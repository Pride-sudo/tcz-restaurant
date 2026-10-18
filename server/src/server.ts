import { env } from './config/env';
import { connectDb, disconnectDb } from './config/db';
import { createApp } from './app';
import { getRestaurant, getSettings } from './services/restaurant';
import { startJobs, stopJobs } from './jobs';
import { logger } from './utils/logger';
import { devPaymentsEnabled, stripeConfigured } from './config/env';

async function main() {
  await connectDb();
  const r = await getRestaurant();
  await getSettings(r._id);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`TCZ API listening on :${env.PORT}`, { env: env.NODE_ENV, stripe: stripeConfigured, devPayments: devPaymentsEnabled });
    if (!stripeConfigured) logger.warn('STRIPE_SECRET_KEY not set: card payments disabled (cash on delivery still works).');
  });
  startJobs();
  const shutdown = (sig: string) => {
    logger.info(`${sig} received, shutting down`);
    stopJobs();
    server.close(async () => { await disconnectDb(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (e: any) => logger.error('Unhandled rejection', { message: e?.message }));
}
main().catch((e) => { logger.error('Fatal startup error', { message: e.message }); process.exit(1); });
