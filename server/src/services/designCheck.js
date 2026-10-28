import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { Metal, Stone, StonePrice } from '../models/index.js';
import { latestRate } from './goldRate.js';
import { getSettings } from './settings.js';
import { computePrice } from './pricing.js';

export const CATEGORIES = ['ring', 'pendant', 'earring', 'necklace', 'bangle', 'bar', 'coin', 'gold-item'];
export const COLLECTIONS = ['bridal', 'red-carpet', 'heritage', 'everyday', 'signature', 'bullion'];
export const OCCASIONS = ['wedding', 'engagement', 'gifting', 'daily', 'investment', 'festival'];
// Parametric preview styles implemented in web/components/studio/procedural.js (a test keeps this list in sync).
export const PROCEDURAL_STYLES = ['plain-band', 'halo-ring', 'three-stone-ring', 'eternity-band', 'cocktail-ring', 'halo-pendant', 'teardrop-pendant', 'stud-earrings', 'drop-earrings', 'riviere-necklace', 'gold-bar', 'gold-coin', 'engraved-coin', 'kada-bangle', 'tennis-bangle'];

const url = z.string().max(300).regex(/^(\/[\w./-]+|https:\/\/[^\s]+)$/, 'Must be an uploaded file path or https URL');
const strs = z.array(z.string().trim().min(1).max(40)).max(40);

export const designInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes').max(80),
  name: z.string().trim().min(2).max(100),
  category: z.enum(CATEGORIES),
  series: z.enum(COLLECTIONS).nullish(),
  description: z.string().max(2000).optional().default(''),
  occasions: z.array(z.enum(OCCASIONS)).max(6).default([]),
  images: z.array(url).max(12).default([]),
  baseWeight: z.number().positive().max(5000),
  makingType: z.enum(['percent', 'perGram']),
  makingValue: z.number().min(0).max(100000),
  allowedMetals: strs.min(1),
  allowedStoneTypes: strs.default([]),
  allowedShapes: strs.default([]),
  allowedQualities: strs.default([]),
  allowedSizes: strs.min(1),
  sizeFactors: z.record(z.string(), z.number().positive().max(10000)).optional(),
  caratRange: z.object({ min: z.number().min(0.01), max: z.number().max(50) }).prefault({ min: 0.1, max: 3 }),
  stoneCount: z.number().int().min(1).max(200).default(1),
  engravingMaxChars: z.number().int().min(0).max(60).default(15),
  model3d: z.object({
    primaryGlbUrl: url.optional(),
    procedural: z.enum(PROCEDURAL_STYLES).optional(),
    fit: z.number().min(0.3).max(4).optional(),
    assetVariants: z.array(z.object({ key: z.string().max(40), stoneShape: z.string().max(40).optional(), glbUrl: url, sizeBytes: z.number().optional(), triangles: z.number().optional(), lodUrls: z.object({ low: url.optional(), mid: url.optional() }).optional() })).max(12).default([]),
    assetBackedMetals: strs.default([]),
    explodedView: z.boolean().default(false),
    components: z.array(z.object({ id: z.string().max(40), label: z.string().max(60), meshName: z.string().max(60) })).max(20).default([]),
    dimensionsMm: z.object({ width: z.number().optional(), height: z.number().optional(), depth: z.number().optional(), bandWidth: z.number().optional() }).optional(),
    annotations: z.array(z.object({ label: z.string().max(60), meshName: z.string().max(60), valueMm: z.number() })).max(20).default([]),
  }).prefault({}),
  simulated: strs.default([]),
  isActive: z.boolean().default(true),
  featured: z.boolean().default(false),
}).strict().superRefine((d, ctx) => {
  if (d.caratRange.min >= d.caratRange.max) ctx.addIssue({ code: 'custom', path: ['caratRange'], message: 'Minimum carat must be below maximum' });
});

