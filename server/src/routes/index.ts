import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import { authLimiter, orderLimiter, resetLimiter } from '../middleware/security';
import { validate } from '../middleware/validate';
import * as S from '../validators/schemas';
import * as auth from '../controllers/auth';
import * as users from '../controllers/users';
import * as food from '../controllers/food';
import * as cart from '../controllers/cart';
import * as orders from '../controllers/orders';
import * as pay from '../controllers/payments';
import * as eng from '../controllers/engagement';
import * as admin from '../controllers/admin';
import { z } from 'zod';

const r = Router();
const needAuth = authenticate;
const idParam = (name = 'id') => validate(z.object({ [name]: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') }), 'params');

/* auth */
r.post('/auth/register', authLimiter, validate(S.registerSchema), auth.register);
r.post('/auth/login', authLimiter, validate(S.loginSchema), auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', needAuth, auth.me);
r.post('/auth/forgot-password', resetLimiter, validate(S.forgotSchema), auth.forgotPassword);
r.post('/auth/reset-password', resetLimiter, validate(S.resetSchema), auth.resetPassword);

/* users */
r.get('/users/me', needAuth, users.getMe);
r.patch('/users/me', needAuth, validate(S.profileSchema), users.updateMe);
r.post('/users/me/password', needAuth, authLimiter, validate(S.changePasswordSchema), users.changePassword);
r.get('/users/me/addresses', needAuth, users.listAddresses);
r.post('/users/me/addresses', needAuth, validate(S.addressSchema), users.addAddress);
r.patch('/users/me/addresses/:addressId', needAuth, idParam('addressId'), validate(S.addressPatchSchema), users.updateAddress);
r.delete('/users/me/addresses/:addressId', needAuth, idParam('addressId'), users.deleteAddress);

/* public catalogue */
r.get('/settings/public', eng.publicSettings);
r.get('/categories', food.listCategories);
r.get('/foods/featured', food.featured);
r.get('/foods', validate(S.foodQuerySchema, 'query'), food.listFoods);
r.get('/foods/:id', food.getFood);
r.get('/reviews/recent', eng.recentReviews);
r.get('/foods/:id/reviews', idParam(), eng.listReviews);
r.post('/foods/:id/reviews', needAuth, idParam(), validate(S.reviewSchema), eng.createReview);
r.patch('/reviews/:id', needAuth, idParam(), validate(S.reviewPatchSchema), eng.updateReview);
r.delete('/reviews/:id', needAuth, idParam(), eng.deleteReview);

/* favorites */
r.get('/favorites', needAuth, eng.listFavorites);
r.post('/favorites/:foodId', needAuth, idParam('foodId'), eng.addFavorite);
r.delete('/favorites/:foodId', needAuth, idParam('foodId'), eng.removeFavorite);

/* cart & coupons */
r.post('/cart/quote', validate(S.quoteSchema), cart.quote);
r.get('/cart', needAuth, cart.getMyCart);
r.put('/cart', needAuth, validate(S.cartReplaceSchema), cart.replaceCart);
r.post('/cart/items', needAuth, validate(S.cartAddSchema), cart.addItem);
r.patch('/cart/items/:itemId', needAuth, idParam('itemId'), validate(S.cartPatchSchema), cart.updateItem);
r.delete('/cart/items/:itemId', needAuth, idParam('itemId'), cart.removeItem);
r.delete('/cart', needAuth, cart.clearCart);
r.post('/coupons/validate', validate(S.couponValidateSchema), eng.validateCoupon);
r.post('/newsletter', authLimiter, validate(S.newsletterSchema), eng.subscribe);

/* orders & payments */
r.post('/orders', needAuth, orderLimiter, validate(S.orderSchema), orders.create);
r.get('/orders/my-orders', needAuth, orders.myOrders);
r.get('/orders/:id', needAuth, idParam(), orders.getOrder);
r.get('/orders/:id/tracking', needAuth, idParam(), orders.tracking);
r.get('/payments/config', pay.config);
r.post('/payments/create-checkout-session', needAuth, orderLimiter, validate(z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i) })), pay.createCheckoutSession);
r.post('/payments/dev-confirm', needAuth, validate(z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i), outcome: z.enum(['success', 'fail']) })), pay.devConfirm);
r.get('/payments/:id/status', needAuth, idParam(), pay.paymentStatus);
// POST /payments/webhook is mounted in app.ts with a raw body parser.

/* admin / staff */
const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
const uploader = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (_q, f, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[f.mimetype] || '.bin'}`) }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => (['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) ? cb(null, true) : cb(new Error('UNSUPPORTED_FILE'))),
});
const a = Router();
a.use(needAuth, requireRole('admin', 'staff'));
const adminOnly = requireRole('admin');
a.get('/dashboard', admin.dashboard);
a.get('/foods', validate(S.adminFoodQuerySchema, 'query'), admin.listFoods);
a.post('/foods', adminOnly, validate(S.foodCreateSchema), admin.createFood);
a.patch('/foods/:id', adminOnly, idParam(), validate(S.foodPatchSchema), admin.updateFood);
a.delete('/foods/:id', adminOnly, idParam(), admin.archiveFood);
a.post('/categories', adminOnly, validate(S.categorySchema), admin.createCategory);
a.patch('/categories/:id', adminOnly, idParam(), validate(S.categorySchema.partial()), admin.updateCategory);
a.delete('/categories/:id', adminOnly, idParam(), admin.deleteCategory);
a.get('/inventory', validate(S.inventoryQuerySchema, 'query'), admin.inventory);
a.get('/inventory/export', admin.inventoryCsv);
a.get('/inventory/movements', validate(S.movementQuerySchema, 'query'), admin.movements);
a.post('/inventory/restock', validate(S.restockSchema), admin.doRestock);
a.post('/inventory/adjust', adminOnly, validate(S.adjustSchema), admin.doAdjust);
a.get('/orders', validate(S.adminOrderQuerySchema, 'query'), admin.listOrders);
a.get('/orders/:id', idParam(), admin.getOrder);
a.patch('/orders/:id/status', idParam(), validate(S.orderStatusSchema), admin.updateOrderStatus);
a.post('/orders/:id/refund', adminOnly, idParam(), validate(S.refundSchema), admin.refundOrder);
a.get('/users', adminOnly, validate(S.adminUserQuerySchema, 'query'), admin.listUsers);
a.get('/users/:id/orders', adminOnly, idParam(), admin.userOrders);
a.patch('/users/:id/status', adminOnly, idParam(), validate(S.userStatusSchema), admin.setUserStatus);
a.patch('/users/:id/role', adminOnly, idParam(), validate(S.userRoleSchema), admin.setUserRole);
a.get('/coupons', adminOnly, admin.listCoupons);
a.post('/coupons', adminOnly, validate(S.couponSchema), admin.createCoupon);
a.patch('/coupons/:id', adminOnly, idParam(), validate(S.couponPatchSchema), admin.updateCoupon);
a.get('/settings', adminOnly, admin.getSettingsCtl);
a.patch('/settings', adminOnly, validate(S.settingsSchema), admin.updateSettings);
a.post('/uploads', adminOnly, uploader.single('image'), admin.upload);
a.get('/audit-log', adminOnly, admin.auditLog);
r.use('/admin', a);

export default r;
