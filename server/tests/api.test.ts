import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let app: any; let mem: MongoMemoryServer; let M: any; let rid: any; let cat: any;
const H = { 'X-Requested-With': 'tcz-web' };
const ag = () => request.agent(app).set(H);

async function signup(email: string) {
  const a = ag();
  const r = await a.post('/api/auth/register').send({ name: 'Test User', email, password: 'Passw0rdX' });
  expect(r.status).toBe(201);
  return a;
}
async function adminAgent() {
  await M.User.create({ name: 'Boss', email: 'admin@t.test', passwordHash: await bcrypt.hash('Passw0rdX', 4), role: 'admin', restaurantId: rid });
  const a = ag(); await a.post('/api/auth/login').send({ email: 'admin@t.test', password: 'Passw0rdX' }); return a;
}
const mkFood = (over: any = {}) => M.Food.create({ restaurantId: rid, name: 'Burger', slug: 'burger-' + Math.random().toString(36).slice(2), description: 'Tasty burger', category: cat._id, priceCents: 1000, stock: 10, lowStockThreshold: 2, ...over });
const addr = { line1: '1 Test Road', city: 'Harare' };
const orderBody = (foodId: string, quantity = 1, extra: any = {}) => ({ items: [{ foodId, quantity }], paymentMethod: 'cash', customer: { name: 'Test User', phone: '+263771234567' }, address: addr, ...extra });

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  const { connectDb } = await import('../src/config/db');
  await connectDb(mem.getUri());
  M = await import('../src/models');
  const { createApp } = await import('../src/app');
  app = createApp();
});
afterAll(async () => { await mongoose.disconnect(); await mem.stop(); });
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  const { resetRestaurantCache, getRestaurant, getSettings } = await import('../src/services/restaurant');
  resetRestaurantCache(); rid = (await getRestaurant())._id; await getSettings(rid);
  await M.Settings.updateOne({ restaurantId: rid }, { minOrderCents: 0, deliveryFeeCents: 300 });
  cat = await M.Category.create({ restaurantId: rid, name: 'Mains', slug: 'mains' });
});

