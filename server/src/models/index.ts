import mongoose, { Schema, Types } from 'mongoose';

const opts = { timestamps: true } as const;
const oid = (ref: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

/* ---------------- Restaurant (multi-restaurant ready) ---------------- */
const restaurantSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  ownerId: oid('User'),
  active: { type: Boolean, default: true },
}, opts);
export const Restaurant = mongoose.model('Restaurant', restaurantSchema);

/* ---------------- User ---------------- */
const addressSchema = new Schema({
  label: { type: String, default: 'Home', maxlength: 40 },
  line1: { type: String, required: true, maxlength: 200 },
  line2: { type: String, maxlength: 200 },
  city: { type: String, required: true, maxlength: 80 },
  phone: { type: String, maxlength: 30 },
  notes: { type: String, maxlength: 300 },
  isDefault: { type: Boolean, default: false },
});
const userSchema = new Schema({
  restaurantId: oid('Restaurant', { index: true }),
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer', index: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  tokenVersion: { type: Number, default: 0 },
  addresses: [addressSchema],
  favorites: [oid('Food')],
}, opts);
export const User = mongoose.model('User', userSchema);

/* ---------------- Catalogue ---------------- */
const categorySchema = new Schema({
  restaurantId: oid('Restaurant', { required: true }),
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  icon: { type: String, default: 'utensils' },
  sortOrder: { type: Number, default: 0 },
}, opts);
categorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
export const Category = mongoose.model('Category', categorySchema);

const foodSchema = new Schema({
  restaurantId: oid('Restaurant', { required: true }),
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true },
  description: { type: String, required: true, maxlength: 1000 },
  category: oid('Category', { required: true }),
  image: { type: String, default: '' },
  priceCents: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 90 },
  discountEndsAt: { type: Date },
  prepMinutes: { type: Number, default: 15, min: 1 },
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isChefPick: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  ingredients: [String],
  allergens: [String],
  variants: [{ name: { type: String, required: true }, priceDeltaCents: { type: Number, default: 0 } }],
  // inventory
  stock: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'portion' },
  lowStockThreshold: { type: Number, default: 10, min: 0 },
  reorderQuantity: { type: Number, default: 20, min: 0 },
  costCents: { type: Number, default: 0, min: 0 },
  lastRestockedAt: Date,
  maxPerOrder: { type: Number, default: 10, min: 1 },
  // aggregates
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },
}, opts);
foodSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
foodSchema.index({ restaurantId: 1, archived: 1, category: 1, priceCents: 1 });
foodSchema.index({ restaurantId: 1, archived: 1, soldCount: -1 });
foodSchema.index({ name: 'text', description: 'text' });
export const Food = mongoose.model('Food', foodSchema);

/* ---------------- Orders & payments ---------------- */
const orderItemSchema = new Schema({
  foodId: oid('Food', { required: true }),
  name: { type: String, required: true },
  image: String,
  variantName: String,
  unitPriceCents: { type: Number, required: true },          // price incl. variant, before discount
  discountPerUnitCents: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1 },
  lineTotalCents: { type: Number, required: true },
}, { _id: true });

const orderSchema = new Schema({
  restaurantId: oid('Restaurant', { required: true, index: true }),
  orderNumber: { type: String, required: true, unique: true },
  userId: oid('User', { required: true, index: true }),
  items: { type: [orderItemSchema], validate: (v: any[]) => v.length > 0 },
  subtotalCents: Number,
  couponCode: String,
  discountCents: { type: Number, default: 0 },
  taxCents: { type: Number, default: 0 },
  deliveryFeeCents: { type: Number, default: 0 },
  totalCents: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'], default: 'placed', index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed', 'refund_pending', 'refunded'], default: 'unpaid', index: true },
  paymentMethod: { type: String, enum: ['card', 'cash', 'dev'], required: true },
  stockState: { type: String, enum: ['reserved', 'committed', 'released', 'returned'], default: 'reserved' },
  reservationExpiresAt: Date,
  customer: { name: String, phone: String, email: String },
  address: { label: String, line1: String, line2: String, city: String, notes: String },
  instructions: { type: String, maxlength: 300 },
  notes: { type: String, maxlength: 300 },
  estimatedDeliveryAt: Date,
  idempotencyKey: { type: String },
  timeline: [{ status: String, note: String, at: { type: Date, default: Date.now }, by: oid('User'), _id: false }],
}, opts);
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
export const Order = mongoose.model('Order', orderSchema);

