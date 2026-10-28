import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Read-only safety check for the YAN-75 SKU-uniqueness migration. Run this
// BEFORE applying the migration that adds `products_sku_norm_unique`
// (drizzle/0010_*.sql) — a duplicate under case/whitespace-insensitive
// comparison would make that CREATE UNIQUE INDEX fail.
//
// This script never modifies data. If it finds duplicates, resolve them by
// hand (rename one of the colliding SKUs) — never auto-merge or auto-delete.
async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

  const result = await client.execute(`
    SELECT sku, COUNT(*) as c, GROUP_CONCAT(id) as ids
    FROM products
    GROUP BY UPPER(TRIM(sku))
    HAVING c > 1
  `);

  if (result.rows.length === 0) {
    console.log('✓ No duplicate/case-variant SKUs found. Safe to apply the SKU unique index.');
    process.exit(0);
  }

  console.error(`✗ Found ${result.rows.length} SKU collision(s):`);
  for (const row of result.rows) {
    console.error(`  sku=${row.sku} count=${row.c} ids=${row.ids}`);
  }
  console.error(
    '\nResolve these by hand (rename the colliding SKUs) before applying the migration that adds products_sku_norm_unique.',
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
