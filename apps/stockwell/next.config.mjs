import { existsSync } from 'node:fs';

// The storefront SPA (Expo web export) only exists in public/ after `pnpm build:full`
// (scripts/embed-storefront.mjs). A plain `pnpm dev` has no storefront to serve.
const storefrontEmbedded = existsSync(new URL('./public/index.html', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stockwell/shared'],
  // Serve the embedded storefront SPA (Expo web export in public/) at the root.
  // The SPA has no client-side routing, so only `/` needs mapping; its assets
  // (/_expo/*, /assets/*) are served from public/ directly.
  async rewrites() {
    return storefrontEmbedded ? [{ source: '/', destination: '/index.html' }] : [];
  },
  // Without the embedded storefront, `/` would rewrite to a missing file and show a blank
  // 404. Send it to the admin Dashboard instead (the auth guard sends signed-out visitors
  // to login first, then back to /admin). Temporary on purpose: in the combined deploy `/`
  // is the storefront, so this must never be cached as permanent.
  async redirects() {
    return storefrontEmbedded ? [] : [{ source: '/', destination: '/admin', permanent: false }];
  },
};
export default nextConfig;
