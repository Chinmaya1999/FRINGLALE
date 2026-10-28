import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { Cart, Order, Payment, Coupon, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { priceCart } from '../services/checkout.js';
import { createGatewayOrder, verifySignature, verifyWebhook, paymentsMode, publicKeyId } from '../services/razorpay.js';
import { streamInvoice } from '../services/invoice.js';
import { notifyOrder } from '../services/notify.js';
import { istDate } from '../services/goldRate.js';

const r = Router();

const orderNo = () => `FRG-${istDate().replace(/-/g, '').slice(2)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const address = z.object({
  name: z.string().min(2).max(80), phone: z.string().regex(/^[6-9]\d{9}$/), line1: z.string().min(3).max(200), line2: z.string().max(200).optional(),
  city: z.string().min(2).max(60), state: z.string().min(2).max(60), pincode: z.string().regex(/^\d{6}$/),
});

async function capture(payment, razorpayPaymentId, raw) {
  // Idempotent: webhook and client verify can both arrive.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'captured' } },
    { status: 'captured', razorpayPaymentId, raw }, { new: true });
  if (!claimed) return false;
  const order = await Order.findById(payment.order);
  order.payment.paid = r2(order.payment.paid + payment.amount);
  order.payment.due = r2(Math.max(0, order.priceBreakdown.total - order.payment.paid));
  order.payment.status = order.payment.due > 0 ? 'partial' : 'paid';
  if (order.stageHistory.length === 0) order.stageHistory.push({ stage: 'order_placed', note: 'Payment received' });
  await order.save();
  if (order.coupon?.code) await Coupon.updateOne({ code: order.coupon.code }, { $inc: { used: 1 } });
  await Cart.updateOne({ user: order.user }, { $set: { items: [] }, $unset: { coupon: 1, lock: 1 } });
  notifyOrder(await User.findById(order.user), order, order.payment.paid === payment.amount ? 'placed' : 'payment');
  return true;
}

// Raw body is mounted in app.js for this route.
r.post('/payments/webhook', wrap(async (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  if (!Buffer.isBuffer(req.body) || !sig || !verifyWebhook(req.body, sig)) throw new HttpError(400, 'Bad signature');
  const evt = JSON.parse(req.body.toString());
  if (evt.event === 'payment.captured') {
    const e = evt.payload.payment.entity;
    const p = await Payment.findOne({ razorpayOrderId: e.order_id });
    if (p) await capture(p, e.id, e);
  }
  res.json({ ok: true });
}));

r.use(['/orders', '/payments/verify'], requireAuth);

r.post('/orders', validate(z.object({ address, paymentMode: z.enum(['full', 'advance']).default('full') })), wrap(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart?.items.length) throw new HttpError(422, 'Cart is empty');
  if (!cart.lock?.expiresAt || cart.lock.expiresAt < new Date()) throw new HttpError(409, 'Price lock expired. Please refresh your price.', 'LOCK_EXPIRED');
  if (paymentsMode() === 'unavailable') throw new HttpError(503, 'Payments are not configured');

  const priced = await priceCart(cart.items, { lockedRates: cart.lock.rates, couponCode: cart.coupon });
  const total = priced.totals.total;
  const payNow = req.body.paymentMode === 'advance' ? r2((total * priced.advancePercent) / 100) : total;

  const order = await Order.create({
    orderNo: orderNo(), user: req.user._id, address: req.body.address,
    items: priced.lines.map((l) => ({
      design: l.design, designName: l.designName, config: l.config, qty: l.qty, priceBreakdown: l.quote.price,
      manufacturingStatusAtOrder: l.quote.support.manufacturingStatus,
    })),
    lockedGoldRate: { rates: cart.lock.rates, date: istDate(), lockedAt: new Date(cart.lock.expiresAt.getTime() - 15 * 60000), expiresAt: cart.lock.expiresAt },
    priceBreakdown: priced.totals, coupon: priced.coupon || undefined,
    payment: { mode: req.body.paymentMode, paid: 0, due: total, status: 'pending' },
    stage: 'order_placed',
  });
  let gw;
  try { gw = await createGatewayOrder(payNow, order.orderNo); }
  catch (e) {
    await Order.deleteOne({ _id: order._id });          // don't leave an unpayable order behind
    console.error('[payments] gateway order failed:', e.message);
    throw new HttpError(502, 'Payment provider is unavailable. Please try again.');
  }
  await Payment.create({ order: order._id, user: req.user._id, razorpayOrderId: gw.id, amount: payNow, kind: req.body.paymentMode });
  res.status(201).json({ order, gateway: { mode: paymentsMode(), keyId: publicKeyId(), orderId: gw.id, amount: gw.amount, currency: 'INR' } });
}));

r.post('/payments/verify', validate(z.object({
  razorpayOrderId: z.string(), razorpayPaymentId: z.string(), signature: z.string(),
})), wrap(async (req, res) => {
  const p = await Payment.findOne({ razorpayOrderId: req.body.razorpayOrderId, user: req.user._id });
  if (!p) throw new HttpError(404, 'Payment not found');
  const dev = paymentsMode() === 'dev' && req.body.signature === 'dev';
  if (!dev && !verifySignature(req.body.razorpayOrderId, req.body.razorpayPaymentId, req.body.signature)) {
    await Payment.updateOne({ _id: p._id, status: 'created' }, { status: 'failed' });
    throw new HttpError(400, 'Payment verification failed');
  }
  await capture(p, req.body.razorpayPaymentId, { dev });
  res.json({ order: await Order.findById(p.order) });
}));

// Pay the remaining balance of an advance order.
r.post('/orders/:id/pay-balance', wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o || o.payment.due <= 0) throw new HttpError(404, 'No balance due');
  const gw = await createGatewayOrder(o.payment.due, o.orderNo);
  await Payment.create({ order: o._id, user: req.user._id, razorpayOrderId: gw.id, amount: o.payment.due, kind: 'balance' });
  res.json({ gateway: { mode: paymentsMode(), keyId: publicKeyId(), orderId: gw.id, amount: gw.amount, currency: 'INR' } });
}));

r.get('/orders', wrap(async (req, res) => {
  res.json({ items: await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).select('-items.priceBreakdown').lean() });
}));

r.get('/orders/:id', wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!o) throw new HttpError(404, 'Order not found');
  res.json({ order: o });
}));

r.get('/orders/:id/invoice', wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!o || !o.payment.paid) throw new HttpError(404, 'Invoice not available');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${o.orderNo}.pdf"`);
  streamInvoice(o, req.user, res);
}));

// Customer approval of CAD / wax. Production is blocked server-side until status === 'approved'.
r.post('/orders/:id/approval', validate(z.object({
  decision: z.enum(['approve', 'changes']), comment: z.string().trim().max(1000).optional(),
})), wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new HttpError(404, 'Order not found');
  if (o.stage !== 'customer_approval' || o.approval.status !== 'pending') throw new HttpError(409, 'Nothing to approve right now');
  if (req.body.decision === 'changes' && !req.body.comment) throw new HttpError(422, 'Please describe the changes you need');
  o.approval.status = req.body.decision === 'approve' ? 'approved' : 'changes_requested';
  o.approval.comment = req.body.comment;
  o.approval.decidedAt = new Date();
  o.stageHistory.push({ stage: 'customer_approval', by: req.user._id, note: req.body.decision === 'approve' ? 'Customer approved' : `Changes requested: ${req.body.comment}` });
  await o.save();
  res.json({ order: o });
}));

export default r;
