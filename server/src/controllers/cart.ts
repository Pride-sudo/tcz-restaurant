import { Cart } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok } from '../utils/helpers';
import { currentUser } from '../middleware/auth';
import { priceItems } from '../services/pricing';
import { getRestaurant, getSettings } from '../services/restaurant';

async function view(user: any, cart: any, couponOverride?: string | null) {
  const settings = await getSettings(user.restaurantId);
  const priced = await priceItems(user.restaurantId, cart.items.map((i: any) => ({ foodId: String(i.foodId), variantName: i.variantName, quantity: i.quantity })), settings, couponOverride ?? cart.couponCode);
  const lines = priced.lines.map((l: any) => ({ ...l, itemId: String(cart.items.find((i: any) => String(i.foodId) === l.foodId && (i.variantName || null) === l.variantName)?._id || '') }));
  return { items: lines, issues: priced.issues, totals: priced.totals, currency: priced.currency, couponCode: priced.coupon?.code || null, couponError: priced.couponError, minOrderCents: priced.minOrderCents };
}
const getCart = async (user: any) => (await Cart.findOne({ userId: user._id })) || (await Cart.create({ userId: user._id, items: [] }));

/** Public: price any cart payload against live data (used for guests and the checkout summary). */
export const quote = asyncHandler(async (req, res) => {
  const r = await getRestaurant();
  const settings = await getSettings(r._id);
  const p = await priceItems(r._id, req.body.items, settings, req.body.couponCode);
  ok(res, { items: p.lines, issues: p.issues, totals: p.totals, currency: p.currency, couponCode: p.coupon?.code || null, couponError: p.couponError, minOrderCents: p.minOrderCents });
});

export const getMyCart = asyncHandler(async (req, res) => { const u = currentUser(req); ok(res, await view(u, await getCart(u))); });

export const addItem = asyncHandler(async (req, res) => {
  const u = currentUser(req); const cart: any = await getCart(u);
  const { foodId, variantName, quantity } = req.body;
  const ex = cart.items.find((i: any) => String(i.foodId) === foodId && (i.variantName || null) === (variantName || null));
  if (ex) ex.quantity = Math.min(50, ex.quantity + quantity); else cart.items.push({ foodId, variantName: variantName || undefined, quantity });
  await cart.save(); ok(res, await view(u, cart), 201);
});
export const updateItem = asyncHandler(async (req, res) => {
  const u = currentUser(req); const cart: any = await getCart(u);
  const it = cart.items.id(req.params.itemId); if (!it) throw ApiError.notFound('Cart item not found.');
  it.quantity = req.body.quantity; await cart.save(); ok(res, await view(u, cart));
});
export const removeItem = asyncHandler(async (req, res) => {
  const u = currentUser(req); const cart: any = await getCart(u);
  const it = cart.items.id(req.params.itemId); if (!it) throw ApiError.notFound('Cart item not found.');
  it.deleteOne(); await cart.save(); ok(res, await view(u, cart));
});
export const clearCart = asyncHandler(async (req, res) => { const u = currentUser(req); const cart: any = await getCart(u); cart.items = []; cart.couponCode = undefined; await cart.save(); ok(res, await view(u, cart)); });
export const replaceCart = asyncHandler(async (req, res) => {
  const u = currentUser(req); const cart: any = await getCart(u);
  cart.items = req.body.items.map((i: any) => ({ foodId: i.foodId, variantName: i.variantName || undefined, quantity: i.quantity })); cart.couponCode = req.body.couponCode || undefined;
  await cart.save(); ok(res, await view(u, cart));
});
