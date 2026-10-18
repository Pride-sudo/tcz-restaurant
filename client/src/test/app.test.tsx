import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const routes: Record<string, (q?: any) => any> = {};
const calls: { path: string; query?: any }[] = [];
vi.mock('../services/api', async (orig) => {
  const actual: any = await orig();
  const respond = async (path: string, query?: any) => { calls.push({ path, query }); const h = routes[path]; if (!h) throw new actual.ApiError(404, 'not mocked ' + path); const r = h(query); if (r instanceof Error) throw r; return r; };
  return { ...actual, get: (p: string, q?: any) => respond(p, q), post: (p: string, b?: any) => respond(p, b), patch: (p: string, b?: any) => respond(p, b), put: (p: string, b?: any) => respond(p, b), del: (p: string) => respond(p), api: (p: string, o?: any) => respond(p, o) };
});
import { ApiError } from '../services/api';
import Layout from '../components/layout/Layout';
import Menu from '../pages/Menu';
import OrderDetails from '../pages/OrderDetails';
import Inventory from '../pages/admin/Inventory';
import { useCart } from '../store/cart';

const food = (o: any = {}) => ({ id: 'f1', slug: 'burger', name: 'Chicken Burger', description: 'Crispy', category: { id: 'c', name: 'Burgers', slug: 'burgers' }, image: '', priceCents: 850, finalPriceCents: 850, discountPercent: 0, prepMinutes: 15, isFeatured: false, isChefPick: false, ingredients: [], allergens: [], variants: [], ratingAvg: 4.5, ratingCount: 2, soldCount: 1, unit: 'portion', maxPerOrder: 10, available: true, lowStock: false, createdAt: '', ...o });
const wrap = (ui: ReactNode, path = '/') => { const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></QueryClientProvider>); };
const layout = (el: ReactNode, path: string, route = '/') => wrap(<Routes><Route element={<Layout />}><Route path={route} element={el} /></Route></Routes>, path);

beforeEach(() => {
  calls.length = 0; Object.keys(routes).forEach((k) => delete routes[k]); useCart.setState({ items: [], couponCode: null, bumped: 0 });
  routes['/auth/me'] = () => new ApiError(401, 'no');
  routes['/settings/public'] = () => ({ data: { currency: 'USD', openingHours: [], deliveryAreas: [], address: '', phone: '', email: '', deliveryMinutes: 25 } });
  routes['/categories'] = () => ({ data: [{ id: 'c', name: 'Burgers', slug: 'burgers', icon: 'sandwich', count: 1 }] });
});

