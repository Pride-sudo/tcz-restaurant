import { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'crypto';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export const ok = (res: Response, data: unknown, status = 200, meta?: unknown) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function paginate(query: any, defLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}
export const pageMeta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomCode(len = 4) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
