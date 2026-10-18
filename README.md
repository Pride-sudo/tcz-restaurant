# TCZ Restaurant: food ordering and inventory platform

A full-stack web app: React storefront, Express API, MongoDB, Stripe (test mode) payments, order tracking,
reviews, and an admin console with real inventory management (reservations, commits, movement history).

- **Frontend** `client/`: React 18, Vite, TypeScript, Tailwind, React Router, TanStack Query, Zustand, React Hook Form + Zod, Lucide
- **Backend** `server/`: Node, Express, TypeScript (run with `tsx`), Mongoose, Zod, JWT in HTTP-only cookies, bcryptjs, Stripe
- **Brand/theme** are set in one file: `client/src/config/brand.ts`

## What is implemented, and what needs outside services

| Works with no external credentials | Needs credentials / services |
|---|---|
| Browse, search, filter, cart, coupons, checkout with **cash on delivery**, order tracking, reviews, favorites, admin console, inventory, CSV export, audit log, dev-only fake payment | **MongoDB** (local or Atlas) is required for everything. **Stripe test keys** for card payments. **SMTP** for real emails (without it, password-reset links are printed in the server log in development). |

Not built (listed in the brief as optional bonuses): PWA, WebSockets (order status uses 10-second polling), kitchen display, table reservations, loyalty points, scheduled orders, voice search, live chat, order emails. Delivery tracking is status-based only; there is no live driver GPS.

> **Payment availability:** Stripe is not available for businesses in every country (for example Zimbabwe). If that applies to you, use **cash on delivery**, which works out of the box. The payment layer is a provider interface (`server/src/services/payments/types.ts`); a local gateway can be added by implementing it and a verified webhook route. No local mobile-money provider is implemented here, and none is claimed.

## 1. Prerequisites (Linux)

Node.js 18.18+ (20 LTS recommended) and MongoDB.

```bash
# Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 20 && node -v
```

**MongoDB: pick one**
- *Atlas (free tier):* create a cluster at https://cloud.mongodb.com → Database Access: add a user → Network Access: allow your IP → Connect → Drivers → copy the `mongodb+srv://...` string (add `/tcz` before the `?`).
- *Local:* install MongoDB Community from https://www.mongodb.com/docs/manual/administration/install-on-linux/ and start it, or `docker run -d -p 27017:27017 --name tcz-mongo mongo:7`.

## 2. Install

```bash
unzip tcz-restaurant.zip && cd tcz-restaurant
npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`: set `MONGODB_URI` and a strong `JWT_SECRET` (`openssl rand -hex 48`). Never commit `.env`.

## 3. Seed demo data and create the administrator

```bash
npm run seed -- --reset        # DEV ONLY: wipes this database, adds 22 dishes, orders, coupons, reviews
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='ChooseALongPass123' npm run create-admin
# or run `npm run create-admin` and answer the prompts
```

The seed refuses to run when `NODE_ENV=production`. It also creates `customer@tcz.test / Customer123!` and `staff@tcz.test / Staff12345!` for development. There is no public admin registration, and the admin password is never hard-coded.

## 4. Run

```bash
npm run dev          # API on :5000 and web app on http://localhost:5173
```
Or separately: `npm run dev --prefix server` and `npm run dev --prefix client`.
Production build of the web app: `npm run build` (output `client/dist`). API: `npm start`.

## 5. Payments

**Cash on delivery**: always available. **Development payment**: set `DEV_PAYMENTS_ENABLED=true` (ignored in production); it adds a clearly labelled simulator on the order page.

**Stripe test mode**
1. Create a Stripe account → Developers → API keys → copy the *secret test key* (`sk_test_...`) into `STRIPE_SECRET_KEY`.
2. Forward webhooks locally with the Stripe CLI: `stripe listen --forward-to localhost:5000/api/payments/webhook` and put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`. Restart the API.
3. Pay with test card `4242 4242 4242 4242`, any future date, any CVC.

Orders are marked paid only after the signed webhook (or a server-side session lookup) confirms the amount and currency. Returning to the success URL alone changes nothing. Each webhook event id is processed once.

## 6. How inventory works

`available = stock − reserved`. Placing an order reserves stock with one atomic conditional update per item, so concurrent orders cannot oversell. Card/dev orders **commit** stock (stock and reserved both drop) when payment is verified; cash orders commit when staff confirm. Cancellation or payment failure/expiry **releases** the reservation (unpaid card reservations expire after 30 minutes via a background job). Every change writes an `InventoryMovement` with reason, order, actor and resulting levels. The commit/release/return steps are guarded by an order `stockState` flag so each runs once. This works on standalone MongoDB; the multi-document flow uses explicit rollback instead of transactions.

## 7. Tests

```bash
npm test                          # server then client
npm test --prefix server          # Vitest + supertest + mongodb-memory-server (downloads a MongoDB binary on first run)
npm test --prefix client          # Vitest + Testing Library
npm run typecheck --prefix server # optional strict-ish type check
```
Manual checklist: `docs/MANUAL_TEST_CHECKLIST.md`. API reference: `docs/API.md`.

## 8. Deployment

**MongoDB Atlas**: create a cluster and DB user; allow the API host's outbound IPs (or `0.0.0.0/0` with a strong password for a hobby deploy).

**API on Render** (Railway works the same way): New → Blueprint → select the repo (`render.yaml` is included) or create a Web Service with root `server`, build `npm install`, start `npm start`, health check `/health`. Set `MONGODB_URI`, `CLIENT_URL` (your Vercel URL), `STRIPE_*`, `COOKIE_SECURE=true`. Then run the admin command once from the Render shell. Render's disk is ephemeral: uploaded product images are lost on redeploy, so prefer image URLs (or add object storage) in production.

**Web on Vercel**: import the repo, set Root Directory `client`, framework Vite. Edit `client/vercel.json` and replace `YOUR-API-SERVICE.onrender.com` with your API host. The rewrite proxies `/api` and `/uploads`, so cookies are first-party and `COOKIE_SAMESITE=lax` is correct. Keep `VITE_API_URL=/api`.

**Stripe webhook (production)**: Dashboard → Developers → Webhooks → endpoint `https://YOUR-APP.vercel.app/api/payments/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`; copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment configuration` at start | Fill `server/.env` (JWT_SECRET ≥ 32 chars, MONGODB_URI) |
| `MongoDB connection failed` | Check the URI, Atlas IP allow-list, and that local `mongod` is running |
| Requests fail with 403 "Missing CSRF header" | Only happens for non-browser clients: send `X-Requested-With: tcz-web` |
| Login works but you are logged out on refresh (deployed) | Use the Vercel rewrite (same-site cookies) and `COOKIE_SECURE=true` |
| Card option disabled at checkout | `STRIPE_SECRET_KEY` not set |
| Order stays "pending" after paying | Webhook not reaching the API; check `STRIPE_WEBHOOK_SECRET` and the Stripe CLI; opening the order page also triggers a server-side check |
| Images blank | The image host blocked the request; a placeholder is shown. Replace URLs in the admin console |
| Server tests fail to start | First run downloads MongoDB; ensure network access, or set `MONGOMS_SYSTEM_BINARY` |

## 10. Security notes

bcrypt (cost 12) password hashing; JWT in HTTP-only, SameSite cookies with a token-version for revocation; Helmet; CORS allow-list; custom-header + Origin CSRF guard; Zod validation on every input; Mongo operator stripping; rate limits on auth, reset and order endpoints; ownership checks on orders, reviews, addresses, payments; role checks enforced in the API; audit log for admin actions; upload type + magic-byte checks; no stack traces to clients; Stripe signature verification and replay protection.
