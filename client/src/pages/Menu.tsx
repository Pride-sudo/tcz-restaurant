import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, SearchX } from 'lucide-react';
import { useCategories, useFoods } from '../hooks/queries';
import { FoodCard, FoodCardSkeleton, FoodGrid } from '../components/food/FoodCard';
import { EmptyState, ErrorState, Pagination } from '../components/common/ui';
import { cx } from '../utils/format';

export default function Menu() {
  const [sp, setSp] = useSearchParams(); const { data: cats } = useCategories();
  const [q, setQ] = useState(sp.get('q') || ''); const [showFilters, setShowFilters] = useState(false);
  const params = { q: sp.get('q') || undefined, category: sp.get('category') || undefined, minPrice: sp.get('minPrice') || undefined, maxPrice: sp.get('maxPrice') || undefined, minRating: sp.get('minRating') || undefined, sort: sp.get('sort') || 'popular', page: Number(sp.get('page')) || 1, limit: 12, available: sp.get('available') || undefined };
  const { data, isLoading, isError, refetch, isFetching } = useFoods(params);
  const set = (k: string, v?: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }); };
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q.trim()) set('q', q.trim() || undefined); }, 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp.get('q')]); // eslint-disable-line
  const active = ['q', 'category', 'minPrice', 'maxPrice', 'minRating', 'available'].filter((k) => sp.get(k)).length;
  const chip = (on: boolean) => cx('rounded-full border px-4 py-2 text-sm font-semibold transition', on ? 'border-forest bg-forest text-forest-fg' : 'border-line bg-surface hover:border-forest/50');

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Our menu</h1>
      <p className="mt-1 text-muted">Everything is made to order. Prices and availability update live.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><label htmlFor="menu-q" className="sr-only">Search dishes</label><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input id="menu-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or description" className="input rounded-full pl-11" />{q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 p-1"><X className="h-4 w-4" /></button>}</div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" value={params.sort} onChange={(e) => set('sort', e.target.value)} className="input w-auto rounded-full"><option value="popular">Most popular</option><option value="rating">Top rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="newest">Newest</option></select>
          <button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="btn btn-ghost"><SlidersHorizontal className="h-4 w-4" />Filters{active > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-coral text-[11px] text-coral-fg">{active}</span>}</button>
        </div>
      </div>
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Categories">
        <button className={chip(!params.category)} onClick={() => set('category')} aria-pressed={!params.category}>All</button>
        {cats?.map((c) => <button key={c.id} className={cx(chip(params.category === c.slug), 'shrink-0')} aria-pressed={params.category === c.slug} onClick={() => set('category', c.slug)}>{c.name}</button>)}
      </div>
      {showFilters && (
        <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-4">
          <div><label className="label" htmlFor="minP">Min price</label><input id="minP" type="number" min={0} step="0.5" className="input" value={sp.get('minPrice') || ''} onChange={(e) => set('minPrice', e.target.value)} /></div>
          <div><label className="label" htmlFor="maxP">Max price</label><input id="maxP" type="number" min={0} step="0.5" className="input" value={sp.get('maxPrice') || ''} onChange={(e) => set('maxPrice', e.target.value)} /></div>
          <div><label className="label" htmlFor="minR">Minimum rating</label><select id="minR" className="input" value={sp.get('minRating') || ''} onChange={(e) => set('minRating', e.target.value)}><option value="">Any</option><option value="3">3 stars and up</option><option value="4">4 stars and up</option><option value="4.5">4.5 stars and up</option></select></div>
          <div className="flex items-end gap-3"><label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" checked={sp.get('available') === 'true'} onChange={(e) => set('available', e.target.checked ? 'true' : undefined)} />In stock only</label><button className="btn btn-ghost btn-sm ml-auto" onClick={() => { setQ(''); setSp({}, { replace: true }); }}>Reset</button></div>
        </div>
      )}
      <div className="mt-6" aria-busy={isFetching}>
        {isError ? <ErrorState message="We could not load the menu." onRetry={refetch} /> : isLoading ? <FoodGrid>{Array.from({ length: 8 }).map((_, i) => <FoodCardSkeleton key={i} />)}</FoodGrid>
          : data && data.items.length === 0 ? <EmptyState icon={<SearchX className="h-6 w-6" />} title="No dishes match your search" text="Try a different word, or clear a filter or two." action={<button className="btn btn-primary btn-sm" onClick={() => { setQ(''); setSp({}, { replace: true }); }}>Clear all filters</button>} />
          : <><p className="mb-4 text-sm text-muted" role="status">{data?.meta.total} dish{data?.meta.total === 1 ? '' : 'es'}</p><FoodGrid>{data?.items.map((f) => <FoodCard key={f.id} food={f} />)}</FoodGrid><Pagination meta={data?.meta} onPage={(p) => { set('page', String(p)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></>}
      </div>
    </div>
  );
}
