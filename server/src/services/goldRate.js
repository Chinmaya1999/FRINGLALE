import { GoldRate } from '../models/index.js';
import { env } from '../config/env.js';

export const istDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

export const latestRate = () => GoldRate.findOne().sort({ createdAt: -1 }).lean();

/** Derive per-karat rates from a 24K price. */
export const fromGold24 = (g24) => ({
  '24K': Math.round(g24),
  '22K': Math.round((g24 * 22) / 24),
  '18K': Math.round((g24 * 18) / 24),
  '14K': Math.round((g24 * 14) / 24),
});

/** Pull today's rate from the configured feed. Returns null if no feed is configured. */
export async function fetchRemoteRate() {
  if (!env.goldApiUrl) return null;
  const res = await fetch(env.goldApiUrl, { headers: env.goldApiKey ? { 'x-api-key': env.goldApiKey } : {} });
  if (!res.ok) throw new Error(`Gold feed responded ${res.status}`);
  const body = await res.json();
  // Expected shape: { gold24PerGram, platinumPerGram, silverPerGram }. Adapt to your provider here.
  if (!(body.gold24PerGram > 0)) throw new Error('Gold feed returned no usable price');
  const prev = await latestRate();
  return {
    ...fromGold24(body.gold24PerGram),
    platinum: body.platinumPerGram ?? prev?.rates?.platinum,
    silver: body.silverPerGram ?? prev?.rates?.silver,
  };
}

export async function recordRate(rates, source, setBy) {
  return GoldRate.create({ date: istDate(), rates, source, setBy });
}
