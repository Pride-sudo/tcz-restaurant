import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProd } from '../config/env';

export const notFound = (_req: Request, _res: Response, next: NextFunction) => next(ApiError.notFound('Route not found.'));

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.name === 'CastError') return res.status(400).json({ success: false, error: { code: 'BAD_ID', message: 'Invalid identifier.' } });
  if (err?.code === 11000) return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'That record already exists.' } });
  if (err?.name === 'MulterError' || err?.message === 'UNSUPPORTED_FILE') {
    return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message === 'UNSUPPORTED_FILE' ? 'Only JPEG, PNG or WebP images are allowed.' : 'Upload failed. Images must be under 3 MB.' } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: { code: 'BAD_JSON', message: 'Malformed JSON body.' } });
  logger.error('Unhandled error', { path: req.path, method: req.method, message: err?.message, stack: isProd ? undefined : err?.stack });
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
}
