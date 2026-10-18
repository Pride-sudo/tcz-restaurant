import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, clampQty, useCart } from '../store/cart';
import { checkoutSchema } from '../components/checkout/schema';

const burger = { foodId: 'a1', variantName: null, name: 'Burger', image: '', unitCents: 850 };
beforeEach(() => useCart.setState({ items: [], couponCode: null, bumped: 0 }));

describe('cart store', () => {
  it('adds, merges identical lines and counts', () => {
    useCart.getState().add(burger, 2); useCart.getState().add(burger, 1);
    expect(useCart.getState().items).toHaveLength(1); expect(cartCount(useCart.getState().items)).toBe(3);
  });
  it('keeps different variants as separate lines', () => {
    useCart.getState().add({ ...burger, variantName: 'Double' }); useCart.getState().add(burger);
    expect(useCart.getState().items).toHaveLength(2);
  });
  it('updates quantity, clamps it, and removes at zero', () => {
    useCart.getState().add(burger); useCart.getState().setQty('a1', null, 99);
    expect(useCart.getState().items[0].quantity).toBe(50);
    useCart.getState().setQty('a1', null, 0); expect(useCart.getState().items).toHaveLength(0);
    expect(clampQty(NaN)).toBe(1);
  });
  it('clears items and coupon', () => {
    useCart.getState().add(burger); useCart.getState().setCoupon('SAVE3'); useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]); expect(useCart.getState().couponCode).toBeNull();
  });
});

describe('checkout validation', () => {
  const ok = { name: 'Tendai Moyo', phone: '+263771234567', line1: '45 Borrowdale Rd', city: 'Harare', paymentMethod: 'cash' as const };
  it('accepts a valid new-address order', () => expect(checkoutSchema.safeParse(ok).success).toBe(true));
  it('accepts a saved address without typed fields', () => expect(checkoutSchema.safeParse({ ...ok, addressId: 'abc', line1: '', city: '' }).success).toBe(true));
  it('reports field-level errors', () => {
    const r = checkoutSchema.safeParse({ ...ok, name: 'T', phone: 'abc', line1: '', city: '' });
    expect(r.success).toBe(false);
    const paths = !r.success ? r.error.issues.map((i) => i.path[0]) : [];
    expect(paths).toEqual(expect.arrayContaining(['name', 'phone', 'line1', 'city']));
  });
  it('rejects an unknown payment method', () => expect(checkoutSchema.safeParse({ ...ok, paymentMethod: 'bitcoin' }).success).toBe(false));
});
