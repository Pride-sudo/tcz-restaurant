import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Heart, Minus, Plus, ShieldAlert, Trash2, Pencil } from 'lucide-react';
import { useFood, useMe, useReviews, useToggleFavorite } from '../hooks/queries';
import { del, errMsg, patch, post } from '../services/api';
import { useCart } from '../store/cart';
import { useUI } from '../store/ui';
import { BackButton, ConfirmDialog, EmptyState, ErrorState, FoodImage, Pagination, Skeleton, Spinner, StarRating, TextArea } from '../components/common/ui';
import { FoodCard } from '../components/food/FoodCard';
import { cx, dateTime, money } from '../utils/format';

function Reviews({ foodId }: { foodId: string }) {
  const [page, setPage] = useState(1); const { data, isLoading } = useReviews(foodId, page); const { data: me } = useMe(); const qc = useQueryClient(); const toast = useUI((s) => s.toast);
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [delId, setDelId] = useState<string | null>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ['reviews', foodId] }); qc.invalidateQueries({ queryKey: ['food'] }); qc.invalidateQueries({ queryKey: ['order'] }); };
  const submit = useMutation({ mutationFn: () => (editing ? patch(`/reviews/${editing}`, { rating, comment }) : post(`/foods/${foodId}/reviews`, { rating, comment })), onSuccess: () => { toast(editing ? 'Review updated' : 'Thanks for your review!'); setComment(''); setRating(5); setEditing(null); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  const remove = useMutation({ mutationFn: (id: string) => del(`/reviews/${id}`), onSuccess: () => { toast('Review deleted'); setDelId(null); done(); }, onError: (e) => toast(errMsg(e), 'error') });
  return (
    <section className="mt-12" aria-labelledby="rev-h"><h2 id="rev-h" className="text-2xl font-extrabold">Reviews</h2>
      {me ? (
        <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="card mt-4 space-y-3 p-5">
          <p className="font-bold">{editing ? 'Edit your review' : 'Share your experience'}</p><StarRating value={rating} size={26} onChange={setRating} />
          <TextArea label="Your review (optional)" name="comment" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} hint="Only guests who received this dish can post a review." />
          <div className="flex gap-2"><button className="btn btn-primary" disabled={submit.isPending}>{submit.isPending && <Spinner className="h-4 w-4" />}{editing ? 'Save changes' : 'Post review'}</button>{editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setComment(''); setRating(5); }}>Cancel</button>}</div>
        </form>
      ) : <p className="card mt-4 p-5 text-sm">Want to leave a review? <Link className="font-bold text-forest underline" to="/login">Sign in</Link> after your order arrives.</p>}
      <div className="mt-6 space-y-3">
        {isLoading ? <Skeleton className="h-24" /> : data?.items.length === 0 ? <EmptyState title="No reviews yet" text="Be the first to review this dish after your order is delivered." /> : data?.items.map((r) => (
          <article key={r.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{r.user.name}</p><p className="text-xs text-muted">{dateTime(r.createdAt)}</p></div><StarRating value={r.rating} /></div>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            {me?.id === r.user.id && <div className="mt-3 flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r.id); setRating(r.rating); setComment(r.comment); window.scrollTo({ top: document.getElementById('rev-h')!.offsetTop, behavior: 'smooth' }); }}><Pencil className="h-3.5 w-3.5" />Edit</button><button className="btn btn-ghost btn-sm" onClick={() => setDelId(r.id)}><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}
          </article>))}
      </div>
      <Pagination meta={data?.meta} onPage={setPage} />
      <ConfirmDialog open={!!delId} danger title="Delete your review?" text="This removes your rating from the dish's average." confirmLabel="Delete review" busy={remove.isPending} onConfirm={() => delId && remove.mutate(delId)} onClose={() => setDelId(null)} />
    </section>
  );
}

export default function FoodDetails() {
  const { slug } = useParams(); const nav = useNavigate(); const { data, isLoading, isError, refetch } = useFood(slug);
  const add = useCart((s) => s.add); const toast = useUI((s) => s.toast); const { data: me } = useMe(); const fav = useToggleFavorite();
  const [variant, setVariant] = useState<string | null>(null); const [qty, setQty] = useState(1);
  if (isLoading) return <div className="container-x grid gap-8 py-10 md:grid-cols-2"><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-12 w-1/2" /></div></div>;
  if (isError || !data) return <div className="container-x py-16"><ErrorState message="We could not find that dish." onRetry={refetch} /></div>;
  const f = data.food; const v = f.variants.find((x) => x.name === (variant ?? f.variants[0]?.name)); const chosen = f.variants.length ? v!.name : null;
  const unit = f.finalPriceCents + (v ? Math.round(v.priceDeltaCents * (1 - f.discountPercent / 100)) : 0);
  const isFav = !!me?.favorites.includes(f.id);
  const addToCart = () => { add({ foodId: f.id, variantName: chosen, name: f.name, image: f.image, unitCents: unit }, qty); toast(`${qty} × ${f.name} added to cart`); };
  return (
    <div className="container-x py-8"><BackButton to="/menu" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-4xl"><FoodImage src={f.image} alt={f.name} className={cx('aspect-square w-full', !f.available && 'grayscale')} loading="eager" />{f.discountPercent > 0 && <span className="absolute left-4 top-4 rounded-full bg-coral px-3 py-1.5 text-sm font-bold text-coral-fg">{f.discountPercent}% off</span>}</div>
        <div>
          {f.category && <Link to={`/menu?category=${f.category.slug}`} className="text-sm font-semibold text-forest underline">{f.category.name}</Link>}
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{f.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted"><StarRating value={f.ratingAvg} count={f.ratingCount} /><span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />About {f.prepMinutes} min to prepare</span></div>
          <p className="mt-5 text-base leading-relaxed">{f.description}</p>
          <p className="mt-5 text-3xl font-extrabold">{money(unit)}{f.discountPercent > 0 && <span className="ml-3 text-lg font-medium text-muted line-through">{money(f.priceCents + (v?.priceDeltaCents || 0))}</span>}</p>
          {f.variants.length > 0 && <fieldset className="mt-5"><legend className="label">Choose an option</legend><div className="flex flex-wrap gap-2">{f.variants.map((o) => <label key={o.name} className={cx('cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2', (variant ?? f.variants[0].name) === o.name ? 'border-forest bg-forest text-forest-fg' : 'border-line bg-surface')}><input type="radio" name="variant" className="sr-only" checked={(variant ?? f.variants[0].name) === o.name} onChange={() => setVariant(o.name)} />{o.name}{o.priceDeltaCents ? ` (${o.priceDeltaCents > 0 ? '+' : ''}${money(o.priceDeltaCents)})` : ''}</label>)}</div></fieldset>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-line bg-surface" role="group" aria-label="Quantity"><button className="grid h-11 w-11 place-items-center" aria-label="Decrease quantity" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus className="h-4 w-4" /></button><span className="w-8 text-center font-bold" aria-live="polite">{qty}</span><button className="grid h-11 w-11 place-items-center" aria-label="Increase quantity" onClick={() => setQty((n) => Math.min(f.maxPerOrder, n + 1))}><Plus className="h-4 w-4" /></button></div>
            <button disabled={!f.available} onClick={addToCart} className="btn btn-primary flex-1 sm:flex-none sm:px-8">{f.available ? `Add to cart · ${money(unit * qty)}` : 'Currently unavailable'}</button>
            <button onClick={() => (me ? fav.mutate({ id: f.id, on: !isFav }) : nav('/login?next=' + encodeURIComponent(`/menu/${f.slug}`)))} aria-pressed={isFav} aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'} className="btn btn-ghost h-11 w-11 px-0"><Heart className={cx('h-5 w-5', isFav && 'fill-coral text-coral')} /></button>
          </div>
          {f.lowStock && f.available && <p className="mt-3 text-sm font-semibold text-coral">Only a few left today.</p>}
          {(f.ingredients.length > 0 || f.allergens.length > 0) && (
            <div className="card mt-8 space-y-3 p-5 text-sm">
              {f.ingredients.length > 0 && <p><span className="font-bold">Ingredients: </span>{f.ingredients.join(', ')}</p>}
              {f.allergens.length > 0 && <p><span className="font-bold">Contains (as listed by the restaurant): </span>{f.allergens.join(', ')}</p>}
              <p className="flex gap-2 text-xs text-muted"><ShieldAlert className="h-4 w-4 shrink-0" />{data.allergenNotice}</p>
            </div>)}
        </div>
      </div>
      <Reviews foodId={f.id} />
      {data.related.length > 0 && <section className="mt-14"><h2 className="mb-5 text-2xl font-extrabold">You might also like</h2><div className="grid gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">{data.related.map((r) => <FoodCard key={r.id} food={r} />)}</div></section>}
    </div>
  );
}
