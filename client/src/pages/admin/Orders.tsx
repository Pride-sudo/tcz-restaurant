import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { errMsg, get, patch, post } from '../../services/api';
import { useMe } from '../../hooks/queries';
import { useUI } from '../../store/ui';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Skeleton, Spinner } from '../../components/common/ui';
import { TotalsTable } from '../../components/cart/CartSummary';
import { dateTime, label, money } from '../../utils/format';

const NEXT: Record<string, string[]> = { placed: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered'] };

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast); const { data: me } = useMe(); const [cancel, setCancel] = useState(false); const [note, setNote] = useState(''); const [refund, setRefund] = useState(false);
  const { data: o, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-order', id], queryFn: async () => (await get<any>(`/admin/orders/${id}`)).data, refetchInterval: 15_000 });
  const done = () => { ['admin-order', 'admin-orders', 'admin-dash', 'admin-inv'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };
  const move = useMutation({ mutationFn: (v: { status: string; note?: string }) => patch(`/admin/orders/${id}/status`, v), onSuccess: () => { toast('Order updated'); setCancel(false); done(); }, onError: (e) => { toast(errMsg(e), 'error'); done(); } });
  const doRefund = useMutation({ mutationFn: () => post(`/admin/orders/${id}/refund`, {}), onSuccess: () => { toast('Refund requested. It completes when the provider confirms.'); setRefund(false); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  if (isLoading) return <Skeleton className="h-64" />; if (isError || !o) return <ErrorState onRetry={refetch} />;
  const next = NEXT[o.status] || [];
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge status={o.status} /><Badge status={o.paymentStatus}>Payment: {label(o.paymentStatus)}</Badge><span className="text-muted">{dateTime(o.createdAt)}</span></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="font-bold">{o.customer.name}</p><p className="text-muted">{o.customer.phone} · {o.customer.email}</p><p className="mt-2">{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ''}, {o.address.city}</p>{o.instructions && <p className="mt-2 rounded-xl bg-coral-soft p-2"><b>Delivery:</b> {o.instructions}</p>}{o.notes && <p className="mt-2 rounded-xl bg-line/60 p-2"><b>Notes:</b> {o.notes}</p>}</div>
        <div><p className="font-bold">Payment</p>{o.payments.map((p: any, i: number) => <p key={i} className="text-muted">{p.provider} · {p.status} · {money(p.amountCents, p.currency)}</p>)}{!o.payments.length && <p className="text-muted">{o.paymentMethod === 'cash' ? 'Cash on delivery' : 'No payment started'}</p>}<p className="mt-2 font-bold">Inventory</p><p className="text-muted">Stock state: <b className="text-ink">{o.stockState}</b></p></div></div>
      <ul className="divide-y divide-line rounded-2xl border border-line">{o.items.map((i: any) => <li key={i.id} className="flex justify-between gap-3 p-3"><span>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ''}</span><b>{money(i.lineTotalCents, o.currency)}</b></li>)}</ul>
      <TotalsTable totals={o} couponCode={o.couponCode} />
      {o.movements.length > 0 && <details><summary className="cursor-pointer font-bold">Inventory movements ({o.movements.length})</summary><ul className="mt-2 space-y-1 text-muted">{o.movements.map((m: any, i: number) => <li key={i}>{m.type}: {m.food} (stock {m.stockDelta}, reserved {m.reservedDelta})</li>)}</ul></details>}
      <details><summary className="cursor-pointer font-bold">Timeline</summary><ul className="mt-2 space-y-1 text-muted">{o.timeline.map((t: any, i: number) => <li key={i}>{dateTime(t.at)} · {t.note || t.label}</li>)}</ul></details>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {next.filter((s) => s !== 'cancelled').map((s) => <button key={s} className="btn btn-primary" disabled={move.isPending} onClick={() => move.mutate({ status: s })}>{move.isPending && <Spinner className="h-4 w-4" />}Mark {label(s).toLowerCase()}</button>)}
        {next.includes('cancelled') && <button className="btn btn-ghost" onClick={() => setCancel(true)}>Cancel order</button>}
        {me?.role === 'admin' && o.paymentStatus === 'paid' && o.paymentMethod === 'card' && <button className="btn btn-ghost" onClick={() => setRefund(true)}>Request refund</button>}
        {o.status === 'placed' && o.paymentMethod === 'card' && o.paymentStatus !== 'paid' && <p className="w-full text-xs text-muted">Waiting for verified payment before this order can be confirmed.</p>}
      </div>
      <ConfirmDialog open={cancel} danger title="Cancel this order?" text="Reserved stock is released and the customer sees the order as cancelled." confirmLabel="Cancel order" busy={move.isPending} onConfirm={() => move.mutate({ status: 'cancelled', note: note || undefined })} onClose={() => setCancel(false)} />
      <ConfirmDialog open={refund} title="Request a refund?" text="A full refund is requested from the payment provider. The order is marked refunded only after the provider confirms." confirmLabel="Request refund" busy={doRefund.isPending} onConfirm={() => doRefund.mutate()} onClose={() => setRefund(false)} />
    </div>
  );
}

export default function Orders() {
  const [sp, setSp] = useSearchParams(); const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [pay, setPay] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
  const open = sp.get('open');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-orders', q, status, pay, from, to, page], refetchInterval: 20_000, queryFn: async () => { const r = await get<any[]>('/admin/orders', { q, status, paymentStatus: pay, from: from ? new Date(from).toISOString() : '', to: to ? new Date(to + 'T23:59:59').toISOString() : '', page, limit: 15 }); return { items: r.data, meta: r.meta }; } });
  const reset = (fn: () => void) => { fn(); setPage(1); };
  return (
    <>
      <PageHead title="Orders" sub="Updates refresh automatically." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div><label className="sr-only" htmlFor="oq">Search orders</label><input id="oq" className="input" placeholder="Order no., name, phone" value={q} onChange={(e) => reset(() => setQ(e.target.value))} /></div>
        <div><label className="sr-only" htmlFor="os">Order status</label><select id="os" className="input" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}><option value="">All statuses</option>{['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <div><label className="sr-only" htmlFor="op">Payment status</label><select id="op" className="input" value={pay} onChange={(e) => reset(() => setPay(e.target.value))}><option value="">All payments</option>{['unpaid', 'pending', 'paid', 'failed', 'refund_pending', 'refunded'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <div><label className="sr-only" htmlFor="of">From date</label><input id="of" type="date" className="input" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} /></div>
        <div><label className="sr-only" htmlFor="ot">To date</label><input id="ot" type="date" className="input" value={to} onChange={(e) => reset(() => setTo(e.target.value))} /></div>
      </div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : data!.items.length === 0 ? <EmptyState title="No orders match" text="Try clearing a filter." /> : (
        <Table><thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Status</th><th className="th">Payment</th><th className="th">Total</th><th className="th">Placed</th><th className="th"><span className="sr-only">View</span></th></tr></thead>
          <tbody className="divide-y divide-line">{data!.items.map((o) => <tr key={o.id}><td className="td font-bold">{o.orderNumber}</td><td className="td">{o.customer.name}<span className="block text-xs text-muted">{o.customer.phone}</span></td><td className="td text-muted">{o.items.reduce((n: number, i: any) => n + i.quantity, 0)}</td><td className="td"><Badge status={o.status} /></td><td className="td"><Badge status={o.paymentStatus} /></td><td className="td font-semibold">{money(o.totalCents, o.currency)}</td><td className="td text-xs text-muted">{dateTime(o.createdAt)}</td><td className="td"><button className="btn btn-ghost btn-sm" onClick={() => setSp({ open: o.id })}><Eye className="h-3.5 w-3.5" />View</button></td></tr>)}</tbody></Table>)}
      <Pagination meta={data?.meta} onPage={setPage} />
      <Modal open={!!open} onClose={() => setSp({})} title="Order details" wide>{open && <Detail id={open} onClose={() => setSp({})} />}</Modal>
    </>
  );
}
