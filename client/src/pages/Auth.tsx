import { ReactNode, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, errMsg, post } from '../services/api';
import { Field, Spinner } from '../components/common/ui';
import { useUI } from '../store/ui';
import { Logo } from '../components/layout/Layout';

const email = z.string().trim().email('Enter a valid email address');
const password = z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return <div className="container-x grid min-h-[70vh] place-items-center py-10"><div className="card w-full max-w-md p-6 sm:p-8"><Logo /><h1 className="mt-6 text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-muted">{sub}</p><div className="mt-6">{children}</div></div></div>;
}
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

function useAuthSubmit(path: string, after: (user: any) => void) {
  const qc = useQueryClient(); const [err, setErr] = useState('');
  return { err, run: async (body: any, setFieldError?: (k: string, m: string) => void) => {
    setErr('');
    try { const r = await post<{ user: any }>(path, body); qc.setQueryData(['me'], r.data.user); after(r.data.user); }
    catch (e) { if (e instanceof ApiError && e.details) Object.entries(e.details).forEach(([k, m]) => setFieldError?.(k, String(m))); setErr(errMsg(e)); }
  } };
}

export function Login() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useUI((s) => s.toast);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email, password: z.string().min(1, 'Enter your password') })) });
  const { err, run } = useAuthSubmit('/auth/login', (u) => { toast(`Welcome back, ${u.name.split(' ')[0]}`); nav(safeNext(sp.get('next')), { replace: true }); });
  return (
    <Shell title="Welcome back" sub="Sign in to order, track and review.">
      <form onSubmit={handleSubmit((v) => run(v, (k, m) => setError(k as any, { message: m })))} noValidate className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message as string} {...register('email')} />
        <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message as string} {...register('password')} />
        {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Sign in</button>
        <div className="flex justify-between text-sm"><Link to="/forgot-password" className="font-semibold text-forest underline">Forgot password?</Link><Link to={`/register${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next')!)}` : ''}`} className="font-semibold text-forest underline">Create account</Link></div>
      </form>
    </Shell>
  );
}

export function Register() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useUI((s) => s.toast);
  const schema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email, phone: z.string().trim().regex(/^([+\d][\d\s()-]{6,20})?$/, 'Enter a valid phone number').optional(), password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const { err, run } = useAuthSubmit('/auth/register', () => { toast('Account created. Welcome!'); nav(safeNext(sp.get('next')), { replace: true }); });
  return (
    <Shell title="Create your account" sub="Save addresses, track orders and leave reviews.">
      <form onSubmit={handleSubmit(({ confirm, ...v }) => run(v, (k, m) => setError(k as any, { message: m })))} noValidate className="space-y-4">
        <Field label="Full name" autoComplete="name" error={errors.name?.message as string} {...register('name')} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message as string} {...register('email')} />
        <Field label="Phone (optional)" type="tel" autoComplete="tel" error={errors.phone?.message as string} {...register('phone')} />
        <Field label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." error={errors.password?.message as string} {...register('password')} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message as string} {...register('confirm')} />
        {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Create account</button>
        <p className="text-center text-sm">Already registered? <Link to="/login" className="font-semibold text-forest underline">Sign in</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email })) });
  return (
    <Shell title="Reset your password" sub="We will email you a link that works for 30 minutes.">
      {sent ? <p role="status" className="rounded-xl bg-forest-soft p-4 text-sm font-medium text-forest">If that email is registered, a reset link is on its way. Check your inbox and spam folder.</p> :
        <form onSubmit={handleSubmit(async (v) => { setErr(''); try { await post('/auth/forgot-password', v); setSent(true); } catch (e) { setErr(errMsg(e)); } })} noValidate className="space-y-4">
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message as string} {...register('email')} />
          {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
          <button className="btn btn-primary w-full" disabled={isSubmitting}>Send reset link</button></form>}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="font-semibold text-forest underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useUI((s) => s.toast); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });
  const token = sp.get('token');
  if (!token) return <Shell title="Link problem" sub="This reset link is incomplete."><Link to="/forgot-password" className="btn btn-primary w-full">Request a new link</Link></Shell>;
  return (
    <Shell title="Choose a new password" sub="You will be signed out of other devices.">
      <form onSubmit={handleSubmit(async (v) => { setErr(''); try { await post('/auth/reset-password', { token, password: v.password }); toast('Password updated. Please sign in.'); nav('/login'); } catch (e) { setErr(errMsg(e)); } })} noValidate className="space-y-4">
        <Field label="New password" type="password" autoComplete="new-password" error={errors.password?.message as string} {...register('password')} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message as string} {...register('confirm')} />
        {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={isSubmitting}>Update password</button></form>
    </Shell>
  );
}
