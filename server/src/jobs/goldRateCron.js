import cron from 'node-cron';
import { refreshRate } from '../services/goldRate.js';

/** Live rate from the internet: once at boot (if today has none yet), then every day at 09:30 IST and again at 15:30 IST. A manual admin rate set today is kept until the next morning's run. */
export function startGoldRateCron() {
  refreshRate();
  cron.schedule('30 9 * * *', () => refreshRate({ force: true }), { timezone: 'Asia/Kolkata' });
  cron.schedule('30 15 * * *', () => refreshRate({ force: true }), { timezone: 'Asia/Kolkata' });
}
