// Shared harness: real Express app + real HTTP + an isolated in-memory MongoDB per test file.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-0123456789';
process.env.MONGODB_URI = 'memory';
process.env.AUTH_RATE_LIMIT ||= '1000';
process.env.OTP_RATE_LIMIT ||= '1000';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

let mongod, server, base;
const M = {};

export async function boot() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Object.assign(M, await import('../src/models/index.js'));
  M.auth = await import('../src/middleware/auth.js');
  const { createApp } = await import('../src/app.js');
  await new Promise((r) => { server = createApp().listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  return M;
}
export async function shutdown() {
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await mongod.stop();
}
export const models = M;

export async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: ['GET', 'HEAD'].includes(method) ? undefined : (raw ?? (body ? JSON.stringify(body) : undefined)),
  });
  const type = res.headers.get('content-type') || '';
  const text = await res.text();
  let json = null;
  if (type.includes('json') && text) json = JSON.parse(text);
  return { status: res.status, json, text, type, headers: res.headers };
}

let n = 0;
export async function makeUser(role = 'customer', extra = {}) {
  n += 1;
  const password = extra.password || 'Passw0rd!long';
  const user = await M.User.create({
    name: `${role} ${n}`, email: extra.email || `${role}${n}@test.dev`, role,
    passwordHash: await bcrypt.hash(password, 4), ...extra.fields,
  });
  return { user, id: String(user._id), token: M.auth.signToken(user), password, email: user.email };
}

export const ADDRESS = { name: 'Test Buyer', phone: '9876543210', line1: '12 MG Road', city: 'Bhubaneswar', state: 'Odisha', pincode: '751001' };
export const RATES = { '24K': 12000, '22K': 11000, '18K': 9000, '14K': 7000, platinum: 4500, silver: 150 };

/** Minimal catalogue that exercises every pricing path. */
export async function fixtures() {
  await M.GoldRate.create({ date: '2026-10-28', rates: RATES, source: 'manual' });
  const metal = (key, family, karat, rateKey, densityFactor) => ({ key, family, karat, rateKey, densityFactor, label: key, hex: '#D9B04A' });
  await M.Metal.insertMany([
    metal('yellow-18K', 'yellow', '18K', '18K', 1), metal('platinum-950', 'platinum', '950', 'platinum', 1.38),
    metal('bullion-24K', 'yellow', '24K', '24K', 1), metal('bullion-silver-999', 'silver', '999', 'silver', 1),
  ]);
  await M.Stone.insertMany([{ key: 'natural-diamond', label: 'Natural diamond', kind: 'diamond', certified: true }, { key: 'ruby', label: 'Ruby', kind: 'gem' }]);
  await M.StonePrice.insertMany([
    { stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', pricePerCarat: 100000 },
    { stoneType: 'natural-diamond', shape: 'oval', quality: 'VS-GH', pricePerCarat: 90000 },
    { stoneType: 'ruby', shape: 'round', quality: 'AAA', pricePerCarat: 50000 },
  ]);
  await M.Setting.insertMany([
    { key: 'gstPercent', value: 3 }, { key: 'shipping', value: { flat: 0 } },
    { key: 'extras', value: { engraving: 500, giftBox: 750, insurancePercent: 0.5, insuranceMin: 250 } },
    { key: 'sizeFactors', value: { ring: { 10: 0.94, 12: 1, 14: 1.06 } } },
  ]);
  const ring = await M.Design.create({
    slug: 'test-ring', name: 'Test Ring', category: 'ring', baseWeight: 4, makingType: 'percent', makingValue: 10,
    allowedMetals: ['yellow-18K', 'platinum-950'], allowedStoneTypes: ['natural-diamond', 'ruby'], allowedShapes: ['round', 'oval'],
    allowedQualities: ['VS-GH', 'AAA'], allowedSizes: ['10', '12', '14'], caratRange: { min: 0.3, max: 2 }, engravingMaxChars: 10,
    model3d: { procedural: 'halo-ring', explodedView: true, components: [{ id: 'band', label: 'Band', meshName: 'band' }] },
    manufacturing: { status: 'cad_ready' }, isActive: true,
  });
  const bar = await M.Design.create({
    slug: 'test-bar', name: 'Test Bar', category: 'bar', baseWeight: 1, makingType: 'perGram', makingValue: 100,
    allowedMetals: ['bullion-24K'], allowedSizes: ['10', '100'], sizeFactors: { 10: 10, 100: 100 },
    model3d: { procedural: 'gold-bar' }, manufacturing: { status: 'approved_for_manufacturing' }, isActive: true,
  });
  const hidden = await M.Design.create({
    slug: 'hidden-ring', name: 'Hidden', category: 'ring', baseWeight: 3, makingType: 'percent', makingValue: 10,
    allowedMetals: ['yellow-18K'], allowedSizes: ['12'], isActive: false,
  });
  await M.Coupon.insertMany([
    { code: 'TEN', type: 'percent', value: 10, maxDiscount: 5000, minOrder: 20000 },
    { code: 'FLAT500', type: 'flat', value: 500 },
    { code: 'OLD', type: 'percent', value: 10, validTo: new Date('2020-01-01') },
    { code: 'ONCE', type: 'flat', value: 100, usageLimit: 1, used: 1 },
    { code: 'OFF', type: 'flat', value: 100, isActive: false },
  ]);
  return { ring, bar, hidden };
}

export const RING_CFG = { metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH', carat: 0.5, size: '12', engraving: '' };

/** Pay an order in dev payment mode. */
export async function payDev(token, gateway) {
  return call('POST', '/payments/verify', { token, body: { razorpayOrderId: gateway.orderId, razorpayPaymentId: `pay_${Math.random().toString(36).slice(2)}`, signature: 'dev' } });
}
