import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, makeUser, fixtures, payDev, ADDRESS, RING_CFG, RATES } from './helpers.mjs';

let M, admin, F;
before(async () => { M = await boot(); F = await fixtures(); admin = await makeUser('admin'); });
after(shutdown);

const quote = (slug, config) => call('POST', '/pricing/quote', { body: { designSlug: slug, config } });
const addCart = (u, slug = 'test-ring', config = RING_CFG, qty = 1) => call('POST', '/cart/items', { token: u.token, body: { designSlug: slug, config, qty } });
const checkout = async (u, paymentMode = 'full', coupon) => {
  if (coupon) await call('POST', '/cart/coupon', { token: u.token, body: { code: coupon } });
  await call('POST', '/cart/lock', { token: u.token });
  return call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode } });
};

test('quote: price follows the documented formula to the paisa', async () => {
  const r = await quote('test-ring', RING_CFG);
  assert.equal(r.status, 200);
  const p = r.json.price;
  assert.equal(p.finalWeight, 4);                                    // 4 g × size 12 (1.0) × 18K (1.0)
  assert.equal(p.metalPrice, 36000);                                 // 4 × 9000
  assert.equal(p.makingCharge, 3600);                                // 10%
  assert.equal(p.stonePrice, 50000);                                 // 0.5 ct × 100000
  assert.equal(p.extras.insurance, 448);                             // 0.5% of 89600
  assert.equal(p.subtotal, 90048);
  assert.equal(p.gst, 2701.44);                                      // 3%
  assert.equal(p.total, 92749.44);
  assert.equal(r.json.goldRate.source, 'manual');
});

test('quote: size factor, platinum density, engraving and gift box all flow through', async () => {
  const small = (await quote('test-ring', { ...RING_CFG, size: '10' })).json.price;
  assert.equal(small.finalWeight, 3.76);                             // 4 × 0.94
  const plat = (await quote('test-ring', { ...RING_CFG, metal: 'platinum-950' })).json.price;
  assert.equal(plat.finalWeight, 5.52);                              // 4 × 1.38
  assert.equal(plat.metalPrice, 24840);                              // 5.52 × 4500
  const ex = (await quote('test-ring', { ...RING_CFG, engraving: 'AR', giftBox: true })).json.price;
  assert.equal(ex.extras.engraving, 500); assert.equal(ex.extras.giftBox, 750);
  const noIns = (await quote('test-ring', { ...RING_CFG, insurance: false })).json.price;
  assert.equal(noIns.extras.insurance, 0);
  const ruby = (await quote('test-ring', { ...RING_CFG, stoneType: 'ruby', quality: 'AAA' })).json.price;
  assert.equal(ruby.stonePrice, 25000);
  const noStone = (await quote('test-ring', { metal: 'yellow-18K', size: '12' })).json.price;
  assert.equal(noStone.stonePrice, 0);
});

test('quote: every invalid configuration is refused with 4xx, never priced', async () => {
  const bad = [
    { ...RING_CFG, metal: 'gold-of-the-gods' }, { ...RING_CFG, metal: 'bullion-24K' }, { ...RING_CFG, size: '99' }, { ...RING_CFG, carat: 9 },
    { ...RING_CFG, carat: 0.01 }, { ...RING_CFG, shape: 'heart' }, { ...RING_CFG, quality: 'ZZ' }, { ...RING_CFG, stoneType: 'sapphire' },
    { ...RING_CFG, engraving: 'x'.repeat(11) }, { ...RING_CFG, shape: 'oval', stoneType: 'ruby', quality: 'AAA' } /* priced? no */, { ...RING_CFG, carat: -1 }, { ...RING_CFG, carat: 'lots' },
  ];
  for (const c of bad) { const r = await quote('test-ring', c); assert.ok(r.status >= 400 && r.status < 500, `${JSON.stringify(c)} → ${r.status}`); assert.ok(!r.json.price); }
  assert.equal((await quote('nope', RING_CFG)).status, 404);
  assert.equal((await quote('hidden-ring', { metal: 'yellow-18K', size: '12' })).status, 404);      // inactive designs are not quotable
});

