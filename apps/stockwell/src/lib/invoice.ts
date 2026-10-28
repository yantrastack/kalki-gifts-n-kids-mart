export type SaleInputLine = {
  productId: string;
  name: string;
  sku: string;
  hsnCode: string | null;
  price: number;
  gstRate: number | null;
  qty: number;
};

export type SaleLine = {
  productId: string;
  name: string;
  sku: string;
  hsnCode: string | null;
  qty: number;
  unitPrice: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
};

export type SaleTotals = {
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

const toPaise = (rupees: number) => Math.round(rupees * 100);
const fromPaise = (paise: number) => paise / 100;

// Prices are excl. GST. Money is computed in integer paise so line sums and
// header totals match exactly. Discount applies to the gross line amount; GST
// is charged on the discounted taxable amount at each product's own rate.
export function buildSaleLines(input: SaleInputLine[], discountPct: number): SaleTotals {
  const pct = Math.max(0, Math.min(100, discountPct));
  let subtotalP = 0;
  let discountP = 0;
  let taxP = 0;
  let totalP = 0;

  const lines: SaleLine[] = input.map((l) => {
    const gstRate = Number(l.gstRate) || 0;
    const grossP = toPaise(l.price * l.qty);
    const lineDiscountP = Math.round((grossP * pct) / 100);
    const taxableP = grossP - lineDiscountP;
    const gstP = Math.round((taxableP * gstRate) / 100);
    const lineTotalP = taxableP + gstP;

    subtotalP += grossP;
    discountP += lineDiscountP;
    taxP += gstP;
    totalP += lineTotalP;

    return {
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      hsnCode: l.hsnCode,
      qty: l.qty,
      unitPrice: l.price,
      discount: fromPaise(lineDiscountP),
      gstRate,
      gstAmount: fromPaise(gstP),
      lineTotal: fromPaise(lineTotalP),
    };
  });

  return {
    lines,
    subtotal: fromPaise(subtotalP),
    discount: fromPaise(discountP),
    tax: fromPaise(taxP),
    total: fromPaise(totalP),
  };
}
