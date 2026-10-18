import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const name = z.string().trim().min(2, 'Enter at least 2 characters').max(80);
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);
const phone = z.string().trim().regex(/^[+\d][\d\s()-]{6,20}$/, 'Enter a valid phone number');
const password = z.string().min(8, 'Use at least 8 characters').max(100).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const registerSchema = z.object({ name, email, password, phone: phone.optional().or(z.literal('')) });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const profileSchema = z.object({ name: name.optional(), phone: phone.optional().or(z.literal('')) }).strict();
export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(3, 'Enter the street address').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'Enter the city or suburb').max(80),
  phone: phone.optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional(),
  isDefault: z.boolean().optional(),
});
export const addressPatchSchema = addressSchema.partial();

export const foodQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'rating', 'newest']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
  available: z.enum(['true', 'false']).optional(),
});

const cartItem = z.object({ foodId: objectId, variantName: z.string().max(60).nullish(), quantity: int(1, 50) });
export const quoteSchema = z.object({ items: z.array(cartItem).max(60), couponCode: z.string().trim().max(40).nullish() });
export const cartAddSchema = cartItem;
export const cartPatchSchema = z.object({ quantity: int(1, 50) });
export const cartReplaceSchema = z.object({ items: z.array(cartItem).max(60), couponCode: z.string().trim().max(40).nullish() });
export const couponValidateSchema = quoteSchema.extend({ code: z.string().trim().min(1).max(40) });

export const orderSchema = z.object({
  items: z.array(cartItem).min(1, 'Your cart is empty').max(60),
  couponCode: z.string().trim().max(40).nullish(),
  paymentMethod: z.enum(['card', 'cash', 'dev']),
  customer: z.object({ name, phone }),
  addressId: objectId.optional(),
  address: z.object({ label: z.string().max(40).optional(), line1: z.string().trim().min(3, 'Enter the street address').max(200), line2: z.string().max(200).optional(), city: z.string().trim().min(2, 'Enter the city or suburb').max(80), notes: z.string().max(300).optional() }).optional(),
  instructions: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(300).optional(),
}).refine((v) => v.addressId || v.address, { message: 'Choose or enter a delivery address', path: ['address'] });

export const reviewSchema = z.object({ rating: int(1, 5), comment: z.string().trim().max(1000).optional(), orderId: objectId.optional() });
export const reviewPatchSchema = z.object({ rating: int(1, 5).optional(), comment: z.string().trim().max(1000).optional() });

/* admin */
export const foodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1000),
  category: objectId,
  image: z.string().trim().max(500).optional().default(''),
  priceCents: int(0, 10_000_000),
  discountPercent: int(0, 90).default(0),
  discountEndsAt: z.coerce.date().nullish(),
  prepMinutes: int(1, 240).default(15),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isChefPick: z.boolean().default(false),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  variants: z.array(z.object({ name: z.string().trim().min(1).max(60), priceDeltaCents: int(-1_000_000, 1_000_000).default(0) })).max(10).default([]),
  unit: z.string().trim().min(1).max(20).default('portion'),
  lowStockThreshold: int(0, 100000).default(10),
  reorderQuantity: int(0, 100000).default(20),
  costCents: int(0, 10_000_000).default(0),
  maxPerOrder: int(1, 100).default(10),
});
export const foodCreateSchema = foodSchema.extend({ initialStock: int(0, 1_000_000).default(0) });
export const foodPatchSchema = foodSchema.partial();
export const adminFoodQuerySchema = z.object({ q: z.string().trim().max(80).optional(), category: objectId.optional(), archived: z.enum(['true', 'false']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const categorySchema = z.object({ name: z.string().trim().min(2).max(60), icon: z.string().trim().max(30).optional(), sortOrder: int(0, 1000).optional() });
export const restockSchema = z.object({ foodId: objectId, quantity: int(1, 1_000_000), costCents: int(0, 10_000_000).optional(), reason: z.string().trim().max(200).optional() });
export const adjustSchema = z.object({ foodId: objectId, delta: z.coerce.number().int().refine((n) => n !== 0, 'Enter a non-zero change').refine((n) => Math.abs(n) <= 1_000_000), reason: z.string().trim().min(3, 'A reason is required').max(200) });
export const inventoryQuerySchema = z.object({ q: z.string().trim().max(80).optional(), status: z.enum(['low', 'out', 'ok']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const movementQuerySchema = z.object({ foodId: objectId.optional(), type: z.enum(['restock', 'adjustment', 'reserve', 'release', 'commit', 'cancel_return']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const adminOrderQuerySchema = z.object({ q: z.string().trim().max(80).optional(), status: z.string().optional(), paymentStatus: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const orderStatusSchema = z.object({ status: z.enum(['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']), note: z.string().trim().max(200).optional(), returnStock: z.boolean().optional() });
export const refundSchema = z.object({ reason: z.string().trim().max(200).optional() });
export const userStatusSchema = z.object({ status: z.enum(['active', 'suspended']) });
export const userRoleSchema = z.object({ role: z.enum(['customer', 'staff', 'admin']) });
export const adminUserQuerySchema = z.object({ q: z.string().trim().max(80).optional(), role: z.enum(['customer', 'staff', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const couponSchema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only'),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['percent', 'fixed']),
  value: int(1, 10_000_000),
  minOrderCents: int(0, 10_000_000).default(0),
  maxDiscountCents: int(0, 10_000_000).nullish(),
  startsAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  usageLimit: int(1, 1_000_000).nullish(),
  active: z.boolean().default(true),
}).refine((v) => v.type !== 'percent' || v.value <= 100, { message: 'Percent cannot exceed 100', path: ['value'] });
export const couponPatchSchema = z.object({
  code: z.string().trim().min(3).max(30).optional(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['percent', 'fixed']).optional(),
  value: int(1, 10_000_000).optional(),
  minOrderCents: int(0, 10_000_000).optional(),
  maxDiscountCents: int(0, 10_000_000).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: int(1, 1_000_000).nullable().optional(),
  active: z.boolean().optional(),
}).refine(
  (v) => v.type !== 'percent' || v.value === undefined || v.value <= 100,
  { message: 'Percent cannot exceed 100', path: ['value'] }
);
export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().or(z.literal('')), phone: z.string().trim().max(30), address: z.string().trim().max(200),
  currency: z.string().trim().length(3).toUpperCase(), taxRatePercent: z.coerce.number().min(0).max(50), deliveryFeeCents: int(0, 1_000_000), freeDeliveryOverCents: int(0, 10_000_000), minOrderCents: int(0, 10_000_000),
  openingHours: z.array(z.object({ day: int(0, 6), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), closed: z.boolean() })).max(7),
  deliveryAreas: z.array(z.string().trim().min(1).max(60)).max(50),
  lowStockDefault: int(0, 100000), prepMinutesDefault: int(1, 240), deliveryMinutes: int(1, 240), allowNegativeStock: z.boolean(),
}).partial();
export const newsletterSchema = z.object({ email });
