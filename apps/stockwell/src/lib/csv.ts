/**
 * Client-side CSV download. Every cell is quoted with embedded quotes doubled,
 * and the file is prefixed with a UTF-8 BOM so Excel keeps ₹ / Telugu intact.
 */
type Cell = string | number | null | undefined;

const quote = (v: Cell) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const body = [header, ...rows].map((r) => r.map(quote).join(',')).join('\r\n');
  const blob = new Blob(['﻿', body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
