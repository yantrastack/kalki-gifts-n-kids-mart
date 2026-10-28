export type Lifecycle = 'draft' | 'active' | 'discontinued';

type ActivationCandidate = {
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  price?: number | null;
  cost?: number | null;
  gstRate?: number | null;
  hsnCode?: string | null;
};

const VALID_GST_RATES = new Set([0, 5, 12, 18, 28]);
const HSN_LENGTHS = new Set([4, 6, 8]);

// Fields a product must have before it can become `active`. Returns an
// empty array when the product is complete.
export function missingForActivation(p: ActivationCandidate): string[] {
  const missing: string[] = [];
  if (!p.name?.trim()) missing.push('name');
  if (!p.sku?.trim()) missing.push('sku');
  if (!p.category?.trim() || p.category.trim().toLowerCase() === 'uncategorized')
    missing.push('category');
  if (!(Number(p.cost) > 0)) missing.push('cost');
  if (!(Number(p.price) > 0)) missing.push('price');
  if (p.gstRate == null || !VALID_GST_RATES.has(Number(p.gstRate))) missing.push('gstRate');
  if (!p.hsnCode?.trim() || !HSN_LENGTHS.has(p.hsnCode.trim().length)) missing.push('hsnCode');
  return missing;
}

// Pricing sanity shared by product PUT and purchase entry. Returns an empty
// array when there's nothing to flag.
export function validatePricing(p: {
  price?: number | null;
  cost?: number | null;
  mrp?: number | null;
}): string[] {
  const issues: string[] = [];
  const price = Number(p.price) || 0;
  const cost = Number(p.cost) || 0;
  if (p.mrp != null && price > Number(p.mrp)) issues.push('priceAboveMrp');
  if (cost > 0 && price > 0 && price < cost) issues.push('priceBelowCost');
  return issues;
}

export function normaliseSku(sku: string): string {
  return sku.trim().toUpperCase();
}

export class CatalogError extends Error {
  code: 'SKU_TAKEN';
  conflictId?: string;
  constructor(code: 'SKU_TAKEN', message: string, conflictId?: string) {
    super(message);
    this.code = code;
    this.conflictId = conflictId;
  }
}

// Throws CatalogError('SKU_TAKEN') if `sku` (normalised) collides with
// another product. `lookup` is injected so this is unit-testable without a
// DB — it should resolve the normalised SKU to the existing product's id,
// if any.
export async function assertSkuUnique(
  sku: string,
  excludeId: string | undefined,
  lookup: (normalised: string) => Promise<{ id: string } | undefined>,
): Promise<void> {
  const normalised = normaliseSku(sku);
  const existing = await lookup(normalised);
  if (existing && existing.id !== excludeId) {
    throw new CatalogError('SKU_TAKEN', `SKU "${sku}" is already in use`, existing.id);
  }
}

const TRANSITIONS: Record<Lifecycle, Lifecycle[]> = {
  draft: ['active'],
  active: ['discontinued'],
  discontinued: ['active'],
};

export function canTransition(from: Lifecycle, to: Lifecycle): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// Sellable at POS: lifecycle must be active, and there must be stock to sell.
export function isSellable(p: { lifecycle: Lifecycle; status: string; stock: number }): boolean {
  return p.lifecycle === 'active' && p.status !== 'out' && p.stock > 0;
}

// Shown in the public catalog at all (storefront/gift-finder). Callers
// compose this with their own stock check (e.g. `isPublic(p) && p.stock > 0`)
// since whether an active-but-out-of-stock product should still be visible
// (with a badge) is a product decision, not something baked in here.
export function isPublic(p: { lifecycle: Lifecycle }): boolean {
  return p.lifecycle === 'active';
}
