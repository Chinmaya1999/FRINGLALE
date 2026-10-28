import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';

const configured = !!(env.razorpay.keyId && env.razorpay.keySecret);
const client = configured ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret }) : null;

/** Without keys we run in a clearly-labelled dev mode that is impossible to enable in production. */
export const paymentsMode = () => (configured ? 'razorpay' : env.isProd ? 'unavailable' : 'dev');

export async function createGatewayOrder(amountInr, receipt) {
  if (paymentsMode() === 'dev') return { id: `dev_${crypto.randomBytes(8).toString('hex')}`, amount: Math.round(amountInr * 100), currency: 'INR' };
  if (!client) throw new Error('Payments are not configured');
  return client.orders.create({ amount: Math.round(amountInr * 100), currency: 'INR', receipt });
}

export function verifySignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhook(rawBody, signature) {
  const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const publicKeyId = () => env.razorpay.keyId;
