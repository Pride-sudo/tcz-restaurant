import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';

export const COOKIE = 'tcz_token';

export function signToken(user: any) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion || 0 }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}
export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}
export const clearAuthCookie = (res: Response) =>
  res.clearCookie(COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none', sameSite: env.COOKIE_SAMESITE, path: '/' });

async function resolveUser(req: Request) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active' || (user.tokenVersion || 0) !== payload.tv) return null;
    return user;
  } catch { return null; }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try { (req as any).user = await resolveUser(req); next(); } catch (e) { next(e); }
}
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized();
    (req as any).user = user;
    next();
  } catch (e) { next(e); }
}
export const requireRole = (...roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) return next(ApiError.unauthorized());
  if (!roles.includes(user.role)) return next(ApiError.forbidden());
  next();
};
export const currentUser = (req: Request) => (req as any).user as any;
