import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, makeUser, fixtures, payDev, ADDRESS, RING_CFG } from './helpers.mjs';

let M, admin, designer, alice, bob, F;
before(async () => {
  M = await boot(); F = await fixtures();
  [admin, designer, alice, bob] = [await makeUser('admin'), await makeUser('designer'), await makeUser('customer'), await makeUser('customer')];
});
after(shutdown);

const ID = '65a000000000000000000001';
// Every admin-only endpoint in the API. A new one added without a guard will fail the matrix below.
const ADMIN_ONLY = [
  ['GET', '/admin/dashboard'], ['GET', '/admin/designs'], ['POST', '/admin/designs', {}], ['GET', `/admin/designs/${ID}`], ['PUT', `/admin/designs/${ID}`, {}], ['DELETE', `/admin/designs/${ID}`],
  ['POST', `/admin/designs/${ID}/manufacturing`, { status: 'cad_ready' }], ['POST', '/admin/designs/check', {}],
  ['GET', '/admin/metals'], ['POST', '/admin/metals', {}], ['PUT', `/admin/metals/${ID}`, {}], ['DELETE', `/admin/metals/${ID}`],
  ['GET', '/admin/stones'], ['POST', '/admin/stones', {}], ['GET', '/admin/stone-prices'], ['POST', '/admin/stone-prices', {}],
  ['GET', '/admin/coupons'], ['POST', '/admin/coupons', {}], ['GET', '/admin/reviews'], ['PUT', `/admin/reviews/${ID}`, { approved: true }],
  ['GET', '/admin/settings'], ['PUT', '/admin/settings/gstPercent', { value: 0 }],
  ['GET', '/admin/orders'], ['GET', `/admin/orders/${ID}`], ['POST', `/admin/orders/${ID}/stage`, { stage: 'casting' }], ['PATCH', `/admin/orders/${ID}`, { huid: 'ABC123' }],
  ['POST', `/admin/requests/${ID}/assign`, { designerId: ID }], ['GET', '/admin/consultations'], ['PUT', `/admin/consultations/${ID}`, { status: 'confirmed' }],
  ['GET', '/admin/customers'], ['GET', '/admin/designers'], ['GET', '/admin/users'], ['POST', '/admin/users', {}],
  ['POST', `/admin/users/${ID}/role`, { role: 'admin' }], ['POST', `/admin/users/${ID}/active`, { isActive: false }],
  ['POST', '/gold-rates', { rates: {} }],
];

test('RBAC matrix: anonymous → 401, customer → 403, designer → 403 on every admin-only endpoint', async () => {
  for (const [m, p, b] of ADMIN_ONLY) {
    const anon = await call(m, p, { body: b });
    assert.equal(anon.status, 401, `anon ${m} ${p} → ${anon.status}`);
    for (const who of [alice, designer]) {
      const r = await call(m, p, { token: who.token, body: b });
      assert.equal(r.status, 403, `${who.user.role} ${m} ${p} → ${r.status}`);
    }
    const adm = await call(m, p, { token: admin.token, body: b });
    assert.notEqual(adm.status, 403, `admin blocked on ${m} ${p}`);
    assert.notEqual(adm.status, 401, `admin unauthenticated on ${m} ${p}`);
  }
});

test('authenticated-only endpoints reject anonymous callers', async () => {
  for (const [m, p] of [['GET', '/account'], ['PATCH', '/account'], ['GET', '/cart'], ['POST', '/cart/lock'], ['GET', '/orders'], ['GET', `/orders/${ID}`], ['GET', `/orders/${ID}/invoice`],
    ['POST', `/orders/${ID}/approval`], ['POST', '/orders'], ['GET', '/saved-designs'], ['POST', '/saved-designs'], ['GET', '/custom-requests'], ['POST', '/custom-requests'],
    ['GET', '/consultations'], ['POST', '/consultations'], ['PUT', `/wishlist/${ID}`], ['POST', '/reviews'], ['POST', '/uploads'], ['POST', '/payments/verify']]) {
    assert.equal((await call(m, p, { body: {} })).status, 401, `${m} ${p}`);
  }
});

test('public endpoints stay public', async () => {
  for (const p of ['/health', '/designs', '/designs/test-ring', '/metals', '/stones', '/gold-rates/today', '/gold-rates/history', '/cms/testimonials', '/reviews', `/consultations/slots?date=2030-01-10`]) {
    assert.equal((await call('GET', p)).status, 200, p);
  }
  assert.equal((await call('POST', '/pricing/quote', { body: { designSlug: 'test-ring', config: RING_CFG } })).status, 200);
});

