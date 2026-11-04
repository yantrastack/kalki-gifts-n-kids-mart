import { readdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { type AuditMedia, type AuditProduct, auditMedia } from '../src/lib/mediaAudit';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Product-media audit and repair (YAN-112). Run from apps/stockwell:
//
//   pnpm media:audit                                  # read-only report on DATABASE_URL
//   pnpm media:audit --base-url https://your.app      # also GET each media URL, list non-200s
//   pnpm media:audit --apply                          # apply the repair plan (product_media only)
//
// Point DATABASE_URL / DATABASE_AUTH_TOKEN at production Turso to audit production. The
// repair deletes orphan rows and `/seed/*` rows whose file is gone, then adds the current
// seed photos to seed products left with no media. It never changes `products`, uploads or
// remote URLs, and a second run is a no-op. Never run `db:seed` on production instead: it
// wipes every table.

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const baseIdx = args.indexOf('--base-url');
const baseUrl = baseIdx >= 0 ? args[baseIdx + 1]?.replace(/\/+$/, '') : undefined;

async function urlStatus(url: string): Promise<number | string> {
  const abs = /^https?:\/\//.test(url) ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  try {
    // A 1-byte range keeps this cheap for videos; the uploads/seed routes answer 206.
    const res = await fetch(abs, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    await res.body?.cancel();
    return res.status;
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'file:local.db';
  const client = createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  console.log(`Database: ${dbUrl.replace(/\?.*$/, '')}${apply ? '  (APPLY)' : '  (read-only)'}\n`);

  const products = (
    await client.execute('SELECT id, name, stock, lifecycle FROM products ORDER BY updated_at DESC')
  ).rows.map((r) => ({ ...r }) as unknown as AuditProduct);
  const media = (
    await client.execute(
      'SELECT id, product_id AS productId, url, type, sort_order AS sortOrder FROM product_media ORDER BY product_id, sort_order',
    )
  ).rows.map((r) => ({ ...r }) as unknown as AuditMedia);
  const seedFiles = readdirSync(path.join(process.cwd(), 'public/seed')).filter(
    (f) => !f.startsWith('.'),
  );

  const audit = auditMedia(products, media, seedFiles);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const show = (m: AuditMedia) =>
    `  ${m.id}  ${m.productId} (${names.get(m.productId) ?? '?'})  ${m.url}`;

  console.log(`${products.length} products, ${media.length} media rows.`);
  console.log(`\nOrphan rows (product deleted): ${audit.orphans.length}`);
  for (const m of audit.orphans) console.log(show(m));
  console.log(`\nDead /seed/* rows (file no longer shipped): ${audit.deadSeed.length}`);
  for (const m of audit.deadSeed) console.log(show(m));

  if (baseUrl) {
    console.log(`\nHTTP status of every media URL (base ${baseUrl}):`);
    let bad = 0;
    for (const m of media) {
      const status = await urlStatus(m.url);
      const ok = status === 200 || status === 206;
      if (!ok) bad++;
      console.log(`  ${ok ? 'ok ' : 'BAD'} ${status}  ${m.productId}  ${m.url}`);
    }
    console.log(`  → ${bad} URL(s) not returning 200/206.`);
  }

  console.log(
    `\nVisible in the storefront with no working photo: ${audit.visibleWithoutMedia.length}`,
  );
  for (const p of audit.visibleWithoutMedia) console.log(`  ${p.id}  ${p.name}`);

  console.log(
    `\nRepair plan: delete ${audit.toDelete.length} row(s), insert ${audit.toInsert.length} seed row(s).`,
  );
  for (const r of audit.toInsert)
    console.log(`  + ${r.id}  ${r.productId} (${names.get(r.productId)})  ${r.url}`);
  console.log(
    `Still without a photo after the repair (needs a photo or a docs/MEDIA.md exception): ${audit.stillWithoutMedia.length}`,
  );
  for (const p of audit.stillWithoutMedia) console.log(`  ${p.id}  ${p.name}`);

  if (!apply) {
    console.log('\nRead-only run: nothing changed. Re-run with --apply to repair product_media.');
    return;
  }
  if (!audit.toDelete.length && !audit.toInsert.length) {
    console.log('\nNothing to repair.');
    return;
  }
  await client.batch(
    [
      ...audit.toDelete.map((m) => ({
        sql: 'DELETE FROM product_media WHERE id = ?',
        args: [m.id],
      })),
      ...audit.toInsert.map((r) => ({
        sql: 'INSERT INTO product_media (id, product_id, url, type, sort_order) VALUES (?, ?, ?, ?, ?)',
        args: [r.id, r.productId, r.url, r.type, r.sortOrder],
      })),
    ],
    'write',
  );
  console.log(`\nApplied: ${audit.toDelete.length} deleted, ${audit.toInsert.length} inserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