test('support block tells the truth about real vs simulated vs approved', async () => {
  const r = (await quote('test-ring', RING_CFG)).json.support;
  assert.equal(r.assetBacked, false);
  assert.ok(r.simulatedFeatures.includes('stone-shape')); assert.ok(r.simulatedFeatures.includes('metal-finish'));
  assert.equal(r.manufacturingStatus, 'cad_ready'); assert.equal(r.approvedForManufacturing, false);
  assert.equal(r.explodedView, true);
  const bar = (await quote('test-bar', { metal: 'bullion-24K', size: '10' })).json.support;
  assert.equal(bar.approvedForManufacturing, true);
  assert.ok(!bar.simulatedFeatures.includes('stone-shape'));          // no stone, nothing to simulate
  assert.deepEqual(bar.components, []);                               // exploded view only when the model supports it
});

test('bullion: exact weight, per-gram premium, only listed weights', async () => {
  const p = (await quote('test-bar', { metal: 'bullion-24K', size: '10' })).json.price;
  assert.equal(p.finalWeight, 10); assert.equal(p.metalPrice, 120000); assert.equal(p.makingCharge, 1000);
  assert.equal((await quote('test-bar', { metal: 'bullion-24K', size: '100' })).json.price.metalPrice, 1200000);
  assert.equal((await quote('test-bar', { metal: 'bullion-24K', size: '7' })).status, 422);
  assert.equal((await quote('test-bar', { metal: 'bullion-silver-999', size: '10' })).status, 422);   // metal not allowed on this bar
});

test('catalogue: filters, pagination, hidden designs never leak', async () => {
  const all = (await call('GET', '/designs')).json;
  assert.equal(all.total, 2);
  assert.ok(!all.items.some((d) => d.slug === 'hidden-ring'));
  assert.equal((await call('GET', '/designs/hidden-ring')).status, 404);
  assert.equal((await call('GET', '/designs?category=bar')).json.total, 1);
  assert.equal((await call('GET', '/designs?metal=yellow')).json.items.some((d) => d.slug === 'test-bar'), true);   // bullion-24K counts as yellow gold
  assert.equal((await call('GET', '/designs?limit=1&page=2')).json.items.length, 1);
  assert.equal((await call('GET', '/designs?limit=9999')).status, 400);
  assert.equal((await call('GET', '/designs?sort=hax')).status, 400);
  assert.equal((await call('GET', '/designs?q=' + encodeURIComponent('(.*+?^$'))).status, 200);                    // regex injection is escaped
  const st = (await call('GET', '/stones')).json;
  assert.deepEqual(st.matrix['natural-diamond'].round, ['VS-GH']);
});

test('cart: add, qty limits, remove, and any change drops the price lock', async () => {
  const u = await makeUser('customer');
  assert.equal((await addCart(u, 'test-ring', { ...RING_CFG, metal: 'nope' })).status, 422);
  assert.equal((await call('POST', '/cart/items', { token: u.token, body: { designSlug: 'test-ring', config: RING_CFG, qty: 9 } })).status, 400);
  const a = await addCart(u);
  assert.equal(a.status, 201);
  assert.equal(a.json.totals.total, 92749.44);
  const lock = await call('POST', '/cart/lock', { token: u.token });
  assert.ok(lock.json.lock.expiresAt);
  const b = await addCart(u, 'test-bar', { metal: 'bullion-24K', size: '10' });
  assert.equal(b.json.lock, null);                                    // adding an item invalidates the lock
  const itemId = b.json.items[1].id;
  await call('POST', '/cart/lock', { token: u.token });
  const rm = await call('DELETE', `/cart/items/${itemId}`, { token: u.token });
  assert.equal(rm.json.items.length, 1); assert.equal(rm.json.lock, null);
  assert.equal((await call('POST', '/cart/lock', { token: (await makeUser('customer')).token })).status, 422);       // empty cart cannot be locked
});

