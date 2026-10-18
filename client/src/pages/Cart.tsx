import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useCart } from '../store/cart';
import { useQuote } from '../hooks/queries';
import { ConfirmDialog, EmptyState, ErrorState, FoodImage, Skeleton } from '../components/common/ui';
import { TotalsTable } from '../components/cart/CartSummary';
import { money } from '../utils/format';

export default function Cart() {
  const { items, couponCode, setQty, remove, clear, setCoupon } = useCart();
  const { data: quote, isLoading, isError, refetch } = useQuote(items, couponCode);
  const [code, setCode] = useState(''); const [confirm, setConfirm] = useState(false);
  const issueFor = (id: string) => quote?.issues.find((i) => i.foodId === id);
  const blocked = !!quote && (quote.issues.length > 0 || quote.totals.subtotalCents < quote.minOrderCents);
  const apply = (e: FormEvent) => { e.preventDefault(); if (code.trim()) { setCoupon(code.trim().toUpperCase()); setCode(''); } };

  if (items.length === 0) return <div className="container-x py-16"><EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Your cart is empty" text="Add a few dishes and they will show up here." action={<Link to="/menu" className="btn btn-primary">Browse the menu</Link>} /></div>;
  return (
    <div className="container-x py-8">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-extrabold">Your cart</h1><button onClick={() => setConfirm(true)} className="btn btn-ghost btn-sm"><Trash2 className="h-4 w-4" />Clear cart</button></div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {items.map((i) => {
            const line = quote?.items.find((l) => l.foodId === i.foodId && (l.variantName || null) === (i.variantName || null)); const issue = issueFor(i.foodId);
            return (
              <li key={`${i.foodId}-${i.variantName}`} className="card p-4">
                <div className="flex gap-4"><FoodImage src={i.image} alt={i.name} className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
                  <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div><h2 className="font-bold leading-snug">{i.name}</h2>{i.variantName && <p className="text-sm text-muted">{i.variantName}</p>}</div><button onClick={() => remove(i.foodId, i.variantName)} aria-label={`Remove ${i.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-line"><X className="h-4 w-4" /></button></div>
                    <p className="mt-1 text-sm text-muted">{money(line?.finalCents ?? i.unitCents)} each{line && line.discountPerUnitCents > 0 && <span className="ml-1 line-through">{money(line.unitPriceCents)}</span>}</p>
                    <div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-full border border-line" role="group" aria-label={`Quantity of ${i.name}`}><button className="grid h-9 w-9 place-items-center" aria-label="Decrease" onClick={() => setQty(i.foodId, i.variantName, i.quantity - 1)}><Minus className="h-4 w-4" /></button><span className="w-7 text-center text-sm font-bold">{i.quantity}</span><button className="grid h-9 w-9 place-items-center" aria-label="Increase" onClick={() => setQty(i.foodId, i.variantName, i.quantity + 1)}><Plus className="h-4 w-4" /></button></div><p className="font-extrabold">{money((line?.finalCents ?? i.unitCents) * i.quantity)}</p></div></div></div>
                {issue && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm font-medium"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue.message}{issue.available ? <button className="ml-auto font-bold underline" onClick={() => setQty(i.foodId, i.variantName, issue.available!)}>Set to {issue.available}</button> : <button className="ml-auto font-bold underline" onClick={() => remove(i.foodId, i.variantName)}>Remove</button>}</p>}
              </li>);
          })}
        </ul>
        <aside className="card h-fit space-y-5 p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold">Order summary</h2>
          {couponCode && quote?.couponCode ? <div className="flex items-center justify-between rounded-xl bg-forest-soft px-3 py-2 text-sm font-semibold text-forest"><span className="inline-flex items-center gap-2"><Tag className="h-4 w-4" />{quote.couponCode} applied</span><button onClick={() => setCoupon(null)} className="underline">Remove</button></div>
            : <form onSubmit={apply} className="flex gap-2"><label htmlFor="coupon" className="sr-only">Coupon code</label><input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon code" className="input uppercase" /><button className="btn btn-ghost">Apply</button></form>}
          {quote?.couponError && <p role="alert" className="text-sm font-medium text-danger">{quote.couponError} <button className="underline" onClick={() => setCoupon(null)}>Dismiss</button></p>}
          {isError ? <ErrorState message="We could not price your cart." onRetry={refetch} /> : isLoading || !quote ? <Skeleton className="h-32" /> : <TotalsTable totals={quote.totals} couponCode={quote.couponCode} />}
          {quote && quote.totals.subtotalCents < quote.minOrderCents && <p className="text-sm text-danger" role="alert">Minimum order is {money(quote.minOrderCents)}. Add {money(quote.minOrderCents - quote.totals.subtotalCents)} more.</p>}
          <Link to="/checkout" aria-disabled={blocked} onClick={(e) => blocked && e.preventDefault()} className={`btn btn-accent w-full ${blocked ? 'pointer-events-none opacity-50' : ''}`}>Continue to checkout</Link>
          <p className="text-center text-xs text-muted">Final prices and stock are confirmed by our server at checkout.</p>
        </aside>
      </div>
      <ConfirmDialog open={confirm} danger title="Clear your cart?" text="All items will be removed from your cart." confirmLabel="Clear cart" onConfirm={() => { clear(); setConfirm(false); }} onClose={() => setConfirm(false)} />
    </div>
  );
}