test('designer sees only requests assigned to them and cannot touch others', async () => {
  const a = await M.CustomRequest.create({ user: alice.id, category: 'ring', description: 'assigned to designer for sure', assignedDesigner: designer.id });
  const b = await M.CustomRequest.create({ user: bob.id, category: 'ring', description: 'not assigned to anyone yet' });
  const list = await call('GET', '/admin/requests', { token: designer.token });
  assert.deepEqual(list.json.items.map((x) => x._id), [String(a._id)]);
  assert.equal((await call('POST', `/admin/requests/${b._id}/cad`, { token: designer.token, body: { files: ['/uploads/abc.pdf'] } })).status, 404);
  const ok = await call('POST', `/admin/requests/${a._id}/cad`, { token: designer.token, body: { files: ['/uploads/abc.pdf'] } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.request.status, 'cad_shared');
  assert.equal((await call('GET', '/admin/requests', { token: admin.token })).json.items.length, 2);
  assert.equal((await call('GET', '/admin/requests', { token: alice.token })).status, 403);
});

test('admin can assign a request only to a real designer', async () => {
  const b = await M.CustomRequest.findOne({ user: bob.id });
  assert.equal((await call('POST', `/admin/requests/${b._id}/assign`, { token: admin.token, body: { designerId: alice.id } })).status, 422);
  assert.equal((await call('POST', `/admin/requests/${b._id}/assign`, { token: admin.token, body: { designerId: designer.id } })).status, 200);
  assert.equal((await call('GET', '/admin/requests', { token: designer.token })).json.items.length, 2);
});

test('data isolation: users cannot read or modify each other’s orders, carts, saved designs, requests, consultations', async () => {
  // Alice builds a paid order, a saved design and a request.
  await call('POST', '/cart/items', { token: alice.token, body: { designSlug: 'test-ring', config: RING_CFG, qty: 1 } });
  await call('POST', '/cart/lock', { token: alice.token });
  const o = await call('POST', '/orders', { token: alice.token, body: { address: ADDRESS, paymentMode: 'full' } });
  assert.equal(o.status, 201);
  const paid = await payDev(alice.token, o.json.gateway);
  assert.equal(paid.status, 200);
  const oid = o.json.order._id;
  const sd = await call('POST', '/saved-designs', { token: alice.token, body: { designSlug: 'test-ring', config: RING_CFG } });
  const req = await M.CustomRequest.create({ user: alice.id, category: 'ring', description: 'alice private request' });

  assert.equal((await call('GET', `/orders/${oid}`, { token: bob.token })).status, 404);
  assert.equal((await call('GET', `/orders/${oid}/invoice`, { token: bob.token })).status, 404);
  assert.equal((await call('POST', `/orders/${oid}/approval`, { token: bob.token, body: { decision: 'approve' } })).status, 404);
  assert.equal((await call('POST', `/orders/${oid}/pay-balance`, { token: bob.token })).status, 404);
  assert.equal((await call('GET', '/orders', { token: bob.token })).json.items.length, 0);
  assert.equal((await call('GET', `/saved-designs/${sd.json.saved._id}`, { token: bob.token })).status, 404);
  assert.equal((await call('DELETE', `/saved-designs/${sd.json.saved._id}`, { token: bob.token })).status, 404);
  assert.equal((await call('GET', '/saved-designs', { token: bob.token })).json.items.length, 0);
  const bobReqs = (await call('GET', '/custom-requests', { token: bob.token })).json.items;
  assert.ok(bobReqs.every((x) => x.user === bob.id) && !bobReqs.some((x) => /alice/.test(x.description)));
  assert.equal((await call('GET', '/cart', { token: bob.token })).json.items.length, 0);
  // Bob cannot attach a consultation to Alice's request, nor pay with her payment reference.
  assert.equal((await call('POST', '/consultations', { token: bob.token, body: { mode: 'video', date: '2030-06-10', slot: '11:00-11:30', request: String(req._id) } })).status, 404);
  assert.equal((await call('POST', '/payments/verify', { token: bob.token, body: { razorpayOrderId: o.json.gateway.orderId, razorpayPaymentId: 'pay_x', signature: 'dev' } })).status, 404);
  // …but Alice can see her own.
  assert.equal((await call('GET', `/orders/${oid}`, { token: alice.token })).status, 200);
  assert.equal((await call('GET', `/orders/${oid}/invoice`, { token: alice.token })).type, 'application/pdf');
});

test('mass assignment / privilege escalation attempts fail', async () => {
  for (const body of [{ role: 'admin' }, { isActive: true }, { passwordHash: 'x' }, { tokenVersion: 99 }, { email: 'a@b.co', role: 'admin' }]) {
    const r = await call('PATCH', '/account', { token: bob.token, body });
    assert.equal(r.status === 400 || (r.status === 200 && Object.keys(body).every((k) => ['email'].includes(k))), true, JSON.stringify(body));
  }
  assert.equal((await M.User.findById(bob.id)).role, 'customer');
  // Role/escalation endpoints are admin-only and an admin cannot demote or disable themselves.
  assert.equal((await call('POST', `/admin/users/${bob.id}/role`, { token: bob.token, body: { role: 'admin' } })).status, 403);
  assert.equal((await call('POST', `/admin/users/${admin.id}/role`, { token: admin.token, body: { role: 'customer' } })).status, 422);
  assert.equal((await call('POST', `/admin/users/${admin.id}/active`, { token: admin.token, body: { isActive: false } })).status, 422);
});

test('admin user management: create staff, change roles (revokes old tokens), disable accounts, protect the last admin', async () => {
  const mk = await call('POST', '/admin/users', { token: admin.token, body: { name: 'New Designer', email: 'nd@test.dev', password: 'designer-pass1', role: 'designer' } });
  assert.equal(mk.status, 201);
  assert.equal((await call('POST', '/admin/users', { token: admin.token, body: { name: 'Dup', email: 'nd@test.dev', password: 'designer-pass1', role: 'designer' } })).status, 409);
  assert.equal((await call('POST', '/admin/users', { token: admin.token, body: { name: 'X Y', email: 'x@test.dev', password: 'designer-pass1', role: 'customer' } })).status, 400);   // only staff roles via this route
  const login = await call('POST', '/auth/login', { body: { email: 'nd@test.dev', password: 'designer-pass1' } });
  assert.equal(login.json.user.role, 'designer');
  assert.equal((await call('GET', '/admin/requests', { token: login.json.token })).status, 200);

  // Promote then demote Bob: his old token must stop working at once.
  assert.equal((await call('POST', `/admin/users/${bob.id}/role`, { token: admin.token, body: { role: 'designer' } })).status, 200);
  assert.equal((await call('GET', '/account', { token: bob.token })).status, 401);
  // Disable Alice: her token dies and she cannot log in.
  assert.equal((await call('POST', `/admin/users/${alice.id}/active`, { token: admin.token, body: { isActive: false } })).status, 200);
  assert.equal((await call('GET', '/account', { token: alice.token })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: alice.email, password: alice.password } })).status, 401);
  assert.equal((await call('POST', `/admin/users/${alice.id}/active`, { token: admin.token, body: { isActive: true } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { email: alice.email, password: alice.password } })).status, 200);

  // Last-admin protection: with a second admin present demotion works; the final one is protected.
  const second = await makeUser('admin');
  assert.equal((await call('POST', `/admin/users/${second.id}/role`, { token: admin.token, body: { role: 'customer' } })).status, 200);
  const only = await call('POST', `/admin/users/${admin.id}/role`, { token: second.token, body: { role: 'customer' } });
  assert.equal(only.status, 401);                                   // demoting someone revokes their token, so it is refused outright
  const third = await makeUser('admin');
  assert.equal((await call('POST', `/admin/users/${admin.id}/active`, { token: third.token, body: { isActive: false } })).status, 200);
  assert.equal((await call('POST', `/admin/users/${third.id}/active`, { token: third.token, body: { isActive: false } })).status, 422);   // self
  const fourth = await makeUser('admin');
  await call('POST', `/admin/users/${third.id}/active`, { token: fourth.token, body: { isActive: false } });
  assert.equal((await call('POST', `/admin/users/${fourth.id}/role`, { token: fourth.token, body: { role: 'customer' } })).status, 422);
});

test('uploads: type and role restrictions, size cap, random names', async () => {
  const carol = await makeUser('customer');
  const fd = (name, type, bytes = 100) => { const f = new FormData(); f.append('files', new Blob([Buffer.alloc(bytes, 1)], { type }), name); return f; };
  const up = async (token, form) => call('POST', '/uploads', { token, raw: form });
  const img = await up(carol.token, fd('photo.jpg', 'image/jpeg'));
  assert.equal(img.status, 201);
  assert.match(img.json.files[0].url, /^\/uploads\/[a-f0-9]{24}\.jpg$/);
  assert.equal((await up(carol.token, fd('run.exe', 'application/x-msdownload'))).status, 415);
  assert.equal((await up(carol.token, fd('evil.html', 'text/html'))).status, 415);
  assert.equal((await up(carol.token, fd('model.glb', 'application/octet-stream'))).status, 415);       // GLB is admin-only
  const adm = await makeUser('admin');
  assert.equal((await up(adm.token, fd('model.glb', 'application/octet-stream'))).status, 201);
  assert.equal((await up(undefined, fd('p.jpg', 'image/jpeg'))).status, 401);
});
