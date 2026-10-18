import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, CreditCard, FlaskConical, Lock, Timer } from 'lucide-react';
import { checkoutSchema, CheckoutValues } from '../components/checkout/schema';
import { useMe, usePaymentConfig, usePublicSettings, useQuote } from '../hooks/queries';
import { ApiError, errMsg, post } from '../services/api';
import { useCart } from '../store/cart';
import { useUI } from '../store/ui';
import { Field, Skeleton, Spinner, TextArea, EmptyState, FoodImage } from '../components/common/ui';
import { TotalsTable } from '../components/cart/CartSummary';
import { cx, money, newKey } from '../utils/format';

export default function Checkout() {
  const nav = useNavigate(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { data: user } = useMe(); const { items, couponCode, clear } = useCart();
  const { data: quote, isLoading, refetch } = useQuote(items, couponCode); const { data: pay } = usePaymentConfig(); const { data: settings } = usePublicSettings();
  const [serverError, setServerError] = useState(''); const [busy, setBusy] = useState(false);
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const def = user?.addresses.find((a) => a.isDefault) || user?.addresses[0];
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema), mode: 'onTouched',
    values: { name: user?.name || '', phone: user?.phone || '', addressId: def?._id || '', line1: '', line2: '', city: '', instructions: '', notes: '', paymentMethod: 'cash' } as CheckoutValues,
  });
  const addressId = watch('addressId'); const method = watch('paymentMethod');
  if (items.length === 0) return <div className="container-x py-16"><EmptyState title="Your cart is empty" text="Add something delicious before checking out." action={<Link to="/menu" className="btn btn-primary">Browse the menu</Link>} /></div>;
  const blocked = !quote || quote.issues.length > 0 || quote.totals.subtotalCents < quote.minOrderCents;

  const onSubmit = async (v: CheckoutValues) => {
    if (!quote || blocked) return;
    setServerError(''); setBusy(true);
    // Same cart + same key => retries after network errors or double clicks can never create two orders.
    const sig = JSON.stringify([items.map((i) => [i.foodId, i.variantName, i.quantity]), couponCode, v.paymentMethod, v.addressId, v.line1, v.city]);
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { sig, key: newKey() };
    try {
      const { data: order } = await post<{ id: string }>('/orders', {
        items: items.map(({ foodId, variantName, quantity }) => ({ foodId, variantName, quantity })), couponCode, paymentMethod: v.paymentMethod,
        customer: { name: v.name, phone: v.phone }, instructions: v.instructions || undefined, notes: v.notes || undefined,
        ...(v.addressId ? { addressId: v.addressId } : { address: { line1: v.line1, line2: v.line2 || undefined, city: v.city } }),
      }, { 'Idempotency-Key': keyRef.current.key });
      clear(); qc.invalidateQueries({ queryKey: ['my-orders'] }); qc.invalidateQueries({ queryKey: ['foods'] });
      if (v.paymentMethod === 'card') {
        try { const { data: s } = await post<{ url: string }>('/payments/create-checkout-session', { orderId: order.id }); window.location.assign(s.url); return; }
        catch (e) { toast(`Order placed, but payment could not start: ${errMsg(e)} You can retry from your order page.`, 'error'); }
      }
      nav(`/orders/${order.id}?placed=1`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.details && e.status === 422) Object.entries(e.details).forEach(([k, m]) => { const f = k === 'customer.name' ? 'name' : k === 'customer.phone' ? 'phone' : k.replace('address.', ''); if (['name', 'phone', 'line1', 'city', 'instructions', 'notes'].includes(f)) setError(f as any, { message: String(m) }); });
        if (['CART_ISSUES', 'INSUFFICIENT_STOCK', 'COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_EXHAUSTED'].includes(e.code)) refetch();
        if (e.status === 401) return nav('/login?next=/checkout');
      }
      setServerError(errMsg(e));
    } finally { setBusy(false); }
  };

  const opt = (value: 'card' | 'cash' | 'dev', icon: React.ReactNode, title: string, text: string, enabled = true) => (
    <label className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2', method === value ? 'border-forest bg-forest-soft' : 'border-line', !enabled && 'cursor-not-allowed opacity-50')}>
      <input type="radio" value={value} disabled={!enabled} {...register('paymentMethod')} className="mt-1 accent-[rgb(var(--c-primary))]" /><span className="text-forest">{icon}</span><span><span className="block font-bold text-ink">{title}</span><span className="text-sm text-muted">{text}</span></span>
    </label>);

  return (
    <div className="container-x py-8"><h1 className="text-3xl font-extrabold">Checkout</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="c1"><h2 id="c1" className="text-lg font-extrabold">1. Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} /><Field label="Contact number" type="tel" autoComplete="tel" error={errors.phone?.message} hint="The driver may call this number." {...register('phone')} /></div></section>
          <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="c2"><h2 id="c2" className="text-lg font-extrabold">2. Delivery address</h2>
            {!user && <p className="rounded-xl bg-coral-soft p-3 text-sm">Please <Link className="font-bold underline" to="/login?next=/checkout">sign in</Link> or <Link className="font-bold underline" to="/register?next=/checkout">create an account</Link> to place your order. Your cart will be kept.</p>}
            {user && user.addresses.length > 0 && <div className="space-y-2" role="radiogroup" aria-label="Saved addresses">{user.addresses.map((a) => <label key={a._id} className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5', addressId === a._id ? 'border-forest bg-forest-soft' : 'border-line')}><input type="radio" value={a._id} {...register('addressId')} className="mt-1 accent-[rgb(var(--c-primary))]" /><span className="text-sm"><b>{a.label || 'Address'}</b><br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}</span></label>)}<label className={cx('flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-sm font-semibold', !addressId ? 'border-forest bg-forest-soft' : 'border-line')}><input type="radio" value="" {...register('addressId')} className="accent-[rgb(var(--c-primary))]" />Deliver somewhere else</label></div>}
            {!addressId && <div className="grid gap-4 sm:grid-cols-2"><Field className="sm:col-span-2" label="Street address" autoComplete="address-line1" error={errors.line1?.message} {...register('line1')} /><Field label="Apartment, gate or landmark (optional)" autoComplete="address-line2" {...register('line2')} /><Field label="City or suburb" autoComplete="address-level2" error={errors.city?.message} hint={settings?.deliveryAreas.length ? `We deliver to: ${settings.deliveryAreas.join(', ')}` : undefined} {...register('city')} /></div>}
            <TextArea label="Delivery instructions (optional)" error={errors.instructions?.message} placeholder="Gate code, where to leave the order…" {...register('instructions')} />
            <TextArea label="Order notes (optional)" error={errors.notes?.message} placeholder="Anything the kitchen should know" {...register('notes')} /></section>
          <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="c3"><h2 id="c3" className="text-lg font-extrabold">3. Payment</h2>
            {opt('card', <CreditCard className="h-5 w-5" />, 'Pay by card', pay?.card ? 'You will be taken to our secure payment provider. We never see your card number.' : 'Card payments are not enabled on this server yet.', !!pay?.card)}
            {opt('cash', <Banknote className="h-5 w-5" />, 'Cash on delivery', 'Pay the driver when your food arrives.')}
            {pay?.dev && opt('dev', <FlaskConical className="h-5 w-5" />, 'Development payment (no real money)', 'Test-only option for developers. Hidden in production.')}
            {errors.paymentMethod && <p role="alert" className="text-xs font-medium text-danger">{errors.paymentMethod.message}</p>}</section>
        </div>
        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24" aria-labelledby="c4"><h2 id="c4" className="text-lg font-extrabold">Review your order</h2>
          {isLoading || !quote ? <Skeleton className="h-40" /> : <>
            <ul className="divide-y divide-line">{quote.items.map((l) => <li key={`${l.foodId}-${l.variantName}`} className="flex gap-3 py-3"><FoodImage src={l.image} alt="" className="h-14 w-14 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 text-sm"><p className="font-bold">{l.name}</p><p className="text-muted">{l.variantName ? `${l.variantName} · ` : ''}{l.quantity} × {money(l.finalCents)}</p></div><p className="text-sm font-bold">{money(l.lineTotalCents)}</p></li>)}</ul>
            {quote.issues.map((i) => <p key={i.foodId + i.code} role="alert" className="flex gap-2 rounded-xl bg-coral-soft p-3 text-sm font-medium"><AlertTriangle className="h-4 w-4 shrink-0" />{i.message} <Link to="/cart" className="font-bold underline">Fix in cart</Link></p>)}
            {quote.couponError && <p role="alert" className="text-sm text-danger">{quote.couponError} <Link to="/cart" className="underline">Change coupon</Link></p>}
            <TotalsTable totals={quote.totals} couponCode={quote.couponCode} />
            {quote.totals.subtotalCents < quote.minOrderCents && <p role="alert" className="text-sm text-danger">Minimum order is {money(quote.minOrderCents)}.</p>}
            <p className="flex items-center gap-2 text-sm text-muted"><Timer className="h-4 w-4" />Estimated delivery: roughly {(settings?.deliveryMinutes ?? 25) + 20} minutes after you order (an estimate, not a guarantee)</p></>}
          {serverError && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{serverError}</p>}
          <button disabled={busy || blocked || !user} className="btn btn-accent w-full">{busy ? <><Spinner className="h-4 w-4" />Placing order…</> : <><Lock className="h-4 w-4" />{method === 'card' ? 'Place order and pay' : 'Place order'}{quote ? ` · ${money(quote.totals.totalCents)}` : ''}</>}</button>
        </aside>
      </form>
    </div>
  );
}
