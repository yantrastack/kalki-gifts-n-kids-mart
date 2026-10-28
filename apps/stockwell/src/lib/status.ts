// Stock-level only — not a product lifecycle. See lib/catalog.ts for
// draft/active/discontinued, which is tracked separately on `lifecycle`.
export function deriveStatus(stock: number): 'active' | 'low' | 'out' {
  if (stock <= 0) return 'out';
  if (stock <= 10) return 'low';
  return 'active';
}
