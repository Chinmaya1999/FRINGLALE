# Fringlale — Make My Jewel

Custom jewellery e-commerce for Rootage Group: design a ring, pendant, earrings, necklace or bangle in a real-time 3D
studio, see an itemised price at today's gold rate, pay online, approve the CAD/wax model, and track production to delivery.

```
server/   Express + Mongoose REST API (pricing engine, orders, payments, admin)
web/      Next.js (App Router) + Tailwind + React Three Fiber storefront, studio, account and admin
docs/     MODEL_ASSET_SPEC.md  — what 3D assets must look like
```

## Quick start

Requires Node 20+ and a MongoDB (Atlas or local).

```bash
# API
cd server
cp .env.example .env        # set MONGODB_URI and JWT_SECRET (see below)
npm install
npm run seed                # metals, stones, price matrix, 6 designs, 30 days of SAMPLE gold rates, admin user
npm run dev                 # http://localhost:4000

# Web (second terminal)
cd web
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

The seed prints the admin login once (`admin@fringlale.com`). Override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Change it immediately.

**Without Razorpay keys** the checkout runs in a clearly labelled *development payment mode* with a "Simulate successful payment" button.
This mode is disabled when `NODE_ENV=production`. Without SMS/SMTP configured, OTPs and notifications are logged to the API console (OTP is also returned in the response outside production).

## Tests

```bash
cd server && npm test                       # pricing engine, support logic, stage gates (11 tests)
cd web    && npm test                       # studio config/viewer-item logic (4 tests)
cd server && node scripts/smoke.mjs http://localhost:4000/api '<admin password>'   # 21-step API flow incl. payment, approval gate
cd web    && CHROME_PATH=/path/to/chrome node test/e2e/studio.e2e.mjs              # browser test of the 3D studio (needs puppeteer-core)
```

## The experience

- **Brand**: the Fringlale logo (`web/public/brand/`) is used in the header, hero, footer, login and editor; the black-and-gold palette is taken from it.
- **Design Studio** (`/design`): a full-screen editor — step rail, large viewport, inspector, undo/redo (Ctrl/Cmd+Z), quick looks, share links, compare. Switch the viewport between **studio light** and a **hologram stage**.
- **13 designs in 5 collections** (Bridal, Red Carpet, Heritage, Everyday Luxe, Signature). "Red Carpet" is a *style* collection inspired by award-night glamour; it does not use any real person's name or likeness. Each design has its own parametric 3D model (`web/components/studio/procedural.js`), labelled *Parametric 3D preview (not final CAD)* until real GLB assets exist. Catalogue photos are renders from the studio: `node scripts/capture-thumbnails.mjs` (needs Chrome + puppeteer-core).
- **Admin**: glassmorphism dashboard with a collapsible sidebar, sales/stage/top-design charts (hover tooltips, table view).

## How pricing works (single source of truth: `server/src/services/pricing.js`)

```
finalWeight  = baseWeight × sizeFactor[size] × metal.densityFactor
metalPrice   = goldRate[metal.rateKey] × finalWeight
makingCharge = metalPrice × making%   OR   making₹/g × finalWeight        (per design)
stonePrice   = carat × pricePerCarat[stoneType][shape][quality]
extras       = engraving + gift box + insurance
subtotal     = metalPrice + makingCharge + stonePrice + extras
gst          = subtotal × gst% (Settings, default 3)        total = subtotal + gst + shipping
```

The browser never computes prices; every UI change calls `POST /api/pricing/quote`. `/cart/lock` freezes the rate for
`PRICE_LOCK_MINUTES` (15); orders are priced from that locked rate, and it is stored on the order (`lockedGoldRate`).
Saved designs, cart lines and orders are all validated and priced by the same function, so an unsupported option can't be persisted.

## What the studio tells customers

Every configuration carries a support block from the API, displayed verbatim:

- **Real 3D model** vs **Simulated preview** (and which features are simulated: stone shape, metal finish, engraving, stone size…)
- **Manufacturing status**: concept → CAD ready → approved for manufacturing (admin-only, audited action)
- A **placeholder model** disclosure when a design doesn't have its own geometry yet

Exploded view, component highlighting and measurements appear **only** if the design's `model3d` declares them.
See `docs/MODEL_ASSET_SPEC.md`.

## Order flow and the approval gate

`Order Placed → Design/CAD Ready → Customer Approval → Wax Model → Casting → Stone Setting → Polishing → Hallmarking → Quality Check → Shipped → Delivered`

Enforced on the server (`server/src/services/stages.js`): no skipping; no progress past *Customer Approval* until the
customer approves; CAD/wax media required to request approval; HUID required before quality check; tracking number and
full payment required before shipping. If the customer requests changes, uploading new media re-opens approval.

## Environment variables

See `server/.env.example` and `web/.env.example`. Required: `MONGODB_URI`, `JWT_SECRET`. For production also set
`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `SMTP_URL`, `CLIENT_URL`, `GOOGLE_CLIENT_ID` (+ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), and a gold-rate feed (`GOLD_API_URL`).
Razorpay webhook URL: `https://<api-host>/api/payments/webhook`, event `payment.captured`.

