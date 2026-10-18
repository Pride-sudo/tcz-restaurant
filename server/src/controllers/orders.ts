import { Order, Payment, Review } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok, paginate, pageMeta } from '../utils/helpers';
import { currentUser } from '../middleware/auth';
import { createOrder, STATUS_LABELS } from '../services/orders';
import { Cart } from '../models';

export const orderDto = (o: any, extra: any = {}) => ({
  id: String(o._id), orderNumber: o.orderNumber, status: o.status, statusLabel: STATUS_LABELS[o.status], paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod,
  items: o.items.map((i: any) => ({ id: String(i._id), foodId: String(i.foodId), name: i.name, image: i.image, variantName: i.variantName, unitPriceCents: i.unitPriceCents, discountPerUnitCents: i.discountPerUnitCents, quantity: i.quantity, lineTotalCents: i.lineTotalCents })),
  subtotalCents: o.subtotalCents, discountCents: o.discountCents, taxCents: o.taxCents, deliveryFeeCents: o.deliveryFeeCents, totalCents: o.totalCents, currency: o.currency, couponCode: o.couponCode,
  customer: o.customer, address: o.address, instructions: o.instructions, notes: o.notes, estimatedDeliveryAt: o.estimatedDeliveryAt, createdAt: o.createdAt,
  timeline: (o.timeline || []).map((t: any) => ({ status: t.status, label: STATUS_LABELS[t.status], note: t.note, at: t.at })), ...extra,
});

export async function loadOwnedOrder(req: any, id: string) {
  const user = currentUser(req);
  const o: any = await Order.findById(id);
  // Same 404 for "not yours" and "does not exist" so ids cannot be probed.
  if (!o || (String(o.userId) !== String(user._id) && !['admin', 'staff'].includes(user.role))) throw ApiError.notFound('Order not found.');
  return o;
}

export const create = asyncHandler(async (req, res) => {
  const key = (req.get('idempotency-key') || '').trim();
  if (key.length < 8 || key.length > 100) throw ApiError.badRequest('Missing Idempotency-Key header.', 'IDEMPOTENCY_KEY_REQUIRED');
  const user = currentUser(req);
  const { order, replay } = await createOrder(user, req.body, key);
  if (!replay) await Cart.updateOne({ userId: user._id }, { items: [], couponCode: undefined });
  ok(res, orderDto(order), replay ? 200 : 201);
});

export const myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 10, 50);
  const filter = { userId: currentUser(req)._id };
  const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
  ok(res, items.map((o) => orderDto(o)), 200, pageMeta(page, limit, total));
});

export const getOrder = asyncHandler(async (req, res) => {
  const o = await loadOwnedOrder(req, req.params.id);
  const reviews = await Review.find({ orderId: o._id }).select('foodId rating comment');
  const payment = await Payment.findOne({ orderId: o._id }).sort({ createdAt: -1 }).select('status provider');
  const reviewMap: any = {}; reviews.forEach((r: any) => (reviewMap[String(r.foodId)] = { id: String(r._id), rating: r.rating, comment: r.comment }));
  ok(res, orderDto(o, { reviews: reviewMap, canReview: o.status === 'delivered', paymentId: payment ? String(payment._id) : null, paymentProvider: payment?.provider }));
});

export const tracking = asyncHandler(async (req, res) => {
  const o = await loadOwnedOrder(req, req.params.id);
  const flow = ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
  ok(res, {
    orderNumber: o.orderNumber, status: o.status, statusLabel: STATUS_LABELS[o.status], paymentStatus: o.paymentStatus,
    steps: flow.map((s) => { const t = (o.timeline || []).find((x: any) => x.status === s); return { status: s, label: STATUS_LABELS[s], at: t?.at || null, done: !!t }; }),
    cancelled: o.status === 'cancelled', estimatedDeliveryAt: o.estimatedDeliveryAt,
    trackingMode: 'status-based', trackingNote: 'Status updates come from the restaurant. Live driver location is not available.',
    timeline: (o.timeline || []).map((t: any) => ({ status: t.status, label: STATUS_LABELS[t.status], note: t.note, at: t.at })),
  });
});
