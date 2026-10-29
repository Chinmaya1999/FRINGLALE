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

const TROY_OZ_G = 31.1034768;
const getJson = async (url, init) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
};

/** Free public feeds, no key: spot gold/platinum/silver in USD per troy oz (gold-api.com) and USD→INR (open.er-api.com). */
async function fetchSpotRate() {
  const [xau, xpt, xag, fx] = await Promise.all([
    getJson('https://api.gold-api.com/price/XAU'), getJson('https://api.gold-api.com/price/XPT'),
    getJson('https://api.gold-api.com/price/XAG'), getJson('https://open.er-api.com/v6/latest/USD'),
  ]);
  const inr = fx?.rates?.INR;
  if (!(xau?.price > 0) || !(xpt?.price > 0) || !(xag?.price > 0) || !(inr > 0)) throw new Error('Spot feed returned no usable price');
  // GOLD_PREMIUM_PCT lets the shop add import duty / local premium on top of the international price.
  const perGram = (usdOz) => (usdOz / TROY_OZ_G) * inr * (1 + env.goldPremiumPct / 100);
  return { gold24PerGram: perGram(xau.price), platinumPerGram: perGram(xpt.price) * 0.95, silverPerGram: perGram(xag.price) * 0.925 };
}

/** Pull today's rate: from GOLD_API_URL if configured, otherwise from the free spot feeds above. */
export async function fetchRemoteRate() {
  let body;
  if (env.goldApiUrl) {
    body = await getJson(env.goldApiUrl, { headers: env.goldApiKey ? { 'x-api-key': env.goldApiKey } : {} });
    // Expected shape: { gold24PerGram, platinumPerGram, silverPerGram }. Adapt to your provider here.
  } else body = await fetchSpotRate();
  if (!(body.gold24PerGram > 0)) throw new Error('Gold feed returned no usable price');
  const prev = await latestRate();
  return {
    ...fromGold24(body.gold24PerGram),
    platinum: Math.round(body.platinumPerGram) || prev?.rates?.platinum,
    silver: Math.round(body.silverPerGram) || prev?.rates?.silver,
  };
}

/** Fetch and store today's rate unless an admin already set one today. Never throws; the previous rate stays on failure. */
export async function refreshRate({ force = false } = {}) {
  try {
    const last = await latestRate();
    if (!force && last?.date === istDate() && last.source !== 'seed') return last;
    const rates = await fetchRemoteRate();
    return rates ? await recordRate(rates, 'api') : null;
  } catch (e) {
    console.error('[gold-rate] refresh failed, keeping previous rate:', e.message);
    return null;
  }
}

export async function recordRate(rates, source, setBy) {
  return GoldRate.create({ date: istDate(), rates, source, setBy });
}
