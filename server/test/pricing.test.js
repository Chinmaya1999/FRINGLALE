import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrice, describeSupport, PricingError, DEFAULT_SETTINGS } from '../src/services/pricing.js';

const design = {
  category: 'ring', baseWeight: 4, makingType: 'percent', makingValue: 12,
  allowedMetals: ['yellow-22K', 'platinum-950'], allowedStoneTypes: ['natural-diamond'],
  allowedShapes: ['round', 'oval'], allowedQualities: ['VS-GH'], allowedSizes: ['10', '12'],
  caratRange: { min: 0.2, max: 2 }, engravingMaxChars: 10,
  model3d: {
    assetVariants: [{ key: 'round', stoneShape: 'round', glbUrl: '/m/round.glb' }],
    assetBackedMetals: ['yellow-22K'], explodedView: false,
  },
  simulated: [], manufacturing: { status: 'cad_ready' },
};
const metal = { key: 'yellow-22K', rateKey: '22K', densityFactor: 1.1 };
const rates = { '22K': 6000, platinum: 3000 };
const stonePrice = { pricePerCarat: 50000 };
const config = { metal: 'yellow-22K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', carat: 0.5, size: '12', engraving: '' };
const run = (over = {}, extra = {}) =>
  computePrice({ design, metal, rates, stonePrice, settings: DEFAULT_SETTINGS, config: { ...config, ...over }, ...extra });

test('follows the specified formula', () => {
  const p = run();
  assert.equal(p.finalWeight, 4.4);                    // 4 × 1 × 1.1
  assert.equal(p.metalPrice, 26400);                   // 6000 × 4.4
  assert.equal(p.makingCharge, 3168);                  // 12%
  assert.equal(p.stonePrice, 25000);                   // 0.5 × 50000
  assert.equal(p.extras.insurance, 272.84);            // 0.5% of 54568
  assert.equal(p.subtotal, 54840.84);
  assert.equal(p.gst, 1645.23);                        // 3%
  assert.equal(p.total, 56486.07);
});

test('per-gram making charge', () => {
  const p = run({}, { design: { ...design, makingType: 'perGram', makingValue: 800 } });
  assert.equal(p.makingCharge, 3520);                  // 800 × 4.4
});

test('size factor scales weight', () => {
  const p = run({}, { settings: { ...DEFAULT_SETTINGS, sizeFactors: { ring: { 12: 1.25 } } } });
  assert.equal(p.finalWeight, 5.5);
});

test('engraving and gift box are added to extras', () => {
  const p = run({ engraving: 'A+B', giftBox: true });
  assert.equal(p.extras.engraving, 500);
  assert.equal(p.extras.giftBox, 750);
});

test('rejects configs the design does not allow', () => {
  assert.throws(() => run({ metal: 'silver-925' }), PricingError);
  assert.throws(() => run({ shape: 'heart' }), /not available/);
  assert.throws(() => run({ carat: 5 }), /between/);
  assert.throws(() => run({ engraving: 'x'.repeat(11) }), /limited/);
});

test('missing gold rate or stone price fails loudly, never prices at zero', () => {
  assert.throws(() => run({}, { rates: {} }), /No gold rate/);
  assert.throws(() => run({}, { stonePrice: null }), /No price/);
});

test('support: asset-backed only when shape variant AND metal are real assets', () => {
  assert.equal(describeSupport(design, config).assetBacked, true);
  const oval = describeSupport(design, { ...config, shape: 'oval' });
  assert.equal(oval.assetBacked, false);
  assert.ok(oval.simulatedFeatures.includes('stone-shape'));
  const plat = describeSupport(design, { ...config, metal: 'platinum-950' });
  assert.ok(plat.simulatedFeatures.includes('metal-finish'));
});

test('support: exploded view only when model supports it; manufacturing state surfaced', () => {
  assert.deepEqual(describeSupport(design, config).components, []);
  assert.equal(describeSupport(design, config).approvedForManufacturing, false);
  const d2 = { ...design, model3d: { ...design.model3d, explodedView: true, components: [{ id: 'head' }] }, manufacturing: { status: 'approved_for_manufacturing' } };
  const s = describeSupport(d2, config);
  assert.equal(s.components.length, 1);
  assert.equal(s.approvedForManufacturing, true);
});

import { checkTransition } from '../src/services/stages.js';

test('stage gate: production blocked until customer approves', () => {
  const o = { stage: 'customer_approval', payment: { paid: 1 }, approval: { status: 'pending', media: ['/uploads/a.jpg'] } };
  assert.match(checkTransition(o, 'wax_model'), /approves/);
  o.approval.status = 'changes_requested';
  assert.match(checkTransition(o, 'wax_model'), /approves/);
  o.approval.status = 'approved';
  assert.equal(checkTransition(o, 'wax_model'), null);
});

test('stage gate: no skipping, media needed for approval, HUID and tracking enforced', () => {
  assert.match(checkTransition({ stage: 'order_placed', payment: { paid: 1 }, approval: {} }, 'casting'), /skipped/);
  assert.match(checkTransition({ stage: 'order_placed', payment: { paid: 0 }, approval: {} }, 'design_cad_ready'), /payment/);
  assert.match(checkTransition({ stage: 'design_cad_ready', payment: { paid: 1 }, approval: { media: [] } }, 'customer_approval'), /Upload/);
  const base = { approval: { status: 'approved' }, payment: { paid: 1, status: 'paid' } };
  assert.match(checkTransition({ ...base, stage: 'hallmarking' }, 'quality_check'), /HUID/);
  assert.match(checkTransition({ ...base, stage: 'quality_check' }, 'shipped'), /tracking/);
  assert.match(checkTransition({ ...base, stage: 'quality_check', trackingNumber: 'X', payment: { paid: 1, status: 'partial' } }, 'shipped'), /Balance/);
});

test('support: parametric-only design is never reported as a real asset', () => {
  const d = { ...design, model3d: { procedural: 'halo-ring', assetVariants: [], assetBackedMetals: [] }, simulated: ['parametric-model'] };
  const s = describeSupport(d, config);
  assert.equal(s.assetBacked, false);
  assert.equal(s.glbUrl, null);
  assert.ok(s.simulatedFeatures.includes('parametric-model'));
  assert.ok(s.simulatedFeatures.includes('stone-size'));
});
