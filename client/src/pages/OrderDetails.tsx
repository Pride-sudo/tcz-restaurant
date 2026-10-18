import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, CreditCard, FlaskConical, Info, MapPin, PartyPopper, XCircle } from 'lucide-react';
import { useOrder } from '../hooks/queries';
import { del, errMsg, get, patch, post } from '../services/api';
import { useUI } from '../store/ui';
import { Badge, ErrorState, FoodImage, Skeleton, Spinner, StarRating, TextArea, BackButton } from '../components/common/ui';
import { TotalsTable } from '../components/cart/CartSummary';
import { cx, dateTime, label, money, timeOnly } from '../utils/format';
import type { Order, OrderItem } from '../types';

function ReviewRow({ order, item }: { order: Order; item: OrderItem }) {
  const existing = order.reviews?.[item.foodId]; const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false); const [rating, setRating] = useState(existing?.rating || 5); const [comment, setComment] = useState(existing?.comment || '');
  const done = () => { qc.invalidateQueries({ queryKey: ['order', order.id] }); qc.invalidateQueries({ queryKey: ['reviews'] }); setOpen(false); };
  const save = useMutation({ mutationFn: () => (existing ? patch(`/reviews/${existing.id}`, { rating, comment }) : post(`/foods/${item.foodId}/reviews`, { rating, comment, orderId: order.id })), onSuccess: () => { toast('Review saved'); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  const remove = useMutation({ mutationFn: () => del(`/reviews/${existing!.id}`), onSuccess: () => { toast('Review deleted'); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  return (
    <li className="py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{item.name}</span>
      {existing && !open ? <span className="flex items-center gap-3"><StarRating value={existing.rating} /><button className="text-sm font-semibold text-forest underline" onClick={() => setOpen(true)}>Edit</button><button className="text-sm font-semibold text-danger underline" onClick={() => remove.mutate()}>Delete</button></span> : !open && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Rate this dish</button>}</div>
      {open && <div className="mt-3 space-y-3"><StarRating value={rating} size={26} onChange={setRating} /><TextArea label="Comment (optional)" name={`c-${item.id}`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} /><div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Spinner className="h-3.5 w-3.5" />}Save review</button><button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div></div>}</li>
  );
}

export default function OrderDetails() {
  const { id } = useParams(); const [sp] = useSearchParams(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { data: o, isLoading, isError, refetch } = useOrder(id, true);
  const tracking = useQuery({ queryKey: ['tracking', id], enabled: !!id, refetchInterval: (q) => { const d = q.state.data as any; return d && !d.cancelled && d.status !== 'delivered' ? 10_000 : false; }, queryFn: async () => (await get<any>(`/orders/${id}/tracking`)).data });
  // After returning from the provider, ask the server to verify with the provider until it confirms (or we give up).
  const verifying = sp.get('checkout') === 'success' && o && o.paymentStatus !== 'paid' && o.paymentMethod === 'card' && !!o.paymentId;
  useQuery({ queryKey: ['pay-verify', o?.paymentId], enabled: !!verifying, refetchInterval: 4000, queryFn: async () => { const r = await get<any>(`/payments/${o!.paymentId}/status`); if (r.data.orderPaymentStatus === 'paid' || r.data.status !== 'pending') { qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['tracking', id] }); } return r.data; } });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['tracking', id] }); };
  const payNow = useMutation({ mutationFn: async () => (await post<{ url: string }>('/payments/create-checkout-session', { orderId: id })).data, onSuccess: (d) => window.location.assign(d.url), onError: (e) => toast(errMsg(e), 'error') });
  const dev = useMutation({ mutationFn: async (outcome: 'success' | 'fail') => post('/payments/dev-confirm', { orderId: id, outcome }), onSuccess: refresh, onError: (e) => toast(errMsg(e), 'error') });
  useEffect(() => { if (sp.get('placed')) window.scrollTo(0, 0); }, []); // eslint-disable-line

  if (isLoading) return <div className="container-x space-y-4 py-10"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  if (isError || !o) return <div className="container-x py-16"><ErrorState message="We could not find that order." onRetry={refetch} /></div>;
  const t = tracking.data; const cancelled = o.status === 'cancelled';
  const awaitingPay = o.paymentMethod === 'card' && ['unpaid', 'pending', 'failed'].includes(o.paymentStatus) && !cancelled;
  return (
    <div className="container-x max-w-5xl py-8"><BackButton to="/orders" />
      <div className="card flex flex-col gap-4 bg-forest p-6 text-forest-fg sm:flex-row sm:items-center sm:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-semibold opacity-90">{cancelled ? <XCircle className="h-4 w-4" /> : <PartyPopper className="h-4 w-4" />}{sp.get('placed') ? 'Thank you! Your order is in.' : 'Order'}</p><h1 className="mt-1 text-3xl font-extrabold">{o.orderNumber}</h1><p className="mt-1 text-sm opacity-85">Placed {dateTime(o.createdAt)}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge status={o.status} /><Badge status={o.paymentStatus}>Payment: {label(o.paymentStatus)}</Badge></div>
      </div>
      {sp.get('checkout') === 'cancelled' && awaitingPay && <p role="status" className="mt-4 rounded-2xl bg-coral-soft p-4 text-sm font-medium">Payment was cancelled. Your order is held for a short time. You can pay now below.</p>}
      {verifying && <p role="status" className="mt-4 flex items-center gap-3 rounded-2xl bg-forest-soft p-4 text-sm font-medium text-forest"><Spinner className="h-4 w-4" />Confirming your payment with the provider…</p>}
      {awaitingPay && !verifying && (
        <div className="card mt-4 space-y-3 p-5"><p className="font-bold">{o.paymentMethod === 'dev' ? 'Awaiting development payment' : 'Payment needed to confirm this order'}</p>
          <button className="btn btn-accent" disabled={payNow.isPending} onClick={() => payNow.mutate()}><CreditCard className="h-4 w-4" />Pay {money(o.totalCents)} by card</button></div>)}
      {o.paymentMethod === 'dev' && ['unpaid', 'pending'].includes(o.paymentStatus) && !cancelled && (
        <div className="card mt-4 border-dashed border-coral p-5"><p className="flex items-center gap-2 font-bold"><FlaskConical className="h-4 w-4" />Development payment, no real money</p><p className="mt-1 text-sm text-muted">This simulator exists for local testing and is disabled in production.</p>
          <div className="mt-3 flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => dev.mutate('success')}>Simulate success</button><button className="btn btn-ghost btn-sm" onClick={() => dev.mutate('fail')}>Simulate failure</button></div></div>)}
      {o.paymentMethod === 'card' && o.paymentStatus === 'paid' && cancelled && <p className="mt-4 rounded-2xl bg-coral-soft p-4 text-sm font-medium">This order was cancelled after payment. The restaurant will arrange your refund through the payment provider.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="trk"><h2 id="trk" className="text-lg font-extrabold">Order progress</h2>
          {o.estimatedDeliveryAt && !cancelled && o.status !== 'delivered' && <p className="mt-1 text-sm text-muted">Estimated delivery around <b className="text-ink">{timeOnly(o.estimatedDeliveryAt)}</b> (an estimate, not a guarantee)</p>}
          {!t ? <Skeleton className="mt-4 h-48" /> : cancelled ? <div className="mt-4 rounded-2xl bg-danger/10 p-4 text-sm"><b className="text-danger">This order was cancelled.</b>{o.timeline.filter((x) => x.status === 'cancelled').slice(-1).map((x) => <p key={x.at} className="mt-1">{x.note}</p>)}</div> : (
            <ol className="mt-5 space-y-1">{t.steps.map((s: any, i: number) => { const current = s.done && !t.steps[i + 1]?.done; return (
              <li key={s.status} className="flex gap-3"><div className="flex flex-col items-center">{s.done ? <CheckCircle2 className={cx('h-6 w-6', current ? 'text-coral' : 'text-forest')} /> : <Circle className="h-6 w-6 text-line" />}{i < t.steps.length - 1 && <span className={cx('my-1 w-0.5 flex-1', s.done && t.steps[i + 1].done ? 'bg-forest' : 'bg-line')} />}</div>
                <div className="pb-5"><p className={cx('font-bold leading-6', !s.done && 'text-muted')} aria-current={current ? 'step' : undefined}>{s.label}</p>{s.at && <p className="text-xs text-muted">{dateTime(s.at)}</p>}</div></li>); })}</ol>)}
          <p className="mt-2 flex gap-2 rounded-xl bg-line/50 p-3 text-xs text-muted"><Info className="h-4 w-4 shrink-0" />Status updates come straight from the restaurant and refresh automatically. Live driver location is not available.</p>
        </section>
        <div className="space-y-6">
          <section className="card p-5 sm:p-6"><h2 className="text-lg font-extrabold">Items</h2>
            <ul className="mt-3 divide-y divide-line">{o.items.map((i) => <li key={i.id} className="flex gap-3 py-3"><FoodImage src={i.image} alt="" className="h-14 w-14 shrink-0 rounded-xl" /><div className="flex-1 text-sm"><p className="font-bold">{i.name}</p><p className="text-muted">{i.variantName ? `${i.variantName} · ` : ''}{i.quantity} × {money(i.unitPriceCents - i.discountPerUnitCents, o.currency)}</p></div><p className="text-sm font-bold">{money(i.lineTotalCents, o.currency)}</p></li>)}</ul>
            <div className="mt-3 border-t border-line pt-4"><TotalsTable totals={o} couponCode={o.couponCode} /></div></section>
          <section className="card space-y-2 p-5 text-sm sm:p-6"><h2 className="text-lg font-extrabold">Delivery</h2><p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" /><span>{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ''}, {o.address.city}</span></p><p className="text-muted">{o.customer.name} · {o.customer.phone}</p>{o.instructions && <p><b>Instructions:</b> {o.instructions}</p>}{o.notes && <p><b>Notes:</b> {o.notes}</p>}<p className="text-muted">Payment method: {o.paymentMethod === 'cash' ? 'Cash on delivery' : o.paymentMethod === 'card' ? 'Card' : 'Development payment'}</p></section>
        </div>
      </div>
      {o.canReview && <section className="card mt-6 p-5 sm:p-6"><h2 className="text-lg font-extrabold">How was it?</h2><p className="text-sm text-muted">Rate the dishes you received.</p><ul className="mt-2 divide-y divide-line">{o.items.map((i) => <ReviewRow key={i.id} order={o} item={i} />)}</ul></section>}
      <div className="mt-6 text-center"><Link to="/orders" className="btn btn-ghost">All my orders</Link></div>
    </div>
  );
}
