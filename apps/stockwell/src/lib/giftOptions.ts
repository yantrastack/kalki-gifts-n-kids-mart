import { db, schema } from '@/db/client';
import { GIFT_OCCASIONS, GIFT_TYPES, csvToList, type GiftOptions } from '@stockwell/shared';
import { isPublic } from '@/lib/catalog';

// Built-in choices first (fixed order), then every other value admins have tagged products
// with, alphabetically. `publicOnly` limits the custom values to products the storefront
// can actually show, so customers never see a choice that leads nowhere.
export async function getGiftOptions({
  publicOnly,
}: {
  publicOnly: boolean;
}): Promise<GiftOptions> {
  const rows = await db
    .select({
      occasions: schema.products.giftOccasions,
      types: schema.products.giftTypes,
      lifecycle: schema.products.lifecycle,
      stock: schema.products.stock,
    })
    .from(schema.products)
    .all();

  const occasions = new Set<string>();
  const types = new Set<string>();
  const typeCounts: Record<string, number> = {};
  for (const p of rows) {
    if (publicOnly && !(isPublic(p as any) && p.stock > 0)) continue;
    for (const o of csvToList(p.occasions)) occasions.add(o);
    for (const t of new Set(csvToList(p.types))) {
      types.add(t);
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
  }

  const withCustom = (builtin: readonly string[], found: Set<string>) => [
    ...builtin,
    ...[...found].filter((v) => !builtin.includes(v)).sort(),
  ];
  return {
    occasions: withCustom(GIFT_OCCASIONS, occasions),
    types: withCustom(GIFT_TYPES, types),
    // Counts only mean "in stock" when non-sellable products were skipped above.
    ...(publicOnly ? { typeCounts } : {}),
  };
}
