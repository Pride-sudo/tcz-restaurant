import { brand } from '../config/brand';

let currency = 'USD';
export const setCurrency = (c: string) => { currency = c || 'USD'; };
export const money = (cents: number, cur = currency) => new Intl.NumberFormat(brand.locale, { style: 'currency', currency: cur }).format((cents || 0) / 100);
export const toCents = (v: string | number) => Math.round(Number(v) * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);
export const dateTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleString(brand.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const timeOnly = (d?: string | Date | null) => (d ? new Date(d).toLocaleTimeString(brand.locale, { timeStyle: 'short' }) : '-');
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const statusTone: Record<string, string> = {
  placed: 'bg-coral-soft text-ink', confirmed: 'bg-forest-soft text-forest', preparing: 'bg-forest-soft text-forest', ready: 'bg-forest-soft text-forest',
  out_for_delivery: 'bg-forest-soft text-forest', delivered: 'bg-forest text-forest-fg', cancelled: 'bg-danger/15 text-danger',
  paid: 'bg-forest text-forest-fg', unpaid: 'bg-line text-ink', pending: 'bg-coral-soft text-ink', failed: 'bg-danger/15 text-danger', refunded: 'bg-line text-ink', refund_pending: 'bg-coral-soft text-ink',
  ok: 'bg-forest-soft text-forest', low: 'bg-coral-soft text-ink', out: 'bg-danger/15 text-danger', active: 'bg-forest-soft text-forest', suspended: 'bg-danger/15 text-danger',
};
export const label = (s: string) => ({ out_for_delivery: 'Out for delivery', ready: 'Ready for dispatch', placed: 'Order placed', refund_pending: 'Refund pending' } as Record<string, string>)[s] || s.charAt(0).toUpperCase() + s.slice(1);
