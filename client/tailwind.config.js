const v = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;
/** Colours come from CSS variables written by src/config/brand.ts, so rebranding is a one-file change. */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: v('bg'), surface: v('surface'), ink: v('ink'), muted: v('muted'), line: v('line'), forest: { DEFAULT: v('primary'), fg: v('primary-fg'), soft: v('primary-soft') }, coral: { DEFAULT: v('accent'), fg: v('accent-fg'), soft: v('accent-soft') }, danger: v('danger') },
      fontFamily: { display: ['Manrope', 'system-ui', 'sans-serif'], sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      borderRadius: { '4xl': '2rem' },
      boxShadow: { card: '0 1px 2px rgb(var(--c-ink) / .05), 0 8px 24px -12px rgb(var(--c-ink) / .18)', lift: '0 18px 40px -18px rgb(var(--c-ink) / .35)' },
      keyframes: { bump: { '0%,100%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' } }, shimmer: { '100%': { transform: 'translateX(100%)' } }, pop: { from: { opacity: 0, transform: 'translateY(8px) scale(.98)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { bump: 'bump .4s ease', pop: 'pop .18s ease-out' },
    },
  },
  plugins: [],
};
