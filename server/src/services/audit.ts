import { Request } from 'express';
import { AuditLog } from '../models';
import { logger } from '../utils/logger';

export async function audit(req: Request, action: string, entity: string, entityId: any, meta: any = {}) {
  try {
    const u = (req as any).user;
    await AuditLog.create({ actorId: u?._id, restaurantId: u?.restaurantId, action, entity, entityId: String(entityId ?? ''), meta, ip: req.ip });
  } catch (e: any) { logger.error('Audit write failed', { message: e.message }); }
}
