import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { boot, shutdown, call, makeUser, fixtures, payDev, ADDRESS } from './helpers.mjs';
import { PROCEDURAL_STYLES } from '../src/services/designCheck.js';

let M, admin, cust;
before(async () => { M = await boot(); await fixtures(); admin = await makeUser('admin'); cust = await makeUser('customer'); });
after(shutdown);

const NEW = () => ({
  slug: 'royal-pendant', name: 'Royal Pendant', category: 'pendant', series: 'signature', description: 'Admin-created pendant',
  occasions: ['gifting'], images: ['/uploads/aa11.jpg'], baseWeight: 2.5, makingType: 'percent', makingValue: 12,
  allowedMetals: ['yellow-18K', 'platinum-950'], allowedStoneTypes: ['natural-diamond'], allowedShapes: ['round'], allowedQualities: ['VS-GH'],
  allowedSizes: ['16', '18'], sizeFactors: { 16: 0.95, 18: 1 }, caratRange: { min: 0.2, max: 1.5 }, stoneCount: 1, engravingMaxChars: 12,
  model3d: { procedural: 'halo-pendant', fit: 1.05 }, simulated: ['parametric-model'], isActive: true, featured: false,
});
const create = (b, t = admin.token) => call('POST', '/admin/designs', { token: t, body: b });

