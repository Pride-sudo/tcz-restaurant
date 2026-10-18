import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Boxes, CheckCircle2, Clock, ShoppingBag, Users, XCircle } from 'lucide-react';
import { get } from '../../services/api';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, ErrorState, Skeleton } from '../../components/common/ui';
import { dateTime, money } from '../../utils/format';

function BarChart({ data, valueKey, fmt }: { data: any[]; valueKey: string; fmt: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey])); const w = 100 / data.length;
  return (
    <figure><svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label={`Daily chart, peak ${fmt(max)}`}>
      {[10, 20, 30].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgb(var(--c-line))" strokeWidth=".2" />)}
      {data.map((d, i) => { const h = (d[valueKey] / max) * 38; return <rect key={d.date} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, d[valueKey] ? 0.6 : 0)} rx=".4" fill="rgb(var(--c-primary))"><title>{`${d.date}: ${fmt(d[valueKey])}`}</title></rect>; })}
    </svg><figcaption className="mt-1 flex justify-between text-xs text-muted"><span>{data[0]?.date}</span><span>{data[data.length - 1]?.date}</span></figcaption></figure>
  );
}
const Stat = ({ icon: Icon, label, value, tone = '' }: any) => <div className="card flex items-center gap-4 p-5"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone || 'bg-forest-soft text-forest'}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm text-muted">{label}</p><p className="text-2xl font-extrabold">{value}</p></div></div>;

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data: d, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-dash', days], queryFn: async () => (await get<any>('/admin/dashboard', { days })).data, refetchInterval: 30_000 });
  if (isError) return <ErrorState onRetry={refetch} />;
  return (
    <>
      <PageHead title="Overview" sub="Revenue counts verified-paid orders that were not cancelled."><label className="sr-only" htmlFor="range">Period</label><select id="range" className="input w-auto rounded-full" value={days} onChange={(e) => setDays(+e.target.value)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></PageHead>
      {isLoading || !d ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Banknote} label="Total sales" value={money(d.totalSalesCents)} /><Stat icon={Banknote} label={`Revenue, last ${d.days} days`} value={money(d.revenueInRangeCents)} />
          <Stat icon={ShoppingBag} label="Orders" value={d.orders.total} /><Stat icon={Clock} label="Open orders" value={d.orders.pending} tone="bg-coral-soft text-ink" />
          <Stat icon={CheckCircle2} label="Completed" value={d.orders.completed} /><Stat icon={XCircle} label="Cancelled" value={d.orders.cancelled} tone="bg-danger/10 text-danger" />
          <Stat icon={Users} label="Customers" value={d.customers} /><Stat icon={Boxes} label="Active products" value={d.activeFoods} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="card p-5"><h2 className="font-extrabold">Sales per day</h2><BarChart data={d.series} valueKey="revenueCents" fmt={money} /></section>
          <section className="card p-5"><h2 className="font-extrabold">Orders per day</h2><BarChart data={d.series} valueKey="orders" fmt={(n) => `${n} orders`} /></section>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold">Stock alerts</h2><Link to="/admin/inventory" className="text-sm font-semibold text-forest underline">Open inventory</Link></div>
            <p className="mt-2 flex gap-4 text-sm"><span><b className="text-coral">{d.lowStockCount}</b> low</span><span><b className="text-danger">{d.outOfStockCount}</b> out of stock</span></p>
            <ul className="mt-3 space-y-2 text-sm">{d.outOfStock.map((f: any) => <li key={f.id} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-danger" />{f.name}<Badge status="out">Out</Badge></li>)}{d.lowStock.map((f: any) => <li key={f.id} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-coral" />{f.name}<Badge status="low">{f.available} left</Badge></li>)}{!d.lowStock.length && !d.outOfStock.length && <li className="text-muted">Everything is well stocked.</li>}</ul></section>
          <section className="card p-5"><h2 className="font-extrabold">Bestsellers (last {d.days} days)</h2>{d.bestsellers.length === 0 ? <p className="mt-3 text-sm text-muted">No paid orders in this period yet.</p> : <ol className="mt-3 space-y-2 text-sm">{d.bestsellers.map((b: any, i: number) => <li key={b.id} className="flex justify-between gap-2"><span>{i + 1}. {b.name}</span><span className="text-muted">{b.quantity} sold · {money(b.revenueCents)}</span></li>)}</ol>}</section>
        </div>
        <h2 className="mb-3 mt-8 text-lg font-extrabold">Recent orders</h2>
        <Table><thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Status</th><th className="th">Payment</th><th className="th">Total</th><th className="th">Placed</th></tr></thead>
          <tbody className="divide-y divide-line">{d.recentOrders.map((o: any) => <tr key={o.id}><td className="td font-bold"><Link className="text-forest underline" to={`/admin/orders?open=${o.id}`}>{o.orderNumber}</Link></td><td className="td">{o.customer.name}</td><td className="td"><Badge status={o.status} /></td><td className="td"><Badge status={o.paymentStatus} /></td><td className="td font-semibold">{money(o.totalCents, o.currency)}</td><td className="td text-muted">{dateTime(o.createdAt)}</td></tr>)}{!d.recentOrders.length && <tr><td className="td text-muted" colSpan={6}>No orders yet.</td></tr>}</tbody></Table>
      </>}
    </>
  );
}