## Deploy

**Vercel (web) + EC2 (API) + MongoDB Atlas**
1. Atlas: create a cluster, a DB user, and allow your EC2's IP in Network Access. Use that URI as `MONGODB_URI`.
2. EC2 (Ubuntu): install Node 20+, `git clone`, `cd server && npm ci`, create `.env`, `npm run seed` once, then run with `pm2 start src/index.js --name fringlale-api`. Put nginx in front with TLS (Let's Encrypt), proxying `/` to `:4000`. Set `NODE_ENV=production` and `CLIENT_URL=https://www.your-domain`.
3. Vercel: import the repo, root directory `web`, set `API_URL=https://api.your-domain` and `NEXT_PUBLIC_SITE_URL`. `/api/*` and `/uploads/*` are proxied to the API by `next.config.mjs`.
4. Back up the `uploads/` directory, or switch uploads to S3/Cloudinary (see below).

**Single EC2** also works: run the API under pm2 and `next build && next start` for the web, with nginx routing.

## Known gaps — read before launch

- **Uploads are stored on local disk** (`server/uploads`), served at `/uploads`. For multi-server or ephemeral hosting, replace the multer storage engine in `server/src/routes/uploads.js` with S3/Cloudinary; callers only use the returned URL.
- **SMS/WhatsApp delivery is a stub** (`services/otp.js`, `services/notify.js`): add your provider's call where marked. Email works once `SMTP_URL` is set.
- **Gold-rate feed**: `fetchRemoteRate` expects `{ gold24PerGram, platinumPerGram, silverPerGram }`; adapt it to your provider. Until configured, rates come from the seeded sample data or the admin manual override — **the seeded rates are sample numbers, not market prices.**
- **Placeholder 3D models and sample designs**: seeded designs, their manufacturing statuses, prices matrices, extras (engraving ₹500, gift box ₹750, insurance 0.5%) and size factors are demo values to be replaced from the admin panel.
- **Content to supply**: MD message (Ashok Kalash), contact details, testimonials (via Admin → CMS; none are shown until you add real ones), policy text (review with counsel), design photos.
- **Admin forms for metals/stones/price-matrix/coupons/CMS edit raw JSON** (validated server-side) rather than bespoke forms; designs and orders have dedicated UI.
- The JWT is kept in `localStorage`; for a stricter posture move it to an httpOnly cookie (the API already reads `req.cookies.token`).
- The headless browser test uses a software GPU, so it validates behaviour, not real-GPU visual quality or frame rate. Test on real phones before launch.

## Photos and video

- `web/public/gallery/` + `web/lib/gallery.json`: 33 openly licensed photographs (12 of them Dubai & Gulf gold jewellery, the default tab) from Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA) shown on `/shop` with the artist and licence under each image, as the licences require. They are inspiration, not Fringlale products. Do not remove the captions. No photos with identifiable people are used.
- `web/public/video/brand-film.mp4` is your film (with sound) and `brand-film-poster.jpg` its still. It is not currently placed on any page.

## Motion layer

`web/components/motion/`: Lenis smooth scroll + GSAP ScrollTrigger (`MotionProvider`), a once-per-session loader, reveal / line-mask / parallax / count-up helpers (`Reveal.jsx`), and `ScrollStage` — a pinned section where scrolling spins the 3D ring, flies the camera, swaps metals and explodes the parts. All of it is disabled for `prefers-reduced-motion` (ScrollStage falls back to a static layout) and when WebGL is unavailable.

- `web/public/designs/*-photo.jpg` + `web/lib/designPhotos.json`: real, openly licensed photographs (Wikimedia Commons) of the nearest real-world piece for 16 catalogue designs, shown on the shop cards and the product Photos tab with artist and licence. Remove an entry from the JSON to fall back to the 3D render. Credits must stay visible.
