// Razorpay mode with the network call stubbed. Keys must be set BEFORE the app is imported.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_value';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { boot, shutdown, call, makeUser, fixtures, ADDRESS, RING_CFG } from './helpers.mjs';

let M, rz, calls = [];
before(async () => {
  M = await boot(); await fixtures();
  rz = await import('../src/services/razorpay.js');
  rz.gateway.create = async (opts) => { calls.push(opts); if (rz.gateway.fail) throw new Error('boom'); return { id: `order_${calls.length}`, amount: opts.amount, currency: 'INR' }; };
});
after(shutdown);

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
async function newOrder(mode = 'full') {
  const u = await makeUser('customer');
  await call('POST', '/cart/items', { token: u.token, body: { designSlug: 'test-ring', config: RING_CFG, qty: 1 } });
  await call('POST', '/cart/lock', { token: u.token });
  const o = await call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode: mode } });
  return { u, o };
}

test('gateway order is created for the exact amount in paise, with the order number as receipt', async () => {
  calls = [];
  const { o } = await newOrder('full');
  assert.equal(o.status, 201);
  assert.equal(o.json.gateway.mode, 'razorpay');
  assert.equal(o.json.gateway.keyId, 'rzp_test_key');
  assert.ok(!JSON.stringify(o.json).includes('test_key_secret_value'));                 // the secret never reaches the browser
  assert.equal(calls[0].amount, Math.round(o.json.order.priceBreakdown.total * 100));
  assert.equal(calls[0].receipt, o.json.order.orderNo);
  const adv = await newOrder('advance');
  assert.equal(adv.o.json.gateway.amount, Math.round(adv.o.json.order.priceBreakdown.total * 0.3 * 100));
});

test('verify: correct HMAC captures; wrong, empty and dev signatures are rejected', async () => {
  const { u, o } = await newOrder();
  const id = o.json.gateway.orderId;
  const body = (sig, pid = 'pay_a1') => ({ razorpayOrderId: id, razorpayPaymentId: pid, signature: sig });
  for (const sig of ['dev', '', 'deadbeef', hmac('wrong-secret', `${id}|pay_a1`), hmac('test_key_secret_value', `${id}|OTHER_PAYMENT`)]) {
    const r = await call('POST', '/payments/verify', { token: u.token, body: body(sig) });
    assert.ok(r.status === 400, `signature "${sig.slice(0, 8)}" → ${r.status}`);
  }
  assert.equal((await M.Order.findById(o.json.order._id)).payment.paid, 0);              // nothing credited by failed attempts
  const ok = await call('POST', '/payments/verify', { token: u.token, body: body(hmac('test_key_secret_value', `${id}|pay_a1`)) });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.order.payment.status, 'paid');
  const again = await call('POST', '/payments/verify', { token: u.token, body: body(hmac('test_key_secret_value', `${id}|pay_a1`)) });
  assert.equal(again.json.order.payment.paid, ok.json.order.payment.paid);              // idempotent
});

