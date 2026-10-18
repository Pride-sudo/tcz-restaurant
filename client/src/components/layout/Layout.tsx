import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Heart, LayoutDashboard, LogOut, Menu, Moon, Package, Search, ShoppingBag, Sun, User as UserIcon, X, Mail, MapPin, Phone, Instagram, Facebook, Twitter } from 'lucide-react';
import { brand } from '../../config/brand';
import { useCart, cartCount } from '../../store/cart';
import { useUI } from '../../store/ui';
import { useCartSync, useMe, usePublicSettings } from '../../hooks/queries';
import { post } from '../../services/api';
import { setCurrency, cx } from '../../utils/format';
import { Spinner } from '../common/ui';

export const Logo = ({ light }: { light?: boolean }) => (
  <Link to="/" className="flex items-center gap-2.5" aria-label={`${brand.name} home`}>
    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-forest font-display text-lg font-extrabold text-forest-fg">{brand.shortName[0]}<span className="-ml-0.5 text-coral">{brand.shortName.slice(1)}</span></span>
    <span className={cx('font-display text-lg font-extrabold leading-none', light && 'text-forest-fg')}>{brand.name}</span>
  </Link>
);

function Navbar() {
  const nav = useNavigate(); const loc = useLocation(); const qc = useQueryClient();
  const { data: user } = useMe(); const items = useCart((s) => s.items); const bumped = useCart((s) => s.bumped);
  const { theme, toggleTheme, toast } = useUI();
  const [open, setOpen] = useState(false); const [acct, setAcct] = useState(false); const [q, setQ] = useState('');
  useEffect(() => { setOpen(false); setAcct(false); }, [loc.pathname]);
  const count = cartCount(items);
  const search = (e: FormEvent) => { e.preventDefault(); nav(`/menu${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); setOpen(false); };
  const logout = async () => { await post('/auth/logout').catch(() => {}); qc.setQueryData(['me'], null); qc.removeQueries({ predicate: (x) => ['favorites', 'my-orders', 'order'].includes(String(x.queryKey[0])) }); toast('Signed out'); nav('/'); };
  const link = ({ isActive }: { isActive: boolean }) => cx('rounded-full px-4 py-2 text-sm font-semibold transition', isActive ? 'bg-forest-soft text-forest' : 'text-muted hover:text-ink');
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-coral focus:px-4 focus:py-2 focus:font-semibold focus:text-coral-fg">Skip to content</a>
      <div className="container-x flex h-16 items-center gap-3">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main"><NavLink to="/" end className={link}>Home</NavLink><NavLink to="/menu" className={link}>Menu</NavLink>{user && <NavLink to="/orders" className={link}>My orders</NavLink>}</nav>
        <form onSubmit={search} role="search" className="mx-auto hidden max-w-sm flex-1 md:block">
          <label htmlFor="nav-search" className="sr-only">Search dishes</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input id="nav-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search burgers, pizza, drinks" className="input rounded-full pl-10" /></div>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className="grid h-10 w-10 place-items-center rounded-full hover:bg-line">{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          <Link to="/favorites" aria-label="Favorites" className="hidden h-10 w-10 place-items-center rounded-full hover:bg-line sm:grid"><Heart className="h-5 w-5" /></Link>
          <Link to="/cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-line">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <span key={bumped} className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] animate-bump place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-coral-fg">{count}</span>}
          </Link>
          {user ? (
            <div className="relative hidden lg:block">
              <button onClick={() => setAcct((v) => !v)} aria-expanded={acct} aria-haspopup="menu" className="ml-1 flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-xs text-forest-fg">{user.name[0]?.toUpperCase()}</span>{user.name.split(' ')[0]}</button>
              {acct && (
                <div role="menu" className="card absolute right-0 mt-2 w-52 animate-pop p-2">
                  <MenuLink to="/account" icon={<UserIcon className="h-4 w-4" />}>Account</MenuLink><MenuLink to="/orders" icon={<Package className="h-4 w-4" />}>My orders</MenuLink><MenuLink to="/favorites" icon={<Heart className="h-4 w-4" />}>Favorites</MenuLink>
                  {['admin', 'staff'].includes(user.role) && <MenuLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>Admin dashboard</MenuLink>}
                  <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-line"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          ) : <div className="ml-1 hidden items-center gap-2 lg:flex"><Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link><Link to="/register" className="btn btn-primary btn-sm">Create account</Link></div>}
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-line lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-bg px-4 pb-5 pt-3 lg:hidden">
          <form onSubmit={search} role="search" className="mb-3"><label htmlFor="m-search" className="sr-only">Search dishes</label><input id="m-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" className="input rounded-full" /></form>
          <nav aria-label="Mobile" className="flex flex-col">
            {[['/', 'Home'], ['/menu', 'Menu'], ['/favorites', 'Favorites'], ...(user ? [['/orders', 'My orders'], ['/account', 'Account']] : [])].map(([to, l]) => <Link key={to} to={to} className="rounded-xl px-3 py-3 font-semibold hover:bg-line">{l}</Link>)}
            {user && ['admin', 'staff'].includes(user.role) && <Link to="/admin" className="rounded-xl px-3 py-3 font-semibold hover:bg-line">Admin dashboard</Link>}
            {user ? <button onClick={logout} className="rounded-xl px-3 py-3 text-left font-semibold text-danger hover:bg-line">Sign out</button> : <div className="mt-2 flex gap-2"><Link to="/login" className="btn btn-ghost flex-1">Sign in</Link><Link to="/register" className="btn btn-primary flex-1">Join</Link></div>}
          </nav>
        </div>
      )}
    </header>
  );
}
const MenuLink = ({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) => <Link role="menuitem" to={to} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-line">{icon}{children}</Link>;

function Footer() {
  const { data: s } = usePublicSettings();
  return (
    <footer className="mt-20 bg-forest text-forest-fg">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2"><Logo light /><p className="mt-4 max-w-sm text-sm opacity-80">{brand.tagline} Made fresh to order, delivered with care.</p>
          <div className="mt-5 flex gap-3">{[Instagram, Facebook, Twitter].map((Icon, i) => <a key={i} href={brand.social[i].href} target="_blank" rel="noreferrer" aria-label={brand.social[i].label} className="grid h-10 w-10 place-items-center rounded-full bg-forest-fg/10 hover:bg-forest-fg/20"><Icon className="h-4 w-4" /></a>)}</div></div>
        <div><h3 className="mb-3 font-bold">Explore</h3><ul className="space-y-2 text-sm opacity-90"><li><Link to="/menu">Menu</Link></li><li><Link to="/orders">Track an order</Link></li><li><Link to="/favorites">Favorites</Link></li><li><Link to="/account">Account</Link></li></ul></div>
        <div><h3 className="mb-3 font-bold">Contact</h3><ul className="space-y-2.5 text-sm opacity-90">
          <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s?.address || brand.contact.address}</li>
          <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" />{s?.phone || brand.contact.phone}</li>
          <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" />{s?.email || brand.contact.email}</li></ul></div>
      </div>
      <div className="border-t border-forest-fg/15"><div className="container-x flex flex-col gap-2 py-5 text-xs opacity-80 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} {brand.name}. All rights reserved.</span><span>Allergen details are provided by the restaurant. Ask us if you have a serious allergy.</span></div></div>
    </footer>
  );
}

export default function Layout() {
  const { data: user } = useMe(); const { data: s } = usePublicSettings();
  useCartSync(user); useEffect(() => { if (s) setCurrency(s.currency); }, [s]);
  const loc = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return <div className="flex min-h-screen flex-col"><Navbar /><main id="main" className="flex-1"><Outlet /></main><Footer /></div>;
}

export function RequireAuth({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { data: user, isLoading } = useMe(); const loc = useLocation();
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-8 w-8 text-forest" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
