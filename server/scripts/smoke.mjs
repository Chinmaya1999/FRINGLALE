// End-to-end smoke test against a running API (dev payment mode). Usage: node scripts/smoke.mjs [baseUrl] [adminPassword]
const base = process.argv[2] || 'http://localhost:4000/api';
const adminPw = process.argv[3] || process.env.SEED_ADMIN_PASSWORD;
let fails = 0;
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); if (!cond) fails++; };

const PAYID = `pay_dev_${Date.now()}`;
const email = `smoke${Date.now()}@example.com`;
const reg = await call('POST', '/auth/register', { name: 'Smoke Test', email, password: 'Sup3rSecret!' });
ok('register', reg.status === 201); const T = reg.json.token;

const cfg = { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', carat: 0.5, size: '12', engraving: 'AR' };
const bad = await call('POST', '/cart/items', { designSlug: 'aurelia-solitaire-ring', config: { ...cfg, metal: 'nope' }, qty: 1 }, T);
ok('invalid config rejected', bad.status === 422, JSON.stringify(bad.json));
const add = await call('POST', '/cart/items', { designSlug: 'aurelia-solitaire-ring', config: cfg, qty: 1 }, T);
ok('add to cart', add.status === 201 && add.json.totals.total > 0);
const unlockedOrder = await call('POST', '/orders', { paymentMode: 'full', address: { name: 'Smoke', phone: '9876543210', line1: '1 Test Rd', city: 'Bhubaneswar', state: 'Odisha', pincode: '751001' } }, T);
ok('order without price lock refused', unlockedOrder.status === 409);
const lock = await call('POST', '/cart/lock', null, T);
ok('price lock', !!lock.json.lock?.expiresAt);
const addr = { name: 'Smoke', phone: '9876543210', line1: '1 Test Rd', city: 'Bhubaneswar', state: 'Odisha', pincode: '751001' };
const ord = await call('POST', '/orders', { paymentMode: 'advance', address: addr }, T);
ok('create order (advance)', ord.status === 201, JSON.stringify(ord.json));
const oid = ord.json.order._id;
ok('locked rate stored on order', ord.json.order.lockedGoldRate.rates['18K'] > 0);
const pay = await call('POST', '/payments/verify', { razorpayOrderId: ord.json.gateway.orderId, razorpayPaymentId: PAYID, signature: 'dev' }, T);
ok('payment captured → partial', pay.json?.order?.payment?.status === 'partial', JSON.stringify(pay.json));
const replay = await call('POST', '/payments/verify', { razorpayOrderId: ord.json.gateway.orderId, razorpayPaymentId: PAYID, signature: 'dev' }, T);
ok('payment replay is idempotent', replay.json?.order?.payment?.paid === pay.json?.order?.payment?.paid);

if (adminPw) {
  const A = (await call('POST', '/auth/login', { email: 'admin@fringlale.com', password: adminPw })).json.token;
  const st = (stage) => call('POST', `/admin/orders/${oid}/stage`, { stage }, A);
  ok('admin: advance to CAD ready', (await st('design_cad_ready')).status === 200);
  ok('admin: approval needs media', (await st('customer_approval')).status === 422);
  await call('PATCH', `/admin/orders/${oid}`, { approvalMedia: ['/uploads/placeholder.jpg'] }, A);
  ok('admin: request approval', (await st('customer_approval')).status === 200);
  ok('admin: production blocked before approval', (await st('wax_model')).status === 422);
  const ch = await call('POST', `/orders/${oid}/approval`, { decision: 'changes' }, T);
  ok('customer: changes need comment', ch.status === 422);
  ok('customer: approve', (await call('POST', `/orders/${oid}/approval`, { decision: 'approve' }, T)).status === 200);
  ok('admin: wax model after approval', (await st('wax_model')).status === 200);
  const dash = await call('GET', '/admin/dashboard', null, A);
  ok('admin dashboard', dash.status === 200 && dash.json.orderCount >= 1);
  ok('customer cannot hit admin', (await call('GET', '/admin/dashboard', null, T)).status === 403);
  const inv = await fetch(`${base}/orders/${oid}/invoice`, { headers: { authorization: `Bearer ${T}` } });
  ok('invoice PDF', inv.status === 200 && inv.headers.get('content-type') === 'application/pdf');
}
const slots = await call('GET', '/consultations/slots?date=2030-01-10');
ok('public consultation slots', slots.status === 200 && slots.json.slots.length > 0);
const cms = await call('GET', '/cms/testimonials');
ok('public CMS', cms.status === 200);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
