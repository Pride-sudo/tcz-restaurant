import { useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, del, get, post, put } from '../services/api';
import { useCart } from '../store/cart';
import { useUI } from '../store/ui';
import { errMsg } from '../services/api';
import type { Category, Food, Meta, Order, PublicSettings, Quote, Review, User } from '../types';

export function useMe() {
  return useQuery({
    queryKey: ['me'], retry: false, staleTime: 60_000,
    queryFn: async () => { try { return (await get<{ user: User }>('/auth/me')).data.user; } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; } },
  });
}
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: async () => (await get<Category[]>('/categories')).data, staleTime: 5 * 60_000 });
export const usePublicSettings = () => useQuery({ queryKey: ['settings-public'], queryFn: async () => (await get<PublicSettings>('/settings/public')).data, staleTime: 5 * 60_000 });
export const usePaymentConfig = () => useQuery({ queryKey: ['pay-config'], queryFn: async () => (await get<{ card: boolean; cash: boolean; dev: boolean }>('/payments/config')).data });
export const useFoods = (params: Record<string, any>) => useQuery({ queryKey: ['foods', params], placeholderData: keepPreviousData, queryFn: async () => { const r = await get<Food[]>('/foods', params); return { items: r.data, meta: r.meta as Meta }; } });
export const useFeatured = () => useQuery({ queryKey: ['featured'], queryFn: async () => (await get<{ featured: Food[]; bestsellers: Food[]; chefPicks: Food[]; offers: Food[] }>('/foods/featured')).data });
export const useFood = (id?: string) => useQuery({ queryKey: ['food', id], enabled: !!id, queryFn: async () => (await get<{ food: Food; related: Food[]; allergenNotice: string }>(`/foods/${id}`)).data });
export const useReviews = (id: string, page = 1) => useQuery({ queryKey: ['reviews', id, page], queryFn: async () => { const r = await get<Review[]>(`/foods/${id}/reviews`, { page }); return { items: r.data, meta: r.meta as Meta }; } });
export const useFavorites = (enabled: boolean) => useQuery({ queryKey: ['favorites'], enabled, queryFn: async () => (await get<Food[]>('/favorites')).data });
export const useMyOrders = (page: number) => useQuery({ queryKey: ['my-orders', page], queryFn: async () => { const r = await get<Order[]>('/orders/my-orders', { page }); return { items: r.data, meta: r.meta as Meta }; } });
export const useOrder = (id?: string, poll = false) => useQuery({
  queryKey: ['order', id], enabled: !!id,
  queryFn: async () => (await get<Order>(`/orders/${id}`)).data,
  refetchInterval: (q) => { const o = q.state.data as Order | undefined; return poll && o && !['delivered', 'cancelled'].includes(o.status) ? 10_000 : false; },
});

/** Prices the local cart on the server (current price, discount, stock, coupon, tax, delivery). */
export function useQuote(items: { foodId: string; variantName: string | null; quantity: number }[], couponCode: string | null) {
  const key = JSON.stringify(items.map((i) => [i.foodId, i.variantName, i.quantity]));
  return useQuery({
    queryKey: ['quote', key, couponCode], enabled: items.length > 0, placeholderData: keepPreviousData, staleTime: 15_000,
    queryFn: async () => (await post<Quote>('/cart/quote', { items: items.map(({ foodId, variantName, quantity }) => ({ foodId, variantName, quantity })), couponCode })).data,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => (on ? await post(`/favorites/${id}`) : await del(`/favorites/${id}`)),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['me'] }); qc.invalidateQueries({ queryKey: ['favorites'] }); toast(v.on ? 'Saved to favorites' : 'Removed from favorites'); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
}

/** Keeps the signed-in user's server cart in step with the local cart. */
export function useCartSync(user: User | null | undefined) {
  const { items, couponCode, replace } = useCart();
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { loaded.current = null; return; }
    if (loaded.current === user.id) return;
    loaded.current = user.id;
    if (items.length === 0) get<{ items: any[]; couponCode: string | null }>('/cart').then((r) => { if (r.data.items.length) replace(r.data.items.map((l) => ({ foodId: l.foodId, variantName: l.variantName, quantity: l.quantity, name: l.name, image: l.image, unitCents: l.finalCents })), r.data.couponCode); }).catch(() => {});
  }, [user?.id]); // eslint-disable-line
  useEffect(() => {
    if (!user || loaded.current !== user.id) return;
    const t = setTimeout(() => { put('/cart', { items: items.map(({ foodId, variantName, quantity }) => ({ foodId, variantName, quantity })), couponCode }).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [items, couponCode, user?.id]); // eslint-disable-line
}
export const useRecentReviews = () => useQuery({ queryKey: ['recent-reviews'], queryFn: async () => (await get<(Review & { food: { name: string; slug: string } | null })[]>('/reviews/recent')).data });