describe('auth & permissions', () => {
  it('registers, logs in, and never lets a client choose its role', async () => {
    const a = ag();
    const r = await a.post('/api/auth/register').send({ name: 'Eve', email: 'eve@t.test', password: 'Passw0rdX', role: 'admin' });
    expect(r.status).toBe(201); expect(r.body.data.user.role).toBe('customer');
    expect((await a.get('/api/auth/me')).status).toBe(200);
    await a.post('/api/auth/logout'); expect((await a.get('/api/auth/me')).status).toBe(401);
    expect((await ag().post('/api/auth/login').send({ email: 'eve@t.test', password: 'wrong-pass1' })).status).toBe(401);
  });
  it('rejects weak passwords and missing CSRF header', async () => {
    expect((await ag().post('/api/auth/register').send({ name: 'Bob', email: 'b@t.test', password: 'short' })).status).toBe(422);
    expect((await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' })).status).toBe(403);
  });
  it('blocks customers from admin routes', async () => {
    const c = await signup('cust@t.test');
    expect((await c.get('/api/admin/dashboard')).status).toBe(403);
    expect((await ag().get('/api/admin/dashboard')).status).toBe(401);
  });
});

describe('food CRUD (admin)', () => {
  it('creates with initial stock, edits, and archives', async () => {
    const admin = await adminAgent();
    const body = { name: 'Chicken Burger', description: 'Crispy chicken burger', category: String(cat._id), priceCents: 850, initialStock: 35, lowStockThreshold: 10 };
    const c = await admin.post('/api/admin/foods').send(body); expect(c.status).toBe(201); expect(c.body.data.stock).toBe(35);
    const id = c.body.data.id;
    expect((await admin.patch(`/api/admin/foods/${id}`).send({ priceCents: 900 })).body.data.priceCents).toBe(900);
    expect((await admin.get('/api/admin/inventory/movements')).body.data.length).toBe(1);
    expect((await admin.delete(`/api/admin/foods/${id}`)).body.data.archived).toBe(true);
    expect((await request(app).get('/api/foods')).body.data.length).toBe(0);
  });
});

describe('orders & inventory', () => {
  it('prices on the server and reserves stock; cancel releases it', async () => {
    const f = await mkFood({ priceCents: 1000, discountPercent: 10 });
    const u = await signup('o1@t.test');
    const r = await u.post('/api/orders').set('Idempotency-Key', 'key-0000001').send({ ...orderBody(String(f._id), 2), price: 1, totalCents: 1 });
    expect(r.status).toBe(201);
    expect(r.body.data.subtotalCents).toBe(1800); expect(r.body.data.totalCents).toBe(2100); // 2 x 900 + 300 delivery; spoofed totals ignored
    expect(await M.Food.findById(f._id).then((x: any) => [x.stock, x.reserved])).toEqual([10, 2]);
    const admin = await adminAgent();
    expect((await admin.patch(`/api/admin/orders/${r.body.data.id}/status`).send({ status: 'cancelled' })).status).toBe(200);
    expect(await M.Food.findById(f._id).then((x: any) => [x.stock, x.reserved])).toEqual([10, 0]);
  });
  it('is idempotent: the same key never creates two orders', async () => {
    const f = await mkFood(); const u = await signup('o2@t.test');
    const a = await u.post('/api/orders').set('Idempotency-Key', 'dup-key-0001').send(orderBody(String(f._id)));
    const b = await u.post('/api/orders').set('Idempotency-Key', 'dup-key-0001').send(orderBody(String(f._id)));
    expect(a.body.data.id).toBe(b.body.data.id); expect(await M.Order.countDocuments()).toBe(1);
    expect((await M.Food.findById(f._id)).reserved).toBe(1);
  });
  it('never oversells under concurrent orders', async () => {
    const f = await mkFood({ stock: 3 }); const u = await signup('o3@t.test');
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => u.post('/api/orders').set('Idempotency-Key', `race-key-${i}-xxxx`).send(orderBody(String(f._id)))));
    expect(results.filter((r) => r.status === 201).length).toBe(3);
    expect(results.filter((r) => r.status === 409).length).toBe(5);
    const after = await M.Food.findById(f._id); expect(after.reserved).toBe(3); expect(after.stock - after.reserved).toBe(0);
  });
  it('commits stock exactly once when a cash order is confirmed, and enforces transitions', async () => {
    const f = await mkFood(); const u = await signup('o4@t.test'); const admin = await adminAgent();
    const o = (await u.post('/api/orders').set('Idempotency-Key', 'flow-key-0001').send(orderBody(String(f._id), 2))).body.data;
    expect((await admin.patch(`/api/admin/orders/${o.id}/status`).send({ status: 'delivered' })).status).toBe(409);
    expect((await admin.patch(`/api/admin/orders/${o.id}/status`).send({ status: 'confirmed' })).status).toBe(200);
    expect((await admin.patch(`/api/admin/orders/${o.id}/status`).send({ status: 'confirmed' })).status).toBe(409);
    expect(await M.Food.findById(f._id).then((x: any) => [x.stock, x.reserved])).toEqual([8, 0]);
    for (const s of ['preparing', 'ready', 'out_for_delivery', 'delivered']) expect((await admin.patch(`/api/admin/orders/${o.id}/status`).send({ status: s })).status).toBe(200);
    expect((await u.get(`/api/orders/${o.id}/tracking`)).body.data.trackingMode).toBe('status-based');
  });
  it("hides other customers' orders", async () => {
    const f = await mkFood(); const a = await signup('a@t.test'); const b = await signup('b@t.test');
    const o = (await a.post('/api/orders').set('Idempotency-Key', 'own-key-00001').send(orderBody(String(f._id)))).body.data;
    expect((await b.get(`/api/orders/${o.id}`)).status).toBe(404);
  });
  it('rejects expired coupons and cart quantities above stock', async () => {
    const f = await mkFood({ stock: 2 }); const u = await signup('c@t.test');
    await M.Coupon.create({ restaurantId: rid, code: 'OLD', type: 'percent', value: 10, expiresAt: new Date(Date.now() - 1000) });
    expect((await u.post('/api/coupons/validate').send({ code: 'OLD', items: [{ foodId: String(f._id), quantity: 1 }] })).status).toBe(400);
    expect((await u.post('/api/orders').set('Idempotency-Key', 'big-key-00001').send(orderBody(String(f._id), 5))).status).toBe(409);
  });
});

