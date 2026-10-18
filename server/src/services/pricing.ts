import { Types } from 'mongoose';
import { Coupon, Food } from '../models';
import { ApiError } from '../utils/ApiError';

export interface Pricing { base: number; discount: number; final: number; variantName?: string }

/** Current unit price of a food (+variant), applying a non-expired discount. */
export function unitPricing(food: any, variantName?: string | null, now = new Date()): Pricing | null {
  const variant = variantName ? (food.variants || []).find((v: any) => v.name === variantName) : undefined;
  if (variantName && !variant) return null;
  const base = food.priceCents + (variant?.priceDeltaCents || 0);
  const active = food.discountPercent > 0 && (!food.discountEndsAt || new Date(food.discountEndsAt) > now);
  const discount = active ? Math.round((base * food.discountPercent) / 100) : 0;
  return { base, discount, final: base - discount, variantName: variant?.name };
}

export function couponDiscount(coupon: any, subtotalCents: number, now = new Date()): number {
  if (!coupon || !coupon.active) throw ApiError.badRequest('This coupon is not valid.', 'COUPON_INVALID');
  if (coupon.startsAt && now < new Date(coupon.startsAt)) throw ApiError.badRequest('This coupon is not active yet.', 'COUPON_INVALID');
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) throw ApiError.badRequest('This coupon has expired.', 'COUPON_EXPIRED');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw ApiError.badRequest('This coupon has been fully redeemed.', 'COUPON_EXHAUSTED');
  if (subtotalCents < (coupon.minOrderCents || 0)) throw ApiError.badRequest(`Spend at least ${(coupon.minOrderCents / 100).toFixed(2)} to use this coupon.`, 'COUPON_MIN_ORDER');
  let d = coupon.type === 'percent' ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscountCents != null) d = Math.min(d, coupon.maxDiscountCents);
  return Math.max(0, Math.min(d, subtotalCents));
}

export function computeTotals(lines: { finalCents: number; quantity: number }[], settings: { taxRatePercent: number; deliveryFeeCents: number; freeDeliveryOverCents: number }, couponDiscountCents = 0) {
  const subtotalCents = lines.reduce((s, l) => s + l.finalCents * l.quantity, 0);
  const discountCents = Math.min(couponDiscountCents, subtotalCents);
  const taxable = subtotalCents - discountCents;
  const taxCents = Math.round((taxable * (settings.taxRatePercent || 0)) / 100);
  const free = settings.freeDeliveryOverCents > 0 && subtotalCents >= settings.freeDeliveryOverCents;
  const deliveryFeeCents = lines.length === 0 || free ? 0 : settings.deliveryFeeCents;
  return { subtotalCents, discountCents, taxCents, deliveryFeeCents, totalCents: taxable + taxCents + deliveryFeeCents };
}

export const availableStock = (f: any) => Math.max(0, (f.stock || 0) - (f.reserved || 0));

export interface InItem { foodId: string; variantName?: string | null; quantity: number }

/** Resolve client-supplied cart lines against live DB data. Never trusts client prices. */
export async function priceItems(restaurantId: any, items: InItem[], settings: any, couponCode?: string | null) {
  const merged = new Map<string, InItem>();
  for (const it of items) {
    if (!Types.ObjectId.isValid(it.foodId)) continue;
    const key = `${it.foodId}::${it.variantName || ''}`;
    const prev = merged.get(key);
    merged.set(key, { foodId: it.foodId, variantName: it.variantName || null, quantity: (prev?.quantity || 0) + it.quantity });
  }
  const list = [...merged.values()];
  const foods = await Food.find({ _id: { $in: list.map((l) => l.foodId) }, restaurantId });
  const byId = new Map(foods.map((f: any) => [String(f._id), f]));
  const issues: { foodId: string; code: string; message: string; available?: number }[] = [];
  const lines: any[] = [];
  const now = new Date();
  for (const it of list) {
    const f: any = byId.get(it.foodId);
    if (!f || f.archived) { issues.push({ foodId: it.foodId, code: 'NOT_FOUND', message: 'An item in your cart is no longer on the menu.' }); continue; }
    const p = unitPricing(f, it.variantName, now);
    if (!p) { issues.push({ foodId: it.foodId, code: 'BAD_VARIANT', message: `${f.name}: that size is no longer offered.` }); continue; }
    const avail = availableStock(f);
    if (!f.isAvailable || avail <= 0) issues.push({ foodId: it.foodId, code: 'UNAVAILABLE', message: `${f.name} is currently unavailable.`, available: 0 });
    else if (it.quantity > avail) issues.push({ foodId: it.foodId, code: 'INSUFFICIENT_STOCK', message: `Only ${avail} of ${f.name} left.`, available: avail });
    else if (it.quantity > f.maxPerOrder) issues.push({ foodId: it.foodId, code: 'MAX_PER_ORDER', message: `You can order at most ${f.maxPerOrder} of ${f.name}.` });
    lines.push({ foodId: String(f._id), name: f.name, image: f.image, slug: f.slug, variantName: p.variantName || null, quantity: it.quantity, unitPriceCents: p.base, discountPerUnitCents: p.discount, finalCents: p.final, lineTotalCents: p.final * it.quantity, prepMinutes: f.prepMinutes, available: avail });
  }
  let coupon: any = null; let couponError: string | null = null; let couponDiscountCents = 0;
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (couponCode) {
    try {
      coupon = await Coupon.findOne({ restaurantId, code: couponCode.trim().toUpperCase() });
      couponDiscountCents = couponDiscount(coupon, subtotal, now);
    } catch (e: any) { couponError = e.message; coupon = null; couponDiscountCents = 0; }
  }
  const totals = computeTotals(lines, settings, couponDiscountCents);
  return { lines, issues, coupon, couponError, totals, currency: settings.currency, minOrderCents: settings.minOrderCents };
}
