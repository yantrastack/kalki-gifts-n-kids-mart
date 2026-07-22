/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stockwell/shared'],
  // Serve the embedded storefront SPA (Expo web export in public/) at the root.
  // The SPA has no client-side routing, so only `/` needs mapping; its assets
  // (/_expo/*, /assets/*) are served from public/ directly.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};
export default nextConfig;
