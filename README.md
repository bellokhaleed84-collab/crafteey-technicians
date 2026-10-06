# Crafteey Vendor

The 4th Crafteey app — a Chowdeck-style vendor marketplace app where vendors
(restaurants, shops) manage their storefront, menu, and incoming orders.
Orders are fulfilled through Crafteey's existing rider/courier delivery
system (already built in `crafteey-client`).

## Stack
Matches the other three Crafteey apps:
- Next.js 14.2.35 (App Router), TypeScript, Tailwind CSS
- Firebase Auth (client SDK + Admin SDK for server-side token verification)
- MongoDB Atlas via Mongoose
- Cloudinary (product photos, verification docs)

## What's wired up
- **Auth**: Firebase email/password, `AuthContext` (client), `verifyToken`
  helper (server, verifies the `Authorization: Bearer <idToken>` header on
  API routes) — same pattern as `middleware/auth.ts` in the other apps.
- **Models**: `Vendor`, `Product`, `Order` (Mongoose, `src/models`).
- **Register flow**: 3-step wizard (business + account → phone/address →
  verification doc), creates the Firebase user then POSTs to
  `/api/vendor/register` to create the Mongo profile with `status: "pending"`.
- **Dashboard**: Overview, Menu (CRUD + in-stock toggle), Orders (list +
  detail with accept/reject/preparing/ready-for-pickup transitions), Earnings
  (gross sales, 15% platform fee placeholder, payout), Settings (store
  open/close toggle, editable profile fields).
- **API routes**: `/api/vendor/register`, `/api/vendor/me` (GET/PATCH),
  `/api/products` (GET/POST), `/api/products/[id]` (PATCH/DELETE),
  `/api/orders` (GET), `/api/orders/[id]` (PATCH — status transitions).

## Not wired up yet (left as TODOs / next steps)
- **Cloudinary upload** on the register wizard's verification step — currently
  a manual URL paste field. Swap in the same signed direct-upload pattern
  used for job photos/videos in `crafteey-client` (`lib/cloudinary.ts`
  already has `generateUploadSignature` ready for this).
- **Admin approval queue** — `crafteey-admin` needs a Vendor tab (approve/
  reject pending vendors), same shape as the existing technician approval
  queue.
- **Handoff to courier/rider** once an order hits `ready_for_pickup` — needs
  to create/update a delivery record the rider side can pick up, same as the
  technician job-dispatch flow.
- **Real commission rate** — Earnings page uses a hardcoded 15% placeholder.
- **Payout history / bank details save flow** — `bankDetails` exists on the
  `Vendor` model but has no settings-page UI yet.
- **Push/real-time order notifications** — orders currently only show up on
  page load/refresh; no FCM or polling wired in.

## Getting started
```bash
npm install
cp .env.example .env.local   # fill in Firebase, MongoDB, Cloudinary keys
npm run dev
```

To approve a vendor manually while the admin approval queue isn't built yet:
```bash
node scripts/seed-vendor.js <firebase-uid>
```