const paymentSchema = new Schema({
  orderId: oid('Order', { required: true, index: true }),
  userId: oid('User', { required: true }),
  provider: { type: String, enum: ['stripe', 'dev', 'cash'], required: true },
  providerSessionId: { type: String },
  providerPaymentIntentId: { type: String },
  amountCents: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refund_pending', 'refunded'], default: 'pending' },
  checkoutUrl: String,
  expiresAt: Date,
  failureReason: String,
}, opts);
paymentSchema.index({ providerSessionId: 1 }, { unique: true, partialFilterExpression: { providerSessionId: { $type: 'string' } } });
export const Payment = mongoose.model('Payment', paymentSchema);

/** One row per processed provider event: the unique index blocks replays. */
const webhookEventSchema = new Schema({ eventId: { type: String, required: true, unique: true }, type: String }, opts);
export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

/* ---------------- Reviews, coupons, cart ---------------- */
const reviewSchema = new Schema({
  foodId: oid('Food', { required: true, index: true }),
  userId: oid('User', { required: true }),
  orderId: oid('Order', { required: true }),
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000, default: '' },
}, opts);
reviewSchema.index({ userId: 1, orderId: 1, foodId: 1 }, { unique: true });
export const Review = mongoose.model('Review', reviewSchema);

const couponSchema = new Schema({
  restaurantId: oid('Restaurant', { required: true }),
  code: { type: String, required: true, uppercase: true, trim: true },
  description: String,
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },              // percent or cents
  minOrderCents: { type: Number, default: 0 },
  maxDiscountCents: Number,
  startsAt: Date,
  expiresAt: Date,
  usageLimit: Number,
  usedCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, opts);
couponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });
export const Coupon = mongoose.model('Coupon', couponSchema);

const cartSchema = new Schema({
  userId: oid('User', { required: true, unique: true }),
  items: [{ foodId: oid('Food', { required: true }), variantName: String, quantity: { type: Number, min: 1, required: true } }],
  couponCode: String,
}, opts);
export const Cart = mongoose.model('Cart', cartSchema);

/* ---------------- Inventory ---------------- */
const movementSchema = new Schema({
  restaurantId: oid('Restaurant', { required: true }),
  foodId: oid('Food', { required: true, index: true }),
  type: { type: String, enum: ['restock', 'adjustment', 'reserve', 'release', 'commit', 'cancel_return'], required: true },
  stockDelta: { type: Number, default: 0 },
  reservedDelta: { type: Number, default: 0 },
  stockAfter: Number,
  reservedAfter: Number,
  reason: String,
  orderId: oid('Order'),
  actorId: oid('User'),
}, opts);
movementSchema.index({ restaurantId: 1, createdAt: -1 });
export const InventoryMovement = mongoose.model('InventoryMovement', movementSchema);

/* ---------------- Settings, tokens, audit, newsletter ---------------- */
const settingsSchema = new Schema({
  restaurantId: oid('Restaurant', { required: true, unique: true }),
  name: { type: String, default: 'TCZ Restaurant' },
  email: String, phone: String, address: String,
  currency: { type: String, default: 'USD' },
  taxRatePercent: { type: Number, default: 0, min: 0, max: 50 },
  deliveryFeeCents: { type: Number, default: 300, min: 0 },
  freeDeliveryOverCents: { type: Number, default: 0, min: 0 },
  minOrderCents: { type: Number, default: 500, min: 0 },
  openingHours: [{ day: Number, open: String, close: String, closed: Boolean, _id: false }],
  deliveryAreas: [String],
  lowStockDefault: { type: Number, default: 10, min: 0 },
  prepMinutesDefault: { type: Number, default: 20, min: 1 },
  deliveryMinutes: { type: Number, default: 25, min: 1 },
  allowNegativeStock: { type: Boolean, default: false },
}, opts);
export const Settings = mongoose.model('Settings', settingsSchema);

const resetSchema = new Schema({
  userId: oid('User', { required: true, index: true }),
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: Date,
}, opts);
export const PasswordResetToken = mongoose.model('PasswordResetToken', resetSchema);

const auditSchema = new Schema({
  restaurantId: oid('Restaurant'),
  actorId: oid('User', { index: true }),
  action: { type: String, required: true },
  entity: String,
  entityId: String,
  meta: Schema.Types.Mixed,
  ip: String,
}, opts);
auditSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema);

export const Subscriber = mongoose.model('Subscriber', new Schema({ email: { type: String, required: true, unique: true, lowercase: true } }, opts));

export type Id = Types.ObjectId | string;
