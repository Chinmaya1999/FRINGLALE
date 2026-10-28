import { Router } from 'express';
import { z } from 'zod';
import { Design, Metal, Stone, StonePrice } from '../models/index.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { describeSupport } from '../services/pricing.js';

const r = Router();

const listQuery = z.object({
  category: z.string().optional(),
  metal: z.string().optional(),
  stone: z.string().optional(),
  occasion: z.string().optional(),
  collection: z.enum(['bridal', 'red-carpet', 'heritage', 'everyday', 'signature']).optional(),
  q: z.string().max(60).optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'weight_asc', 'weight_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const publicDesign = (d) => ({
  ...d,
  // The list view only needs a summary of what the 3D model supports.
  support: describeSupport(d, { metal: d.allowedMetals?.[0], shape: d.allowedShapes?.[0] }),
});

r.get('/designs', validate(listQuery, 'query'), wrap(async (req, res) => {
  const q = req.query;
  const f = { isActive: true };
  if (q.category) f.category = q.category;
  if (q.metal) f.allowedMetals = new RegExp(`^${q.metal.replace(/[^\w-]/g, '')}`);
  if (q.stone) f.allowedStoneTypes = q.stone;
  if (q.occasion) f.occasions = q.occasion;
  if (q.collection) f.collection = q.collection;
  if (q.featured) f.featured = q.featured === 'true';
  if (q.q) f.name = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const sort = { newest: { createdAt: -1 }, weight_asc: { baseWeight: 1 }, weight_desc: { baseWeight: -1 } }[q.sort];
  const [items, total] = await Promise.all([
    Design.find(f).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Design.countDocuments(f),
  ]);
  res.json({ items: items.map(publicDesign), total, page: q.page, pages: Math.ceil(total / q.limit) });
}));

r.get('/designs/:slug', wrap(async (req, res) => {
  const d = await Design.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!d) throw new HttpError(404, 'Design not found');
  res.json({ design: publicDesign(d) });
}));

r.get('/metals', wrap(async (_req, res) => {
  res.json({ items: await Metal.find({ isActive: true }).lean() });
}));

r.get('/stones', wrap(async (_req, res) => {
  const [items, prices] = await Promise.all([Stone.find({ isActive: true }).lean(), StonePrice.find().lean()]);
  // Expose which shape/quality combos are actually priced so the UI never offers an unpriceable choice.
  const matrix = {};
  for (const p of prices) ((matrix[p.stoneType] ??= {})[p.shape] ??= []).push(p.quality);
  res.json({ items, matrix });
}));

export default r;
