import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Beef, CakeSlice, CupSoda, Flame, MapPin, Pizza, Salad, Sandwich, Search, Soup, Timer, Truck, UtensilsCrossed, ClipboardList, ChefHat, Quote } from 'lucide-react';
import { brand } from '../config/brand';
import { useCategories, useFeatured, usePublicSettings, useRecentReviews } from '../hooks/queries';
import { post, errMsg } from '../services/api';
import { useUI } from '../store/ui';
import { FoodCard, FoodCardSkeleton, FoodGrid } from '../components/food/FoodCard';
import { FoodImage, StarRating } from '../components/common/ui';
import { money } from '../utils/format';
import type { Food } from '../types';

const icons: Record<string, any> = { sandwich: Sandwich, pizza: Pizza, flame: Flame, salad: Salad, soup: Soup, 'cake-slice': CakeSlice, 'cup-soda': CupSoda, beef: Beef };
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Section({ title, sub, to, children }: { title: string; sub?: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="container-x mt-16">
      <div className="mb-6 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>{sub && <p className="mt-1 text-muted">{sub}</p>}</div>{to && <Link to={to} className="btn btn-ghost btn-sm shrink-0">See all<ArrowRight className="h-4 w-4" /></Link>}</div>
      {children}
    </section>
  );
}
const Row = ({ items, loading }: { items?: Food[]; loading: boolean }) => <FoodGrid>{loading ? Array.from({ length: 4 }).map((_, i) => <FoodCardSkeleton key={i} />) : items?.slice(0, 4).map((f) => <FoodCard key={f.id} food={f} />)}</FoodGrid>;

