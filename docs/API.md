# TCZ Restaurant REST API

Base path `/api`. All responses: `{ "success": true, "data": ..., "meta"?: {page,limit,total,pages} }` or
`{ "success": false, "error": { "code", "message", "details"? } }`.

**Auth** is an HTTP-only cookie (`tcz_token`). Every state-changing request (POST/PUT/PATCH/DELETE) must send header
`X-Requested-With: tcz-web` (CSRF defence; the web client does this automatically). `POST /orders` also needs an
`Idempotency-Key` header (8-100 chars). Validation errors return **422** with `error.details = { "field.path": "message" }`.

Legend: 🔓 public · 🔐 signed in · 🧑‍🍳 staff or admin · 👑 admin only

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register 🔓 | name, email, password (8+, letter+number), phone?. Always creates a *customer*; `role` is ignored |
| POST | /auth/login 🔓 | Rate limited |
| POST | /auth/logout | Clears cookie |
| GET | /auth/me 🔐 | |
| POST | /auth/forgot-password 🔓 | Same response whether or not the email exists. Token valid 30 min, stored hashed |
| POST | /auth/reset-password 🔓 | token, password. Signs out all sessions |

## Users 🔐
GET/PATCH `/users/me` · POST `/users/me/password` (extra) · GET/POST `/users/me/addresses` · PATCH/DELETE `/users/me/addresses/:addressId`

## Catalogue 🔓
- GET `/foods?q&category&minPrice&maxPrice&minRating&sort=popular|price_asc|price_desc|rating|newest&available=true&page&limit` (prices in currency units for filters)
- GET `/foods/featured` → `{featured,bestsellers,chefPicks,offers}` · GET `/foods/:idOrSlug` · GET `/categories`
- GET `/settings/public` (extra) · GET `/reviews/recent` (extra) · POST `/newsletter` (extra)

## Cart
- POST `/cart/quote` 🔓 (extra): price any `{items:[{foodId,variantName,quantity}],couponCode}` against live data
- GET `/cart` · PUT `/cart` (replace, extra) · POST `/cart/items` · PATCH `/cart/items/:itemId` · DELETE `/cart/items/:itemId` · DELETE `/cart` 🔐
- POST `/coupons/validate` 🔓 `{code, items}`

## Orders 🔐
- POST `/orders` — body `{items, couponCode?, paymentMethod: card|cash|dev, customer:{name,phone}, addressId | address:{line1,line2?,city}, instructions?, notes?}`. Totals are computed server side; client prices are ignored. Reserves stock atomically. Replaying the same `Idempotency-Key` returns the same order (200).
- GET `/orders/my-orders?page` · GET `/orders/:id` · GET `/orders/:id/tracking` (status-based; `trackingMode: "status-based"`)

Status flow: `placed → confirmed → preparing → ready → out_for_delivery → delivered`; `cancelled` is allowed until `ready`. Card orders cannot be confirmed before payment is verified.

## Payments
- GET `/payments/config` 🔓 → `{card,cash,dev}`
- POST `/payments/create-checkout-session` 🔐 `{orderId}` → `{url}` (reuses an open session)
- GET `/payments/:id/status` 🔐 — asks the provider server-side if still pending
- POST `/payments/webhook` 🔓 — raw body, Stripe signature verified, each event id processed once
- POST `/payments/dev-confirm` 🔐 (extra) — **development only**; returns 404 when `NODE_ENV=production` or `DEV_PAYMENTS_ENABLED=false`

## Reviews & favorites 🔐
GET `/foods/:id/reviews` 🔓 · POST `/foods/:id/reviews {rating,comment?,orderId?}` (needs a *delivered* order containing the dish; one per order item) · PATCH/DELETE `/reviews/:id` (owner only)
GET `/favorites` · POST/DELETE `/favorites/:foodId`

## Admin (`/admin/*`, 🧑‍🍳 unless noted)
| Path | Notes |
|---|---|
| GET /dashboard?days | Stats derive from DB; revenue = paid and not cancelled |
| GET /foods · POST 👑 /foods · PATCH 👑 /foods/:id · DELETE 👑 /foods/:id[?restore=true] | DELETE archives (soft delete) |
| POST/PATCH/DELETE 👑 /categories | extra |
| GET /inventory · GET /inventory/export (CSV) · GET /inventory/movements | |
| POST /inventory/restock · POST 👑 /inventory/adjust | adjust needs a reason; cannot drop below reserved stock |
| GET /orders · GET /orders/:id · PATCH /orders/:id/status | Transitions enforced; actor recorded |
| POST 👑 /orders/:id/refund | Requests a provider refund; order becomes `refunded` only after the provider webhook |
| GET 👑 /users · GET 👑 /users/:id/orders · PATCH 👑 /users/:id/status · PATCH 👑 /users/:id/role | Last active admin is protected |
| GET/POST/PATCH 👑 /coupons | extra |
| GET/PATCH 👑 /settings | |
| POST 👑 /uploads | JPEG/PNG/WebP ≤ 3 MB, magic bytes verified |
| GET 👑 /audit-log | |

`GET /health` (no `/api` prefix) returns DB connectivity.
