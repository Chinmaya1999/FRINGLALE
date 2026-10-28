import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { boot, shutdown, call, makeUser, models } from './helpers.mjs';

let M;
before(async () => { M = await boot(); });
after(shutdown);

test('register: creates a customer, never trusts a role from the client, hashes the password', async () => {
  const r = await call('POST', '/auth/register', { body: { name: 'New Person', email: 'New@Test.dev', password: 'longenough1', role: 'admin' } });
  assert.equal(r.status, 400);                                          // unknown field "role" is rejected, not silently accepted
  const ok = await call('POST', '/auth/register', { body: { name: 'New Person', email: 'New@Test.dev', password: 'longenough1' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.role, 'customer');
  assert.equal(ok.json.user.email, 'new@test.dev');                    // normalised
  assert.ok(!JSON.stringify(ok.json).includes('passwordHash'));
  const u = await M.User.findOne({ email: 'new@test.dev' }).select('+passwordHash');
  assert.match(u.passwordHash, /^\$2[aby]\$/);
  assert.notEqual(u.passwordHash, 'longenough1');
  assert.equal((await call('POST', '/auth/register', { body: { name: 'Dup', email: 'new@test.dev', password: 'longenough1' } })).status, 409);
  assert.equal((await call('POST', '/auth/register', { body: { name: 'Weak', email: 'w@test.dev', password: 'short' } })).status, 400);
  assert.equal((await call('POST', '/auth/register', { body: { name: 'Bad', email: 'not-an-email', password: 'longenough1' } })).status, 400);
});

test('login: unknown user and wrong password are indistinguishable', async () => {
  const u = await makeUser('customer');
  const wrong = await call('POST', '/auth/login', { body: { email: u.email, password: 'nope-nope-nope' } });
  const unknown = await call('POST', '/auth/login', { body: { email: 'ghost@test.dev', password: 'nope-nope-nope' } });
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.equal(wrong.json.error.message, unknown.json.error.message);
  const ok = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
  assert.equal((await call('GET', '/auth/me', { token: ok.json.token })).json.user.email, u.email);
});

test('login: account locks after repeated failures, then even the right password is refused', async () => {
  const u = await makeUser('customer');
  for (let i = 0; i < 8; i++) assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: 'bad-bad-bad-1' } })).status, 401);
  const locked = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
  assert.equal(locked.status, 429);
  assert.equal(locked.json.error.code, 'LOCKED');
  await M.User.updateOne({ _id: u.id }, { lockUntil: new Date(Date.now() - 1000) });    // lock expires
  assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 200);
});

test('login: deactivated accounts cannot sign in', async () => {
  const u = await makeUser('customer', { fields: { isActive: false } });
  assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);
});

