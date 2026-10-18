import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2, LogOut } from 'lucide-react';
import { useMe } from '../hooks/queries';
import { del, errMsg, patch, post } from '../services/api';
import { useUI } from '../store/ui';
import { ConfirmDialog, Field, Modal, Spinner, TextArea } from '../components/common/ui';
import { cx } from '../utils/format';
import type { Address } from '../types';

const phone = z.string().trim().regex(/^([+\d][\d\s()-]{6,20})?$/, 'Enter a valid phone number');
const pw = z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');

function Profile() {
  const { data: me } = useMe(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ name: z.string().trim().min(2, 'Enter your name'), phone })), values: { name: me?.name || '', phone: me?.phone || '' } });
  return (
    <form onSubmit={handleSubmit(async (v) => { try { const r = await patch('/users/me', v); qc.setQueryData(['me'], r.data.user); toast('Profile updated'); } catch (e) { toast(errMsg(e), 'error'); } })} noValidate className="card max-w-xl space-y-4 p-5 sm:p-6">
      <Field label="Full name" error={errors.name?.message} {...register('name')} /><Field label="Email" value={me?.email} disabled readOnly hint="Email cannot be changed here." onChange={() => {}} name="email" />
      <Field label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} /><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Save changes</button>
    </form>
  );
}

function AddressForm({ initial, onClose }: { initial?: Address; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ label: z.string().max(40).optional(), line1: z.string().trim().min(3, 'Enter the street address'), line2: z.string().optional(), city: z.string().trim().min(2, 'Enter the city or suburb'), notes: z.string().max(300).optional(), isDefault: z.boolean().optional() })), defaultValues: { label: initial?.label || 'Home', line1: initial?.line1 || '', line2: initial?.line2 || '', city: initial?.city || '', notes: initial?.notes || '', isDefault: initial?.isDefault || false } });
  return (
    <form onSubmit={handleSubmit(async (v) => { try { const r = initial ? await patch(`/users/me/addresses/${initial._id}`, v) : await post('/users/me/addresses', v); qc.setQueryData(['me'], (u: any) => u && { ...u, addresses: r.data.addresses }); toast('Address saved'); onClose(); } catch (e) { toast(errMsg(e), 'error'); } })} noValidate className="space-y-4">
      <Field label="Label" placeholder="Home, Work…" {...register('label')} /><Field label="Street address" error={errors.line1?.message} {...register('line1')} /><Field label="Apartment, gate or landmark (optional)" {...register('line2')} /><Field label="City or suburb" error={errors.city?.message} {...register('city')} />
      <TextArea label="Delivery notes (optional)" {...register('notes')} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" {...register('isDefault')} />Use as my default address</label>
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={isSubmitting}>Save address</button></div>
    </form>
  );
}
function Addresses() {
  const { data: me } = useMe(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const [edit, setEdit] = useState<Address | 'new' | null>(null); const [rm, setRm] = useState<Address | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => del(`/users/me/addresses/${id}`), onSuccess: (r) => { qc.setQueryData(['me'], (u: any) => u && { ...u, addresses: r.data.addresses }); setRm(null); toast('Address removed'); }, onError: (e) => toast(errMsg(e), 'error') });
  return (
    <div className="max-w-2xl space-y-3">
      {me?.addresses.length === 0 && <p className="card p-5 text-sm text-muted">No saved addresses yet. Add one to speed up checkout.</p>}
      {me?.addresses.map((a) => <div key={a._id} className="card flex items-start gap-3 p-4"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-coral" /><div className="flex-1 text-sm"><p className="font-bold">{a.label}{a.isDefault && <span className="ml-2 rounded-full bg-forest-soft px-2 py-0.5 text-xs text-forest">Default</span>}</p><p className="text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}</p></div><button aria-label="Edit address" className="grid h-9 w-9 place-items-center rounded-full hover:bg-line" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></button><button aria-label="Delete address" className="grid h-9 w-9 place-items-center rounded-full hover:bg-line" onClick={() => setRm(a)}><Trash2 className="h-4 w-4" /></button></div>)}
      <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add address</button>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add address' : 'Edit address'}>{edit && <AddressForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}</Modal>
      <ConfirmDialog open={!!rm} danger title="Delete this address?" text={rm ? `${rm.line1}, ${rm.city}` : ''} confirmLabel="Delete" busy={remove.isPending} onConfirm={() => rm?._id && remove.mutate(rm._id)} onClose={() => setRm(null)} />
    </div>
  );
}
function Security() {
  const toast = useUI((s) => s.toast); const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: pw })) });
  return (
    <form onSubmit={handleSubmit(async (v) => { try { const r = await post<{ message: string }>('/users/me/password', v); toast(r.data.message); reset(); } catch (e) { toast(errMsg(e), 'error'); } })} noValidate className="card max-w-xl space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">Change password</h2><Field label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} /><Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." error={errors.newPassword?.message} {...register('newPassword')} />
      <button className="btn btn-primary" disabled={isSubmitting}>Update password</button><p className="text-xs text-muted">Changing your password signs you out of other devices.</p></form>
  );
}
export default function Account() {
  const [tab, setTab] = useState<'profile' | 'addresses' | 'security'>('profile'); const nav = useNavigate(); const qc = useQueryClient();
  const tabs = [['profile', 'Profile'], ['addresses', 'Addresses'], ['security', 'Security']] as const;
  return (
    <div className="container-x py-8"><div className="flex items-center justify-between"><h1 className="text-3xl font-extrabold">Your account</h1><button className="btn btn-ghost btn-sm" onClick={async () => { await post('/auth/logout'); qc.setQueryData(['me'], null); nav('/'); }}><LogOut className="h-4 w-4" />Sign out</button></div>
      <div role="tablist" aria-label="Account sections" className="mt-6 flex gap-2 overflow-x-auto">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('shrink-0 rounded-full border px-5 py-2 text-sm font-semibold', tab === k ? 'border-forest bg-forest text-forest-fg' : 'border-line bg-surface')}>{l}</button>)}</div>
      <div className="mt-6" role="tabpanel">{tab === 'profile' ? <Profile /> : tab === 'addresses' ? <Addresses /> : <Security />}</div></div>
  );
}
