import { Request } from 'express';
import fs from 'fs';
import { Types } from 'mongoose';
import { AuditLog, Category, Coupon, Food, InventoryMovement, Order, Payment, Settings, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, escapeRegex, ok, pageMeta, slugify } from '../utils/helpers';
import { currentUser } from '../middleware/auth';
import { audit } from '../services/audit';
import { adjustStock, restock, stockStatus } from '../services/inventory';
import { changeStatus } from '../services/orders';
import { getProvider } from '../services/payments';
import { getRestaurant, getSettings } from '../services/restaurant';
import { orderDto } from './orders';
import { toFoodDto } from './food';

const rid = async () => (await getRestaurant())._id;

/* ---------- dashboard ---------- */
export const dashboard = asyncHandler(async (req, res) => {
  const restaurantId = await rid();
  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days)) || 30));
  const since = new Date(Date.now() - days * 86400000); since.setHours(0, 0, 0, 0);
  // Revenue only counts orders that are verified paid and not cancelled.
  const revenueMatch: any = { restaurantId, paymentStatus: 'paid', status: { $ne: 'cancelled' } };
  const [totals, inRange, byStatus, customers, activeFoods, foods, daily, best, recent] = await Promise.all([
    Order.aggregate([{ $match: revenueMatch }, { $group: { _id: null, revenue: { $sum: '$totalCents' }, n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...revenueMatch, createdAt: { $gte: since } } }, { $group: { _id: null, revenue: { $sum: '$totalCents' }, n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { restaurantId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.countDocuments({ restaurantId, role: 'customer' }),
    Food.countDocuments({ restaurantId, archived: false, isAvailable: true }),
    Food.find({ restaurantId, archived: false }).select('name stock reserved lowStockThreshold'),
    Order.aggregate([{ $match: { ...revenueMatch, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalCents' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: { ...revenueMatch, createdAt: { $gte: since } } }, { $unwind: '$items' }, { $group: { _id: '$items.foodId', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotalCents' } } }, { $sort: { qty: -1 } }, { $limit: 5 }]),
    Order.find({ restaurantId }).sort({ createdAt: -1 }).limit(8),
  ]);
  const statusMap: Record<string, number> = {}; byStatus.forEach((s: any) => (statusMap[s._id] = s.n));
  const dayMap = new Map(daily.map((d: any) => [d._id, d]));
  const series = Array.from({ length: Math.min(days, 90) }, (_, i) => { const d = new Date(Date.now() - (Math.min(days, 90) - 1 - i) * 86400000); const k = d.toISOString().slice(0, 10); const v: any = dayMap.get(k); return { date: k, revenueCents: v?.revenue || 0, orders: v?.orders || 0 }; });
  const low = foods.filter((f) => stockStatus(f) === 'low'); const out = foods.filter((f) => stockStatus(f) === 'out');
  ok(res, {
    days, totalSalesCents: totals[0]?.revenue || 0, paidOrders: totals[0]?.n || 0, revenueInRangeCents: inRange[0]?.revenue || 0, ordersInRange: inRange[0]?.n || 0,
    orders: { total: Object.values(statusMap).reduce((a, b) => a + b, 0), pending: (statusMap.placed || 0) + (statusMap.confirmed || 0) + (statusMap.preparing || 0) + (statusMap.ready || 0) + (statusMap.out_for_delivery || 0), completed: statusMap.delivered || 0, cancelled: statusMap.cancelled || 0, byStatus: statusMap },
    customers, activeFoods, lowStockCount: low.length, outOfStockCount: out.length,
    lowStock: low.slice(0, 6).map((f: any) => ({ id: String(f._id), name: f.name, available: f.stock - f.reserved })), outOfStock: out.slice(0, 6).map((f: any) => ({ id: String(f._id), name: f.name })),
    bestsellers: best.map((b: any) => ({ id: String(b._id), name: b.name, quantity: b.qty, revenueCents: b.revenue })), series,
    recentOrders: recent.map((o) => orderDto(o)),
  });
});

/* ---------- foods ---------- */
const adminFoodDto = (f: any) => ({ ...toFoodDto(f), stock: f.stock, reserved: f.reserved, lowStockThreshold: f.lowStockThreshold, reorderQuantity: f.reorderQuantity, costCents: f.costCents, isAvailableFlag: f.isAvailable, archived: f.archived, lastRestockedAt: f.lastRestockedAt, updatedAt: f.updatedAt, stockStatus: stockStatus(f), category: f.category?.name ? { id: String(f.category._id), name: f.category.name, slug: f.category.slug } : { id: String(f.category) } });

async function uniqueSlug(restaurantId: any, name: string, exceptId?: any) {
  const base = slugify(name) || 'item'; let slug = base; let i = 2;
  while (await Food.exists({ restaurantId, slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) slug = `${base}-${i++}`;
  return slug;
}
export const listFoods = asyncHandler(async (req, res) => {
  const restaurantId = await rid(); const { q, category, archived, page, limit } = req.query as any;
  const filter: any = { restaurantId, archived: archived === 'true' };
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  if (category) filter.category = category;
  const [items, total] = await Promise.all([Food.find(filter).populate('category', 'name slug').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit), Food.countDocuments(filter)]);
  ok(res, items.map(adminFoodDto), 200, pageMeta(page, limit, total));
});
export const createFood = asyncHandler(async (req, res) => {
  const restaurantId = await rid(); const { initialStock, ...data } = req.body;
  if (!(await Category.exists({ _id: data.category, restaurantId }))) throw ApiError.badRequest('Choose a valid category.');
  const f: any = await Food.create({ ...data, restaurantId, slug: await uniqueSlug(restaurantId, data.name), stock: 0 });
  if (initialStock > 0) await restock(restaurantId, f._id, initialStock, { reason: 'Initial stock', actorId: currentUser(req)._id });
  await audit(req, 'food.create', 'Food', f._id, { name: f.name });
  ok(res, adminFoodDto(await Food.findById(f._id).populate('category', 'name slug')), 201);
});
export const updateFood = asyncHandler(async (req, res) => {
  const restaurantId = await rid();
  const f: any = await Food.findOne({ _id: req.params.id, restaurantId }); if (!f) throw ApiError.notFound('Product not found.');
  if (req.body.category && !(await Category.exists({ _id: req.body.category, restaurantId }))) throw ApiError.badRequest('Choose a valid category.');
  if (req.body.name && req.body.name !== f.name) f.slug = await uniqueSlug(restaurantId, req.body.name, f._id);
  f.set(req.body); await f.save(); // past orders keep their own snapshots, so edits never rewrite history
  await audit(req, 'food.update', 'Food', f._id, { fields: Object.keys(req.body) });
  ok(res, adminFoodDto(await Food.findById(f._id).populate('category', 'name slug')));
});
/** Soft delete: archived products vanish from the menu but stay referenced by historical orders. */
export const archiveFood = asyncHandler(async (req, res) => {
  const restaurantId = await rid();
  const f: any = await Food.findOneAndUpdate({ _id: req.params.id, restaurantId }, { archived: req.query.restore === 'true' ? false : true }, { new: true });
  if (!f) throw ApiError.notFound('Product not found.');
  await audit(req, f.archived ? 'food.archive' : 'food.restore', 'Food', f._id, { name: f.name });
  ok(res, { id: String(f._id), archived: f.archived });
});

/* ---------- categories ---------- */
export const createCategory = asyncHandler(async (req, res) => {
  const restaurantId = await rid(); const slug = slugify(req.body.name);
  const c = await Category.create({ ...req.body, restaurantId, slug }); await audit(req, 'category.create', 'Category', c._id, { name: c.name }); ok(res, c, 201);
});
export const updateCategory = asyncHandler(async (req, res) => {
  const restaurantId = await rid(); const set: any = { ...req.body }; if (req.body.name) set.slug = slugify(req.body.name);
  const c = await Category.findOneAndUpdate({ _id: req.params.id, restaurantId }, set, { new: true }); if (!c) throw ApiError.notFound('Category not found.'); ok(res, c);
});
export const deleteCategory = asyncHandler(async (req, res) => {
  const restaurantId = await rid();
  if (await Food.exists({ restaurantId, category: req.params.id })) throw ApiError.conflict('Move or archive the dishes in this category first.', 'CATEGORY_IN_USE');
  await Category.deleteOne({ _id: req.params.id, restaurantId }); await audit(req, 'category.delete', 'Category', req.params.id); ok(res, { deleted: true });
});

/* ---------- inventory ---------- */
const inventoryFilter = async (q: any) => {
  const restaurantId = await rid(); const filter: any = { restaurantId, archived: false };
  if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
  const avail = { $subtract: ['$stock', '$reserved'] };
  if (q.status === 'out') filter.$expr = { $lte: [avail, 0] };
  if (q.status === 'low') filter.$expr = { $and: [{ $gt: [avail, 0] }, { $lte: [avail, '$lowStockThreshold'] }] };
  if (q.status === 'ok') filter.$expr = { $gt: [avail, '$lowStockThreshold'] };
  return filter;
};
const invDto = (f: any) => ({ id: String(f._id), name: f.name, image: f.image, category: f.category?.name, unit: f.unit, stock: f.stock, reserved: f.reserved, available: Math.max(0, f.stock - f.reserved), lowStockThreshold: f.lowStockThreshold, reorderQuantity: f.reorderQuantity, costCents: f.costCents, valueCents: f.stock * f.costCents, lastRestockedAt: f.lastRestockedAt, status: stockStatus(f), isAvailable: f.isAvailable });
export const inventory = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as any; const filter = await inventoryFilter(req.query);
  const restaurantId = filter.restaurantId;
  const [items, total, all] = await Promise.all([
    Food.find(filter).populate('category', 'name').sort({ name: 1 }).skip((page - 1) * limit).limit(limit), Food.countDocuments(filter),
    Food.find({ restaurantId, archived: false }).select('stock reserved lowStockThreshold costCents'),
  ]);
  const summary = { totalValueCents: all.reduce((s: number, f: any) => s + f.stock * f.costCents, 0), low: all.filter((f: any) => stockStatus(f) === 'low').length, out: all.filter((f: any) => stockStatus(f) === 'out').length, products: all.length };
  ok(res, { items: items.map(invDto), summary }, 200, pageMeta(page, limit, total));
});
export const inventoryCsv = asyncHandler(async (req, res) => {
  const items = await Food.find(await inventoryFilter(req.query)).populate('category', 'name').sort({ name: 1 }).limit(5000);
  const esc = (v: any) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // neutralise spreadsheet formulas
  const rows = [['Name', 'Category', 'Unit', 'Stock', 'Reserved', 'Available', 'Low threshold', 'Status', 'Unit cost', 'Value'], ...items.map((f: any) => { const d = invDto(f); return [d.name, d.category, d.unit, d.stock, d.reserved, d.available, d.lowStockThreshold, d.status, (d.costCents / 100).toFixed(2), (d.valueCents / 100).toFixed(2)]; })];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
  res.send(rows.map((r) => r.map(esc).join(',')).join('\n'));
});
export const doRestock = asyncHandler(async (req, res) => {
  const f: any = await restock(await rid(), req.body.foodId, req.body.quantity, { costCents: req.body.costCents, reason: req.body.reason, actorId: currentUser(req)._id });
  await audit(req, 'inventory.restock', 'Food', f._id, { quantity: req.body.quantity }); ok(res, invDto(f));
});
export const doAdjust = asyncHandler(async (req, res) => {
  const f: any = await adjustStock(await rid(), req.body.foodId, req.body.delta, req.body.reason, currentUser(req)._id);
  await audit(req, 'inventory.adjust', 'Food', f._id, { delta: req.body.delta, reason: req.body.reason }); ok(res, invDto(f));
});
export const movements = asyncHandler(async (req, res) => {
  const { foodId, type, page, limit } = req.query as any; const filter: any = { restaurantId: await rid() };
  if (foodId) filter.foodId = foodId; if (type) filter.type = type;
  const [items, total] = await Promise.all([InventoryMovement.find(filter).populate('foodId', 'name unit').populate('actorId', 'name').populate('orderId', 'orderNumber').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), InventoryMovement.countDocuments(filter)]);
  ok(res, items.map((m: any) => ({ id: String(m._id), type: m.type, food: m.foodId ? { id: String(m.foodId._id), name: m.foodId.name, unit: m.foodId.unit } : null, stockDelta: m.stockDelta, reservedDelta: m.reservedDelta, stockAfter: m.stockAfter, reservedAfter: m.reservedAfter, reason: m.reason, order: m.orderId ? { id: String(m.orderId._id), orderNumber: m.orderId.orderNumber } : null, actor: m.actorId?.name || 'System', createdAt: m.createdAt })), 200, pageMeta(page, limit, total));
});

