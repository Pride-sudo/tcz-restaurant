import { Food, InventoryMovement, Order, Settings } from '../models';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

type Line = { foodId: any; quantity: number; name?: string };
const log = (restaurantId: any, f: any, type: string, stockDelta: number, reservedDelta: number, extra: any = {}) =>
  InventoryMovement.create({ restaurantId, foodId: f._id, type, stockDelta, reservedDelta, stockAfter: f.stock, reservedAfter: f.reserved, ...extra });

/**
 * Atomically reserve stock for every line. Each line is one conditional update
 * (available = stock - reserved >= qty), so concurrent orders can never oversell.
 * Works on standalone MongoDB (no transactions needed); partial reservations are rolled back.
 */
export async function reserveStock(restaurantId: any, lines: Line[], orderId: any, actorId?: any) {
  const done: { line: Line; doc: any }[] = [];
  try {
    for (const line of lines) {
      const doc = await Food.findOneAndUpdate(
        { _id: line.foodId, restaurantId, archived: false, isAvailable: true, $expr: { $gte: [{ $subtract: ['$stock', '$reserved'] }, line.quantity] } },
        { $inc: { reserved: line.quantity } }, { new: true });
      if (!doc) throw ApiError.conflict(`Sorry, ${line.name || 'an item'} just sold out or has too little stock left.`, 'INSUFFICIENT_STOCK', { foodId: String(line.foodId) });
      done.push({ line, doc });
    }
  } catch (e) {
    for (const d of done) await Food.updateOne({ _id: d.line.foodId }, { $inc: { reserved: -d.line.quantity } });
    throw e;
  }
  await Promise.all(done.map((d) => log(restaurantId, d.doc, 'reserve', 0, d.line.quantity, { orderId, actorId, reason: 'Order placed' })));
}

/** Undo a reservation for a line set that was reserved but whose order was never saved. */
export async function rollbackReservation(lines: Line[]) {
  for (const l of lines) await Food.updateOne({ _id: l.foodId }, { $inc: { reserved: -l.quantity } });
}

const orderLines = (o: any): Line[] => o.items.map((i: any) => ({ foodId: i.foodId, quantity: i.quantity, name: i.name }));

/** reserved -> released. The state flip is the idempotency guard (runs at most once). */
export async function releaseStock(order: any, reason: string, actorId?: any) {
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockState: 'reserved' }, { stockState: 'released' });
  if (!claimed) return false;
  for (const l of orderLines(order)) {
    const doc = await Food.findOneAndUpdate({ _id: l.foodId, reserved: { $gte: l.quantity } }, { $inc: { reserved: -l.quantity } }, { new: true });
    if (doc) await log(order.restaurantId, doc, 'release', 0, -l.quantity, { orderId: order._id, actorId, reason });
    else logger.error('Reservation release found inconsistent reserved count', { orderId: String(order._id), foodId: String(l.foodId) });
  }
  return true;
}

/** reserved -> committed: stock and reserved both drop, sold count rises. Exactly once per order. */
export async function commitStock(order: any, reason: string, actorId?: any) {
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockState: 'reserved' }, { stockState: 'committed' });
  if (!claimed) return false;
  for (const l of orderLines(order)) {
    const doc = await Food.findOneAndUpdate({ _id: l.foodId }, { $inc: { stock: -l.quantity, reserved: -l.quantity, soldCount: l.quantity } }, { new: true });
    if (doc) await log(order.restaurantId, doc, 'commit', -l.quantity, -l.quantity, { orderId: order._id, actorId, reason });
  }
  return true;
}

/** committed -> returned (cancelled before the kitchen used the ingredients). */
export async function returnCommittedStock(order: any, reason: string, actorId?: any) {
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockState: 'committed' }, { stockState: 'returned' });
  if (!claimed) return false;
  for (const l of orderLines(order)) {
    const doc = await Food.findOneAndUpdate({ _id: l.foodId }, { $inc: { stock: l.quantity, soldCount: -l.quantity } }, { new: true });
    if (doc) await log(order.restaurantId, doc, 'cancel_return', l.quantity, 0, { orderId: order._id, actorId, reason });
  }
  return true;
}

export async function restock(restaurantId: any, foodId: any, quantity: number, opts: { costCents?: number; reason?: string; actorId?: any }) {
  const set: any = { lastRestockedAt: new Date() };
  if (opts.costCents != null) set.costCents = opts.costCents;
  const doc = await Food.findOneAndUpdate({ _id: foodId, restaurantId }, { $inc: { stock: quantity }, $set: set }, { new: true });
  if (!doc) throw ApiError.notFound('Product not found.');
  await log(restaurantId, doc, 'restock', quantity, 0, { reason: opts.reason || 'Restock', actorId: opts.actorId });
  return doc;
}

/** Signed stock correction. Refuses to drop below reserved stock (or below 0 when negative stock is allowed). */
export async function adjustStock(restaurantId: any, foodId: any, delta: number, reason: string, actorId: any) {
  const settings: any = await Settings.findOne({ restaurantId });
  const allowNegative = !!settings?.allowNegativeStock;
  const filter: any = { _id: foodId, restaurantId };
  if (delta < 0 && !allowNegative) filter.$expr = { $gte: [{ $add: ['$stock', delta] }, '$reserved'] };
  const doc = await Food.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true });
  if (!doc) {
    const exists = await Food.exists({ _id: foodId, restaurantId });
    if (!exists) throw ApiError.notFound('Product not found.');
    throw ApiError.conflict('That adjustment would take stock below what is already reserved for open orders.', 'NEGATIVE_STOCK');
  }
  await log(restaurantId, doc, 'adjustment', delta, 0, { reason, actorId });
  return doc;
}

export const stockStatus = (f: any) => {
  const avail = Math.max(0, f.stock - f.reserved);
  return avail <= 0 ? 'out' : avail <= f.lowStockThreshold ? 'low' : 'ok';
};
