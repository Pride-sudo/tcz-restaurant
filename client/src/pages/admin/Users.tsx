import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg, get, patch } from '../../services/api';
import { useMe } from '../../hooks/queries';
import { useUI } from '../../store/ui';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Skeleton } from '../../components/common/ui';
import { dateTime, money } from '../../utils/format';

export default function Users() {
  const { data: me } = useMe(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [view, setView] = useState<any>(null); const [confirm, setConfirm] = useState<any>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-users', q, role, status, page], queryFn: async () => { const r = await get<any[]>('/admin/users', { q, role, status, page, limit: 20 }); return { items: r.data, meta: r.meta }; } });
  const orders = useQuery({ queryKey: ['admin-user-orders', view?.id], enabled: !!view, queryFn: async () => (await get<any[]>(`/admin/users/${view.id}/orders`)).data });
  const done = () => qc.invalidateQueries({ queryKey: ['admin-users'] });
  const setStatusM = useMutation({ mutationFn: (u: any) => patch(`/admin/users/${u.id}/status`, { status: u.status === 'active' ? 'suspended' : 'active' }), onSuccess: () => { toast('Account updated'); setConfirm(null); done(); }, onError: (e) => { toast(errMsg(e), 'error'); setConfirm(null); } });
  const setRoleM = useMutation({ mutationFn: (v: { id: string; role: string }) => patch(`/admin/users/${v.id}/role`, { role: v.role }), onSuccess: () => { toast('Role updated'); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  const reset = (fn: () => void) => { fn(); setPage(1); };
  return (
    <>
      <PageHead title="Customers and staff" sub="Only administrators can change roles. The last active administrator cannot be removed." />
      <div className="mb-4 flex flex-wrap gap-3"><label className="sr-only" htmlFor="uq">Search users</label><input id="uq" className="input max-w-xs" placeholder="Name, email or phone" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
        <select aria-label="Role" className="input w-auto rounded-full" value={role} onChange={(e) => reset(() => setRole(e.target.value))}><option value="">All roles</option><option value="customer">Customers</option><option value="staff">Staff</option><option value="admin">Admins</option></select>
        <select aria-label="Account status" className="input w-auto rounded-full" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : data!.items.length === 0 ? <EmptyState title="No users found" /> : (
        <Table><thead><tr><th className="th">Name</th><th className="th">Contact</th><th className="th">Role</th><th className="th">Orders</th><th className="th">Spent</th><th className="th">Joined</th><th className="th">Status</th><th className="th"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">{data!.items.map((u) => <tr key={u.id}><td className="td font-semibold">{u.name}</td><td className="td">{u.email}<span className="block text-xs text-muted">{u.phone}</span></td>
            <td className="td"><label className="sr-only" htmlFor={`r-${u.id}`}>Role for {u.name}</label><select id={`r-${u.id}`} className="input min-h-[36px] w-auto py-1 text-xs" value={u.role} disabled={u.id === me?.id || setRoleM.isPending} onChange={(e) => setRoleM.mutate({ id: u.id, role: e.target.value })}><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></select></td>
            <td className="td">{u.orders}</td><td className="td">{money(u.spentCents)}</td><td className="td text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td><td className="td"><Badge status={u.status} /></td>
            <td className="td"><div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setView(u)}>Orders</button>{u.id !== me?.id && <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(u)}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}</div></td></tr>)}</tbody></Table>)}
      <Pagination meta={data?.meta} onPage={setPage} />
      <Modal open={!!view} onClose={() => setView(null)} title={`${view?.name}'s orders`}>{orders.isLoading ? <Skeleton className="h-24" /> : orders.data?.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : <ul className="divide-y divide-line text-sm">{orders.data?.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><b>{o.orderNumber}</b><span className="block text-xs text-muted">{dateTime(o.createdAt)}</span></span><Badge status={o.status} /><b>{money(o.totalCents, o.currency)}</b></li>)}</ul>}</Modal>
      <ConfirmDialog open={!!confirm} danger={confirm?.status === 'active'} title={confirm?.status === 'active' ? 'Suspend this account?' : 'Reactivate this account?'} text={confirm?.status === 'active' ? `${confirm?.name} will be signed out and unable to sign in.` : `${confirm?.name} will be able to sign in again.`} confirmLabel={confirm?.status === 'active' ? 'Suspend' : 'Reactivate'} busy={setStatusM.isPending} onConfirm={() => setStatusM.mutate(confirm)} onClose={() => setConfirm(null)} />
    </>
  );
}
