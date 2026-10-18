import { expireUnpaidOrders } from '../services/orders';
import { logger } from '../utils/logger';

let timer: NodeJS.Timeout | null = null;
export function startJobs() {
  timer = setInterval(async () => {
    try { const n = await expireUnpaidOrders(); if (n) logger.info('Expired unpaid orders', { count: n }); }
    catch (e: any) { logger.error('Expiry job failed', { message: e.message }); }
  }, 60_000);
  timer.unref();
}
export const stopJobs = () => { if (timer) clearInterval(timer); };
