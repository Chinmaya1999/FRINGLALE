import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export async function makeOtp() {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  return { code, hash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
}

/** Deliver via SMS/WhatsApp. Without a provider configured we only log in non-production. */
export async function sendOtp(mobile, code) {
  if (!env.isProd) console.log(`[dev] OTP for ${mobile}: ${code}`);
  // TODO(provider): call MSG91 / Twilio here once SMS_PROVIDER_KEY is configured.
}