describe('reviews', () => {
  it('only delivered buyers may review, once per order, and can edit/delete', async () => {
    const f = await mkFood(); const u = await signup('r@t.test'); const other = await signup('r2@t.test'); const admin = await adminAgent();
    expect((await u.post(`/api/foods/${f._id}/reviews`).send({ rating: 5 })).status).toBe(403);
    const o = (await u.post('/api/orders').set('Idempotency-Key', 'rev-key-00001').send(orderBody(String(f._id)))).body.data;
    for (const s of ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']) await admin.patch(`/api/admin/orders/${o.id}/status`).send({ status: s });
    expect((await other.post(`/api/foods/${f._id}/reviews`).send({ rating: 1 })).status).toBe(403);
    const r = await u.post(`/api/foods/${f._id}/reviews`).send({ rating: 4, comment: 'Nice' }); expect(r.status).toBe(201);
    expect((await u.post(`/api/foods/${f._id}/reviews`).send({ rating: 5 })).status).toBe(409);
    expect((await other.patch(`/api/reviews/${r.body.data.id}`).send({ rating: 1 })).status).toBe(404);
    await u.patch(`/api/reviews/${r.body.data.id}`).send({ rating: 2 }); expect((await M.Food.findById(f._id)).ratingAvg).toBe(2);
    await u.delete(`/api/reviews/${r.body.data.id}`); expect((await M.Food.findById(f._id)).ratingCount).toBe(0);
  });
});

describe('payments', () => {
  const stripe = new Stripe('sk_test_dummy_key_for_signature_tests');
  const sign = (payload: string) => stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
  async function cardOrder() {
    const f = await mkFood(); const u = await signup('p@t.test');
    const o = (await u.post('/api/orders').set('Idempotency-Key', 'pay-key-00001').send(orderBody(String(f._id), 2, { paymentMethod: 'card' }))).body.data;
    const p = await M.Payment.create({ orderId: o.id, userId: (await M.User.findOne({ email: 'p@t.test' }))._id, provider: 'stripe', providerSessionId: 'cs_test_1', amountCents: o.totalCents, currency: o.currency });
    return { f, o, p };
  }
  const evt = (id: string, o: any, over: any = {}) => JSON.stringify({ id, object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: o.totalCents, currency: o.currency.toLowerCase(), payment_intent: 'pi_1', ...over } } });

  it('rejects unsigned webhooks and never marks paid from the browser', async () => {
    const { o } = await cardOrder();
    expect((await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'bad').send(evt('evt_1', o))).status).toBe(400);
    expect((await M.Order.findById(o.id)).paymentStatus).toBe('unpaid');
  });
  it('processes a signed event once and ignores duplicates', async () => {
    const { f, o } = await cardOrder(); const body = evt('evt_2', o);
    const send = () => request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('stripe-signature', sign(body)).send(body);
    expect((await send()).status).toBe(200); expect((await send()).body.duplicate).toBe(true);
    expect((await M.Order.findById(o.id)).paymentStatus).toBe('paid');
    expect(await M.Food.findById(f._id).then((x: any) => [x.stock, x.reserved, x.soldCount])).toEqual([8, 0, 2]); // committed once
  });
  it('refuses a payment whose amount does not match the order', async () => {
    const { o } = await cardOrder(); const body = evt('evt_3', o, { amount_total: 1 });
    expect((await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('stripe-signature', sign(body)).send(body)).status).toBe(500);
    expect((await M.Order.findById(o.id)).paymentStatus).not.toBe('paid');
  });
  it('releases stock when the checkout session expires', async () => {
    const { f, o } = await cardOrder();
    const body = JSON.stringify({ id: 'evt_4', object: 'event', type: 'checkout.session.expired', data: { object: { id: 'cs_test_1' } } });
    await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('stripe-signature', sign(body)).send(body);
    expect((await M.Order.findById(o.id)).status).toBe('cancelled');
    expect(await M.Food.findById(f._id).then((x: any) => [x.stock, x.reserved])).toEqual([10, 0]);
  });
});
