import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Load the temporary development photos in dev-media/ into a LOCAL database (YAN-112).
// Run from apps/stockwell:   pnpm media:dev-load [folder]   (default: dev-media)
//
// Each file is named <productId>.<ext> (e.g. p4.png). It is copied into uploads/ and
// added as that product's cover, the same way an admin Media-tab upload is stored.
// Products that already have media are left alone, so running it twice changes nothing.
// These photos are placeholders for testing only: they are not licensed for production,
// so the script refuses to run against a remote database (Turso). Replace them with real
// product photos in the admin (Products → Media).

const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'file:local.db';
  if (!dbUrl.startsWith('file:')) {
    console.error(
      `Refusing: ${dbUrl} is not a local database. Dev photos are for local testing only.`,
    );
    process.exit(1);
  }
  const dir = path.resolve(process.argv[2] ?? 'dev-media');
  const uploads = path.join(process.cwd(), 'uploads');
  mkdirSync(uploads, { recursive: true });
  const client = createClient({ url: dbUrl });

  let added = 0;
  for (const file of readdirSync(dir).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!EXT.has(ext)) continue;
    const productId = path.basename(file, path.extname(file));
    const product = await client.execute({
      sql: 'SELECT name FROM products WHERE id = ?',
      args: [productId],
    });
    if (!product.rows.length) {
      console.log(`skip ${file}: no product ${productId}`);
      continue;
    }
    const media = await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM product_media WHERE product_id = ?',
      args: [productId],
    });
    if (Number(media.rows[0].n) > 0) {
      console.log(`skip ${file}: ${productId} already has media`);
      continue;
    }
    const name = `${productId}-${randomBytes(6).toString('hex')}${ext === '.jpeg' ? '.jpg' : ext}`;
    copyFileSync(path.join(dir, file), path.join(uploads, name));
    await client.execute({
      sql: 'INSERT INTO product_media (id, product_id, url, type, sort_order) VALUES (?, ?, ?, ?, 0)',
      args: [`m${randomBytes(5).toString('hex')}`, productId, `/uploads/${name}`, 'image'],
    });
    console.log(`added ${file} → ${product.rows[0].name}`);
    added++;
  }
  console.log(`\n${added} photo(s) added.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
