// Copies the storefront's Expo web export (apps/storefront/dist) into this app's
// public/ so Next serves the customer SPA at `/` (see next.config.mjs rewrite).
// The committed public/seed/ demo media is left untouched.
import { cp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../storefront/dist');
const pub = path.resolve(here, '../public');

try {
  await access(path.join(dist, 'index.html'));
} catch {
  console.error(`✗ No storefront web build at ${dist}\n  Run: pnpm --filter storefront build:web`);
  process.exit(1);
}

// Remove any previous embed (never touch seed/ or uploads media).
for (const p of ['index.html', 'metadata.json', 'favicon.ico', '_expo', 'assets']) {
  await rm(path.join(pub, p), { recursive: true, force: true });
}
// Merge the export into public/.
await cp(dist, pub, { recursive: true });
console.log('✓ Embedded storefront web build into apps/stockwell/public/');
