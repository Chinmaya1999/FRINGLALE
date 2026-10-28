import { ZodError } from 'zod';
import { env } from '../config/env.js';

export function notFound(_req, res) {
  res.status(404).json({ error: { message: 'Not found' } });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { message: 'Validation failed', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: { message: 'Invalid id' } });
  if (err.code === 11000) return res.status(409).json({ error: { message: 'Already exists' } });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: { message: status >= 500 && env.isProd ? 'Server error' : err.message, code: err.code } });
}
