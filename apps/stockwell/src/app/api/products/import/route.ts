import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/guard';
import { deriveStatus } from '@/lib/status';
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  importNumber,
  validateImportRows,
  type ImportIssue,
  type ImportResult,
  type ImportRow,
  type ImportSummary,
} from '@/lib/productImport';
import { eq } from 'drizzle-orm';

// Bulk product import (CSV parsed client-side by `rowsFromCsv`).
// Body: { rows: ImportRow[] }. Each row is upserted by SKU (case-insensitive):
//   - new SKU      → product created with the same defaults as POST /api/products
//   - existing SKU → only the non-empty cells overwrite that product
// Stock rule: status is re-derived and a `stock_moves` row is written for any
// opening stock / stock change. Invalid rows are reported (not written); all
// valid rows are written in one transaction. Returns an `ImportSummary`.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rows: ImportRow[] | undefined = Array.isArray(body?.rows) ? body.rows : undefined;
  if (!rows?.length) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  if (rows.length > MAX_IMPORT_ROWS)
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_IMPORT_ROWS} per import)` },
      { status: 400 },
    );

  // Keep only known columns, as trimmed strings.
  const clean: ImportRow[] = rows.map((r: any) => {
    const out: ImportRow = {};
    for (const c of IMPORT_COLUMNS) if (r?.[c] != null) out[c] = String(r[c]).trim();
    return out;
  });
  const issues: ImportIssue[][] = validateImportRows(clean);

  const [products, warehouses] = await Promise.all([
    db.select().from(schema.products).all(),
    db.select().from(schema.warehouses).all(),
  ]);
  const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
  const warehouseId = new Map<string, string>();
  for (const w of warehouses) {
    warehouseId.set(w.id.toLowerCase(), w.id);
    warehouseId.set(w.name.toLowerCase(), w.id);
  }
  clean.forEach((r, i) => {
    if (r.warehouse && !warehouseId.has(r.warehouse.toLowerCase()))
      issues[i].push({ code: 'unknownWarehouse', field: 'warehouse' });
  });

  const session = await getSession(req);
  const who = session?.name || 'Import';
  const now = new Date().toISOString();
  const results: ImportResult[] = [];

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < clean.length; i++) {
        const r = clean[i];
        const sku = r.sku || '';
        if (issues[i].length) {
          results.push({ index: i, sku, status: 'failed', issues: issues[i] });
          continue;
        }
        const warehouse = r.warehouse ? warehouseId.get(r.warehouse.toLowerCase())! : undefined;
        const existing = bySku.get(sku.toLowerCase());

        if (!existing) {
          const stock = r.stock ? importNumber(r.stock) : 0;
          const row = {
            id: `p${Date.now().toString(36)}${randomUUID().slice(0, 6)}`,
            name: r.name!,
            sku,
            barcode: r.barcode || null,
            category: r.category || 'Uncategorized',
            brand: r.brand || null,
            price: r.price ? importNumber(r.price) : 0,
            cost: r.cost ? importNumber(r.cost) : 0,
            stock,
            warehouse: warehouse ?? null,
            supplier: r.supplier || null,
            status: deriveStatus(stock),
            hsnCode: r.hsnCode || null,
            gstRate: r.gstRate ? importNumber(r.gstRate) : 0,
            createdAt: now,
            updatedAt: now,
          };
          await tx.insert(schema.products).values(row as any);
          if (stock > 0)
            await tx.insert(schema.stockMoves).values({
              type: 'add',
              productId: row.id,
              product: row.name,
              qty: stock,
              who,
              warehouse: row.warehouse,
              meta: 'CSV import · opening stock',
            } as any);
          results.push({ index: i, sku, status: 'created' });
          continue;
        }

        const patch: Record<string, any> = { updatedAt: now };
        for (const k of ['name', 'barcode', 'category', 'brand', 'supplier', 'hsnCode'] as const)
          if (r[k]) patch[k] = r[k];
        for (const k of ['price', 'cost', 'gstRate'] as const)
          if (r[k]) patch[k] = importNumber(r[k]);
        if (warehouse) patch.warehouse = warehouse;
        const delta = r.stock ? importNumber(r.stock) - existing.stock : 0;
        if (r.stock) {
          patch.stock = importNumber(r.stock);
          patch.status = deriveStatus(patch.stock);
        }
        await tx.update(schema.products).set(patch).where(eq(schema.products.id, existing.id));
        if (delta !== 0)
          await tx.insert(schema.stockMoves).values({
            type: delta > 0 ? 'add' : 'remove',
            productId: existing.id,
            product: patch.name ?? existing.name,
            qty: delta,
            who,
            warehouse: patch.warehouse ?? existing.warehouse,
            meta: 'CSV import · stock updated',
          } as any);
        results.push({ index: i, sku, status: 'updated' });
      }
    });
  } catch (e: any) {
    // Transaction rolled back — nothing was written.
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }

  const count = (s: ImportResult['status']) => results.filter((r) => r.status === s).length;
  const summary: ImportSummary = {
    created: count('created'),
    updated: count('updated'),
    failed: count('failed'),
    results,
  };
  return NextResponse.json(summary);
}
