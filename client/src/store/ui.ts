import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyTheme } from '../config/brand';

interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }
interface UI { theme: 'light' | 'dark'; toasts: Toast[]; toggleTheme: () => void; toast: (text: string, kind?: Toast['kind']) => void; dismiss: (id: number) => void }
let n = 0;
const initial = (): 'light' | 'dark' => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export const useUI = create<UI>()(persist((set, get) => ({
  theme: initial(), toasts: [],
  toggleTheme: () => { const t = get().theme === 'light' ? 'dark' : 'light'; applyTheme(t); set({ theme: t }); },
  toast: (text, kind = 'success') => { const id = ++n; set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] })); setTimeout(() => get().dismiss(id), 4500); },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}), { name: 'tcz-ui', partialize: (s) => ({ theme: s.theme }) }));