test('price lock: order uses the LOCKED rate even after the live rate changes; expiry is enforced', async () => {
  const u = await makeUser('customer');
  await addCart(u);
  const before = (await call('GET', '/cart', { token: u.token })).json.totals.total;
  assert.equal((await call('POST', '/orders', { token: u.token, body: { address: ADDRESS } })).status, 409);       // no lock yet
  await call('POST', '/cart/lock', { token: u.token });
  // Gold jumps 20% after the customer locked.
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: Object.fromEntries(Object.entries(RATES).map(([k, v]) => [k, Math.round(v * 1.2)])) } });
  const live = (await quote('test-ring', RING_CFG)).json.price.total;
  assert.ok(live > before + 5000);
  const o = await call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode: 'full' } });
  assert.equal(o.status, 201);
  assert.equal(o.json.order.priceBreakdown.total, before);           // locked price honoured
  assert.equal(o.json.order.lockedGoldRate.rates['18K'], 9000);       // locked rate stored on the order
  // Another customer whose lock has expired must be refused.
  const v = await makeUser('customer');
  await addCart(v); await call('POST', '/cart/lock', { token: v.token });
  await M.Cart.updateOne({ user: v.id }, { 'lock.expiresAt': new Date(Date.now() - 1000) });
  const exp = await call('POST', '/orders', { token: v.token, body: { address: ADDRESS } });
  assert.equal(exp.status, 409); assert.equal(exp.json.error.code, 'LOCK_EXPIRED');
  // restore rate for later tests
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: RATES } });
});

test('checkout validation: address is required and validated', async () => {
  const u = await makeUser('customer');
  await addCart(u); await call('POST', '/cart/lock', { token: u.token });
  for (const addr of [{}, { ...ADDRESS, phone: '12345' }, { ...ADDRESS, pincode: '75' }, { ...ADDRESS, name: '' }, { ...ADDRESS, line1: undefined }]) {
    assert.equal((await call('POST', '/orders', { token: u.token, body: { address: addr } })).status, 400, JSON.stringify(addr));
  }
  assert.equal((await call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode: 'crypto' } })).status, 400);
});

test('full payment: order starts at "Order Placed", payment is idempotent, cart empties, invoice available', async () => {
  const u = await makeUser('customer');
  await addCart(u);
  const o = await checkout(u, 'full');
  assert.equal(o.status, 201);
  assert.equal(o.json.order.payment.status, 'pending');
  assert.equal((await call('GET', `/orders/${o.json.order._id}/invoice`, { token: u.token })).status, 404);        // no invoice before payment
  const gw = o.json.gateway;
  assert.equal(gw.mode, 'dev');
  const pay = { razorpayOrderId: gw.orderId, razorpayPaymentId: 'pay_fixed_1', signature: 'dev' };
  const p1 = await call('POST', '/payments/verify', { token: u.token, body: pay });
  assert.equal(p1.json.order.payment.status, 'paid');
  assert.equal(p1.json.order.payment.due, 0);
  const p2 = await call('POST', '/payments/verify', { token: u.token, body: pay });                              // replay
  assert.equal(p2.json.order.payment.paid, p1.json.order.payment.paid);
  assert.equal((await call('GET', '/cart', { token: u.token })).json.items.length, 0);
  assert.equal((await call('POST', '/payments/verify', { token: u.token, body: { ...pay, signature: 'forged' } })).status, 400);   // dev signature is the only accepted shortcut
  const inv = await call('GET', `/orders/${o.json.order._id}/invoice`, { token: u.token });
  assert.equal(inv.type, 'application/pdf'); assert.ok(inv.text.startsWith('%PDF'));
  assert.equal(await M.Payment.countDocuments({ order: o.json.order._id, status: 'captured' }), 1);
});

