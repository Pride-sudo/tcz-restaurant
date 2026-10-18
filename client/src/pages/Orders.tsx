import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useMyOrders } from '../hooks/queries';
import { Badge, EmptyState, ErrorState, Pagination, Skeleton } from '../components/common/ui';
import { dateTime, money } from '../utils/format';

export default function Orders() {
  const [page, setPage] = useState(1); const { data, isLoading, isError, refetch } = useMyOrders(page);
  return (
    <div className="container-x max-w-4xl py-8"><h1 className="text-3xl font-extrabold">My orders</h1>
      <div className="mt-6 space-y-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />) : isError ? <ErrorState onRetry={refetch} /> : data!.items.length === 0 ? <EmptyState icon={<Package className="h-6 w-6" />} title="No orders yet" text="Your orders and their progress will appear here." action={<Link to="/menu" className="btn btn-primary">Start an order</Link>} /> :
          data!.items.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card block p-5 transition hover:shadow-lift"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold">{o.orderNumber}</p><div className="flex gap-2"><Badge status={o.status} /><Badge status={o.paymentStatus}>{`Payment: ${o.paymentStatus}`}</Badge></div></div>
              <p className="mt-2 line-clamp-1 text-sm text-muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p><div className="mt-2 flex justify-between text-sm"><span className="text-muted">{dateTime(o.createdAt)}</span><b>{money(o.totalCents, o.currency)}</b></div></Link>))}
      </div>
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
