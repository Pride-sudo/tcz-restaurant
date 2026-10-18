import { Link, useNavigate } from 'react-router-dom';
import { Clock, Heart, Plus, Flame } from 'lucide-react';
import type { Food } from '../../types';
import { useCart } from '../../store/cart';
import { useMe, useToggleFavorite } from '../../hooks/queries';
import { useUI } from '../../store/ui';
import { cx, money } from '../../utils/format';
import { FoodImage, Skeleton, StarRating } from '../common/ui';

export function FoodCard({ food }: { food: Food }) {
  const add = useCart((s) => s.add); const toast = useUI((s) => s.toast); const nav = useNavigate();
  const { data: user } = useMe(); const fav = useToggleFavorite();
  const isFav = !!user?.favorites.includes(food.id);
  const hasVariants = food.variants.length > 0;
  const onAdd = () => {
    if (hasVariants) return nav(`/menu/${food.slug}`);
    add({ foodId: food.id, variantName: null, name: food.name, image: food.image, unitCents: food.finalPriceCents });
    toast(`${food.name} added to cart`);
  };
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative">
        <Link to={`/menu/${food.slug}`} aria-label={`View ${food.name}`}>
          <FoodImage src={food.image} alt={food.name} className={cx('aspect-[4/3] w-full', !food.available && 'grayscale')} />
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {food.discountPercent > 0 && <span className="rounded-full bg-coral px-2.5 py-1 text-xs font-bold text-coral-fg">{food.discountPercent}% off</span>}
          {food.isChefPick && <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-bold text-forest-fg"><Flame className="h-3 w-3" />Chef pick</span>}
        </div>
        <button onClick={() => (user ? fav.mutate({ id: food.id, on: !isFav }) : nav('/login?next=/menu'))} aria-pressed={isFav} aria-label={isFav ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-surface/95 shadow-card">
          <Heart className={cx('h-5 w-5 transition', isFav ? 'fill-coral text-coral' : 'text-ink')} />
        </button>
        {!food.available && <div className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-xs font-bold text-bg">Currently unavailable</div>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2"><h3 className="text-base font-bold leading-snug"><Link to={`/menu/${food.slug}`}>{food.name}</Link></h3></div>
        <p className="line-clamp-2 text-sm text-muted">{food.description}</p>
        <div className="flex items-center justify-between text-xs text-muted"><StarRating value={food.ratingAvg} count={food.ratingCount} size={14} /><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{food.prepMinutes} min</span></div>
        {food.lowStock && <p className="text-xs font-semibold text-coral">Almost gone</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div><span className="text-lg font-extrabold">{hasVariants ? 'from ' : ''}{money(food.finalPriceCents)}</span>{food.discountPercent > 0 && <span className="ml-2 text-sm text-muted line-through">{money(food.priceCents)}</span>}</div>
          <button disabled={!food.available} onClick={onAdd} aria-label={hasVariants ? `Choose size for ${food.name}` : `Add ${food.name} to cart`} className="btn btn-primary btn-sm"><Plus className="h-4 w-4" />{hasVariants ? 'Options' : 'Add'}</button>
        </div>
      </div>
    </article>
  );
}
export const FoodCardSkeleton = () => <div className="card overflow-hidden"><Skeleton className="aspect-[4/3] w-full rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-10 w-full" /></div></div>;
export const FoodGrid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
