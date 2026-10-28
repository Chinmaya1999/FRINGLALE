import { Setting } from '../models/index.js';
import { DEFAULT_SETTINGS } from './pricing.js';

export async function getSettings() {
  const rows = await Setting.find({ key: { $in: ['gstPercent', 'shipping', 'extras', 'sizeFactors'] } }).lean();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.key === 'gstPercent' ? r.value : { ...(DEFAULT_SETTINGS[r.key] || {}), ...r.value };
  return s;
}
