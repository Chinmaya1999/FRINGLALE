import cron from 'node-cron';
import { fetchRemoteRate, recordRate } from '../services/goldRate.js';

/** 09:30 IST daily. Failures are logged and leave the previous rate in place; admins can override manually. */
export function startGoldRateCron() {
  cron.schedule('30 9 * * *', async () => {
    try {
      const rates = await fetchRemoteRate();
      if (rates) await recordRate(rates, 'api');
    } catch (e) {
      console.error('[gold-rate cron] failed, keeping previous rate:', e.message);
    }
  }, { timezone: 'Asia/Kolkata' });
}
