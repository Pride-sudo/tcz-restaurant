import { Types } from 'mongoose';
import { Coupon, Order, Payment } from '../models';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { randomCode } from '../utils/helpers';
import { devPaymentsEnabled, stripeConfigured } from '../config/env';
import { priceItems } from './pricing';
import { commitStock, releaseStock, reserveStock, returnCommittedStock, rollbackReservation } from './inventory';
import { getSettings } from './restaurant';

export const TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const canTransition = (from: string, to: string) => !!TRANSITIONS[from]?.includes(to);
export const STATUS_LABELS: Record<string, string> = { placed: 'Order placed', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready for dispatch', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

const RESERVATION_MINUTES = 30;

async function nextOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < 6; i++) {
    const n = `TCZ-${ymd}-${randomCode(4)}`;
    if (!(await Order.exists({ orderNumber: n }))) return n;
  }
  return `TCZ-${ymd}-${randomCode(8)}`;
}

export interface CreateOrderInput {
  items: { foodId: string; variantName?: string | null; quantity: number }[];
  couponCode?: string | null;
  paymentMethod: 'card' | 'cash' | 'dev';
  customer: { name: string; phone: string };
  addressId?: string;
  address?: { label?: string; line1: string; line2?: string; city: string; notes?: string };
  instructions?: string;
  notes?: string;
}

