import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROCEDURAL_STYLES, blankDesign, toPayload, fromDesign, slugify } from '../lib/designOptions.js';

test('editor style list matches the server allow-list and the studio builders', () => {
  const server = fs.readFileSync(new URL('../../server/src/services/designCheck.js', import.meta.url), 'utf8');
  const serverList = [...server.match(/PROCEDURAL_STYLES = \[([^\]]+)\]/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(PROCEDURAL_STYLES.map((s) => s[0]).sort(), serverList);
});

test('slugify', () => { assert.equal(slugify('  Lumière Halo — Pendant! '), 'lumiere-halo-pendant'); assert.equal(slugify('A  B_C'), 'a-b-c'); });

test('blank bullion draft is weight-based with per-gram making and factor = grams', () => {
  const b = blankDesign('bar');
  assert.equal(b.makingType, 'perGram'); assert.equal(b.baseWeight, 1); assert.equal(b.sizeFactors['100'], 100); assert.equal(b.model3d.procedural, 'gold-bar');
  assert.equal(b.isActive, false);                                    // new designs start as drafts
});

test('payload: strips client-only fields, drops stone fields for no-stone designs, never sends manufacturing', () => {
  const f = { ...blankDesign('ring'), slug: 'x-ring', name: ' X ', allowedMetals: ['yellow-18K'], allowedShapes: ['round'], allowedQualities: ['VS-GH'], _id: 'abc', manufacturing: { status: 'approved_for_manufacturing' }, createdAt: 'now' };
  f.model3d.useGlb = false;
  const p = toPayload(f);
  assert.equal(p.name, 'X');
  assert.deepEqual(p.allowedShapes, []);                              // no stone types → no shapes/qualities
  for (const k of ['_id', 'manufacturing', 'createdAt', 'updatedAt', '__v']) assert.ok(!(k in p), k);
  assert.ok(!('useGlb' in p.model3d));
  assert.deepEqual(p.simulated, ['parametric-model']);
});

test('payload: GLB mode drops the procedural style and marks nothing simulated; round-trips through fromDesign', () => {
  const f = { ...blankDesign('ring'), slug: 'g', name: 'Glb Ring', allowedMetals: ['yellow-18K'], allowedStoneTypes: ['natural-diamond'], allowedShapes: ['round'], allowedQualities: ['VS-GH'] };
  f.model3d = { ...f.model3d, useGlb: true, primaryGlbUrl: '/uploads/a.glb', assetVariants: [{ stoneShape: 'round', glbUrl: '/uploads/a.glb' }], components: [{ id: 'band', label: '', meshName: 'band' }], explodedView: true };
  const p = toPayload(f);
  assert.equal(p.model3d.procedural, undefined); assert.deepEqual(p.simulated, []);
  assert.equal(p.model3d.assetVariants[0].key, 'round'); assert.equal(p.model3d.components[0].label, 'band'); assert.equal(p.model3d.explodedView, true);
  assert.equal(fromDesign(p).model3d.useGlb, true);
});