test('tokens: missing, malformed, tampered, wrong-secret, alg=none and expired are all rejected', async () => {
  const u = await makeUser('customer');
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: 'abc.def.ghi' })).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: u.token.slice(0, -3) + 'xxx' })).status, 401);
  const forged = jwt.sign({ sub: u.id, role: 'admin', tv: 0 }, 'attacker-secret');
  assert.equal((await call('GET', '/admin/dashboard', { token: forged })).status, 401);
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: u.id, role: 'admin', tv: 0 })).toString('base64url')}.`;
  assert.equal((await call('GET', '/admin/dashboard', { token: none })).status, 401);
  const expired = jwt.sign({ sub: u.id, role: 'customer', tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await call('GET', '/auth/me', { token: expired })).status, 401);
});

test('tokens: the role in the token is not trusted — the database role wins', async () => {
  const u = await makeUser('customer');
  const lying = jwt.sign({ sub: u.id, role: 'admin', tv: 0 }, process.env.JWT_SECRET);
  assert.equal((await call('GET', '/admin/dashboard', { token: lying })).status, 403);
});

test('revocation: change-password invalidates every older token and returns a fresh one', async () => {
  const u = await makeUser('customer');
  assert.equal((await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: 'wrong-wrong-1', newPassword: 'brandnew-pass1' } })).status, 401);
  const r = await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: u.password, newPassword: 'brandnew-pass1' } });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);          // old token dead
  assert.equal((await call('GET', '/auth/me', { token: r.json.token })).status, 200);     // new token works
  assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: 'brandnew-pass1' } })).status, 200);
});

test('revocation: logout-all kills all sessions', async () => {
  const u = await makeUser('customer');
  const second = (await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).json.token;
  assert.equal((await call('POST', '/auth/logout-all', { token: u.token })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: second })).status, 401);
});

test('OTP: request → verify works once; code is stored hashed; wrong code counts attempts', async () => {
  const mobile = '9123456780';
  const req = await call('POST', '/auth/otp/request', { body: { mobile } });
  assert.equal(req.status, 200);
  assert.match(req.json.devOtp, /^\d{6}$/);                              // returned only outside production
  const stored = await M.User.findOne({ mobile }).select('+otp');
  assert.ok(stored.otp.hash && stored.otp.hash !== req.json.devOtp);
  const wrong = await call('POST', '/auth/otp/verify', { body: { mobile, code: req.json.devOtp === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 401);
  const ok = await call('POST', '/auth/otp/verify', { body: { mobile, code: req.json.devOtp } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.mobile, mobile);
  assert.equal((await call('POST', '/auth/otp/verify', { body: { mobile, code: req.json.devOtp } })).status, 401);   // single use
});

test('OTP: locked after 5 wrong attempts even if the right code is then supplied; expiry honoured; format validated', async () => {
  const mobile = '9123456781';
  const { json } = await call('POST', '/auth/otp/request', { body: { mobile } });
  const bad = json.devOtp === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/auth/otp/verify', { body: { mobile, code: bad } })).status, 401);
  assert.equal((await call('POST', '/auth/otp/verify', { body: { mobile, code: json.devOtp } })).status, 429);
  const again = await call('POST', '/auth/otp/request', { body: { mobile } });          // new code resets attempts
  await M.User.updateOne({ mobile }, { 'otp.expiresAt': new Date(Date.now() - 1000) });
  assert.equal((await call('POST', '/auth/otp/verify', { body: { mobile, code: again.json.devOtp } })).status, 401);   // expired
  assert.equal((await call('POST', '/auth/otp/request', { body: { mobile: '12345' } })).status, 400);
  assert.equal((await call('POST', '/auth/otp/request', { body: { mobile: '5123456789' } })).status, 400);             // must start 6-9
});

test('OTP: a disabled account cannot sign in by OTP', async () => {
  const mobile = '9123456782';
  const { json } = await call('POST', '/auth/otp/request', { body: { mobile } });
  await M.User.updateOne({ mobile }, { isActive: false });
  assert.equal((await call('POST', '/auth/otp/verify', { body: { mobile, code: json.devOtp } })).status, 401);
});

test('Google sign-in is refused (501) when not configured, never silently accepted', async () => {
  assert.equal((await call('POST', '/auth/google', { body: { idToken: 'x'.repeat(30) } })).status, 501);
});

test('rate limiting: login endpoint throttles after the configured limit', async () => {
  // A separate tiny limiter check without touching the shared 1000-limit app: spawn a fresh process.
  const { spawnSync } = await import('node:child_process');
  const script = `
    process.env.AUTH_RATE_LIMIT='3'; const h = await import('./test/helpers.mjs'); await h.boot();
    const out=[]; for (let i=0;i<5;i++) out.push((await h.call('POST','/auth/login',{body:{email:'a@b.co',password:'xxxxxxxx'}})).status);
    console.log(JSON.stringify(out)); await h.shutdown();`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 90000 });
  assert.deepEqual(JSON.parse(r.stdout.trim().split('\n').pop()), [401, 401, 401, 429, 429]);
});
