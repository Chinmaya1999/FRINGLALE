import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { HttpError, wrap } from '../utils/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const readToken = (req) => {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.token || null;
};

export const requireAuth = wrap(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Login required');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }); } catch { throw new HttpError(401, 'Session expired'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new HttpError(401, 'Account unavailable');
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw new HttpError(401, 'Session expired');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Not allowed'));
