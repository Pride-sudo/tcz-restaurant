import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ImagePlus, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api, del, errMsg, get, patch, post } from '../../services/api';
import { useCategories } from '../../hooks/queries';
import { useUI } from '../../store/ui';
import { PageHead, Table } from '../../components/admin/AdminLayout';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, FoodImage, Modal, Pagination, Select, Skeleton, Spinner, TextArea } from '../../components/common/ui';
import { fromCents, money, toCents } from '../../utils/format';

const num = (min: number, max: number) => z.coerce.number({ invalid_type_error: 'Enter a number' }).min(min, `Min ${min}`).max(max, `Max ${max}`);
const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name'), description: z.string().trim().min(5, 'Add a short description'), category: z.string().min(1, 'Choose a category'), image: z.string().trim().optional(),
  price: num(0, 100000), discountPercent: num(0, 90), prepMinutes: num(1, 240), unit: z.string().trim().min(1, 'Required'), initialStock: num(0, 1000000).optional(), lowStockThreshold: num(0, 100000), reorderQuantity: num(0, 100000), cost: num(0, 100000), maxPerOrder: num(1, 100),
  ingredients: z.string().optional(), allergens: z.string().optional(), variants: z.string().optional(), isAvailable: z.boolean(), isFeatured: z.boolean(), isChefPick: z.boolean(),
});
type V = z.infer<typeof schema>;
const list = (s?: string) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const parseVariants = (s?: string) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [name, d] = l.split(':'); return { name: name.trim(), priceDeltaCents: toCents(d || 0) }; });

