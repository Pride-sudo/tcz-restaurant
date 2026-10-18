import { Component, ReactNode, forwardRef, useEffect, useRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ImgHTMLAttributes, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Star, UtensilsCrossed, X, CheckCircle2, Info } from 'lucide-react';
import { cx, label, statusTone } from '../../utils/format';
import { useUI } from '../../store/ui';
import { useNavigate } from 'react-router-dom';

export const Spinner = ({ className = '' }: { className?: string }) => <Loader2 aria-label="Loading" className={cx('h-5 w-5 animate-spin', className)} />;
export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={cx('skeleton', className)} />;

export const Badge = ({ status, children }: { status?: string; children?: ReactNode }) => (
  <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', statusTone[status || ''] || 'bg-line text-ink')}>{children ?? label(status || '')}</span>
);

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-forest-soft text-forest">{icon || <UtensilsCrossed className="h-6 w-6" />}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}
export const ErrorState = ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
  <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
    <AlertTriangle className="h-8 w-8 text-danger" />
    <p className="font-semibold">{message || 'We could not load this.'}</p>
    {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
  </div>
);

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: unknown) { console.error(e); }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="container-x py-24"><ErrorState message="Something broke on this page." onRetry={() => { this.setState({ err: false }); location.reload(); }} /></div>;
  }
}

export function StarRating({ value, count, size = 16, onChange }: { value: number; count?: number; size?: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star width={size} height={size} className={n <= Math.round(value) ? 'fill-coral text-coral' : 'text-line'} />;
        return onChange ? <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="p-0.5">{star}</button> : <span key={n}>{star}</span>;
      })}
      {count !== undefined && <span className="ml-1 text-xs text-muted">{value ? value.toFixed(1) : 'New'}{count ? ` (${count})` : ''}</span>}
    </span>
  );
}

export function FoodImage({ src, alt, className = '', ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div role="img" aria-label={alt} className={cx('grid place-items-center bg-gradient-to-br from-forest-soft to-coral-soft text-forest', className)}><UtensilsCrossed className="h-8 w-8 opacity-60" /></div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBad(true)} className={cx('object-cover', className)} {...rest} />;
}

type FieldProps = { label: string; error?: string; hint?: string };
export const Field = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(({ label: l, error, hint, id, className, ...p }, ref) => {
  const fid = id || `f-${p.name}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{l}</label>
      <input ref={ref} id={fid} aria-invalid={!!error} aria-describedby={error ? `${fid}-e` : hint ? `${fid}-h` : undefined} className={cx('input', error && 'border-danger')} {...p} />
      {hint && !error && <p id={`${fid}-h`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${fid}-e`} role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});
export const TextArea = forwardRef<HTMLTextAreaElement, FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(({ label: l, error, hint, id, className, ...p }, ref) => {
  const fid = id || `f-${p.name}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{l}</label>
      <textarea ref={ref} id={fid} rows={3} aria-invalid={!!error} className={cx('input py-2.5', error && 'border-danger')} {...p} />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});
export const Select = forwardRef<HTMLSelectElement, FieldProps & SelectHTMLAttributes<HTMLSelectElement>>(({ label: l, error, id, className, children, ...p }, ref) => {
  const fid = id || `f-${p.name}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{l}</label>
      <select ref={ref} id={fid} aria-invalid={!!error} className={cx('input', error && 'border-danger')} {...p}>{children}</select>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { // focus trap
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus(); };
  }, [open]); // eslint-disable-line
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('card max-h-[92vh] w-full animate-pop overflow-y-auto rounded-b-none p-5 sm:rounded-3xl sm:p-6', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close dialog" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-line"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, text, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }: { open: boolean; title: string; text: string; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{text}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} disabled={busy} onClick={onConfirm}>{busy && <Spinner className="h-4 w-4" />}{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Pagination({ meta, onPage }: { meta?: { page: number; pages: number; total: number }; onPage: (p: number) => void }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
      <button className="btn btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="h-4 w-4" />Previous</button>
      <span className="text-sm text-muted">Page {meta.page} of {meta.pages}</span>
      <button className="btn btn-ghost btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useUI();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex max-w-md animate-pop items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-lift">
          {t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" /> : t.kind === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-coral" />}
          <span>{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

export function BackButton({ to }: { to?: string }) {
  const nav = useNavigate();
  return <button onClick={() => (to ? nav(to) : nav(-1))} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" />Back</button>;
}