test('advance payment: partial → balance → paid; shipping blocked until balance cleared', async () => {
  const u = await makeUser('customer');
  await addCart(u);
  const o = await checkout(u, 'advance');
  const total = o.json.order.priceBreakdown.total;
  assert.equal(o.json.gateway.amount, Math.round(total * 0.3 * 100));                                               // 30% advance, in paise
  const p = await payDev(u.token, o.json.gateway);
  assert.equal(p.json.order.payment.status, 'partial');
  assert.equal(p.json.order.payment.due, Math.round((total - total * 0.3) * 100) / 100);
  const id = o.json.order._id;
  const bal = await call('POST', `/orders/${id}/pay-balance`, { token: u.token });
  assert.equal(bal.status, 200);
  const paid = await payDev(u.token, bal.json.gateway);
  assert.equal(paid.json.order.payment.status, 'paid'); assert.equal(paid.json.order.payment.due, 0);
  assert.equal((await call('POST', `/orders/${id}/pay-balance`, { token: u.token })).status, 404);                 // nothing left to pay
});

test('production pipeline: approval gate, HUID, tracking, notes and history all enforced', async () => {
  const u = await makeUser('customer');
  await addCart(u);
  const o = await checkout(u, 'advance');
  const id = o.json.order._id;
  await payDev(u.token, o.json.gateway);
  const stage = (s) => call('POST', `/admin/orders/${id}/stage`, { token: admin.token, body: { stage: s } });
  assert.equal((await stage('casting')).status, 422);                                                              // cannot skip
  assert.equal((await stage('design_cad_ready')).status, 200);
  assert.equal((await stage('customer_approval')).status, 422);                                                    // needs CAD/wax media first
  await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { approvalMedia: ['/uploads/cad1.jpg'] } });
  assert.equal((await stage('customer_approval')).status, 200);
  assert.equal((await stage('wax_model')).status, 422);                                                            // BLOCKED until customer approves
  assert.equal((await call('POST', `/orders/${id}/approval`, { token: u.token, body: { decision: 'changes' } })).status, 422);   // comment required
  const ch = await call('POST', `/orders/${id}/approval`, { token: u.token, body: { decision: 'changes', comment: 'Thinner band please' } });
  assert.equal(ch.json.order.approval.status, 'changes_requested');
  assert.equal((await stage('wax_model')).status, 422);                                                            // still blocked
  await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { approvalMedia: ['/uploads/cad2.jpg'] } });   // revised CAD re-opens approval
  assert.equal((await M.Order.findById(id)).approval.status, 'pending');
  assert.equal((await call('POST', `/orders/${id}/approval`, { token: u.token, body: { decision: 'approve' } })).json.order.approval.status, 'approved');
  assert.equal((await call('POST', `/orders/${id}/approval`, { token: u.token, body: { decision: 'approve' } })).status, 409);   // already decided
  for (const s of ['wax_model', 'casting', 'stone_setting', 'polishing', 'hallmarking']) assert.equal((await stage(s)).status, 200, s);
  assert.equal((await stage('quality_check')).status, 422);                                                        // HUID required
  assert.equal((await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { huid: 'bad' } })).status, 400);
  assert.equal((await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { huid: 'AB12CD' } })).status, 200);
  assert.equal((await stage('quality_check')).status, 200);
  assert.equal((await stage('shipped')).status, 422);                                                              // tracking required
  await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { trackingNumber: 'TRK123', courier: 'BlueDart' } });
  assert.equal((await stage('shipped')).status, 422);                                                              // balance still due
  const bal = await call('POST', `/orders/${id}/pay-balance`, { token: u.token });
  await payDev(u.token, bal.json.gateway);
  assert.equal((await stage('shipped')).status, 200);
  assert.equal((await stage('delivered')).status, 200);
  const final = (await call('GET', `/orders/${id}`, { token: u.token })).json.order;
  assert.equal(final.stage, 'delivered'); assert.equal(final.huid, 'AB12CD');
  assert.ok(final.stageHistory.length >= 12);
  assert.equal((await call('PATCH', `/admin/orders/${id}`, { token: admin.token, body: { price: 1 } })).status, 400);   // cannot edit prices through the order API
  // A customer may review once their order is delivered, and only once.
  const rv = { order: id, rating: 5, title: 'Lovely', body: 'Perfect' };
  assert.equal((await call('POST', '/reviews', { token: u.token, body: rv })).status, 201);
  assert.equal((await call('POST', '/reviews', { token: u.token, body: rv })).status, 409);
  assert.equal((await call('GET', '/reviews')).json.items.length, 0);                                              // unpublished until approved
});

