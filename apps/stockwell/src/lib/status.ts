export function deriveStatus(stock: number): 'active' | 'low' | 'out' {
  if (stock <= 0) return 'out';
  if (stock <= 10) return 'low';
  return 'active';
}
