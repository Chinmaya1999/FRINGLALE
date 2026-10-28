import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { makeOtp, sendOtp, OTP_MAX_ATTEMPTS } from '../services/otp.js';

const r = Router();
const strict = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const otpLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

const mobile = z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')
  .transform((m) => m.replace(/^\+91/, ''));
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, savedRingSize: u.savedRingSize });
const session = (u) => ({ token: signToken(u), user: publicUser(u) });

r.post('/register', strict, validate(z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
})), wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new HttpError(409, 'Email already registered');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(session(user));
}));

r.post('/login', strict, validate(z.object({
  email: z.string().email().toLowerCase(), password: z.string().min(1),
})), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same message for unknown user and wrong password.
  const ok = user?.passwordHash && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok || !user.isActive) throw new HttpError(401, 'Invalid email or password');
  res.json(session(user));
}));

r.post('/otp/request', otpLimit, validate(z.object({ mobile })), wrap(async (req, res) => {
  const { code, hash, expiresAt } = await makeOtp();
  await User.findOneAndUpdate(
    { mobile: req.body.mobile },
    { $set: { otp: { hash, expiresAt, attempts: 0 } }, $setOnInsert: { mobile: req.body.mobile } },
    { upsert: true },
  );
  await sendOtp(req.body.mobile, code);
  res.json({ sent: true, ...(env.isProd ? {} : { devOtp: code }) });
}));

r.post('/otp/verify', strict, validate(z.object({ mobile, code: z.string().length(6) })), wrap(async (req, res) => {
  const user = await User.findOne({ mobile: req.body.mobile }).select('+otp');
  const o = user?.otp;
  if (!o?.hash || o.expiresAt < new Date()) throw new HttpError(401, 'Code expired. Request a new one.');
  if (o.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many attempts. Request a new code.');
  if (!(await bcrypt.compare(req.body.code, o.hash))) {
    await User.updateOne({ _id: user._id }, { $inc: { 'otp.attempts': 1 } });
    throw new HttpError(401, 'Incorrect code');
  }
  await User.updateOne({ _id: user._id }, { $unset: { otp: 1 } });   // single use
  res.json(session(user));
}));

r.post('/google', strict, validate(z.object({ idToken: z.string().min(10) })), wrap(async (req, res) => {
  if (!env.googleClientId) throw new HttpError(501, 'Google login is not configured');
  const ticket = await new OAuth2Client(env.googleClientId)
    .verifyIdToken({ idToken: req.body.idToken, audience: env.googleClientId });
  const p = ticket.getPayload();
  if (!p?.email_verified) throw new HttpError(401, 'Google email not verified');
  let user = await User.findOne({ $or: [{ googleId: p.sub }, { email: p.email }] });
  if (!user) user = await User.create({ googleId: p.sub, email: p.email, name: p.name });
  else if (!user.googleId) { user.googleId = p.sub; await user.save(); }
  res.json(session(user));
}));

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default r;
