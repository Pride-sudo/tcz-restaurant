import 'dotenv/config';
import { z } from 'zod';

const bool = (d: boolean) => z.string().optional().transform((v) => (v === undefined || v === '' ? d : v === 'true'));
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: bool(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  DEV_PAYMENTS_ENABLED: bool(false),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('TCZ Restaurant <no-reply@example.com>'),
  UPLOAD_DIR: z.string().default('uploads'),
  ADMIN_NAME: z.string().optional().default('Owner'),
  ADMIN_EMAIL: z.string().optional().default(''),
  ADMIN_PASSWORD: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${msg}\nCopy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}
export const env = parsed.data;
if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('replace-with')) {
  console.error('Refusing to start in production with the example JWT_SECRET. Generate one: openssl rand -hex 48');
  process.exit(1);
}
export const isProd = env.NODE_ENV === 'production';
export const clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
export const devPaymentsEnabled = env.DEV_PAYMENTS_ENABLED && !isProd;
export const stripeConfigured = !!env.STRIPE_SECRET_KEY;
