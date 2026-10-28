import { Coupon } from '../models/index.js';
import { quote } from './quote.js';
import { getSettings } from './settings.js';
import { HttpError } from '../utils/http.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function resolveCoupon(code, subtotal) {
  if (!code) return null;
  const c = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).lean();
  const now = new Date();
  if (!c || (c.validFrom && c.validFrom > now) || (c.validTo && c.validTo < now) || (c.usageLimit && c.used >= c.usageLimit)) {
    throw new HttpError(422, 'Coupon is not valid');
  }
  if (subtotal < c.minOrder) throw new HttpError(422, `Coupon needs a minimum order of ₹${c.minOrder}`);
  let discount = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  return { code: c.code, discount: r2(Math.min(discount, subtotal)) };
}

/** Price every cart line with the same engine used by the builder, then combine into order totals. */
export async function priceCart(items, { lockedRates = null, couponCode = null } = {}) {
  if (!items.length) throw new HttpError(422, 'Cart is empty');
  const lines = [];
  for (const it of items) {
    const q = await quote({ designId: it.design, config: it.config, lockedRates });
    lines.push({ design: it.design, designName: q.design.name, config: it.config, qty: it.qty, quote: q });
  }
  const settings = await getSettings();
  const subtotal = r2(lines.reduce((s, l) => s + l.quote.price.subtotal * l.qty, 0));
  const coupon = await resolveCoupon(couponCode, subtotal);
  const discount = coupon?.discount || 0;
  const taxable = r2(subtotal - discount);
  const gst = r2((taxable * settings.gstPercent) / 100);
  const shipping = r2(settings.shipping?.flat ?? 0);
  const total = r2(taxable + gst + shipping);
  return {
    lines, coupon,
    totals: { subtotal, discount, taxable, gstPercent: settings.gstPercent, gst, shipping, total },
    advancePercent: settings.advancePercent ?? 30,
  };
}
