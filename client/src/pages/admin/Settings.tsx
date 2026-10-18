import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, errMsg, get, patch, post } from '../../services/api';
import { useUI } from '../../store/ui';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, ErrorState, Field, Modal, Skeleton, Spinner } from '../../components/common/ui';
import { dateTime, fromCents, money, toCents } from '../../utils/format';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SettingsForm({ s }: { s: any }) {
  const qc = useQueryClient(); const toast = useUI((st) => st.toast);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<any>({ defaultValues: { name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '', currency: s.currency, taxRatePercent: s.taxRatePercent, deliveryFee: fromCents(s.deliveryFeeCents), freeOver: fromCents(s.freeDeliveryOverCents), minOrder: fromCents(s.minOrderCents), deliveryAreas: (s.deliveryAreas || []).join(', '), lowStockDefault: s.lowStockDefault, prepMinutesDefault: s.prepMinutesDefault, deliveryMinutes: s.deliveryMinutes, allowNegativeStock: s.allowNegativeStock, hours: days.map((_, d) => s.openingHours.find((h: any) => h.day === d) || { day: d, open: '10:00', close: '22:00', closed: false }) } });
  const submit = async (v: any) => {
    try {
      await patch('/admin/settings', { name: v.name, email: v.email, phone: v.phone, address: v.address, currency: String(v.currency).toUpperCase(), taxRatePercent: +v.taxRatePercent, deliveryFeeCents: toCents(v.deliveryFee), freeDeliveryOverCents: toCents(v.freeOver), minOrderCents: toCents(v.minOrder), deliveryAreas: String(v.deliveryAreas).split(',').map((x) => x.trim()).filter(Boolean), lowStockDefault: +v.lowStockDefault, prepMinutesDefault: +v.prepMinutesDefault, deliveryMinutes: +v.deliveryMinutes, allowNegativeStock: !!v.allowNegativeStock, openingHours: v.hours.map((h: any) => ({ day: h.day, open: h.open, close: h.close, closed: !!h.closed })) });
      toast('Settings saved'); qc.invalidateQueries({ queryKey: ['settings-public'] }); qc.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <form onSubmit={handleSubmit(submit)} className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <Field label="Restaurant name" {...register('name')} /><Field label="Currency (ISO code)" maxLength={3} {...register('currency')} />
      <Field label="Contact email" type="email" {...register('email')} /><Field label="Contact phone" {...register('phone')} /><Field className="sm:col-span-2" label="Address" {...register('address')} />
      <Field label="Tax rate (%)" type="number" step="0.01" {...register('taxRatePercent')} /><Field label="Delivery fee" type="number" step="0.01" {...register('deliveryFee')} />
      <Field label="Free delivery over (0 = never)" type="number" step="0.01" {...register('freeOver')} /><Field label="Minimum order" type="number" step="0.01" {...register('minOrder')} />
      <Field className="sm:col-span-2" label="Delivery areas (comma separated, empty = anywhere)" {...register('deliveryAreas')} hint="Customers outside these cities or suburbs cannot check out." />
      <Field label="Default low-stock threshold" type="number" {...register('lowStockDefault')} /><Field label="Default preparation time (min)" type="number" {...register('prepMinutesDefault')} /><Field label="Delivery time (min)" type="number" {...register('deliveryMinutes')} />
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" {...register('allowNegativeStock')} />Allow adjustments below reserved stock</label>
      <fieldset className="sm:col-span-2"><legend className="label">Opening hours</legend><div className="space-y-2">{days.map((d, i) => <div key={d} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2 text-sm"><span className="font-semibold">{d.slice(0, 3)}</span><input aria-label={`${d} opens`} type="time" className="input" {...register(`hours.${i}.open`)} /><input aria-label={`${d} closes`} type="time" className="input" {...register(`hours.${i}.close`)} /><label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" {...register(`hours.${i}.closed`)} />Closed</label></div>)}</div></fieldset>
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Save settings</button></div>
    </form>
  );
}

function CouponForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<any>({ defaultValues: { type: 'percent', value: 10, minOrder: 0 } });
  return (
    <form className="space-y-4" onSubmit={handleSubmit(async (v) => { try { await post('/admin/coupons', { code: v.code, description: v.description || undefined, type: v.type, value: v.type === 'percent' ? +v.value : toCents(v.value), minOrderCents: toCents(v.minOrder || 0), expiresAt: v.expiresAt ? new Date(v.expiresAt + 'T23:59:59').toISOString() : null, usageLimit: v.usageLimit ? +v.usageLimit : null }); toast('Coupon created'); qc.invalidateQueries({ queryKey: ['admin-coupons'] }); onClose(); } catch (e) { toast(errMsg(e), 'error'); } })}>
      <Field label="Code" required {...register('code')} /><Field label="Description" {...register('description')} />
      <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="ctype">Type</label><select id="ctype" className="input" {...register('type')}><option value="percent">Percent off</option><option value="fixed">Amount off</option></select></div><Field label={watch('type') === 'percent' ? 'Percent' : 'Amount'} type="number" step="0.01" {...register('value')} /></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Minimum order" type="number" step="0.01" {...register('minOrder')} /><Field label="Usage limit" type="number" {...register('usageLimit')} /></div>
      <Field label="Expires on (optional)" type="date" {...register('expiresAt')} />
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={isSubmitting}>Create coupon</button></div>
    </form>
  );
}
function Coupons() {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast); const [add, setAdd] = useState(false);
  const { data } = useQuery({ queryKey: ['admin-coupons'], queryFn: async () => (await get<any[]>('/admin/coupons')).data });
  const toggle = useMutation({ mutationFn: (c: any) => patch(`/admin/coupons/${c._id}`, { active: !c.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }), onError: (e) => toast(errMsg(e), 'error') });
  return (
    <section className="mt-10"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold">Coupons</h2><button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New coupon</button></div>
      <Table><thead><tr><th className="th">Code</th><th className="th">Discount</th><th className="th">Min order</th><th className="th">Used</th><th className="th">Expires</th><th className="th">Active</th></tr></thead>
        <tbody className="divide-y divide-line">{data?.map((c) => <tr key={c._id}><td className="td font-bold">{c.code}<span className="block text-xs font-normal text-muted">{c.description}</span></td><td className="td">{c.type === 'percent' ? `${c.value}%` : money(c.value)}</td><td className="td">{money(c.minOrderCents)}</td><td className="td">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td><td className="td text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}</td><td className="td"><button className="btn btn-ghost btn-sm" onClick={() => toggle.mutate(c)} aria-pressed={c.active}>{c.active ? 'On' : 'Off'}</button></td></tr>)}{!data?.length && <tr><td colSpan={6} className="td text-muted">No coupons yet.</td></tr>}</tbody></Table>
      <Modal open={add} onClose={() => setAdd(false)} title="New coupon"><CouponForm onClose={() => setAdd(false)} /></Modal></section>
  );
}
function Audit() {
  const { data } = useQuery({ queryKey: ['admin-audit'], queryFn: async () => (await get<any[]>('/admin/audit-log')).data });
  return (
    <section className="mt-10"><h2 className="mb-3 text-xl font-extrabold">Admin activity log</h2><Table><thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Details</th></tr></thead>
      <tbody className="divide-y divide-line">{data?.map((a) => <tr key={a.id}><td className="td whitespace-nowrap text-xs text-muted">{dateTime(a.createdAt)}</td><td className="td">{a.actor || 'System'}</td><td className="td"><Badge>{a.action}</Badge></td><td className="td max-w-xs truncate text-xs text-muted">{JSON.stringify(a.meta)}</td></tr>)}{!data?.length && <tr><td colSpan={4} className="td text-muted">No activity yet.</td></tr>}</tbody></Table></section>
  );
}
export default function Settings() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await get<any>('/admin/settings')).data });
  return (<><PageHead title="Settings" sub="Changes apply immediately to prices, checkout and the storefront." />{isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-96" /> : <SettingsForm s={data} />}<Coupons /><Audit /></>);
}