export async function createOrder(user: any, input: CreateOrderInput, idempotencyKey: string) {
  const restaurantId = user.restaurantId;
  const existing = await Order.findOne({ userId: user._id, idempotencyKey });
  if (existing) return { order: existing, replay: true };

  const settings: any = await getSettings(restaurantId);
  if (input.paymentMethod === 'card' && !stripeConfigured) throw new ApiError(503, 'Card payments are not configured on this server yet. Please choose cash on delivery.', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  if (input.paymentMethod === 'dev' && !devPaymentsEnabled) throw ApiError.badRequest('The development payment option is disabled.', 'DEV_PAYMENTS_DISABLED');

  let address: any = input.address;
  if (input.addressId) {
    const saved = user.addresses.id(input.addressId);
    if (!saved) throw ApiError.badRequest('Selected address was not found.', 'BAD_ADDRESS');
    address = { label: saved.label, line1: saved.line1, line2: saved.line2, city: saved.city, notes: saved.notes };
  }
  if (!address) throw ApiError.badRequest('A delivery address is required.', 'BAD_ADDRESS');
  if (settings.deliveryAreas?.length && !settings.deliveryAreas.some((a: string) => a.toLowerCase() === String(address.city).trim().toLowerCase()))
    throw new ApiError(422, `We currently deliver to: ${settings.deliveryAreas.join(', ')}.`, 'OUT_OF_AREA', { 'address.city': 'Outside our delivery area' });

  const priced = await priceItems(restaurantId, input.items, settings, input.couponCode);
  if (priced.lines.length === 0) throw ApiError.badRequest('Your cart is empty.', 'EMPTY_CART');
  if (priced.issues.length) throw ApiError.conflict(priced.issues[0].message, 'CART_ISSUES', priced.issues);
  if (input.couponCode && priced.couponError) throw ApiError.badRequest(priced.couponError, 'COUPON_INVALID');
  const sub = priced.lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (sub < settings.minOrderCents) throw new ApiError(422, `The minimum order is ${(settings.minOrderCents / 100).toFixed(2)} ${settings.currency}.`, 'MIN_ORDER');

  const orderId = new Types.ObjectId();
  await reserveStock(restaurantId, priced.lines.map((l) => ({ foodId: l.foodId, quantity: l.quantity, name: l.name })), orderId, user._id);

  let couponClaimed = false;
  try {
    if (priced.coupon) {
      const r = await Coupon.updateOne({ _id: priced.coupon._id, $expr: { $or: [{ $eq: [{ $ifNull: ['$usageLimit', null] }, null] }, { $lt: ['$usedCount', '$usageLimit'] }] } }, { $inc: { usedCount: 1 } });
      if (!r.modifiedCount) throw ApiError.badRequest('This coupon has just been fully redeemed.', 'COUPON_EXHAUSTED');
      couponClaimed = true;
    }
    const maxPrep = Math.max(settings.prepMinutesDefault, ...priced.lines.map((l) => l.prepMinutes || 0));
    const now = new Date();
    const order = await Order.create({
      _id: orderId, restaurantId, orderNumber: await nextOrderNumber(), userId: user._id,
      items: priced.lines.map((l) => ({ foodId: l.foodId, name: l.name, image: l.image, variantName: l.variantName, unitPriceCents: l.unitPriceCents, discountPerUnitCents: l.discountPerUnitCents, quantity: l.quantity, lineTotalCents: l.lineTotalCents })),
      ...priced.totals, couponCode: priced.coupon?.code, currency: settings.currency,
      paymentMethod: input.paymentMethod, paymentStatus: 'unpaid', status: 'placed', stockState: 'reserved',
      reservationExpiresAt: input.paymentMethod === 'cash' ? undefined : new Date(now.getTime() + RESERVATION_MINUTES * 60000),
      customer: { name: input.customer.name, phone: input.customer.phone, email: user.email },
      address, instructions: input.instructions, notes: input.notes,
      estimatedDeliveryAt: new Date(now.getTime() + (maxPrep + settings.deliveryMinutes) * 60000),
      idempotencyKey, timeline: [{ status: 'placed', note: 'Order placed', at: now, by: user._id }],
    });
    return { order, replay: false };
  } catch (e: any) {
    await rollbackReservation(priced.lines.map((l) => ({ foodId: l.foodId, quantity: l.quantity })));
    if (couponClaimed) await Coupon.updateOne({ _id: priced.coupon._id }, { $inc: { usedCount: -1 } });
    if (e?.code === 11000 && e.keyPattern?.idempotencyKey) { const again = await Order.findOne({ userId: user._id, idempotencyKey }); if (again) return { order: again, replay: true }; }
    throw e;
  }
}

/** Move an order to a new status. `actor` null means the system (expiry job, payment failure). */
export async function changeStatus(orderId: any, to: string, actor: any | null, note?: string, opts: { returnStock?: boolean } = {}) {
  const order: any = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found.');
  const from = order.status;
  if (!canTransition(from, to)) throw ApiError.conflict(`An order that is "${STATUS_LABELS[from]}" cannot move to "${STATUS_LABELS[to]}".`, 'INVALID_TRANSITION');
  if (to === 'confirmed' && order.paymentMethod !== 'cash' && order.paymentStatus !== 'paid') throw ApiError.conflict('This order has not been paid yet, so it cannot be confirmed.', 'PAYMENT_REQUIRED');

  const set: any = { status: to };
  if (to === 'delivered' && order.paymentMethod === 'cash') set.paymentStatus = 'paid';
  const updated: any = await Order.findOneAndUpdate({ _id: orderId, status: from }, { $set: set, $push: { timeline: { status: to, note: note || STATUS_LABELS[to], at: new Date(), by: actor?._id } } }, { new: true });
  if (!updated) throw ApiError.conflict('This order was just updated by someone else. Refresh and try again.', 'CONCURRENT_UPDATE');

  if (to === 'confirmed' && order.paymentMethod === 'cash') await commitStock(updated, 'Cash order confirmed', actor?._id);
  if (to === 'cancelled') {
    await releaseStock(updated, 'Order cancelled', actor?._id);
    const early = ['placed', 'confirmed'].includes(from);
    if (opts.returnStock ?? early) await returnCommittedStock(updated, 'Order cancelled - stock returned', actor?._id);
    if (updated.couponCode) await Coupon.updateOne({ restaurantId: updated.restaurantId, code: updated.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    await Payment.updateMany({ orderId, status: 'pending' }, { status: 'cancelled' });
    if (updated.paymentStatus === 'pending') await Order.updateOne({ _id: orderId }, { paymentStatus: 'unpaid' });
  }
  return Order.findById(orderId);
}

export interface PaidInfo { provider: 'stripe' | 'dev'; sessionId?: string; paymentIntentId?: string; amountCents: number; currency: string }

/** Idempotently mark an order paid after *server-verified* provider confirmation. */
export async function markOrderPaid(orderId: any, info: PaidInfo) {
  const order: any = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found.');
  if (info.amountCents !== order.totalCents || info.currency.toLowerCase() !== order.currency.toLowerCase()) {
    logger.error('Payment amount mismatch - not marking paid', { orderId: String(orderId), expected: order.totalCents, got: info.amountCents });
    throw ApiError.conflict('Payment amount does not match the order total.', 'AMOUNT_MISMATCH');
  }
  const payFilter: any = { orderId };
  if (info.sessionId) payFilter.providerSessionId = info.sessionId;
  await Payment.updateMany({ ...payFilter, status: { $in: ['pending', 'failed'] } }, { status: 'succeeded', providerPaymentIntentId: info.paymentIntentId });

  if (order.status === 'cancelled') {
    // Money arrived for an order that was already cancelled/expired: record it so staff can refund.
    await Order.updateOne({ _id: orderId, paymentStatus: { $ne: 'paid' } }, { paymentStatus: 'paid', $push: { timeline: { status: 'cancelled', note: 'Payment received after cancellation - refund required', at: new Date() } } });
    return { order: await Order.findById(orderId), lateCancelledPayment: true };
  }
  const updated: any = await Order.findOneAndUpdate({ _id: orderId, paymentStatus: { $in: ['unpaid', 'pending', 'failed'] } }, { paymentStatus: 'paid', $unset: { reservationExpiresAt: 1 }, $push: { timeline: { status: order.status, note: 'Payment received', at: new Date() } } }, { new: true });
  if (updated) await commitStock(updated, 'Payment verified');
  return { order: updated || (await Order.findById(orderId)), duplicate: !updated };
}

export async function markPaymentFailed(orderId: any, reason: string) {
  const order: any = await Order.findOneAndUpdate({ _id: orderId, paymentStatus: { $in: ['unpaid', 'pending'] }, status: { $ne: 'cancelled' } }, { paymentStatus: 'failed' }, { new: true });
  if (!order) return null;
  await Payment.updateMany({ orderId, status: 'pending' }, { status: 'failed', failureReason: reason });
  return changeStatus(orderId, 'cancelled', null, `Payment failed: ${reason}`, { returnStock: false });
}

/** Cancel unpaid card orders whose stock reservation window has passed. */
export async function expireUnpaidOrders(now = new Date()) {
  const stale = await Order.find({ status: 'placed', paymentMethod: { $in: ['card', 'dev'] }, paymentStatus: { $in: ['unpaid', 'pending'] }, reservationExpiresAt: { $lt: now } }).limit(100);
  let n = 0;
  for (const o of stale) { try { await markPaymentFailed(o._id, 'Payment window expired'); n++; } catch (e: any) { logger.error('Expiry failed', { orderId: String(o._id), message: e.message }); } }
  return n;
}
