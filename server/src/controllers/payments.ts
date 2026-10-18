import { Request, Response } from 'express';
import { Order, Payment, WebhookEvent } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok } from '../utils/helpers';
import { currentUser } from '../middleware/auth';
import { clientOrigins, devPaymentsEnabled, stripeConfigured } from '../config/env';
import { getProvider } from '../services/payments';
import { handleStripeEvent } from '../services/payments/webhook';
import { markOrderPaid, markPaymentFailed } from '../services/orders';
import { logger } from '../utils/logger';

export const config = asyncHandler(async (_req, res) => ok(res, { card: stripeConfigured, cash: true, dev: devPaymentsEnabled, provider: 'stripe' }));

async function ownOrder(req: Request, orderId: string) {
  const o: any = await Order.findById(orderId);
  if (!o || String(o.userId) !== String(currentUser(req)._id)) throw ApiError.notFound('Order not found.');
  return o;
}

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const order = await ownOrder(req, req.body.orderId);
  if (order.paymentMethod !== 'card') throw ApiError.badRequest('This order is not a card order.');
  if (order.status === 'cancelled') throw ApiError.conflict('This order was cancelled.', 'ORDER_CANCELLED');
  if (order.paymentStatus === 'paid') throw ApiError.conflict('This order is already paid.', 'ALREADY_PAID');
  const provider = getProvider('stripe');
  if (!provider.isConfigured()) throw new ApiError(503, 'Card payments are not configured on this server.', 'PAYMENT_PROVIDER_NOT_CONFIGURED');

  // Reuse an open session so repeated clicks never create parallel payments.
  const open: any = await Payment.findOne({ orderId: order._id, status: 'pending', expiresAt: { $gt: new Date(Date.now() + 60_000) } });
  if (open?.checkoutUrl) return ok(res, { paymentId: String(open._id), url: open.checkoutUrl, reused: true });

  const payment: any = await Payment.create({ orderId: order._id, userId: order.userId, provider: 'stripe', amountCents: order.totalCents, currency: order.currency, status: 'pending' });
  try {
    const base = clientOrigins[0];
    const s = await provider.createCheckout({ order, paymentId: String(payment._id), successUrl: `${base}/orders/${order._id}?checkout=success`, cancelUrl: `${base}/orders/${order._id}?checkout=cancelled`, customerEmail: order.customer?.email });
    payment.providerSessionId = s.sessionId; payment.checkoutUrl = s.url; payment.expiresAt = s.expiresAt; await payment.save();
    await Order.updateOne({ _id: order._id, paymentStatus: 'unpaid' }, { paymentStatus: 'pending' });
    ok(res, { paymentId: String(payment._id), url: s.url });
  } catch (e: any) {
    await Payment.updateOne({ _id: payment._id }, { status: 'failed', failureReason: 'Could not start checkout' });
    logger.error('Checkout session creation failed', { message: e.message });
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, 'We could not reach the payment provider. Please try again.', 'PROVIDER_ERROR');
  }
});

/** Status endpoint: if still pending, ask the provider directly (server-side verification), never trust the browser. */
export const paymentStatus = asyncHandler(async (req, res) => {
  const p: any = await Payment.findById(req.params.id);
  if (!p || String(p.userId) !== String(currentUser(req)._id)) throw ApiError.notFound('Payment not found.');
  if (p.status === 'pending' && p.providerSessionId && p.provider === 'stripe' && stripeConfigured) {
    try {
      const s = await getProvider('stripe').retrieveSession(p.providerSessionId);
      if (s.status === 'paid') await markOrderPaid(p.orderId, { provider: 'stripe', sessionId: p.providerSessionId, paymentIntentId: s.paymentIntentId, amountCents: s.amountCents, currency: s.currency });
      else if (s.status === 'expired') await markPaymentFailed(p.orderId, 'Checkout session expired');
    } catch (e: any) { logger.warn('Payment reconcile failed', { message: e.message }); }
  }
  const fresh: any = await Payment.findById(p._id); const order: any = await Order.findById(p.orderId);
  ok(res, { id: String(fresh._id), status: fresh.status, provider: fresh.provider, orderId: String(order._id), orderPaymentStatus: order.paymentStatus, orderStatus: order.status });
});

/** Raw-body route. Signature verified; each event id processed once. */
export const webhook = async (req: Request, res: Response) => {
  let event: any;
  try { event = getProvider('stripe').constructEvent(req.body as Buffer, String(req.headers['stripe-signature'] || '')); }
  catch (e: any) { logger.warn('Webhook signature rejected', { message: e.message }); return res.status(400).json({ success: false, error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } }); }
  try { await WebhookEvent.create({ eventId: event.id, type: event.type }); }
  catch (e: any) { if (e?.code === 11000) return res.json({ received: true, duplicate: true }); throw e; }
  try { await handleStripeEvent(event); res.json({ received: true }); }
  catch (e: any) {
    await WebhookEvent.deleteOne({ eventId: event.id }); // allow provider retry
    logger.error('Webhook handling failed', { type: event.type, message: e.message });
    res.status(500).json({ success: false, error: { code: 'WEBHOOK_FAILED', message: 'Processing failed.' } });
  }
};

/** Development-only fake payment: disabled in production, never touches a real provider. */
export const devConfirm = asyncHandler(async (req, res) => {
  if (!devPaymentsEnabled) throw ApiError.notFound('Route not found.');
  const order = await ownOrder(req, req.body.orderId);
  if (order.paymentMethod !== 'dev') throw ApiError.badRequest('This order did not use the development payment option.');
  if (req.body.outcome === 'fail') { await markPaymentFailed(order._id, 'Simulated failure (development)'); return ok(res, { status: 'failed' }); }
  await Payment.findOneAndUpdate({ orderId: order._id, provider: 'dev' }, { $setOnInsert: { userId: order.userId, amountCents: order.totalCents, currency: order.currency, status: 'pending' } }, { upsert: true });
  await markOrderPaid(order._id, { provider: 'dev', amountCents: order.totalCents, currency: order.currency });
  ok(res, { status: 'paid' });
});
