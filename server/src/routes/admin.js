import { Router } from 'express';
import { z } from 'zod';
import { Design, Metal, Stone, StonePrice, Coupon, Review, Setting, User, Order, CustomRequest, Consultation } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { checkTransition } from '../services/stages.js';
import { notifyOrder } from '../services/notify.js';

const r = Router();
r.use(requireAuth);

// ---------- Designer: only assigned requests ----------
r.get('/requests', requireRole('admin', 'designer'), wrap(async (req, res) => {
  const f = req.user.role === 'designer' ? { assignedDesigner: req.user._id } : {};
  res.json({ items: await CustomRequest.find(f).sort({ createdAt: -1 }).populate('user', 'name email mobile').populate('assignedDesigner', 'name').lean() });
}));
r.post('/requests/:id/cad', requireRole('admin', 'designer'), validate(z.object({
  files: z.array(z.string().regex(/^\/uploads\/[\w.]+$/)).min(1).max(10), note: z.string().max(1000).optional(),
})), wrap(async (req, res) => {
  const f = { _id: req.params.id, ...(req.user.role === 'designer' ? { assignedDesigner: req.user._id } : {}) };
  const doc = await CustomRequest.findOne(f);
  if (!doc) throw new HttpError(404, 'Request not found');
  doc.cadFiles.push(...req.body.files);
  doc.status = 'cad_shared';
  if (req.body.note) doc.notes.push({ by: req.user._id, text: req.body.note });
  await doc.save();
  res.json({ request: doc });
}));

// Everything below is admin-only.
r.use(requireRole('admin'));

r.get('/dashboard', wrap(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [byStage, revenue, daily, top, counts] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$stage', n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: null, revenue: { $sum: '$payment.paid' }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: since }, 'payment.paid': { $gt: 0 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, sales: { $sum: '$payment.paid' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.designName', units: { $sum: '$items.qty' } } }, { $sort: { units: -1 } }, { $limit: 5 }]),
    Promise.all([User.countDocuments({ role: 'customer' }), CustomRequest.countDocuments({ status: 'new' }), Consultation.countDocuments({ status: 'booked' })]),
  ]);
  res.json({
    ordersByStage: byStage, revenue: revenue[0]?.revenue || 0, orderCount: revenue[0]?.orders || 0, daily, topDesigns: top,
    customers: counts[0], newRequests: counts[1], pendingConsultations: counts[2],
  });
}));

// ---------- Generic CRUD for catalogue data ----------
function crud(path, Model, { sort = { createdAt: -1 }, allowDelete = true } = {}) {
  r.get(`/${path}`, wrap(async (_req, res) => res.json({ items: await Model.find().sort(sort).lean() })));
  r.post(`/${path}`, wrap(async (req, res) => res.status(201).json({ item: await Model.create(req.body) })));
  r.put(`/${path}/:id`, wrap(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, 'Not found');
    res.json({ item });
  }));
  if (allowDelete) r.delete(`/${path}/:id`, wrap(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.status(204).end();
  }));
}
crud('designs', Design);
crud('metals', Metal);
crud('stones', Stone);
crud('stone-prices', StonePrice);
crud('coupons', Coupon);
crud('reviews', Review, { allowDelete: true });

// Manufacturing approval is its own audited action, never a side effect of editing a design.
r.post('/designs/:id/manufacturing', validate(z.object({ status: z.enum(['concept', 'cad_ready', 'approved_for_manufacturing']) })), wrap(async (req, res) => {
  const d = await Design.findById(req.params.id);
  if (!d) throw new HttpError(404, 'Not found');
  if (req.body.status === 'approved_for_manufacturing' && !d.model3d?.primaryGlbUrl && !d.images?.length) {
    throw new HttpError(422, 'Attach a model or images before approving for manufacturing');
  }
  d.manufacturing = { status: req.body.status, approvedAt: req.body.status === 'approved_for_manufacturing' ? new Date() : undefined, approvedBy: req.user._id };
  await d.save();
  res.json({ design: d });
}));

