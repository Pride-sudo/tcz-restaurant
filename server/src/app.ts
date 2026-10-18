import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import { clientOrigins, env } from './config/env';
import { apiLimiter, csrfGuard, sanitize } from './middleware/security';
import { errorHandler, notFound } from './middleware/errors';
import { webhook } from './controllers/payments';
import routes from './routes';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || clientOrigins.includes(origin)), credentials: true, allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Requested-With'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));

  // Webhook needs the raw body for signature verification, so it is mounted before express.json().
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => { webhook(req, res).catch(next); });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => { const t = Date.now(); res.on('finish', () => { if (req.path !== '/health') logger.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t }); }); next(); });
  app.use(sanitize);
  app.get('/health', (_req, res) => { const up = mongoose.connection.readyState === 1; res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'degraded', db: up ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) }); });
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '7d', index: false }));
  app.use('/api', apiLimiter, csrfGuard, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
