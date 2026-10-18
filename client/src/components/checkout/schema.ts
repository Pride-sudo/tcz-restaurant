import { z } from 'zod';

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,20}$/, 'Enter a valid phone number'),
  addressId: z.string().optional(),
  line1: z.string().trim().optional(), line2: z.string().trim().optional(), city: z.string().trim().optional(),
  instructions: z.string().trim().max(300, 'Keep instructions under 300 characters').optional(),
  notes: z.string().trim().max(300, 'Keep notes under 300 characters').optional(),
  paymentMethod: z.enum(['card', 'cash', 'dev'], { errorMap: () => ({ message: 'Choose a payment method' }) }),
}).superRefine((v, ctx) => {
  if (v.addressId) return;
  if (!v.line1 || v.line1.length < 3) ctx.addIssue({ code: 'custom', path: ['line1'], message: 'Enter your street address' });
  if (!v.city || v.city.length < 2) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Enter your city or suburb' });
});
export type CheckoutValues = z.infer<typeof checkoutSchema>;