function FoodForm({ food, onClose }: { food?: any; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useUI((s) => s.toast); const { data: cats } = useCategories(); const file = useRef<HTMLInputElement>(null); const [up, setUp] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) as any, defaultValues: food ? { name: food.name, description: food.description, category: food.category?.id, image: food.image, price: +fromCents(food.priceCents), discountPercent: food.discountPercent, prepMinutes: food.prepMinutes, unit: food.unit, lowStockThreshold: food.lowStockThreshold, reorderQuantity: food.reorderQuantity, cost: +fromCents(food.costCents), maxPerOrder: food.maxPerOrder, ingredients: food.ingredients.join(', '), allergens: food.allergens.join(', '), variants: food.variants.map((v: any) => `${v.name}:${fromCents(v.priceDeltaCents)}`).join('\n'), isAvailable: food.isAvailableFlag, isFeatured: food.isFeatured, isChefPick: food.isChefPick } : { price: 5, discountPercent: 0, prepMinutes: 15, unit: 'portion', initialStock: 20, lowStockThreshold: 10, reorderQuantity: 20, cost: 0, maxPerOrder: 10, isAvailable: true, isFeatured: false, isChefPick: false } });
  const uploadImg = async (f?: File) => { if (!f) return; setUp(true); try { const fd = new FormData(); fd.append('image', f); const r = await api<{ url: string }>('/admin/uploads', { method: 'POST', body: fd }); setValue('image', r.data.url); toast('Image uploaded'); } catch (e) { toast(errMsg(e), 'error'); } finally { setUp(false); } };
  const onSubmit = async (v: V) => {
    const body: any = { name: v.name, description: v.description, category: v.category, image: v.image || '', priceCents: toCents(v.price), discountPercent: v.discountPercent, prepMinutes: v.prepMinutes, unit: v.unit, lowStockThreshold: v.lowStockThreshold, reorderQuantity: v.reorderQuantity, costCents: toCents(v.cost), maxPerOrder: v.maxPerOrder, ingredients: list(v.ingredients), allergens: list(v.allergens), variants: parseVariants(v.variants), isAvailable: v.isAvailable, isFeatured: v.isFeatured, isChefPick: v.isChefPick };
    try { if (food) await patch(`/admin/foods/${food.id}`, body); else await post('/admin/foods', { ...body, initialStock: v.initialStock || 0 }); toast(food ? 'Product updated' : 'Product created'); qc.invalidateQueries({ queryKey: ['admin-foods'] }); qc.invalidateQueries({ queryKey: ['admin-inv'] }); qc.invalidateQueries({ queryKey: ['foods'] }); onClose(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const e = (k: keyof V) => (errors[k]?.message as string | undefined);
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" label="Name" error={e('name')} {...register('name')} />
      <TextArea className="sm:col-span-2" label="Description" error={e('description')} {...register('description')} />
      <Select label="Category" error={e('category')} {...register('category')}><option value="">Choose…</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Field label="Unit of stock" hint="portion, pack, bottle…" error={e('unit')} {...register('unit')} />
      <Field label="Price" type="number" step="0.01" error={e('price')} {...register('price')} /><Field label="Discount %" type="number" error={e('discountPercent')} {...register('discountPercent')} />
      <Field label="Preparation time (min)" type="number" error={e('prepMinutes')} {...register('prepMinutes')} /><Field label="Max per order" type="number" error={e('maxPerOrder')} {...register('maxPerOrder')} />
      {!food && <Field label="Initial stock" type="number" error={e('initialStock')} {...register('initialStock')} />}
      <Field label="Low-stock threshold" type="number" error={e('lowStockThreshold')} {...register('lowStockThreshold')} /><Field label="Reorder quantity" type="number" error={e('reorderQuantity')} {...register('reorderQuantity')} /><Field label="Unit cost (for valuation)" type="number" step="0.01" error={e('cost')} {...register('cost')} />
      <div className="sm:col-span-2"><label className="label" htmlFor="img">Image URL</label><div className="flex gap-2"><input id="img" className="input" placeholder="https://… or upload" {...register('image')} /><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload image" onChange={(ev) => uploadImg(ev.target.files?.[0])} /><button type="button" className="btn btn-ghost shrink-0" onClick={() => file.current?.click()} disabled={up}>{up ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}Upload</button></div>{watch('image') && <FoodImage src={watch('image')} alt="Preview" className="mt-2 h-20 w-28 rounded-xl" />}</div>
      <TextArea label="Ingredients (comma separated)" {...register('ingredients')} /><TextArea label="Allergens (comma separated)" hint="Shown to customers as restaurant-provided information." {...register('allergens')} />
      <TextArea className="sm:col-span-2" label="Sizes / variants (one per line, Name:price difference)" hint="Example: Large:4.00" {...register('variants')} />
      <div className="flex flex-wrap gap-5 sm:col-span-2">{([['isAvailable', 'Available to order'], ['isFeatured', 'Featured'], ['isChefPick', "Chef's pick"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" {...register(k)} />{l}</label>)}</div>
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}{food ? 'Save changes' : 'Create product'}</button></div>
    </form>
  );
}

function Categories() {
  const { data: cats } = useCategories(); const qc = useQueryClient(); const toast = useUI((s) => s.toast); const [name, setName] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['categories'] }); };
  return (
    <section className="card mt-8 p-5"><h2 className="font-extrabold">Categories</h2>
      <ul className="mt-3 flex flex-wrap gap-2">{cats?.map((c) => <li key={c.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">{c.name} <span className="text-muted">({c.count})</span><button aria-label={`Delete ${c.name}`} onClick={async () => { try { await del(`/admin/categories/${c.id}`); toast('Category deleted'); refresh(); } catch (e) { toast(errMsg(e), 'error'); } }}><Trash2 className="h-3.5 w-3.5 text-danger" /></button></li>)}</ul>
      <form className="mt-4 flex max-w-sm gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim().length < 2) return; try { await post('/admin/categories', { name }); setName(''); toast('Category added'); refresh(); } catch (er) { toast(errMsg(er), 'error'); } }}><label className="sr-only" htmlFor="newcat">New category</label><input id="newcat" className="input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-ghost">Add</button></form></section>
  );
}

export default function Foods() {
  const [q, setQ] = useState(''); const [archived, setArchived] = useState(false); const [page, setPage] = useState(1); const [edit, setEdit] = useState<any>(null); const [arch, setArch] = useState<any>(null);
  const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-foods', q, archived, page], queryFn: async () => { const r = await get<any[]>('/admin/foods', { q, archived, page, limit: 15 }); return { items: r.data, meta: r.meta }; } });
  const toggle = useMutation({ mutationFn: (f: any) => api(`/admin/foods/${f.id}${f.archived ? '?restore=true' : ''}`, { method: 'DELETE' }), onSuccess: () => { toast('Product updated'); setArch(null); qc.invalidateQueries({ queryKey: ['admin-foods'] }); qc.invalidateQueries({ queryKey: ['foods'] }); qc.invalidateQueries({ queryKey: ['admin-inv'] }); }, onError: (e) => toast(errMsg(e), 'error') });
  return (
    <>
      <PageHead title="Products" sub="Archiving hides a dish from the menu but keeps past orders intact."><button className="btn btn-primary" onClick={() => setEdit({})}><Plus className="h-4 w-4" />Add product</button></PageHead>
      <div className="mb-4 flex flex-wrap gap-3"><label className="sr-only" htmlFor="pq">Search products</label><input id="pq" className="input max-w-xs" placeholder="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" checked={archived} onChange={(e) => { setArchived(e.target.checked); setPage(1); }} />Show archived</label></div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : data!.items.length === 0 ? <EmptyState title="No products found" text="Add your first dish or change the filters." /> : (
        <Table><thead><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Status</th><th className="th">Updated</th><th className="th"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">{data!.items.map((f) => <tr key={f.id}><td className="td"><div className="flex items-center gap-3"><FoodImage src={f.image} alt="" className="h-11 w-11 rounded-xl" /><span className="font-semibold">{f.name}</span></div></td><td className="td">{f.category?.name}</td>
            <td className="td">{money(f.priceCents)}{f.discountPercent > 0 && <span className="ml-1 text-xs text-coral">-{f.discountPercent}%</span>}</td><td className="td">{f.stock - f.reserved} <span className="text-xs text-muted">({f.reserved} reserved)</span></td>
            <td className="td">{f.archived ? <Badge status="suspended">Archived</Badge> : <Badge status={f.stockStatus} />}</td><td className="td text-xs text-muted">{new Date(f.updatedAt).toLocaleDateString()}</td>
            <td className="td"><div className="flex gap-1"><button aria-label={`Edit ${f.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-line" onClick={() => setEdit(f)}><Pencil className="h-4 w-4" /></button><button aria-label={`${f.archived ? 'Restore' : 'Archive'} ${f.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-line" onClick={() => setArch(f)}>{f.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button></div></td></tr>)}</tbody></Table>)}
      <Pagination meta={data?.meta} onPage={setPage} />
      <Categories />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add product'} wide>{edit && <FoodForm food={edit.id ? edit : undefined} onClose={() => setEdit(null)} />}</Modal>
      <ConfirmDialog open={!!arch} danger={!arch?.archived} title={arch?.archived ? 'Restore this product?' : 'Archive this product?'} text={arch?.archived ? 'It will appear on the menu again.' : `${arch?.name} will be hidden from the menu. Existing orders and stock history are kept.`} confirmLabel={arch?.archived ? 'Restore' : 'Archive'} busy={toggle.isPending} onConfirm={() => toggle.mutate(arch)} onClose={() => setArch(null)} />
    </>
  );
}
