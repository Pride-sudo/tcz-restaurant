export interface CheckoutArgs { order: any; paymentId: string; successUrl: string; cancelUrl: string; customerEmail?: string }
export interface CheckoutResult { sessionId: string; url: string; expiresAt?: Date }
/**
 * Payment provider abstraction. To add a provider (e.g. a local mobile-money gateway), implement this
 * interface, register it in ./index.ts, and add its verified webhook route in controllers/payments.ts.
 */
export interface PaymentProvider {
  name: 'stripe';
  isConfigured(): boolean;
  createCheckout(args: CheckoutArgs): Promise<CheckoutResult>;
  retrieveSession(sessionId: string): Promise<{ status: 'paid' | 'unpaid' | 'expired'; amountCents: number; currency: string; paymentIntentId?: string }>;
  constructEvent(rawBody: Buffer, signature: string): any;
  refund(paymentIntentId: string, amountCents: number, idempotencyKey: string): Promise<{ id: string; status: string }>;
}
