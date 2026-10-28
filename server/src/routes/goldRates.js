import { Router } from 'express';
import { z } from 'zod';
import { GoldRate } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { latestRate, recordRate } from '../services/goldRate.js';

const r = Router();

r.get('/today', wrap(async (_req, res) => {
  const g = await latestRate();
  if (!g) throw new HttpError(404, 'Gold rate not available');
  res.json({ date: g.date, rates: g.rates, source: g.source, updatedAt: g.createdAt });
}));

r.get('/history', wrap(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  // Latest entry per day.
  const rows = await GoldRate.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$date', rates: { $first: '$rates' }, source: { $first: '$source' } } },
    { $sort: { _id: -1 } }, { $limit: days }, { $sort: { _id: 1 } },
  ]);
  res.json({ items: rows.map((x) => ({ date: x._id, rates: x.rates, source: x.source })) });
}));

// Manual override (admin). Appends a new record so history is never rewritten.
r.post('/', requireAuth, requireRole('admin'), validate(z.object({
  rates: z.object({
    '24K': z.number().positive(), '22K': z.number().positive(), '18K': z.number().positive(), '14K': z.number().positive(),
    platinum: z.number().positive(), silver: z.number().positive(),
  }),
})), wrap(async (req, res) => {
  res.status(201).json(await recordRate(req.body.rates, 'manual', req.user._id));
}));

export default r;