export default function Home() {
  const nav = useNavigate(); const toast = useUI((s) => s.toast);
  const { data: feat, isLoading } = useFeatured(); const { data: cats } = useCategories(); const { data: s } = usePublicSettings(); const { data: reviews } = useRecentReviews();
  const [q, setQ] = useState(''); const [area, setArea] = useState(''); const [areaMsg, setAreaMsg] = useState(''); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const hero = feat?.featured[0] || feat?.bestsellers[0];
  const checkArea = (e: FormEvent) => { e.preventDefault(); if (!s) return; if (!s.deliveryAreas.length) return setAreaMsg('Good news: we deliver across the city. Delivery fee and time are shown at checkout.'); const hit = s.deliveryAreas.some((a) => a.toLowerCase() === area.trim().toLowerCase()); setAreaMsg(hit ? `Yes, we deliver to ${area.trim()}.` : `We do not deliver to "${area.trim()}" yet. We cover: ${s.deliveryAreas.join(', ')}.`); };
  const subscribe = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { const r = await post<{ message: string }>('/newsletter', { email }); toast(r.data.message); setEmail(''); } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); } };
  const today = s?.openingHours.find((h) => h.day === new Date().getDay());

  return (
    <>
      <section className="container-x pt-6 sm:pt-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest text-forest-fg">
          <div className="grid items-center gap-8 px-6 py-10 sm:px-12 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-4 lg:py-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-forest-fg/10 px-3.5 py-1.5 text-sm font-semibold"><ChefHat className="h-4 w-4" />{brand.tagline}</p>
              <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">{brand.heroTitle}</h1>
              <p className="mt-5 max-w-md text-base opacity-85 sm:text-lg">{brand.heroText}</p>
              <form onSubmit={(e) => { e.preventDefault(); nav(`/menu${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }} role="search" className="mt-7 flex max-w-lg gap-2 rounded-full bg-surface p-1.5 text-ink">
                <label htmlFor="hero-search" className="sr-only">Search the menu</label>
                <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input id="hero-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you craving?" className="h-11 w-full rounded-full bg-transparent pl-11 pr-3 text-sm focus:outline-none" /></div>
                <button className="btn btn-accent">Find food</button>
              </form>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/menu" className="btn btn-accent">Order now<ArrowRight className="h-4 w-4" /></Link><a href="#how" className="btn border border-forest-fg/30 text-forest-fg hover:bg-forest-fg/10">How it works</a></div>
            </div>
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-t-[999px] rounded-b-[2rem] border-4 border-coral/90 bg-forest-soft shadow-lift sm:w-[70%]">
                <FoodImage src={hero?.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=70'} alt={hero ? `${hero.name} from our kitchen` : 'A burger from our kitchen'} className="h-full w-full" loading="eager" />
              </div>
              {hero && <Link to={`/menu/${hero.slug}`} className="absolute bottom-4 left-0 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-5 text-ink shadow-lift sm:left-4"><FoodImage src={hero.image} alt="" className="h-12 w-12 rounded-xl" /><div><p className="text-sm font-bold leading-tight">{hero.name}</p><p className="text-xs text-muted">{money(hero.finalPriceCents)} · {hero.prepMinutes} min</p></div></Link>}
            </div>
          </div>
        </div>
      </section>

      <section className="container-x mt-12" aria-label="Categories">
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {cats?.map((c) => { const Icon = icons[c.icon] || UtensilsCrossed; return <Link key={c.id} to={`/menu?category=${c.slug}`} className="card flex shrink-0 items-center gap-3 px-4 py-3 transition hover:border-forest hover:bg-forest-soft"><span className="grid h-10 w-10 place-items-center rounded-full bg-coral-soft text-ink"><Icon className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{c.name}</span><span className="text-xs text-muted">{c.count} dishes</span></span></Link>; })}
        </div>
      </section>

      <Section title="Featured dishes" sub="The meals our regulars keep coming back for." to="/menu"><Row items={feat?.featured} loading={isLoading} /></Section>
      {feat && feat.offers.length > 0 && <Section title="Special offers" sub="Limited-time prices on guest favourites." to="/menu"><Row items={feat.offers} loading={false} /></Section>}
      <Section title="Bestsellers" sub="Most ordered, based on real orders." to="/menu?sort=popular"><Row items={feat?.bestsellers} loading={isLoading} /></Section>
      {feat && feat.chefPicks.length > 0 && <Section title="Chef recommendations" sub="Dishes our kitchen team is proudest of."><Row items={feat.chefPicks} loading={false} /></Section>}

      <section id="how" className="container-x mt-20 scroll-mt-24">
        <h2 className="text-2xl font-extrabold sm:text-3xl">How ordering works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[[UtensilsCrossed, 'Pick your meal', 'Browse the menu, filter by what you like and add dishes to your cart.'], [ClipboardList, 'Check out securely', 'Confirm your address and pay by card or cash on delivery. Prices are always verified by our server.'], [Truck, 'Follow your order', 'Watch it move from confirmed to preparing to out for delivery on your order page.']].map(([Icon, t, d]: any, i) => (
            <li key={i} className="card flex gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-forest text-forest-fg"><Icon className="h-5 w-5" /></span><div><h3 className="font-bold">Step {i + 1}: {t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></li>
          ))}
        </ol>
      </section>

      {reviews && reviews.length > 0 && (
        <section className="container-x mt-20"><h2 className="text-2xl font-extrabold sm:text-3xl">What guests say</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">{reviews.map((r) => <figure key={r.id} className="card flex flex-col gap-3 p-5"><Quote className="h-6 w-6 text-coral" /><blockquote className="text-sm">{r.comment}</blockquote><figcaption className="mt-auto flex items-center justify-between text-sm"><span><span className="font-bold">{r.user.name}</span>{r.food && <> on <Link className="text-forest underline" to={`/menu/${r.food.slug}`}>{r.food.name}</Link></>}</span><StarRating value={r.rating} /></figcaption></figure>)}</div></section>
      )}

      <section className="container-x mt-20 grid gap-4 lg:grid-cols-2">
        <div className="card p-6"><h2 className="flex items-center gap-2 text-xl font-extrabold"><MapPin className="h-5 w-5 text-coral" />Do we deliver to you?</h2>
          <form onSubmit={checkArea} className="mt-4 flex gap-2"><label htmlFor="area" className="sr-only">Your suburb or city</label><input id="area" required value={area} onChange={(e) => setArea(e.target.value)} placeholder="Enter your suburb or city" className="input" /><button className="btn btn-primary">Check</button></form>
          {areaMsg && <p role="status" className="mt-3 text-sm">{areaMsg}</p>}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Timer className="h-4 w-4" />Typical delivery: about {s?.deliveryMinutes ?? 25} minutes after preparation.{today && <> {today.closed ? `Closed ${days[today.day]}.` : `Today (${days[today.day]}): ${today.open} to ${today.close}.`}</>}</p></div>
        <div className="card bg-coral-soft p-6"><h2 className="text-xl font-extrabold">Get new dishes and offers first</h2><p className="mt-1 text-sm text-muted">One email when something good lands. Unsubscribe any time.</p>
          <form onSubmit={subscribe} className="mt-4 flex gap-2"><label htmlFor="nl" className="sr-only">Email address</label><input id="nl" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" /><button disabled={busy} className="btn btn-primary">Subscribe</button></form></div>
      </section>
    </>
  );
}
