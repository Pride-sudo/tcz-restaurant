import { Order, Payment } from '../../models';
import { logger } from '../../utils/logger';
import { markOrderPaid, markPaymentFailed } from '../orders';

/** Apply a verified Stripe event. Throws on failure so the caller can un-record the event and let Stripe retry. */
export async function handleStripeEvent(event: any) {
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const payment: any = await Payment.findOne({ providerSessionId: obj.id });
      if (!payment) { logger.warn('Webhook for unknown session', { session: obj.id }); return; }
      if (obj.payment_status === 'paid') {
        await markOrderPaid(payment.orderId, { provider: 'stripe', sessionId: obj.id, paymentIntentId: typeof obj.payment_intent === 'string' ? obj.payment_intent : undefined, amountCents: obj.amount_total, currency: obj.currency });
      } else {
        await Order.updateOne({ _id: payment.orderId, paymentStatus: 'unpaid' }, { paymentStatus: 'pending' });
      }
      return;
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const payment: any = await Payment.findOne({ providerSessionId: obj.id });
      if (payment) await markPaymentFailed(payment.orderId, event.type === 'checkout.session.expired' ? 'Checkout session expired' : 'Payment failed');
      return;
    }
    case 'charge.refunded': {
      const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
      const payment: any = pi && (await Payment.findOne({ providerPaymentIntentId: pi }));
      if (payment && obj.refunded) {
        await Payment.updateOne({ _id: payment._id }, { status: 'refunded' });
        await Order.updateOne({ _id: payment.orderId }, { paymentStatus: 'refunded', $push: { timeline: { status: 'cancelled', note: 'Refund confirmed by payment provider', at: new Date() } } });
      }
      return;
    }
    default: return;
  }
}