/* ---------- orders ---------- */
export const listOrders = asyncHandler(async (req, res) => {
  const { q, status, paymentStatus, from, to, page, limit } = req.query as any; const filter: any = { restaurantId: await rid() };
  if (status) filter.status = { $in: String(status).split(',') };
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ orderNumber: rx }, { 'customer.name': rx }, { 'customer.phone': rx }, { 'customer.email': rx }]; }
  const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Order.countDocuments(filter)]);
  ok(res, items.map((o) => orderDto(o)), 200, pageMeta(page, limit, total));
});
export const getOrder = asyncHandler(async (req, res) => {
  const o: any = await Order.findOne({ _id: req.params.id, restaurantId: await rid() }); if (!o) throw ApiError.notFound('Order not found.');
  const [payments, moves] = await Promise.all([
    Payment.find({ orderId: o._id }).select('provider status amountCents currency createdAt failureReason'), // never selects provider secrets or checkout URLs
    InventoryMovement.find({ orderId: o._id }).populate('foodId', 'name').sort({ createdAt: 1 }),
  ]);
  ok(res, orderDto(o, { stockState: o.stockState, reservationExpiresAt: o.reservationExpiresAt, payments, movements: moves.map((m: any) => ({ type: m.type, food: m.foodId?.name, stockDelta: m.stockDelta, reservedDelta: m.reservedDelta, at: m.createdAt })) }));
});
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const o = await changeStatus(req.params.id, req.body.status, currentUser(req), req.body.note, { returnStock: req.body.returnStock });
  await audit(req, 'order.status', 'Order', req.params.id, { status: req.body.status, note: req.body.note }); ok(res, orderDto(o));
});
/** Refund is only *requested* here; the order becomes "refunded" when the provider's webhook confirms it. */
export const refundOrder = asyncHandler(async (req, res) => {
  const o: any = await Order.findOne({ _id: req.params.id, restaurantId: await rid() }); if (!o) throw ApiError.notFound('Order not found.');
  if (o.paymentStatus !== 'paid') throw ApiError.conflict('Only paid orders can be refunded.', 'NOT_PAID');
  const p: any = await Payment.findOne({ orderId: o._id, provider: 'stripe', status: 'succeeded' });
  if (!p?.providerPaymentIntentId) throw ApiError.badRequest('This order was not paid through the card provider, so there is nothing to refund automatically.', 'NOT_REFUNDABLE');
  const r = await getProvider('stripe').refund(p.providerPaymentIntentId, o.totalCents, `refund-${o._id}`);
  await Order.updateOne({ _id: o._id }, { paymentStatus: 'refund_pending', $push: { timeline: { status: o.status, note: `Refund requested (${req.body.reason || 'no reason given'})`, at: new Date(), by: currentUser(req)._id } } });
  await Payment.updateOne({ _id: p._id }, { status: 'refund_pending' });
  await audit(req, 'order.refund', 'Order', o._id, { providerRefund: r.id }); ok(res, { status: 'refund_pending', providerStatus: r.status });
});

