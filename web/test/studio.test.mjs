import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../lib/config.js';
import { buildViewerItem, PROXY_GLB } from '../lib/viewerItem.js';

const matrix = { 'natural-diamond': { round: ['VS-GH', 'SI-IJ'], oval: ['VS-GH'] } };
const design = {
  category: 'ring', allowedMetals: ['white-18K', 'yellow-18K'], allowedStoneTypes: ['natural-diamond'],
  allowedShapes: ['oval', 'round', 'heart'], allowedQualities: ['VS-GH', 'SI-IJ', 'AAA'], allowedSizes: ['10', '12', '14'],
  caratRange: { min: 0.8, max: 2 }, simulated: [], model3d: { assetVariants: [{ key: 'round', stoneShape: 'round', glbUrl: '/m/r.glb' }] },
};

test('defaultConfig only picks priced, allowed combinations', () => {
  const c = defaultConfig(design, matrix);
  assert.equal(c.metal, 'yellow-18K');
  assert.equal(c.shape, 'round');                    // heart is allowed but has no price → never chosen
  assert.equal(c.quality, 'VS-GH');
  assert.equal(c.carat, 0.8);                        // clamped into the design's range
  assert.equal(c.size, '12');
});

test('defaultConfig for a no-stone design', () => {
  const c = defaultConfig({ ...design, allowedStoneTypes: [] }, matrix);
  assert.equal(c.stoneType, undefined);
  assert.equal(c.carat, undefined);
});

test('viewer item: real variant vs simulated shape vs proxy model', () => {
  const metals = [{ key: 'yellow-18K', hex: '#D9B04A' }];
  const stones = [{ key: 'natural-diamond', kind: 'diamond' }];
  const cfg = { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', carat: 1 };
  const real = buildViewerItem({ design, config: cfg, support: { glbUrl: '/m/r.glb', variantKey: 'round' }, metals, stones });
  assert.equal(real.realShape, true);
  assert.equal(real.glbUrl, '/m/r.glb');
  const sim = buildViewerItem({ design, config: { ...cfg, shape: 'oval' }, support: { glbUrl: '/m/r.glb', variantKey: null }, metals, stones });
  assert.equal(sim.realShape, false);                // shape scaling will be applied and labelled as simulated
  const proxy = buildViewerItem({ design: { ...design, simulated: ['model-proxy'], model3d: {} }, config: cfg, support: {}, metals, stones });
  assert.equal(proxy.isProxy, true);
  assert.equal(proxy.glbUrl, PROXY_GLB);
});

test('viewer item: parametric style used only when no real shape variant exists', () => {
  const d = { ...design, model3d: { procedural: 'halo-ring', fit: 1.2, assetVariants: [] }, simulated: ['parametric-model'] };
  const cfg = { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', carat: 1 };
  const it = buildViewerItem({ design: d, config: cfg, support: { variantKey: null }, metals: [], stones: [] });
  assert.equal(it.procedural, 'halo-ring');
  assert.equal(it.parametric, true);
  assert.equal(it.isProxy, false);
  assert.equal(it.fit, 1.2);
  const real = buildViewerItem({ design: { ...d, model3d: { ...d.model3d, assetVariants: [{ key: 'round' }] } }, config: cfg, support: { variantKey: 'round', glbUrl: '/m/r.glb' }, metals: [], stones: [] });
  assert.equal(real.procedural, null);
});
