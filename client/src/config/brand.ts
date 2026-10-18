/**
 * Single place to change brand name, contact details and theme colours.
 * Colours are hex; they are converted to CSS variables at startup (see applyTheme).
 */
export const brand = {
  name: 'TCZ Restaurant',
  shortName: 'TCZ',
  tagline: 'Fire-grilled, fresh and at your door.',
  heroTitle: 'Restaurant-quality meals, delivered while they are still hot.',
  heroText: 'Chef-made burgers, grills, bowls and desserts from our kitchen to your door. Track every step of your order.',
  contact: { email: 'hello@tcz.example', phone: '+263 77 000 0000', address: '12 Samora Machel Ave, Harare' },
  social: [{ label: 'Instagram', href: 'https://instagram.com' }, { label: 'Facebook', href: 'https://facebook.com' }, { label: 'X', href: 'https://x.com' }],
  locale: 'en-US',
  theme: {
    light: { bg: '#FBF6EA', surface: '#FFFFFF', ink: '#1F2421', muted: '#5B645E', line: '#E8DFCA', primary: '#1F4D3A', 'primary-fg': '#FFFFFF', 'primary-soft': '#E3EFE8', accent: '#F26A3D', 'accent-fg': '#1F2421', 'accent-soft': '#FDE6DC', danger: '#B3261E' },
    dark: { bg: '#121815', surface: '#1B231F', ink: '#F4EFE3', muted: '#A9B3AC', line: '#2C3832', primary: '#4FA37C', 'primary-fg': '#0E1512', 'primary-soft': '#1F3329', accent: '#F58A63', 'accent-fg': '#1A1210', 'accent-soft': '#3A2219', danger: '#F2746C' },
  },
};

const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };
export function applyTheme(mode: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  for (const [k, v] of Object.entries(brand.theme[mode])) root.style.setProperty(`--c-${k}`, rgb(v));
  root.style.colorScheme = mode;
}