/* ---------- users ---------- */
const userDto = (u: any, extra: any = {}) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, createdAt: u.createdAt, ...extra });
export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page, limit } = req.query as any; const filter: any = { restaurantId: await rid() };
  if (role) filter.role = role; if (status) filter.status = status;
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
  const stats = await Order.aggregate([{ $match: { userId: { $in: items.map((u) => u._id) } } }, { $group: { _id: '$userId', orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalCents', 0] } } } }]);
  const sm = new Map(stats.map((s: any) => [String(s._id), s]));
  ok(res, items.map((u) => userDto(u, { orders: sm.get(String(u._id))?.orders || 0, spentCents: sm.get(String(u._id))?.spent || 0 })), 200, pageMeta(page, limit, total));
});
export const userOrders = asyncHandler(async (req, res) => { const orders = await Order.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50); ok(res, orders.map((o) => orderDto(o))); });
async function guardLastAdmin(target: any) {
  if (target.role === 'admin' && target.status === 'active' && (await User.countDocuments({ role: 'admin', status: 'active', _id: { $ne: target._id } })) === 0)
    throw ApiError.conflict('This is the last active administrator. Add another administrator first.', 'LAST_ADMIN');
}
export const setUserStatus = asyncHandler(async (req, res) => {
  const u: any = await User.findOne({ _id: req.params.id, restaurantId: await rid() }); if (!u) throw ApiError.notFound('User not found.');
  if (String(u._id) === String(currentUser(req)._id)) throw ApiError.conflict('You cannot change your own account status.', 'SELF_ACTION');
  if (req.body.status === 'suspended') await guardLastAdmin(u);
  u.status = req.body.status; if (u.status === 'suspended') u.tokenVersion += 1; await u.save();
  await audit(req, 'user.status', 'User', u._id, { status: u.status }); ok(res, userDto(u));
});
export const setUserRole = asyncHandler(async (req, res) => {
  const u: any = await User.findOne({ _id: req.params.id, restaurantId: await rid() }); if (!u) throw ApiError.notFound('User not found.');
  if (req.body.role !== 'admin' && u.role === 'admin') await guardLastAdmin(u);
  u.role = req.body.role; u.tokenVersion += 1; await u.save();
  await audit(req, 'user.role', 'User', u._id, { role: u.role }); ok(res, userDto(u));
});

/* ---------- coupons ---------- */
export const listCoupons = asyncHandler(async (_req, res) => ok(res, await Coupon.find({ restaurantId: await rid() }).sort({ createdAt: -1 }).limit(200)));
export const createCoupon = asyncHandler(async (req, res) => { const c = await Coupon.create({ ...req.body, restaurantId: await rid() }); await audit(req, 'coupon.create', 'Coupon', c._id, { code: c.code }); ok(res, c, 201); });
export const updateCoupon = asyncHandler(async (req, res) => { const c = await Coupon.findOneAndUpdate({ _id: req.params.id, restaurantId: await rid() }, req.body, { new: true, runValidators: true }); if (!c) throw ApiError.notFound('Coupon not found.'); await audit(req, 'coupon.update', 'Coupon', c._id, req.body); ok(res, c); });

/* ---------- settings ---------- */
export const getSettingsCtl = asyncHandler(async (_req, res) => ok(res, await getSettings()));
export const updateSettings = asyncHandler(async (req, res) => {
  const r = await rid(); await getSettings(r);
  const s = await Settings.findOneAndUpdate({ restaurantId: r }, { $set: req.body }, { new: true }); await audit(req, 'settings.update', 'Settings', s!._id, { fields: Object.keys(req.body) }); ok(res, s);
});

/* ---------- uploads & audit ---------- */
export const upload = asyncHandler(async (req, res) => {
  const file = (req as any).file; if (!file) throw ApiError.badRequest('Choose an image to upload.');
  const fd = fs.openSync(file.path, 'r'); const buf = Buffer.alloc(12); fs.readSync(fd, buf, 0, 12, 0); fs.closeSync(fd);
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8; const isPng = buf.slice(1, 4).toString() === 'PNG'; const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  if (!isJpg && !isPng && !isWebp) { fs.unlinkSync(file.path); throw new ApiError(400, 'That file is not a valid image.', 'UPLOAD_ERROR'); } // verify magic bytes, not just the claimed type
  await audit(req, 'upload', 'File', file.filename); ok(res, { url: `/uploads/${file.filename}` }, 201);
});
export const auditLog = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1); const limit = 30;
  const [items, total] = await Promise.all([AuditLog.find().populate('actorId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments()]);
  ok(res, items.map((a: any) => ({ id: String(a._id), action: a.action, entity: a.entity, entityId: a.entityId, actor: a.actorId?.name, meta: a.meta, createdAt: a.createdAt })), 200, pageMeta(page, limit, total));
});
