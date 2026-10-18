import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout, { RequireAuth } from './components/layout/Layout';
import { ErrorBoundary, Spinner, Toaster } from './components/common/ui';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

const Menu = lazy(() => import('./pages/Menu'));
const FoodDetails = lazy(() => import('./pages/FoodDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Orders = lazy(() => import('./pages/Orders'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Account = lazy(() => import('./pages/Account'));
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/Auth').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth').then((m) => ({ default: m.ResetPassword })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminFoods = lazy(() => import('./pages/admin/Foods'));
const AdminInventory = lazy(() => import('./pages/admin/Inventory'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

const Loading = () => <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-8 w-8 text-forest" /></div>;
const guard = (el: JSX.Element, roles?: string[]) => <RequireAuth roles={roles}>{el}</RequireAuth>;

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="menu/:slug" element={<FoodDetails />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={guard(<Checkout />)} />
            <Route path="orders" element={guard(<Orders />)} />
            <Route path="orders/:id" element={guard(<OrderDetails />)} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="account" element={guard(<Account />)} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="admin" element={guard(<AdminLayout />, ['admin', 'staff'])}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="foods" element={guard(<AdminFoods />, ['admin'])} />
            <Route path="users" element={guard(<AdminUsers />, ['admin'])} />
            <Route path="settings" element={guard(<AdminSettings />, ['admin'])} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}
