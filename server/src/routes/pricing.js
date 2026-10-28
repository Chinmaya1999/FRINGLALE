import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { wrap } from '../utils/http.js';
import { quote } from '../services/quote.js';

export const configInput = z.object({
  metal: z.string().max(40),
  stoneType: z.string().max(40).optional().nullable().transform((v) => v || undefined),
  shape: z.string().max(40).optional(),
  quality: z.string().max(40).optional(),
  carat: z.number().min(0).max(20).optional(),
  size: z.string().max(10),
  engraving: z.string().max(40).optional().default(''),
  giftBox: z.boolean().optional().default(false),
  insurance: z.boolean().optional().default(true),
});

const r = Router();
// Quote is called on every UI change, so the limit is generous but not unlimited.
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false });

r.post('/quote', limiter, validate(z.object({ designSlug: z.string().max(80), config: configInput })),
  wrap(async (req, res) => res.json(await quote(req.body))));

export default r;