test('webhook: forged, unsigned and tampered requests are refused; a valid one captures exactly once', async () => {
  const { u, o } = await newOrder();
  const evt = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w1', order_id: o.json.gateway.orderId } } } });
  const send = (sig, body = evt) => call('POST', '/payments/webhook', { raw: body, headers: { 'content-type': 'application/json', ...(sig ? { 'x-razorpay-signature': sig } : {}) } });
  assert.equal((await send(null)).status, 400);
  assert.equal((await send('0'.repeat(64))).status, 400);
  assert.equal((await send(hmac('test_key_secret_value', evt))).status, 400);          // signed with the API secret, not the webhook secret
  assert.equal((await send(hmac('test_webhook_secret_value', evt), evt.replace('pay_w1', 'pay_w2'))).status, 400);   // body altered after signing
  assert.equal((await M.Order.findById(o.json.order._id)).payment.paid, 0);
  assert.equal((await send(hmac('test_webhook_secret_value', evt))).status, 200);
  assert.equal((await M.Order.findById(o.json.order._id)).payment.status, 'paid');
  assert.equal((await send(hmac('test_webhook_secret_value', evt))).status, 200);      // Razorpay retries deliveries
  const order = await M.Order.findById(o.json.order._id);
  assert.equal(order.payment.paid, order.priceBreakdown.total);                         // not double-counted
  // …and the browser's verify call arriving afterwards changes nothing either.
  const v = await call('POST', '/payments/verify', { token: u.token, body: { razorpayOrderId: o.json.gateway.orderId, razorpayPaymentId: 'pay_w1', signature: hmac('test_key_secret_value', `${o.json.gateway.orderId}|pay_w1`) } });
  assert.equal(v.json.order.payment.paid, order.priceBreakdown.total);
  assert.equal(await M.Payment.countDocuments({ order: order._id, status: 'captured' }), 1);
});

test('webhook for an unknown order is acknowledged without crediting anything', async () => {
  const evt = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_nope' } } } });
  const r = await call('POST', '/payments/webhook', { raw: evt, headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmac('test_webhook_secret_value', evt) } });
  assert.equal(r.status, 200);
});

test('gateway outage: customer gets a clear 502 and no orphan order is left behind', async () => {
  const u = await makeUser('customer');
  await call('POST', '/cart/items', { token: u.token, body: { designSlug: 'test-ring', config: RING_CFG, qty: 1 } });
  await call('POST', '/cart/lock', { token: u.token });
  const before = await M.Order.countDocuments();
  rz.gateway.fail = true;
  const r = await call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode: 'full' } });
  rz.gateway.fail = false;
  assert.equal(r.status, 502);
  assert.equal(await M.Order.countDocuments(), before);
  assert.equal((await call('GET', '/cart', { token: u.token })).json.items.length, 1);   // cart intact so they can retry
  assert.equal((await call('POST', '/orders', { token: u.token, body: { address: ADDRESS, paymentMode: 'full' } })).status, 201);
});

test('production safety: without payment keys checkout is refused, OTP is never echoed, weak JWT secret is refused at boot', () => {
  const run = (env, code) => spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 90000, env: { PATH: process.env.PATH, ...env } });
  const weak = run({ NODE_ENV: 'production', MONGODB_URI: 'x', JWT_SECRET: 'short' }, "await import('./src/config/env.js')");
  assert.notEqual(weak.status, 0); assert.match(weak.stderr, /JWT_SECRET must be at least 32/);
  const script = `
    const h = await import('./test/helpers.mjs'); await h.boot(); await h.fixtures();
    const otp = await h.call('POST','/auth/otp/request',{body:{mobile:'9000000001'}});
    const u = await h.makeUser('customer');
    await h.call('POST','/cart/items',{token:u.token,body:{designSlug:'test-ring',config:h.RING_CFG,qty:1}});
    await h.call('POST','/cart/lock',{token:u.token});
    const order = await h.call('POST','/orders',{token:u.token,body:{address:h.ADDRESS,paymentMode:'full'}});
    const fake = await h.call('POST','/payments/verify',{token:u.token,body:{razorpayOrderId:'dev_x',razorpayPaymentId:'p',signature:'dev'}});
    console.log(JSON.stringify({ devOtp: otp.json.devOtp ?? null, order: order.status, fake: fake.status }));
    await h.shutdown();`;
  const strong = run({ NODE_ENV: 'production', MONGODB_URI: 'x', JWT_SECRET: crypto.randomBytes(32).toString('hex'), AUTH_RATE_LIMIT: '1000', OTP_RATE_LIMIT: '1000' }, script);
  assert.equal(strong.status, 0, strong.stderr);
  assert.deepEqual(JSON.parse(strong.stdout.trim().split('\n').pop()), { devOtp: null, order: 503, fake: 404 });
});
