import { Router } from 'express';
import { z } from 'zod';
import { Cart, Design, GoldRate } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { quote } from '../services/quote.js';
import { priceCart } from '../services/checkout.js';
import { latestRate } from '../services/goldRate.js';
import { env } from '../config/env.js';
import { configInput } from './pricing.js';

const r = Router();
r.use(requireAuth);

const getCart = async (userId) => (await Cart.findOne({ user: userId })) || Cart.create({ user: userId, items: [] });
const activeLock = (c) => (c.lock?.expiresAt && c.lock.expiresAt > new Date() ? c.lock : null);

async function view(cart) {
  const lock = activeLock(cart);
  if (!cart.items.length) return { items: [], totals: null, lock: null };
  const priced = await priceCart(cart.items, { lockedRates: lock?.rates, couponCode: cart.coupon });
  return {
    items: priced.lines.map((l, i) => ({ id: cart.items[i]._id, designName: l.designName, config: l.config, qty: l.qty, quote: l.quote })),
    totals: priced.totals, coupon: priced.coupon, advancePercent: priced.advancePercent,
    lock: lock ? { expiresAt: lock.expiresAt, rates: lock.rates } : null,
  };
}

r.get('/', wrap(async (req, res) => res.json(await view(await getCart(req.user._id)))));

r.post('/items', validate(z.object({ designSlug: z.string(), config: configInput, qty: z.number().int().min(1).max(5).default(1) })),
  wrap(async (req, res) => {
    const q = await quote({ designSlug: req.body.designSlug, config: req.body.config }); // validates the config
    const cart = await getCart(req.user._id);
    cart.items.push({ design: q.design.id, config: req.body.config, qty: req.body.qty });
    cart.lock = undefined;                                  // any change invalidates a price lock
    await cart.save();
    res.status(201).json(await view(cart));
  }));

r.delete('/items/:itemId', wrap(async (req, res) => {
  const cart = await getCart(req.user._id);
  cart.items.pull({ _id: req.params.itemId });
  cart.lock = undefined;
  await cart.save();
  res.json(await view(cart));
}));

r.post('/coupon', validate(z.object({ code: z.string().max(30).nullable() })), wrap(async (req, res) => {
  const cart = await getCart(req.user._id);
  cart.coupon = req.body.code?.toUpperCase() || undefined;
  await priceCart(cart.items, { couponCode: cart.coupon });   // throws if invalid
  await cart.save();
  res.json(await view(cart));
}));

// Lock today's rate for PRICE_LOCK_MINUTES. The order is later priced with exactly these rates.
r.post('/lock', wrap(async (req, res) => {
  const cart = await getCart(req.user._id);
  if (!cart.items.length) throw new HttpError(422, 'Cart is empty');
  const rate = await latestRate();
  if (!rate) throw new HttpError(503, 'Gold rate unavailable');
  cart.lock = { goldRateId: rate._id, rates: rate.rates, expiresAt: new Date(Date.now() + env.priceLockMinutes * 60000) };
  await cart.save();
  res.json(await view(cart));
}));

export default r;
