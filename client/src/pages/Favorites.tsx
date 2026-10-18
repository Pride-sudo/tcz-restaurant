import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavorites, useMe } from '../hooks/queries';
import { FoodCard, FoodCardSkeleton, FoodGrid } from '../components/food/FoodCard';
import { EmptyState, ErrorState } from '../components/common/ui';

export default function Favorites() {
  const { data: me } = useMe(); const { data, isLoading, isError, refetch } = useFavorites(!!me);
  return (
    <div className="container-x py-8"><h1 className="text-3xl font-extrabold">Favorites</h1>
      <div className="mt-6">{!me ? <EmptyState icon={<Heart className="h-6 w-6" />} title="Sign in to see your favorites" text="Save dishes with the heart icon and find them here." action={<Link to="/login?next=/favorites" className="btn btn-primary">Sign in</Link>} />
        : isError ? <ErrorState onRetry={refetch} /> : isLoading ? <FoodGrid>{Array.from({ length: 4 }).map((_, i) => <FoodCardSkeleton key={i} />)}</FoodGrid>
        : data!.length === 0 ? <EmptyState icon={<Heart className="h-6 w-6" />} title="No favorites yet" text="Tap the heart on any dish to save it." action={<Link to="/menu" className="btn btn-primary">Browse the menu</Link>} />
        : <FoodGrid>{data!.map((f) => <FoodCard key={f.id} food={f} />)}</FoodGrid>}</div></div>
  );
}