test('reviews: not allowed before delivery', async () => {
  const u = await makeUser('customer');
  await addCart(u); const o = await checkout(u); await payDev(u.token, o.json.gateway);
  assert.equal((await call('POST', '/reviews', { token: u.token, body: { order: o.json.order._id, rating: 5 } })).status, 403);
});

test('coupons: percent cap, minimum order, flat, expired, exhausted, inactive, unknown', async () => {
  const u = await makeUser('customer');
  await addCart(u);                                                                                                 // subtotal 90,048
  const apply = (code) => call('POST', '/cart/coupon', { token: u.token, body: { code } });
  const ten = await apply('TEN');
  assert.equal(ten.json.totals.discount, 5000);                                                                    // 10% = 9004.80 capped at 5000
  assert.equal(ten.json.totals.taxable, 85048);
  assert.equal(ten.json.totals.gst, 2551.44);                                                                      // GST on the discounted amount
  assert.equal((await apply('flat500')).json.totals.discount, 500);                                                // case-insensitive
  for (const c of ['OLD', 'ONCE', 'OFF', 'NOPE']) assert.equal((await apply(c)).status, 422, c);
  assert.equal((await apply(null)).json.coupon, null);
  await M.Coupon.create({ code: 'BIGSPEND', type: 'flat', value: 100, minOrder: 500000 });
  assert.equal((await apply('BIGSPEND')).status, 422);                                                             // order below the minimum
});

test('coupon use is counted only when payment succeeds', async () => {
  const u = await makeUser('customer');
  await addCart(u);
  const before = (await M.Coupon.findOne({ code: 'FLAT500' })).used;
  const o = await checkout(u, 'full', 'FLAT500');
  assert.equal(o.json.order.coupon.discount, 500);
  assert.equal((await M.Coupon.findOne({ code: 'FLAT500' })).used, before);
  await payDev(u.token, o.json.gateway);
  assert.equal((await M.Coupon.findOne({ code: 'FLAT500' })).used, before + 1);
});

test('gold rate: admin override changes live quotes and history; history keeps latest per day', async () => {
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: { ...RATES, '18K': 10000 } } });
  assert.equal((await call('GET', '/gold-rates/today')).json.rates['18K'], 10000);
  assert.equal((await quote('test-ring', RING_CFG)).json.price.metalPrice, 40000);
  const bad = await call('POST', '/gold-rates', { token: admin.token, body: { rates: { ...RATES, '18K': -5 } } });
  assert.equal(bad.status, 400);
  assert.equal((await call('POST', '/gold-rates', { token: admin.token, body: { rates: { '24K': 1 } } })).status, 400);        // incomplete
  const h = (await call('GET', '/gold-rates/history?days=30')).json.items;
  assert.equal(new Set(h.map((x) => x.date)).size, h.length);
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: RATES } });
});

test('admin settings drive pricing: GST and extras', async () => {
  await call('PUT', '/admin/settings/gstPercent', { token: admin.token, body: { value: 5 } });
  assert.equal((await quote('test-ring', RING_CFG)).json.price.gstPercent, 5);
  await call('PUT', '/admin/settings/extras', { token: admin.token, body: { value: { engraving: 900 } } });
  assert.equal((await quote('test-ring', { ...RING_CFG, engraving: 'Hi' })).json.price.extras.engraving, 900);
  await call('PUT', '/admin/settings/gstPercent', { token: admin.token, body: { value: 3 } });
  await call('PUT', '/admin/settings/extras', { token: admin.token, body: { value: { engraving: 500 } } });
});

