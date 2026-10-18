import { NavLink, Outlet, Link } from 'react-router-dom';
import { Boxes, ClipboardList, LayoutDashboard, Settings, Store, Users, UtensilsCrossed } from 'lucide-react';
import { useMe } from '../../hooks/queries';
import { Logo } from '../layout/Layout';
import { cx } from '../../utils/format';

export default function AdminLayout() {
  const { data: me } = useMe(); const admin = me?.role === 'admin';
  const links = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/orders', 'Orders', ClipboardList, true], ['/admin/inventory', 'Inventory', Boxes, true], ['/admin/foods', 'Products', UtensilsCrossed, admin], ['/admin/users', 'Customers', Users, admin], ['/admin/settings', 'Settings', Settings, admin]].filter((l) => l[3]) as [string, string, any, boolean][];
  const cls = ({ isActive }: { isActive: boolean }) => cx('flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition', isActive ? 'bg-forest text-forest-fg' : 'text-muted hover:bg-line hover:text-ink');
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:flex-col lg:items-start lg:gap-1 lg:px-5 lg:py-5"><Logo /><span className="hidden text-xs font-semibold text-muted lg:block">{admin ? 'Administrator' : 'Staff'} console</span><Link to="/" className="btn btn-ghost btn-sm lg:hidden"><Store className="h-4 w-4" />Shop</Link></div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">{links.map(([to, l, Icon]) => <NavLink key={to} to={to} end={to === '/admin'} className={cls}><Icon className="h-4 w-4" />{l}</NavLink>)}</nav>
        <div className="hidden px-5 pt-4 lg:block"><Link to="/" className="btn btn-ghost btn-sm w-full"><Store className="h-4 w-4" />View storefront</Link></div>
      </aside>
      <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}
export const PageHead = ({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) => <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div><div className="flex flex-wrap gap-2">{children}</div></div>;
export const Table = ({ children }: { children: React.ReactNode }) => <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm">{children}</table></div>;