test('admin creates a design; it is immediately visible, quotable, orderable', async () => {
  const r = await create(NEW());
  assert.equal(r.status, 201);
  assert.equal(r.json.design.manufacturing.status, 'concept');                      // new designs never start as "approved"
  const cat = await call('GET', '/designs/royal-pendant');
  assert.equal(cat.status, 200);
  assert.equal(cat.json.design.support.manufacturingStatus, 'concept');
  const q = await call('POST', '/pricing/quote', { body: { designSlug: 'royal-pendant', config: { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', carat: 0.5, size: '18' } } });
  assert.equal(q.status, 200);
  assert.equal(q.json.price.finalWeight, 2.5);
  assert.equal(q.json.price.metalPrice, 22500);
  assert.equal((await call('GET', '/designs?category=pendant')).json.total, 1);
  // …and a customer can buy it end-to-end.
  const c = await makeUser('customer');
  const cfg = { metal: 'platinum-950', size: '16' };
  assert.equal((await call('POST', '/cart/items', { token: c.token, body: { designSlug: 'royal-pendant', config: cfg, qty: 1 } })).status, 201);
  await call('POST', '/cart/lock', { token: c.token });
  const o = await call('POST', '/orders', { token: c.token, body: { address: ADDRESS } });
  assert.equal(o.status, 201);
  assert.equal(o.json.order.items[0].manufacturingStatusAtOrder, 'concept');         // the customer is told, on the order, that CAD approval is still ahead
});

test('validation: bad slugs, unknown fields, wrong types, missing parts, mass assignment', async () => {
  const bad = [
    { ...NEW(), slug: 'Bad Slug!' }, { ...NEW(), slug: '' }, { ...NEW(), name: 'x' }, { ...NEW(), category: 'spaceship' }, { ...NEW(), baseWeight: -1 }, { ...NEW(), baseWeight: 'heavy' },
    { ...NEW(), allowedMetals: [] }, { ...NEW(), allowedSizes: [] }, { ...NEW(), makingType: 'free' }, { ...NEW(), images: ['javascript:alert(1)'] }, { ...NEW(), images: ['http://insecure.example/a.jpg'] },
    { ...NEW(), caratRange: { min: 2, max: 1 } }, { ...NEW(), model3d: { procedural: 'does-not-exist' } }, { ...NEW(), series: 'nonsense' },
    { ...NEW(), manufacturing: { status: 'approved_for_manufacturing' } },                 // approval is a separate audited action
    { ...NEW(), _id: '65a000000000000000000001' }, { ...NEW(), createdAt: new Date() }, { ...NEW(), isAdmin: true },
  ];
  for (const b of bad) assert.equal((await create(b)).status, 400, JSON.stringify(b).slice(0, 80));
  assert.equal(await M.Design.countDocuments({ slug: 'bad-slug' }), 0);
});

test('slug must be unique', async () => {
  assert.equal((await create(NEW())).status, 409);
});

test('readiness check: a design that cannot be priced cannot go live, but can be saved as an inactive draft', async () => {
  const noMetal = { ...NEW(), slug: 'ghost-metal', allowedMetals: ['unobtanium'] };
  const r1 = await create(noMetal);
  assert.equal(r1.status, 422); assert.equal(r1.json.error.code, 'DESIGN_INVALID');
  assert.ok(r1.json.error.problems.some((p) => /unobtanium/.test(p.message)));
  const draft = await create({ ...noMetal, isActive: false });
  assert.equal(draft.status, 201);
  assert.equal((await call('GET', '/designs/ghost-metal')).status, 404);              // drafts are invisible to customers

  const noPrice = { ...NEW(), slug: 'no-price', allowedStoneTypes: ['ruby'], allowedShapes: ['oval'], allowedQualities: ['AAA'] };      // ruby has no oval/AAA price
  const r2 = await create(noPrice);
  assert.equal(r2.status, 422);
  assert.ok(r2.json.error.problems.some((p) => /stone price matrix/.test(p.message)));

  const noRate = { ...NEW(), slug: 'no-rate', allowedMetals: ['bullion-silver-999'] };
  await M.GoldRate.updateMany({}, { $unset: { 'rates.silver': 1 } });
  assert.equal((await create(noRate)).status, 422);                                   // no live silver rate → cannot quote
  await M.GoldRate.updateMany({}, { $set: { 'rates.silver': 150 } });
  assert.equal((await create(noRate)).status, 201);

  const exploded = await create({ ...NEW(), slug: 'bad-explode', model3d: { procedural: 'halo-ring', explodedView: true, components: [] } });
  assert.equal(exploded.status, 422);                                                 // exploded view needs components
  const missingFile = await create({ ...NEW(), slug: 'missing-glb', model3d: { primaryGlbUrl: '/uploads/doesnotexist.glb' } });
  assert.equal(missingFile.status, 422);
});

test('check endpoint reports warnings without saving', async () => {
  const body = { ...NEW(), slug: 'warn-only', images: [], model3d: {} };
  const r = await call('POST', '/admin/designs/check', { token: admin.token, body });
  assert.equal(r.status, 200);
  assert.ok(r.json.problems.some((p) => p.level === 'warn' && /photos/.test(p.message)));
  assert.ok(r.json.problems.some((p) => p.level === 'warn' && /3D model/.test(p.message)));
  assert.ok(!r.json.problems.some((p) => p.level === 'error'));
  assert.equal(await M.Design.countDocuments({ slug: 'warn-only' }), 0);
});

test('uploaded 3D model: GLB uploaded by admin can be attached; photos too', async () => {
  const form = new FormData();
  form.append('files', new Blob([Buffer.from('glTF-binary-placeholder')], { type: 'application/octet-stream' }), 'ring.glb');
  const up = await call('POST', '/uploads', { token: admin.token, raw: form });
  assert.equal(up.status, 201);
  const url = up.json.files[0].url;
  const r = await create({ ...NEW(), slug: 'with-glb', model3d: { primaryGlbUrl: url, assetVariants: [{ key: 'round', stoneShape: 'round', glbUrl: url }], assetBackedMetals: ['yellow-18K'], explodedView: true, components: [{ id: 'band', label: 'Band', meshName: 'band' }] } });
  assert.equal(r.status, 201);
  const d = (await call('GET', '/designs/with-glb')).json.design;
  assert.equal(d.support.assetBacked, true);                                         // real shape variant + asset-backed metal → "Real 3D model"
  const sup = (await call('POST', '/pricing/quote', { body: { designSlug: 'with-glb', config: { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', carat: 0.5, size: '18' } } })).json.support;
  assert.equal(sup.assetBacked, true); assert.equal(sup.glbUrl, url);
  fs.rmSync(path.resolve('uploads', path.basename(url)), { force: true });
});

test('update: edits persist, requires the full valid document, cannot rename onto another slug', async () => {
  const d = await M.Design.findOne({ slug: 'royal-pendant' });
  const r = await call('PUT', `/admin/designs/${d._id}`, { token: admin.token, body: { ...NEW(), name: 'Royal Pendant II', makingValue: 15, featured: true } });
  assert.equal(r.status, 200);
  const live = (await call('GET', '/designs/royal-pendant')).json.design;
  assert.equal(live.name, 'Royal Pendant II'); assert.equal(live.makingValue, 15); assert.equal(live.featured, true);
  assert.equal(live.manufacturing.status, 'concept');                                 // editing must not change manufacturing approval
  assert.equal((await call('PUT', `/admin/designs/${d._id}`, { token: admin.token, body: { name: 'only a name' } })).status, 400);
  assert.equal((await call('PUT', `/admin/designs/${d._id}`, { token: admin.token, body: { ...NEW(), slug: 'test-ring' } })).status, 409);
  assert.equal((await call('PUT', '/admin/designs/65a000000000000000000001', { token: admin.token, body: NEW() })).status, 404);
  assert.equal((await call('PUT', '/admin/designs/not-an-id', { token: admin.token, body: NEW() })).status, 400);
  // Editing an existing active design into an unquotable state is refused too.
  assert.equal((await call('PUT', `/admin/designs/${d._id}`, { token: admin.token, body: { ...NEW(), allowedMetals: ['ghost'] } })).status, 422);
  assert.equal((await call('GET', '/designs/royal-pendant')).json.design.allowedMetals.includes('ghost'), false);
});

test('manufacturing approval is an audited admin action; editing never grants it', async () => {
  const d = await M.Design.findOne({ slug: 'royal-pendant' });
  assert.equal((await call('POST', `/admin/designs/${d._id}/manufacturing`, { token: cust.token, body: { status: 'approved_for_manufacturing' } })).status, 403);
  assert.equal((await call('POST', `/admin/designs/${d._id}/manufacturing`, { token: admin.token, body: { status: 'bogus' } })).status, 400);
  const r = await call('POST', `/admin/designs/${d._id}/manufacturing`, { token: admin.token, body: { status: 'approved_for_manufacturing' } });
  assert.equal(r.status, 200);
  const doc = await M.Design.findById(d._id);
  assert.equal(String(doc.manufacturing.approvedBy), admin.id); assert.ok(doc.manufacturing.approvedAt);
  assert.equal((await call('GET', '/designs/royal-pendant')).json.design.support.approvedForManufacturing, true);
  const nothing = await M.Design.create({ slug: 'bare', name: 'Bare', category: 'ring', baseWeight: 1, makingType: 'percent', makingValue: 1, allowedMetals: ['yellow-18K'], allowedSizes: ['12'] });
  assert.equal((await call('POST', `/admin/designs/${nothing._id}/manufacturing`, { token: admin.token, body: { status: 'approved_for_manufacturing' } })).status, 422);   // nothing to approve
});

test('delete: designs used by orders are archived, never deleted; unused ones are removed', async () => {
  const c = await makeUser('customer');
  await call('POST', '/cart/items', { token: c.token, body: { designSlug: 'royal-pendant', config: { metal: 'yellow-18K', size: '18' }, qty: 1 } });
  await call('POST', '/cart/lock', { token: c.token });
  const o = await call('POST', '/orders', { token: c.token, body: { address: ADDRESS } });
  await payDev(c.token, o.json.gateway);
  const d = await M.Design.findOne({ slug: 'royal-pendant' });
  const r = await call('DELETE', `/admin/designs/${d._id}`, { token: admin.token });
  assert.deepEqual(r.json, { archived: true });
  assert.equal((await call('GET', '/designs/royal-pendant')).status, 404);           // hidden from customers
  assert.equal((await call('GET', `/orders/${o.json.order._id}`, { token: c.token })).status, 200);   // order history intact
  const unused = await M.Design.findOne({ slug: 'ghost-metal' });
  assert.deepEqual((await call('DELETE', `/admin/designs/${unused._id}`, { token: admin.token })).json, { deleted: true });
  assert.equal(await M.Design.countDocuments({ slug: 'ghost-metal' }), 0);
});

test('admin sees inactive and draft designs; customers never do', async () => {
  const adm = (await call('GET', '/admin/designs', { token: admin.token })).json.items.map((d) => d.slug);
  assert.ok(adm.includes('hidden-ring')); assert.ok(adm.includes('royal-pendant'));
  const pub = (await call('GET', '/designs?limit=48')).json.items.map((d) => d.slug);
  assert.ok(!pub.includes('hidden-ring')); assert.ok(!pub.includes('royal-pendant'));
});

test('metals / stones / stone prices / coupons: validated CRUD, unknown fields rejected', async () => {
  const mk = (p, b) => call('POST', p, { token: admin.token, body: b });
  const metal = { key: 'white-18K', family: 'white', karat: '18K', label: '18K White', purity: 0.75, rateKey: '18K', densityFactor: 1, hex: '#eeeeee' };
  assert.equal((await mk('/admin/metals', metal)).status, 201);
  assert.equal((await mk('/admin/metals', metal)).status, 409);
  for (const b of [{ ...metal, key: 'x1', rateKey: 'bitcoin' }, { ...metal, key: 'x2', densityFactor: 0 }, { ...metal, key: 'x3', hex: 'red' }, { ...metal, key: 'x4', evil: 1 }, { ...metal, key: 'x5', purity: 2 }]) assert.equal((await mk('/admin/metals', b)).status, 400, JSON.stringify(b));
  const saved = await M.Metal.findOne({ key: 'white-18K' });
  assert.equal((await call('PUT', `/admin/metals/${saved._id}`, { token: admin.token, body: { densityFactor: 1.02 } })).json.item.densityFactor, 1.02);
  assert.equal((await call('PUT', `/admin/metals/${saved._id}`, { token: admin.token, body: { key: 'hijack', extra: 1 } })).status, 400);

  assert.equal((await mk('/admin/stones', { key: 'sapphire', label: 'Sapphire', kind: 'gem', ior: 1.77, hex: '#1f3f9e' })).status, 201);
  assert.equal((await mk('/admin/stones', { key: 'bad', label: 'Bad', kind: 'rock' })).status, 400);
  assert.equal((await mk('/admin/stone-prices', { stoneType: 'sapphire', shape: 'round', quality: 'AAA', pricePerCarat: 40000 })).status, 201);
  assert.equal((await mk('/admin/stone-prices', { stoneType: 'sapphire', shape: 'round', quality: 'AAA', pricePerCarat: 40000 })).status, 409);
  assert.equal((await mk('/admin/stone-prices', { stoneType: 'sapphire', shape: 'oval', quality: 'AAA', pricePerCarat: -1 })).status, 400);
  assert.equal((await call('GET', '/stones')).json.matrix.sapphire.round[0], 'AAA');       // new price instantly visible to the builder

  assert.equal((await mk('/admin/coupons', { code: 'diwali20', type: 'percent', value: 20, maxDiscount: 8000 })).status, 201);
  assert.equal((await mk('/admin/coupons', { code: 'bad', type: 'percent', value: 150 })).status, 400);               // >100%
  assert.equal((await mk('/admin/coupons', { code: 'a b', type: 'flat', value: 5 })).status, 400);
  assert.equal((await mk('/admin/coupons', { code: 'sneaky', type: 'flat', value: 5, used: 0, __v: 3 })).status, 400);
  const cp = await M.Coupon.findOne({ code: 'DIWALI20' });
  assert.equal((await call('PUT', `/admin/coupons/${cp._id}`, { token: admin.token, body: { isActive: false } })).json.item.isActive, false);
  assert.equal((await call('DELETE', `/admin/coupons/${cp._id}`, { token: admin.token })).status, 204);
});

test('admin reviews: moderate then publish', async () => {
  const rv = await M.Review.create({ user: cust.id, rating: 4, title: 'Nice', body: 'Good' });
  assert.equal((await call('GET', '/reviews')).json.items.length, 0);
  assert.equal((await call('PUT', `/admin/reviews/${rv._id}`, { token: admin.token, body: { approved: true, rating: 1 } })).status, 400);   // cannot rewrite a customer's rating
  assert.equal((await call('PUT', `/admin/reviews/${rv._id}`, { token: admin.token, body: { approved: true } })).status, 200);
  assert.equal((await call('GET', '/reviews')).json.items.length, 1);
});

test('admin consultation + CMS management', async () => {
  const con = await M.Consultation.create({ user: cust.id, mode: 'video', date: '2031-05-05', slot: '10:00-10:30' });
  assert.equal((await call('PUT', `/admin/consultations/${con._id}`, { token: admin.token, body: { status: 'confirmed', meetingLink: 'https://meet.example/abc' } })).json.item.status, 'confirmed');
  assert.equal((await call('PUT', `/admin/consultations/${con._id}`, { token: admin.token, body: { meetingLink: 'javascript:alert(1)' } })).status, 400);
  await call('PUT', '/admin/settings/cms:testimonials', { token: admin.token, body: { value: [{ name: 'A', text: 'Great' }] } });
  assert.equal((await call('GET', '/cms/testimonials')).json.items[0].name, 'A');
  assert.equal((await call('GET', '/cms/secrets')).status, 404);                       // only whitelisted CMS keys are public
});

test('every procedural style the server accepts exists in the web studio (and vice-versa)', () => {
  const src = fs.readFileSync(path.resolve('..', 'web/components/studio/procedural.js'), 'utf8');
  const web = [...src.matchAll(/^\s{2}'([a-z-]+)'\(g/gm)].map((m) => m[1]).sort();
  assert.deepEqual([...PROCEDURAL_STYLES].sort(), web);
});
