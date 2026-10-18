# Manual test checklist

Prepare: `npm run seed -- --reset` (dev DB only), `npm run create-admin`, `npm run dev`. Test at 360 px and 1280 px wide.

**Customer**
- [ ] Register, sign out, sign in; wrong password shows a safe message
- [ ] Forgot password: reset link appears in the server log (no SMTP); link works once, expires after 30 min
- [ ] Edit profile; add, edit, delete address; change password
- [ ] Menu: search "burger", category chips, price/rating filters, sorting, pagination; empty state; unavailable dish is greyed and cannot be added
- [ ] Dish page: size options, quantity, allergen notice, favorite toggle
- [ ] Cart: +/-, remove, clear (confirm), coupon `WELCOME10` applies, `OLDDEAL` shows expired, refresh keeps cart
- [ ] Checkout: empty fields show field errors; cash order succeeds; double-click "Place order" creates ONE order
- [ ] Dev payment (if enabled): order page → "Simulate success" → payment shows Paid
- [ ] Card payment (Stripe test key): pay with `4242 4242 4242 4242`; returns to order page and shows Paid only after server verification; cancel at Stripe → "Pay now" available
- [ ] Order page auto-updates when staff change status; cancelled state shows
- [ ] After "Delivered": rate dish, edit review, delete review; cannot review a dish never delivered

**Admin / staff** (staff@tcz.test sees Overview, Orders, Inventory only)
- [ ] Overview cards, charts and stock alerts match data
- [ ] Create, edit, archive and restore a product (with image upload)
- [ ] Restock and adjust (reason required); movement history lists each change; CSV export opens in a spreadsheet
- [ ] Place two orders for the last 1 item from two browsers: only one succeeds
- [ ] Confirm a cash order → stock committed; cancel a placed order → reservation released
- [ ] Invalid transitions are rejected (e.g. placed → delivered)
- [ ] Suspend a customer; they are signed out and cannot sign in. Cannot demote/suspend the last admin
- [ ] Settings: change delivery fee / tax and see them at checkout; add a coupon
- [ ] A customer visiting `/admin` is redirected; calling `/api/admin/dashboard` returns 403
