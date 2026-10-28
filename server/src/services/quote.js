import { Design, Metal, StonePrice } from '../models/index.js';
import { computePrice, describeSupport, PricingError } from './pricing.js';
import { getSettings } from './settings.js';
import { latestRate } from './goldRate.js';
import { HttpError } from '../utils/http.js';

/**
 * Price a configuration. Pass `lockedRates` (from a cart/order lock) to price against a
 * previously locked gold rate instead of today's live rate.
 */
export async function quote({ designId, designSlug, config, lockedRates = null }) {
  const design = await Design.findOne(designId ? { _id: designId } : { slug: designSlug }).lean();
  if (!design || !design.isActive) throw new HttpError(404, 'Design not found');

  const [metal, settings, live] = await Promise.all([
    Metal.findOne({ key: config.metal, isActive: true }).lean(),
    getSettings(),
    lockedRates ? null : latestRate(),
  ]);
  if (!metal) throw new PricingError('INVALID_CONFIG', `Unknown metal "${config.metal}"`);
  const rates = lockedRates || live?.rates;
  if (!rates) throw new PricingError('NO_RATE', 'Gold rate has not been set');

  const stonePrice = config.stoneType
    ? await StonePrice.findOne({ stoneType: config.stoneType, shape: config.shape, quality: config.quality }).lean()
    : null;

  const price = computePrice({ design, metal, rates, stonePrice, settings, config });
  return {
    design: { id: design._id, slug: design.slug, name: design.name, category: design.category },
    price,
    support: describeSupport(design, config),
    goldRate: lockedRates ? { locked: true } : { date: live.date, source: live.source, updatedAt: live.createdAt },
  };
}
