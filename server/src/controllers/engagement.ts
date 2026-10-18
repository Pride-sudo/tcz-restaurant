import { Types } from 'mongoose';
import { Coupon, Food, Order, Review, Subscriber, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok, paginate, pageMeta } from '../utils/helpers';
import { currentUser } from '../middleware/auth';
import { recalcRating, toFoodDto } from './food';
import { getRestaurant, getSettings } from '../services/restaurant';
import { priceItems } from '../services/pricing';

const reviewDto = (r: any) => ({ id: String(r._id), rating: r.rating, comment: r.comment, createdAt: r.createdAt, updatedAt: r.updatedAt, orderId: String(r.orderId), user: { id: String(r.userId?._id || r.userId), name: r.userId?.name ? r.userId.name.split(' ')[0] + (r.userId.name.split(' ')[1] ? ' ' + r.userId.name.split(' ')[1][0] + '.' : '') : 'Customer' } });

export const listReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 10, 50);
  const filter = { foodId: req.params.id };
  const [items, total] = await Promise.all([Review.find(filter).populate('userId', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit), Review.countDocuments(filter)]);
  ok(res, items.map(reviewDto), 200, pageMeta(page, limit, total));
});

/** Policy: only customers with a *delivered* order containing the dish can review it, once per order item. */
export const createReview = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const food = await Food.findById(req.params.id);
  if (!food) throw ApiError.notFound('Dish not found.');
  const orderFilter: any = { userId: user._id, status: 'delivered', 'items.foodId': food._id };
  if (req.body.orderId) orderFilter._id = req.body.orderId;
  const orders = await Order.find(orderFilter).select('_id').sort({ createdAt: -1 });
  if (!orders.length) throw ApiError.forbidden('You can review a dish after an order containing it has been delivered.');
  const reviewed = new Set((await Review.find({ userId: user._id, foodId: food._id, orderId: { $in: orders.map((o) => o._id) } }).select('orderId')).map((r: any) => String(r.orderId)));
  const target = orders.find((o) => !reviewed.has(String(o._id)));
  if (!target) throw ApiError.conflict('You have already reviewed this dish for that order. You can edit your review instead.', 'DUPLICATE_REVIEW');
  const review = await Review.create({ foodId: food._id, userId: user._id, orderId: target._id, rating: req.body.rating, comment: req.body.comment || '' });
  await recalcRating(food._id);
  ok(res, reviewDto(review), 201);
});

async function ownReview(req: any) {
  const r: any = await Review.findById(req.params.id);
  if (!r || String(r.userId) !== String(currentUser(req)._id)) throw ApiError.notFound('Review not found.');
  return r;
}
export const updateReview = asyncHandler(async (req, res) => {
  const r = await ownReview(req);
  if (req.body.rating !== undefined) r.rating = req.body.rating;
  if (req.body.comment !== undefined) r.comment = req.body.comment;
  await r.save(); await recalcRating(r.foodId); ok(res, reviewDto(r));
});
export const deleteReview = asyncHandler(async (req, res) => {
  const r = await ownReview(req);
  await r.deleteOne(); await recalcRating(r.foodId); ok(res, { deleted: true });
});

/* favorites */
export const listFavorites = asyncHandler(async (req, res) => {
  const u: any = await User.findById(currentUser(req)._id).populate({ path: 'favorites', match: { archived: false }, populate: { path: 'category', select: 'name slug icon' } });
  ok(res, (u.favorites || []).filter(Boolean).map((f: any) => toFoodDto(f)));
});
export const addFavorite = asyncHandler(async (req, res) => {
  if (!(await Food.exists({ _id: req.params.foodId, archived: false }))) throw ApiError.notFound('Dish not found.');
  const u: any = await User.findByIdAndUpdate(currentUser(req)._id, { $addToSet: { favorites: req.params.foodId } }, { new: true });
  ok(res, { favorites: u.favorites.map(String) }, 201);
});
export const removeFavorite = asyncHandler(async (req, res) => {
  const u: any = await User.findByIdAndUpdate(currentUser(req)._id, { $pull: { favorites: new Types.ObjectId(req.params.foodId) } }, { new: true });
  ok(res, { favorites: u.favorites.map(String) });
});

/* coupons */
export const validateCoupon = asyncHandler(async (req, res) => {
  const r = await getRestaurant();
  const p = await priceItems(r._id, req.body.items, await getSettings(r._id), req.body.code);
  if (p.couponError) throw ApiError.badRequest(p.couponError, 'COUPON_INVALID');
  ok(res, { code: p.coupon.code, description: p.coupon.description, discountCents: p.totals.discountCents, totals: p.totals });
});

/* newsletter */
export const subscribe = asyncHandler(async (req, res) => {
  await Subscriber.updateOne({ email: req.body.email }, { $setOnInsert: { email: req.body.email } }, { upsert: true });
  ok(res, { message: 'You are on the list. Thanks for subscribing!' }, 201);
});

export const publicSettings = asyncHandler(async (_req, res) => {
  const s: any = await getSettings();
  ok(res, { name: s.name, email: s.email, phone: s.phone, address: s.address, currency: s.currency, taxRatePercent: s.taxRatePercent, deliveryFeeCents: s.deliveryFeeCents, freeDeliveryOverCents: s.freeDeliveryOverCents, minOrderCents: s.minOrderCents, openingHours: s.openingHours, deliveryAreas: s.deliveryAreas, deliveryMinutes: s.deliveryMinutes });
});

/** Real reviews only: the newest 4-5 star reviews, for the homepage. */
export const recentReviews = asyncHandler(async (_req, res) => {
  const items: any[] = await Review.find({ rating: { $gte: 4 }, comment: { $ne: '' } }).populate('userId', 'name').populate('foodId', 'name slug').sort({ createdAt: -1 }).limit(3);
  ok(res, items.map((r) => ({ ...reviewDto(r), food: r.foodId ? { name: r.foodId.name, slug: r.foodId.slug } : null })));
});
