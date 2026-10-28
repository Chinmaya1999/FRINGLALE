import { Router } from 'express';
import { z } from 'zod';
import { SavedDesign, Design } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { quote } from '../services/quote.js';
import { configInput } from './pricing.js';

const r = Router();
r.use(requireAuth);

const body = z.object({ designSlug: z.string(), name: z.string().trim().max(80).optional(), config: configInput });

// Every save is validated and priced by the same engine as checkout, so a saved design can never hold an unsupported config.
r.post('/', validate(body), wrap(async (req, res) => {
  const q = await quote({ designSlug: req.body.designSlug, config: req.body.config });
  const doc = await SavedDesign.create({
    user: req.user._id, design: q.design.id, name: req.body.name || q.design.name, config: req.body.config,
    supportSnapshot: {
      assetBacked: q.support.assetBacked, simulatedFeatures: q.support.simulatedFeatures,
      manufacturingStatus: q.support.manufacturingStatus,
    },
    lastQuote: { total: q.price.total, goldRateDate: q.goldRate.date, quotedAt: new Date() },
  });
  res.status(201).json({ saved: doc, quote: q });
}));

r.get('/', wrap(async (req, res) => {
  const items = await SavedDesign.find({ user: req.user._id }).sort({ updatedAt: -1 }).populate('design', 'slug name images category').lean();
  res.json({ items });
}));

// Re-price a saved design at today's gold rate.
r.get('/:id', wrap(async (req, res) => {
  const s = await SavedDesign.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!s) throw new HttpError(404, 'Saved design not found');
  const d = await Design.findById(s.design).lean();
  if (!d) throw new HttpError(410, 'This design is no longer available');
  res.json({ saved: s, quote: await quote({ designId: d._id, config: s.config }) });
}));

r.delete('/:id', wrap(async (req, res) => {
  const out = await SavedDesign.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!out.deletedCount) throw new HttpError(404, 'Saved design not found');
  res.status(204).end();
}));

export default r;