// ---------- Settings & CMS ----------
r.get('/settings', wrap(async (_req, res) => res.json({ items: await Setting.find().lean() })));
r.put('/settings/:key', validate(z.object({ value: z.any() })), wrap(async (req, res) => {
  const s = await Setting.findOneAndUpdate({ key: req.params.key }, { value: req.body.value }, { upsert: true, new: true });
  res.json({ setting: s });
}));

// ---------- Orders ----------
r.get('/orders', wrap(async (req, res) => {
  const f = req.query.stage ? { stage: String(req.query.stage) } : {};
  res.json({ items: await Order.find(f).sort({ createdAt: -1 }).limit(200).populate('user', 'name email mobile').lean() });
}));
r.get('/orders/:id', wrap(async (req, res) => {
  const o = await Order.findById(req.params.id).populate('user', 'name email mobile').lean();
  if (!o) throw new HttpError(404, 'Not found');
  res.json({ order: o });
}));

r.post('/orders/:id/stage', validate(z.object({ stage: z.string(), note: z.string().max(500).optional() })), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Not found');
  const err = checkTransition(o, req.body.stage);
  if (err) throw new HttpError(422, err, 'STAGE_BLOCKED');
  o.stage = req.body.stage;
  if (o.stage === 'customer_approval') { o.approval.status = 'pending'; o.approval.comment = undefined; o.approval.decidedAt = undefined; }
  o.stageHistory.push({ stage: o.stage, by: req.user._id, note: req.body.note });
  await o.save();
  notifyOrder(await User.findById(o.user), o, 'stage');
  res.json({ order: o });
}));

r.patch('/orders/:id', validate(z.object({
  huid: z.string().regex(/^[A-Z0-9]{6}$/, 'HUID is 6 alphanumeric characters').optional(),
  trackingNumber: z.string().max(60).optional(), courier: z.string().max(40).optional(),
  approvalMedia: z.array(z.string().regex(/^\/uploads\/[\w.]+$/)).max(10).optional(),
  certificates: z.array(z.object({ name: z.string().max(80), url: z.string().regex(/^\/uploads\/[\w.]+$/) })).max(10).optional(),
}).strict()), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Not found');
  const { approvalMedia, certificates, ...rest } = req.body;
  Object.assign(o, rest);
  if (rest.huid) o.items.forEach((i) => { i.huid = rest.huid; });
  if (approvalMedia) {
    o.approval.media.push(...approvalMedia);
    // Customer asked for changes and new media arrived → re-open approval.
    if (o.stage === 'customer_approval' && o.approval.status === 'changes_requested') o.approval.status = 'pending';
  }
  if (certificates) o.certificates.push(...certificates);
  await o.save();
  res.json({ order: o });
}));

// ---------- Requests, consultations, people ----------
r.post('/requests/:id/assign', validate(z.object({ designerId: z.string() })), wrap(async (req, res) => {
  const d = await User.findOne({ _id: req.body.designerId, role: 'designer' });
  if (!d) throw new HttpError(422, 'Not a designer');
  const doc = await CustomRequest.findByIdAndUpdate(req.params.id, { assignedDesigner: d._id, status: 'assigned' }, { new: true });
  res.json({ request: doc });
}));
r.get('/consultations', wrap(async (_req, res) => {
  res.json({ items: await Consultation.find().sort({ date: -1 }).populate('user', 'name email mobile').lean() });
}));
r.put('/consultations/:id', validate(z.object({
  status: z.enum(['booked', 'confirmed', 'completed', 'cancelled']).optional(), assignedDesigner: z.string().optional(), meetingLink: z.string().url().optional(),
})), wrap(async (req, res) => res.json({ item: await Consultation.findByIdAndUpdate(req.params.id, req.body, { new: true }) })));

r.get('/customers', wrap(async (_req, res) => res.json({ items: await User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(200).select('name email mobile createdAt').lean() })));
r.get('/designers', wrap(async (_req, res) => res.json({ items: await User.find({ role: 'designer' }).select('name email').lean() })));
r.post('/users/:id/role', validate(z.object({ role: z.enum(['customer', 'designer', 'admin']) })), wrap(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw new HttpError(422, 'You cannot change your own role');
  await User.updateOne({ _id: req.params.id }, { role: req.body.role });
  res.json({ ok: true });
}));

export default r;
