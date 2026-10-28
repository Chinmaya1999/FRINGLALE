import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import auth from './routes/auth.js';
import catalog from './routes/catalog.js';
import pricing from './routes/pricing.js';
import goldRates from './routes/goldRates.js';
import savedDesigns from './routes/savedDesigns.js';
import cart from './routes/cart.js';
import orders from './routes/orders.js';
import uploads, { UPLOAD_DIR } from './routes/uploads.js';
import requests from './routes/requests.js';
import account from './routes/account.js';
import admin from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl.split(','), credentials: true }));
  app.use(compression());
  // Razorpay signs the exact bytes, so the webhook needs the raw body before JSON parsing.
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); } }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', auth);
  app.use('/api', catalog);
  app.use('/api/pricing', pricing);
  app.use('/api/gold-rates', goldRates);
  app.use('/api/saved-designs', savedDesigns);
  app.use('/api/cart', cart);
  app.use('/api/uploads', uploads);
  app.use('/api', orders);
  app.use('/api', requests);
  app.use('/api', account);
  app.use('/api/admin', admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
