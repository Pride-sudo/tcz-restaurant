import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { clientOrigins } from '../config/env';
import { ApiError } from '../utils/ApiError';

/** Strip Mongo operators ($...) and dotted keys from user supplied objects. */
function clean(v: any): any {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(val);
    }
    return out;
  }
  return v;
}
export function sanitize(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = clean(req.body);
  if (req.query) {
    const q = clean({ ...req.query });
    for (const k of Object.keys(req.query)) delete (req.query as any)[k];
    Object.assign(req.query, q);
  }
  next();
}

/**
 * CSRF defence for cookie auth: state-changing requests must carry a custom header
 * (forces a CORS preflight, which only allow-listed origins pass) and, if an Origin
 * header is present, it must be allow-listed.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/api/payments/webhook') return next();
  if (req.get('x-requested-with') !== 'tcz-web') return next(ApiError.forbidden('Missing CSRF header.'));
  const origin = req.get('origin');
  if (origin && !clientOrigins.includes(origin.replace(/\/$/, ''))) return next(ApiError.forbidden('Origin not allowed.'));
  next();
}

const limiter = (windowMs: number, max: number, message: string) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }) });

export const apiLimiter = limiter(60_000, 300, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many attempts. Please try again in a few minutes.');
export const resetLimiter = limiter(60 * 60_000, 6, 'Too many reset requests. Please try again later.');
export const orderLimiter = limiter(60_000, 10, 'Too many order attempts. Please wait a moment.');