describe('navigation and auth state', () => {
  it('shows sign-in links for guests and routes to the menu', async () => {
    routes['/foods'] = () => ({ data: [food()], meta: { page: 1, pages: 1, total: 1, limit: 12 } });
    layout(<Menu />, '/menu', 'menu');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(await screen.findByText('Chicken Burger')).toBeInTheDocument();
  });
  it('shows the account menu for a signed-in user', async () => {
    routes['/auth/me'] = () => ({ data: { user: { id: 'u1', name: 'Tendai Moyo', email: 't@t.co', role: 'customer', favorites: [], addresses: [] } } });
    routes['/foods'] = () => ({ data: [], meta: { page: 1, pages: 1, total: 0, limit: 12 } });
    routes['/cart'] = () => ({ data: { items: [], couponCode: null } });
    layout(<Menu />, '/menu', 'menu');
    expect(await screen.findByRole('button', { name: /Tendai/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('menu search and filters', () => {
  it('sends search, category and sort to the API and shows the empty state', async () => {
    routes['/foods'] = (q) => (q?.q === 'zzz' ? { data: [], meta: { page: 1, pages: 1, total: 0, limit: 12 } } : { data: [food()], meta: { page: 1, pages: 1, total: 1, limit: 12 } });
    layout(<Menu />, '/menu', 'menu'); await screen.findByText('Chicken Burger');
    await userEvent.type(screen.getByLabelText('Search dishes', { selector: '#menu-q' }), 'zzz');
    expect(await screen.findByText('No dishes match your search')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/foods' && c.query?.q === 'zzz')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Burgers' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/foods' && c.query?.category === 'burgers')).toBe(true));
  });
  it('adds to cart and marks unavailable dishes', async () => {
    routes['/foods'] = () => ({ data: [food(), food({ id: 'f2', slug: 'x', name: 'Sold Out Dish', available: false })], meta: { page: 1, pages: 1, total: 2, limit: 12 } });
    layout(<Menu />, '/menu', 'menu'); await screen.findByText('Sold Out Dish');
    await userEvent.click(screen.getByRole('button', { name: 'Add Chicken Burger to cart' }));
    expect(useCart.getState().items[0]).toMatchObject({ foodId: 'f1', quantity: 1 });
    expect(screen.getByText('Currently unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Sold Out Dish to cart' })).toBeDisabled();
  });
});

describe('order tracking display', () => {
  const order = (status: string) => ({ id: 'o1', orderNumber: 'TCZ-260101-ABCD', status, statusLabel: status, paymentStatus: 'paid', paymentMethod: 'cash', items: [{ id: 'i1', foodId: 'f1', name: 'Chicken Burger', quantity: 1, unitPriceCents: 850, discountPerUnitCents: 0, lineTotalCents: 850 }], subtotalCents: 850, discountCents: 0, taxCents: 0, deliveryFeeCents: 300, totalCents: 1150, currency: 'USD', customer: { name: 'T', phone: '1' }, address: { line1: '1 Rd', city: 'Harare' }, createdAt: new Date().toISOString(), timeline: [], reviews: {} });
  const tracking = (done: number) => ({ cancelled: false, status: 'preparing', steps: ['Order placed', 'Confirmed', 'Preparing', 'Ready for dispatch', 'Out for delivery', 'Delivered'].map((label, i) => ({ status: 's' + i, label, at: i < done ? new Date().toISOString() : null, done: i < done })) });
  it('shows the current step and an honest status-based note', async () => {
    routes['/orders/o1'] = () => ({ data: order('preparing') }); routes['/orders/o1/tracking'] = () => ({ data: tracking(3) });
    layout(<OrderDetails />, '/orders/o1', 'orders/:id'); // renders through RequireAuth-free route for the test
    expect(await screen.findByText('TCZ-260101-ABCD')).toBeInTheDocument();
    const current = await screen.findByText('Preparing', { selector: 'p[aria-current="step"]' }); expect(current).toBeInTheDocument();
    expect(screen.getByText(/Live driver location is not available/)).toBeInTheDocument();
  });
  it('shows a cancelled state', async () => {
    routes['/orders/o1'] = () => ({ data: order('cancelled') }); routes['/orders/o1/tracking'] = () => ({ data: { ...tracking(1), cancelled: true } });
    layout(<OrderDetails />, '/orders/o1', 'orders/:id');
    expect(await screen.findByText('This order was cancelled.')).toBeInTheDocument();
  });
});

describe('admin inventory interactions', () => {
  it('lists stock status and opens the restock form', async () => {
    routes['/admin/inventory'] = () => ({ data: { items: [{ id: 'f1', name: 'Hot Wings', category: 'Starters', unit: 'portion', stock: 9, reserved: 2, available: 7, lowStockThreshold: 10, reorderQuantity: 25, costCents: 300, valueCents: 2700, status: 'low' }, { id: 'f2', name: 'Sushi Platter', category: 'Bowls', unit: 'portion', stock: 0, reserved: 0, available: 0, lowStockThreshold: 5, reorderQuantity: 10, costCents: 0, valueCents: 0, status: 'out' }], summary: { totalValueCents: 2700, low: 1, out: 1, products: 2 } }, meta: { page: 1, pages: 1, total: 2, limit: 20 } });
    routes['/admin/inventory/movements'] = () => ({ data: [], meta: { page: 1, pages: 1, total: 0, limit: 25 } });
    routes['/admin/inventory/restock'] = () => ({ data: {} });
    wrap(<Inventory />);
    expect(await screen.findByText('Hot Wings')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 item(s) out of stock and 1 running low.');
    await userEvent.click(screen.getAllByRole('button', { name: /Restock/ })[0]);
    const dlg = await screen.findByRole('dialog', { name: 'Restock product' });
    await userEvent.clear(within(dlg).getByLabelText(/Quantity received/)); await userEvent.type(within(dlg).getByLabelText(/Quantity received/), '25');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add stock' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/inventory/restock' && c.query?.quantity === 25 && c.query?.foodId === 'f1')).toBe(true));
  });
  it('requires a reason before adjusting stock', async () => {
    routes['/admin/inventory'] = () => ({ data: { items: [{ id: 'f1', name: 'Hot Wings', unit: 'portion', stock: 9, reserved: 2, available: 7, lowStockThreshold: 10, reorderQuantity: 25, costCents: 0, valueCents: 0, status: 'low' }], summary: { totalValueCents: 0, low: 1, out: 0, products: 1 } }, meta: { page: 1, pages: 1, total: 1, limit: 20 } });
    routes['/admin/inventory/movements'] = () => ({ data: [], meta: { page: 1, pages: 1, total: 0, limit: 25 } });
    routes['/auth/me'] = () => ({ data: { user: { id: 'a', name: 'Admin', role: 'admin', favorites: [], addresses: [] } } });
    wrap(<Inventory />); await screen.findByText('Hot Wings');
    await userEvent.click(await screen.findByRole('button', { name: /Adjust/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Adjust stock' });
    await userEvent.type(within(dlg).getByLabelText(/Change/), '-3'); await userEvent.click(within(dlg).getByRole('button', { name: 'Apply adjustment' }));
    expect(await within(dlg).findByText('A reason is required')).toBeInTheDocument();
  });
});
