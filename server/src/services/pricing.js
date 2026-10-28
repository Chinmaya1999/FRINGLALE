/**
 * Pure pricing engine — the single source of truth for every price in the system.
 * No I/O here: callers (quote route, cart, checkout, saved designs) load the
 * documents and pass them in, so the exact same math runs everywhere and is unit-testable.
 */

export class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 422;
  }
}

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const DEFAULT_SETTINGS = {
  gstPercent: 3,
  shipping: { flat: 0 },
  extras: { engraving: 500, giftBox: 750, insurancePercent: 0.5, insuranceMin: 250 },
  sizeFactors: {},
};

/** Check a configuration against what the design allows. Returns nothing or throws. */
export function validateConfig(design, config) {
  const bad = (m) => { throw new PricingError('INVALID_CONFIG', m); };
  const { metal, stoneType, shape, quality, carat, size, engraving } = config;

  if (!design.allowedMetals?.includes(metal)) bad(`Metal "${metal}" is not available for this design`);
  if (design.allowedSizes?.length && !design.allowedSizes.includes(String(size))) bad(`Size "${size}" is not available`);

  const hasStone = !!stoneType;
  if (hasStone) {
    if (!design.allowedStoneTypes?.includes(stoneType)) bad(`Stone "${stoneType}" is not available`);
    if (!design.allowedShapes?.includes(shape)) bad(`Shape "${shape}" is not available`);
    if (!design.allowedQualities?.includes(quality)) bad(`Quality "${quality}" is not available`);
    const { min, max } = design.caratRange || {};
    if (!(carat >= min && carat <= max)) bad(`Carat must be between ${min} and ${max}`);
  }
  if (engraving && engraving.length > (design.engravingMaxChars ?? 15)) {
    bad(`Engraving is limited to ${design.engravingMaxChars ?? 15} characters`);
  }
}

/**
 * @param {object} p
 * @param {object} p.design   Design doc (plain object)
 * @param {object} p.metal    Metal doc
 * @param {object} p.rates    goldRates.rates — INR/gram keyed by metal.rateKey
 * @param {object|null} p.stonePrice StonePrice row for the chosen stone (null if no stone)
 * @param {object} p.settings merged settings
 * @param {object} p.config   customer configuration
 */
export function computePrice({ design, metal, rates, stonePrice, settings = DEFAULT_SETTINGS, config }) {
  validateConfig(design, config);

  const ratePerGram = rates?.[metal.rateKey];
  if (!(ratePerGram > 0)) throw new PricingError('NO_RATE', `No gold rate available for ${metal.rateKey}`);

  const sizeTable = design.sizeFactors?.get ? Object.fromEntries(design.sizeFactors) : design.sizeFactors;
  const sizeFactor =
    sizeTable?.[config.size] ?? settings.sizeFactors?.[design.category]?.[config.size] ?? 1;

  const finalWeight = r2(design.baseWeight * sizeFactor * metal.densityFactor * 1000) / 1000; // 3 dp grams
  const metalPrice = r2(ratePerGram * finalWeight);

  const makingCharge = r2(
    design.makingType === 'perGram'
      ? design.makingValue * finalWeight
      : (metalPrice * design.makingValue) / 100,
  );

  let stoneLine = 0;
  if (config.stoneType) {
    if (!stonePrice) {
      throw new PricingError('NO_STONE_PRICE',
        `No price for ${config.stoneType}/${config.shape}/${config.quality}`);
    }
    stoneLine = r2(config.carat * stonePrice.pricePerCarat);
  }

  const ex = { ...DEFAULT_SETTINGS.extras, ...settings.extras };
  const engraving = config.engraving?.trim() ? ex.engraving : 0;
  const giftBox = config.giftBox ? ex.giftBox : 0;
  const base = metalPrice + makingCharge + stoneLine;
  const insurance = config.insurance === false ? 0 : r2(Math.max(ex.insuranceMin, (base * ex.insurancePercent) / 100));
  const extras = r2(engraving + giftBox + insurance);

  const subtotal = r2(base + extras);
  const gstPercent = settings.gstPercent ?? DEFAULT_SETTINGS.gstPercent;
  const gst = r2((subtotal * gstPercent) / 100);
  const shipping = r2(settings.shipping?.flat ?? 0);
  const total = r2(subtotal + gst + shipping);

  return {
    inputs: { ratePerGram, rateKey: metal.rateKey, sizeFactor, densityFactor: metal.densityFactor, baseWeight: design.baseWeight },
    finalWeight,
    metalPrice,
    makingCharge,
    makingBasis: design.makingType === 'perGram' ? `₹${design.makingValue}/g` : `${design.makingValue}%`,
    stonePrice: stoneLine,
    extras: { engraving, giftBox, insurance, total: extras },
    subtotal,
    gstPercent,
    gst,
    shipping,
    total,
    currency: 'INR',
  };
}

/**
 * What is real vs. simulated for this exact configuration. The UI renders this verbatim
 * so customers are never misled about what they are looking at.
 *   assetBacked: a dedicated GLB exists for the chosen stone shape (and metal is asset-backed)
 *   simulated:   features the viewer approximates with shaders/procedural geometry
 *   manufacturing: concept | cad_ready | approved_for_manufacturing
 */
export function describeSupport(design, config) {
  const m = design.model3d || {};
  const variant = m.assetVariants?.find((v) => v.stoneShape === config.shape) || null;
  const metalBacked = !!m.assetBackedMetals?.includes(config.metal);
  const simulated = new Set(design.simulated || []);

  if (!variant) simulated.add('stone-shape');
  if (!metalBacked) simulated.add('metal-finish');
  if (config.engraving) simulated.add('engraving');
  if (config.stoneType) simulated.add('stone-size');   // carat is scaled visually, not modelled per carat weight
  if (config.stoneType && config.stoneType !== 'natural-diamond' && config.stoneType !== 'lab-grown-diamond') {
    simulated.add('gemstone-colour');
  }

  return {
    assetBacked: !!variant && metalBacked,
    variantKey: variant?.key ?? null,
    glbUrl: variant?.glbUrl ?? m.primaryGlbUrl ?? null,
    simulatedFeatures: [...simulated],
    explodedView: !!m.explodedView,
    components: m.explodedView ? m.components || [] : [],
    manufacturingStatus: design.manufacturing?.status || 'concept',
    approvedForManufacturing: design.manufacturing?.status === 'approved_for_manufacturing',
  };
}