/** Problems that would make a design unquotable or misleading. `error` blocks activating a design; `warn` is advice. */
export async function checkDesign(d) {
  const out = [];
  const err = (m) => out.push({ level: 'error', message: m });
  const warn = (m) => out.push({ level: 'warn', message: m });

  const [metals, rate, settings] = await Promise.all([Metal.find({ key: { $in: d.allowedMetals }, isActive: true }).lean(), latestRate(), getSettings()]);
  const byKey = Object.fromEntries(metals.map((m) => [m.key, m]));
  for (const k of d.allowedMetals) {
    if (!byKey[k]) err(`Metal "${k}" does not exist or is inactive`);
    else if (!(rate?.rates?.[byKey[k].rateKey] > 0)) err(`No gold rate is set for ${byKey[k].rateKey} (needed by ${k})`);
  }
  const sizeTable = d.sizeFactors || settings.sizeFactors?.[d.category] || {};
  for (const s of d.allowedSizes) if (!(s in sizeTable) && !['std'].includes(s)) warn(`Size "${s}" has no size factor, so its weight will not scale`);

  if (d.allowedStoneTypes.length) {
    if (!d.allowedShapes.length || !d.allowedQualities.length) err('Stones are allowed, but no shapes or qualities are selected');
    const stones = await Stone.find({ key: { $in: d.allowedStoneTypes }, isActive: true }).lean();
    const prices = await StonePrice.find({ stoneType: { $in: d.allowedStoneTypes } }).lean();
    for (const t of d.allowedStoneTypes) {
      if (!stones.some((s) => s.key === t)) { err(`Stone "${t}" does not exist or is inactive`); continue; }
      const priced = prices.filter((p) => p.stoneType === t && d.allowedShapes.includes(p.shape) && d.allowedQualities.includes(p.quality));
      if (!priced.length) err(`No price in the stone price matrix for ${t} with the selected shapes and qualities`);
      else if (priced.length < d.allowedShapes.length * d.allowedQualities.length) warn(`Some ${t} shape/quality combinations have no price and will be hidden from customers`);
    }
  }
  if (!d.images.length) warn('No photos yet — a studio render will be used on cards until you add one');
  if (d.model3d.procedural == null && !d.model3d.primaryGlbUrl && !d.model3d.assetVariants.length) warn('No 3D model: customers will see a generic placeholder ring');
  for (const f of [d.model3d.primaryGlbUrl, ...d.model3d.assetVariants.map((v) => v.glbUrl)].filter((u) => u?.startsWith('/uploads/'))) {
    if (!fs.existsSync(path.resolve('uploads', path.basename(f)))) err(`3D file ${f} is not on the server`);
  }
  if (d.model3d.explodedView && !d.model3d.components.length) err('Exploded view needs at least one component');
  for (const m of d.model3d.assetBackedMetals) if (!d.allowedMetals.includes(m)) warn(`"${m}" is marked asset-backed but is not an allowed metal`);

  // Finally prove it: price the first allowed configuration with the real engine.
  if (!out.some((p) => p.level === 'error') && byKey[d.allowedMetals[0]]) {
    try {
      const stoneType = d.allowedStoneTypes.find((t) => d.allowedShapes.some((s) => d.allowedQualities.some((q) => true)));
      let sp = null, cfg = { metal: d.allowedMetals[0], size: d.allowedSizes[0], engraving: '' };
      if (stoneType) {
        sp = await StonePrice.findOne({ stoneType, shape: { $in: d.allowedShapes }, quality: { $in: d.allowedQualities } }).lean();
        cfg = { ...cfg, stoneType, shape: sp?.shape, quality: sp?.quality, carat: d.caratRange.min };
      }
      computePrice({ design: d, metal: byKey[d.allowedMetals[0]], rates: rate.rates, stonePrice: sp, settings, config: cfg });
    } catch (e) { err(`A trial price could not be calculated: ${e.message}`); }
  }
  return out;
}
