// Shared logic for the two purchase-order route handlers (POST create and
// PUT edit), which previously duplicated this near-identically. Keeping it
// here means they can't drift apart again. See YAN-75.

export type PurchaseLine = {
  productId?: string;
  name?: string;
  sku?: string;
  category?: string;
  brand?: string;
  qty: number;
  cost: number;
  free?: number;
  scheme?: string;
  expiry?: string;
  price?: number; // selling price entered on the bill
  mrp?: number;
  batchNo?: string;
  hsnCode?: string;
  gstRate?: number;
  // Explicit opt-in to overwrite the catalog's current price/MRP/cost from
  // this bill line. Defaults to false — entering a bill never silently
  // changes the catalog price unless the UI shows the user the before/after
  // and they tick this.
  updateCatalogPrice?: boolean;
};

export type NewProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  brand: string | null;
  price: number;
  cost: number;
  mrp: number | null;
  expiry: string | null;
  stock: number;
  incoming: number;
  warehouse: string | null;
  supplier: string | null;
  status: 'active' | 'low' | 'out';
  lifecycle: 'draft';
  hsnCode: string | null;
  gstRate: number | null;
  createdAt: string;
  updatedAt: string;
};

function genProductId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// Builds the insert row for a brand-new product created from a purchase
// bill line. Always created as `lifecycle: 'draft'` — regardless of how
// much stock it starts with — so it can never be sellable/visible until
// someone reviews and activates it. No more guessed `cost * 1.25` price:
// an unset selling price is stored as 0 (a draft can't sell anyway), and
// category/GST/HSN are passed through as-is rather than silently defaulted,
// so completeness can be judged later by `missingForActivation`.
export function buildNewProductFromLine(
  line: PurchaseLine,
  ctx: { warehouse: string | null; supplier: string | null; now: string; receiveNow: boolean },
  deriveStatus: (stock: number) => 'active' | 'low' | 'out',
): NewProductRow {
  const qty = Number(line.qty) || 0;
  const free = Math.max(0, Number(line.free) || 0);
  const cost = Number(line.cost) || 0;
  const sell = Number(line.price) || 0;
  const mrp = Number(line.mrp) || 0;
  const totalUnits = qty + free;
  const stock = ctx.receiveNow ? totalUnits : 0;

  return {
    id: genProductId(),
    name: line.name!.trim(),
    sku: line.sku!.trim(),
    category: line.category?.trim() || null,
    brand: line.brand?.trim() || null,
    price: sell, // no cost*1.25 guess — 0 if not given
    cost,
    mrp: mrp || null,
    expiry: line.expiry || null,
    stock,
    incoming: ctx.receiveNow ? 0 : totalUnits,
    warehouse: ctx.warehouse,
    supplier: ctx.supplier,
    status: deriveStatus(stock),
    lifecycle: 'draft',
    hsnCode: line.hsnCode?.trim() || null,
    gstRate: line.gstRate != null ? Number(line.gstRate) : null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

// Decides whether an existing-product line should patch the catalog's
// price/cost/MRP. Only applies when the line explicitly opts in via
// `updateCatalogPrice`. Returns {} (no-op) otherwise — this is what stops a
// bill entry from silently overwriting today's catalog commercials.
export function priceRefreshPatch(
  line: PurchaseLine,
  existing: { cost: number; price: number; mrp: number | null },
): { cost?: number; price?: number; mrp?: number; expiry?: string } {
  if (!line.updateCatalogPrice) return {};
  const cost = Number(line.cost) || 0;
  const sell = Number(line.price) || 0;
  const mrp = Number(line.mrp) || 0;
  const patch: { cost?: number; price?: number; mrp?: number; expiry?: string } = {
    cost: cost || existing.cost,
  };
  if (sell) patch.price = sell;
  if (mrp) patch.mrp = mrp;
  if (line.expiry) patch.expiry = line.expiry;
  return patch;
}