test('consultations: slot capacity, past dates, duplicate protection', async () => {
  const u = await makeUser('customer');
  const slot = { mode: 'video', date: '2031-03-10', slot: '11:00-11:30' };
  assert.equal((await call('POST', '/consultations', { token: u.token, body: { ...slot, date: '2020-01-01' } })).status, 422);
  assert.equal((await call('POST', '/consultations', { token: u.token, body: { ...slot, slot: '03:33-04:00' } })).status, 400);
  assert.equal((await call('POST', '/consultations', { token: u.token, body: slot })).status, 201);
  assert.equal((await call('POST', '/consultations', { token: (await makeUser('customer')).token, body: slot })).status, 201);
  assert.equal((await call('POST', '/consultations', { token: (await makeUser('customer')).token, body: slot })).status, 409);   // capacity 2 reached
  const s = (await call('GET', '/consultations/slots?date=2031-03-10')).json.slots;
  assert.equal(s.find((x) => x.slot === '11:00-11:30').available, false);
  assert.equal(s.find((x) => x.slot === '10:00-10:30').available, true);
});

test('custom requests: validation and listing', async () => {
  const u = await makeUser('customer');
  assert.equal((await call('POST', '/custom-requests', { token: u.token, body: { category: 'ring', description: 'short' } })).status, 400);
  assert.equal((await call('POST', '/custom-requests', { token: u.token, body: { category: 'spaceship', description: 'a long enough description' } })).status, 400);
  assert.equal((await call('POST', '/custom-requests', { token: u.token, body: { category: 'coin', description: 'engraved anniversary coin', files: ['https://evil.example/x.jpg'] } })).status, 400);   // only our uploads
  assert.equal((await call('POST', '/custom-requests', { token: u.token, body: { category: 'coin', description: 'engraved anniversary coin', files: ['/uploads/ab12.jpg'] } })).status, 201);
  assert.equal((await call('GET', '/custom-requests', { token: u.token })).json.items.length, 1);
});

test('account: addresses, saved designs re-priced live, wishlist', async () => {
  const u = await makeUser('customer');
  assert.equal((await call('POST', '/account/addresses', { token: u.token, body: ADDRESS })).status, 201);
  assert.equal((await call('POST', '/account/addresses', { token: u.token, body: { ...ADDRESS, pincode: 'abc' } })).status, 400);
  const acc = (await call('GET', '/account', { token: u.token })).json.user;
  assert.equal(acc.addresses.length, 1);
  assert.equal((await call('DELETE', `/account/addresses/${acc.addresses[0]._id}`, { token: u.token })).json.addresses.length, 0);
  const sd = await call('POST', '/saved-designs', { token: u.token, body: { designSlug: 'test-ring', name: 'Mine', config: RING_CFG } });
  assert.equal(sd.status, 201);
  assert.equal((await call('POST', '/saved-designs', { token: u.token, body: { designSlug: 'test-ring', config: { ...RING_CFG, metal: 'nope' } } })).status, 422);   // can't save an unsupported config
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: { ...RATES, '18K': 9500 } } });
  const reopened = await call('GET', `/saved-designs/${sd.json.saved._id}`, { token: u.token });
  assert.ok(reopened.json.quote.price.total > sd.json.saved.lastQuote.total);                                       // re-priced at today's rate
  await call('POST', '/gold-rates', { token: admin.token, body: { rates: RATES } });
  assert.equal((await call('PUT', `/wishlist/${F.ring._id}`, { token: u.token })).status, 200);
  assert.equal((await call('GET', '/account', { token: u.token })).json.user.wishlist.length, 1);
  assert.equal((await call('PUT', '/wishlist/65a000000000000000000009', { token: u.token })).status, 404);
  assert.equal((await call('PUT', '/wishlist/not-an-id', { token: u.token })).status, 400);
});

test('dashboard aggregates real data', async () => {
  const d = (await call('GET', '/admin/dashboard', { token: admin.token })).json;
  assert.ok(d.orderCount >= 3); assert.ok(d.revenue > 0); assert.ok(d.topDesigns.length >= 1); assert.ok(d.ordersByStage.length >= 1);
});
