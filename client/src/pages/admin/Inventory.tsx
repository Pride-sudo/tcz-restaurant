import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, PackagePlus, SlidersHorizontal } from 'lucide-react';
import { api, errMsg, get, post } from '../../services/api';
import { useMe } from '../../hooks/queries';
import { useUI } from '../../store/ui';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, EmptyState, ErrorState, Field, Modal, Pagination, Skeleton, Spinner } from '../../components/common/ui';
import { cx, dateTime, money, toCents } from '../../utils/format';

function StockForm({ item, mode, onClose }: { item: any; mode: 'restock' | 'adjust'; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const schema = mode === 'restock' ? z.object({ quantity: z.coerce.number().int('Whole numbers only').min(1, 'Enter at least 1'), cost: z.coerce.number().min(0).optional(), reason: z.string().max(200).optional() }) : z.object({ delta: z.coerce.number().int('Whole numbers only').refine((n) => n !== 0, 'Enter a non-zero change'), reason: z.string().trim().min(3, 'A reason is required') });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<any>({ resolver: zodResolver(schema) as any, defaultValues: { quantity: item.reorderQuantity || 10, cost: item.costCents ? item.costCents / 100 : undefined } });
  return (
    <form onSubmit={handleSubmit(async (v: any) => { try { await post(`/admin/inventory/${mode === 'restock' ? 'restock' : 'adjust'}`, mode === 'restock' ? { foodId: item.id, quantity: v.quantity, costCents: v.cost != null && v.cost !== '' ? toCents(v.cost) : undefined, reason: v.reason || undefined } : { foodId: item.id, delta: v.delta, reason: v.reason }); toast(mode === 'restock' ? 'Stock added' : 'Stock adjusted'); ['admin-inv', 'admin-moves', 'admin-dash', 'foods'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose(); } catch (e) { toast(errMsg(e), 'error'); } })} noValidate className="space-y-4">
      <p className="text-sm text-muted">{item.name}: <b className="text-ink">{item.stock}</b> in stock, <b className="text-ink">{item.reserved}</b> reserved ({item.unit}s)</p>
      {mode === 'restock' ? <><Field label={`Quantity received (${item.unit}s)`} type="number" error={errors.quantity?.message as string} {...register('quantity')} /><Field label="Unit cost (optional)" type="number" step="0.01" hint="Updates the valuation cost." error={errors.cost?.message as string} {...register('cost')} /></>
        : <Field label="Change (use a minus to remove)" type="number" hint="Example: -3 for spoilage, 5 for a count correction." error={errors.delta?.message as string} {...register('delta')} />}
      <Field label={mode === 'adjust' ? 'Reason (required)' : 'Note (optional)'} placeholder={mode === 'adjust' ? 'Spoilage, stock count, damaged…' : 'Supplier, invoice…'} error={errors.reason?.message as string} {...register('reason')} />
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}{mode === 'restock' ? 'Add stock' : 'Apply adjustment'}</button></div>
    </form>
  );
}

function Movements() {
  const [page, setPage] = useState(1); const [type, setType] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin-moves', page, type], queryFn: async () => { const r = await get<any[]>('/admin/inventory/movements', { page, type }); return { items: r.data, meta: r.meta }; } });
  return (
    <section className="mt-10"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Stock movement history</h2><select aria-label="Filter movements" className="input w-auto rounded-full" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All movements</option>{['restock', 'adjustment', 'reserve', 'release', 'commit', 'cancel_return'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
      {isLoading ? <Skeleton className="h-48" /> : <Table><thead><tr><th className="th">When</th><th className="th">Product</th><th className="th">Type</th><th className="th">Stock</th><th className="th">Reserved</th><th className="th">After</th><th className="th">By</th><th className="th">Reason / order</th></tr></thead>
        <tbody className="divide-y divide-line">{data!.items.map((m) => <tr key={m.id}><td className="td whitespace-nowrap text-xs text-muted">{dateTime(m.createdAt)}</td><td className="td font-semibold">{m.food?.name}</td><td className="td capitalize">{m.type.replace('_', ' ')}</td><td className={cx('td font-bold', m.stockDelta > 0 ? 'text-forest' : m.stockDelta < 0 ? 'text-danger' : 'text-muted')}>{m.stockDelta > 0 ? '+' : ''}{m.stockDelta}</td><td className="td">{m.reservedDelta > 0 ? '+' : ''}{m.reservedDelta}</td><td className="td text-muted">{m.stockAfter} / {m.reservedAfter}</td><td className="td">{m.actor}</td><td className="td text-muted">{m.order?.orderNumber || m.reason || '-'}</td></tr>)}{!data!.items.length && <tr><td colSpan={8} className="td text-muted">No movements yet.</td></tr>}</tbody></Table>}
      <Pagination meta={data?.meta} onPage={setPage} /></section>
  );
}

export default function Inventory() {
  const { data: me } = useMe(); const toast = useUI((s) => s.toast);
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [dlg, setDlg] = useState<{ item: any; mode: 'restock' | 'adjust' } | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-inv', q, status, page], refetchInterval: 30_000, queryFn: async () => { const r = await get<any>('/admin/inventory', { q, status, page, limit: 20 }); return { ...r.data, meta: r.meta }; } });
  const exportCsv = async () => { try { const r = await api<string>('/admin/inventory/export', { query: { q, status }, raw: true }); const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'inventory.csv'; a.click(); URL.revokeObjectURL(url); } catch (e) { toast(errMsg(e), 'error'); } };
  const s = data?.summary;
  return (
    <>
      <PageHead title="Inventory" sub="Available = in stock minus reserved for open orders."><button className="btn btn-ghost" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</button></PageHead>
      <div className="mb-5 grid gap-4 sm:grid-cols-4">{[['Products', s?.products, ''], ['Low stock', s?.low, 'text-coral'], ['Out of stock', s?.out, 'text-danger'], ['Stock value (at cost)', s ? money(s.totalValueCents) : undefined, '']].map(([l, v, c]: any) => <div key={l} className="card p-4"><p className="text-sm text-muted">{l}</p><p className={cx('text-2xl font-extrabold', c)}>{v ?? '-'}</p></div>)}</div>
      {s && (s.low > 0 || s.out > 0) && <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-coral-soft p-3 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />{s.out} item(s) out of stock and {s.low} running low.</p>}
      <div className="mb-4 flex flex-wrap gap-3"><label className="sr-only" htmlFor="iq">Search inventory</label><input id="iq" className="input max-w-xs" placeholder="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><label className="sr-only" htmlFor="is">Status</label><select id="is" className="input w-auto rounded-full" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="ok">Healthy</option></select></div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : data!.items.length === 0 ? <EmptyState title="Nothing matches" text="Change the search or status filter." /> : (
        <Table><thead><tr><th className="th">Product</th><th className="th">In stock</th><th className="th">Reserved</th><th className="th">Available</th><th className="th">Low at</th><th className="th">Value</th><th className="th">Last restocked</th><th className="th">Status</th><th className="th"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">{data!.items.map((i: any) => <tr key={i.id}><td className="td font-semibold">{i.name}<span className="block text-xs font-normal text-muted">{i.category} · {i.unit}</span></td><td className="td">{i.stock}</td><td className="td">{i.reserved}</td><td className="td font-bold">{i.available}</td><td className="td">{i.lowStockThreshold}</td><td className="td">{money(i.valueCents)}</td><td className="td text-xs text-muted">{i.lastRestockedAt ? dateTime(i.lastRestockedAt) : 'Never'}</td><td className="td"><Badge status={i.status}>{i.status === 'ok' ? 'Healthy' : i.status === 'low' ? 'Low' : 'Out'}</Badge></td>
            <td className="td"><div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => setDlg({ item: i, mode: 'restock' })}><PackagePlus className="h-3.5 w-3.5" />Restock</button>{me?.role === 'admin' && <button className="btn btn-ghost btn-sm" onClick={() => setDlg({ item: i, mode: 'adjust' })}><SlidersHorizontal className="h-3.5 w-3.5" />Adjust</button>}</div></td></tr>)}</tbody></Table>)}
      <Pagination meta={data?.meta} onPage={setPage} />
      <Movements />
      <Modal open={!!dlg} onClose={() => setDlg(null)} title={dlg?.mode === 'restock' ? 'Restock product' : 'Adjust stock'}>{dlg && <StockForm item={dlg.item} mode={dlg.mode} onClose={() => setDlg(null)} />}</Modal>
    </>
  );
}
