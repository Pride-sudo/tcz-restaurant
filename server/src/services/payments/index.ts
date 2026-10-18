import { PaymentProvider } from './types';
import { stripeProvider } from './stripe';
export const providers: Record<string, PaymentProvider> = { stripe: stripeProvider };
export const getProvider = (name: string) => providers[name];
export * from './types';
