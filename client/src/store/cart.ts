import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine { foodId: string; variantName: string | null; quantity: number; name: string; image: string; unitCents: number }
interface CartState {
  items: CartLine[]; couponCode: string | null; bumped: number;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (foodId: string, variantName: string | null, qty: number) => void;
  remove: (foodId: string, variantName: string | null) => void;
  clear: () => void; setCoupon: (c: string | null) => void; replace: (items: CartLine[], coupon?: string | null) => void;
}
const same = (a: CartLine, id: string, v: string | null) => a.foodId === id && (a.variantName || null) === (v || null);
export const clampQty = (n: number) => Math.max(1, Math.min(50, Math.floor(Number.isFinite(n) ? n : 1)));

export const useCart = create<CartState>()(persist((set) => ({
  items: [], couponCode: null, bumped: 0,
  add: (line, qty = 1) => set((s) => {
    const ex = s.items.find((i) => same(i, line.foodId, line.variantName));
    const items = ex ? s.items.map((i) => (i === ex ? { ...i, quantity: clampQty(i.quantity + qty), unitCents: line.unitCents } : i)) : [...s.items, { ...line, quantity: clampQty(qty) }];
    return { items, bumped: s.bumped + 1 };
  }),
  setQty: (id, v, qty) => set((s) => ({ items: qty < 1 ? s.items.filter((i) => !same(i, id, v)) : s.items.map((i) => (same(i, id, v) ? { ...i, quantity: clampQty(qty) } : i)) })),
  remove: (id, v) => set((s) => ({ items: s.items.filter((i) => !same(i, id, v)) })),
  clear: () => set({ items: [], couponCode: null }),
  setCoupon: (couponCode) => set({ couponCode }),
  replace: (items, couponCode = null) => set({ items, couponCode }),
}), { name: 'tcz-cart', partialize: (s) => ({ items: s.items, couponCode: s.couponCode }) }));

export const cartCount = (items: CartLine[]) => items.reduce((n, i) => n + i.quantity, 0);
