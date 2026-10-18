import Stripe from 'stripe';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { PaymentProvider } from './types';

let client: Stripe | null = null;
const stripe = () => {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, 'Card payments are not configured on this server.', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  return (client ||= new Stripe(env.STRIPE_SECRET_KEY));
};

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  isConfigured: () => !!env.STRIPE_SECRET_KEY,
  async createCheckout({ order, paymentId, successUrl, cancelUrl, customerEmail }) {
    const expiresAtSec = Math.floor(Date.now() / 1000) + 31 * 60; // Stripe minimum is 30 minutes
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(order._id),
      customer_email: customerEmail,
      line_items: [{ quantity: 1, price_data: { currency: order.currency.toLowerCase(), unit_amount: order.totalCents, product_data: { name: `TCZ Restaurant order ${order.orderNumber}` } } }],
      metadata: { orderId: String(order._id), paymentId },
      payment_intent_data: { metadata: { orderId: String(order._id) } },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: expiresAtSec,
    }, { idempotencyKey: `checkout-${paymentId}` });
    if (!session.url) throw new ApiError(502, 'The payment provider did not return a checkout link.', 'PROVIDER_ERROR');
    return { sessionId: session.id, url: session.url, expiresAt: new Date(expiresAtSec * 1000) };
  },
  async retrieveSession(sessionId) {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    return {
      status: s.payment_status === 'paid' ? 'paid' : s.status === 'expired' ? 'expired' : 'unpaid',
      amountCents: s.amount_total ?? 0, currency: s.currency || '',
      paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id,
    };
  },
  constructEvent(rawBody, signature) {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Webhook secret is not configured.', 'WEBHOOK_NOT_CONFIGURED');
    return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  },
  async refund(paymentIntentId, amountCents, idempotencyKey) {
    const r = await stripe().refunds.create({ payment_intent: paymentIntentId, amount: amountCents }, { idempotencyKey });
    return { id: r.id, status: r.status || 'pending' };
  },
};
