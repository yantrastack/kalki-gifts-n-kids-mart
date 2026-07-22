# Storefront (Expo)

The customer-facing app for the shop. Browse products, watch **Discover** reels,
find a gift, build a cart, and order by **WhatsApp** or **phone** — there is **no
online payment** (orders are fulfilled at the local shop).

Built with **Expo** (React Native + TypeScript), runs on iOS, Android, and the
web. It's white-label: name, logo initial, accent color, currency, and phone all
come live from the Stockwell backend, so the same code serves any shop.

> Full monorepo setup is in the [root README](../../README.md). This file covers
> storefront specifics.

## Run it (from the repo root)

```bash
pnpm install            # once, at the repo root
pnpm dev                # start the backend first (port 3050)
pnpm dev:storefront     # then the Expo dev server
```

Then press **`w`** for web (http://localhost:8081), `i`/`a` for a simulator, or
scan the QR with **Expo Go** on your phone. The backend (`pnpm dev`) must be
running — the app reads live data from it.

## Point it at the backend

Default API base is in [`src/api.ts`](src/api.ts):
- iOS simulator / web → `http://localhost:3050`
- Android emulator → `http://10.0.2.2:3050`
- **Physical phone (Expo Go)** → your computer's LAN IP (phones can't reach `localhost`):

```bash
EXPO_PUBLIC_API_BASE=http://<your-LAN-IP>:3050 pnpm dev:storefront
```

## Screens

- **Home** — search, category chips, product grid, add-to-cart, floating cart bar.
- **Discover** (reels) — full-screen, vertically-paged feed with per-item image/
  video carousel, like/share/buy, "More like this", category filter.
- **Gift Finder** — pick occasion/recipient/age/likes/budget → ranked suggestions.
- **Product** — media carousel, price, stock, Add to cart, Call shop, WhatsApp.
- **Cart** — quantities, total, **Order on WhatsApp** and **Call to order**.

## Public backend endpoints it uses (CORS-open, no login)

- `GET /api/brand` — name, logo initial, accent, currency, phone, WhatsApp
- `GET /api/shop/products` — sellable products (with media + gift attributes)
- `GET /api/shop/feed` — Discover reels feed (like/share counts + related)
- `GET /api/shop/gift-finder` — ranked gift recommendations
- `POST /api/shop/events` — records engagement (view/like/share/buy)
- media under `/uploads/*` and `/seed/*`

## Structure

```
App.tsx                     root: data load, cart state, screen routing, language toggle
src/api.ts                  API base + fetch helpers + event recorder + session id
src/theme.ts                colors derived from the shop's accent + helpers
src/i18n/{index,en,te}.tsx  English/Telugu dictionaries + useI18n()
src/components/              ProductCard, MediaCarousel, Skeleton
src/screens/                Home, Product, Cart, GiftFinder, Reels
```

Dependencies: core React Native + `expo-image`, `expo-video` (media),
`@expo/vector-icons`, and `Linking` (for `tel:` / `wa.me`). Language, currency,
and gift/discover data all come from the shared `@stockwell/shared` package.

## Shop phone / WhatsApp

Set in the admin (**Stockwell → Settings**) or the seed: `settings.phone`,
`settings.whatsapp` in international format, e.g. `+919845012345`.
