import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate = (schema: ZodSchema, where: 'body' | 'query' | 'params' = 'body') => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse((req as any)[where]);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ||= i.message;
    return next(new ApiError(422, 'Please check the highlighted fields.', 'VALIDATION_ERROR', fields));
  }
  if (where === 'query') { for (const k of Object.keys(req.query)) delete (req.query as any)[k]; Object.assign(req.query, r.data); }
  else (req as any)[where] = r.data;
  next();
};
