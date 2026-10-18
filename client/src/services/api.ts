const BASE = (import.meta.env.VITE_API_URL as string) || '/api';

export class ApiError extends Error {
  status: number; code: string; details?: Record<string, string>;
  constructor(status: number, message: string, code = 'ERROR', details?: any) { super(message); this.status = status; this.code = code; this.details = details; }
}
interface Opts { method?: string; body?: unknown; query?: Record<string, any>; headers?: Record<string, string>; raw?: boolean }

export async function api<T = any>(path: string, opts: Opts = {}): Promise<{ data: T; meta?: any }> {
  const { method = 'GET', body, query, headers = {} } = opts;
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])).toString() : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs === '?' ? '' : qs}`, {
      method, credentials: 'include',
      headers: { 'X-Requested-With': 'tcz-web', ...(body instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }
  if (opts.raw) return { data: (await res.text()) as any };
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new ApiError(res.status, json?.error?.message || 'Something went wrong. Please try again.', json?.error?.code, json?.error?.details);
  return { data: json.data, meta: json.meta };
}
export const get = <T = any>(p: string, query?: Record<string, any>) => api<T>(p, { query });
export const post = <T = any>(p: string, body?: unknown, headers?: Record<string, string>) => api<T>(p, { method: 'POST', body: body ?? {}, headers });
export const patch = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body: body ?? {} });
export const put = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'PUT', body });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
