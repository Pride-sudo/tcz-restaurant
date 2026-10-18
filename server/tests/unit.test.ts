import { describe, expect, it } from 'vitest';
import { computeTotals, couponDiscount, unitPricing } from '../src/services/pricing';
import { canTransition } from '../src/services/orders';

const food = { priceCents: 1000, discountPercent: 20, variants: [{ name: 'Large', priceDeltaCents: 400 }] };
describe('pricing', () => {
  it('applies variant and active discount', () => {
    expect(unitPricing(food, 'Large')).toMatchObject({ base: 1400, discount: 280, final: 1120 });
  });
  it('ignores an expired discount', () => {
    expect(unitPricing({ ...food, discountEndsAt: new Date(Date.now() - 1000) }, null)!.final).toBe(1000);
  });
  it('rejects unknown variants', () => expect(unitPricing(food, 'Huge')).toBeNull());
  it('computes totals with tax, coupon and delivery', () => {
    const t = computeTotals([{ finalCents: 1000, quantity: 3 }], { taxRatePercent: 10, deliveryFeeCents: 300, freeDeliveryOverCents: 0 }, 500);
    expect(t).toEqual({ subtotalCents: 3000, discountCents: 500, taxCents: 250, deliveryFeeCents: 300, totalCents: 3050 });
  });
  it('gives free delivery over the threshold', () => {
    expect(computeTotals([{ finalCents: 5000, quantity: 1 }], { taxRatePercent: 0, deliveryFeeCents: 300, freeDeliveryOverCents: 4000 }).deliveryFeeCents).toBe(0);
  });
});
describe('coupons', () => {
  const base = { active: true, type: 'percent', value: 10, minOrderCents: 1000, usedCount: 0 };
  it('computes percent discounts with a cap', () => expect(couponDiscount({ ...base, maxDiscountCents: 150 }, 3000)).toBe(150));
  it('rejects expired, exhausted and under-minimum', () => {
    expect(() => couponDiscount({ ...base, expiresAt: new Date(Date.now() - 1000) }, 3000)).toThrow(/expired/);
    expect(() => couponDiscount({ ...base, usageLimit: 1, usedCount: 1 }, 3000)).toThrow(/redeemed/);
    expect(() => couponDiscount(base, 500)).toThrow(/Spend at least/);
  });
});
describe('order status transitions', () => {
  it('allows the happy path', () => {
    const flow = ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    for (let i = 0; i < flow.length - 1; i++) expect(canTransition(flow[i], flow[i + 1])).toBe(true);
  });
  it('blocks skipping and reversing', () => {
    expect(canTransition('placed', 'delivered')).toBe(false);
    expect(canTransition('delivered', 'preparing')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('out_for_delivery', 'cancelled')).toBe(false);
  });
});
