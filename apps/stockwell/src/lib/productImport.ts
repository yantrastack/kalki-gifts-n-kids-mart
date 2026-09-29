// Product CSV import — pure helpers shared by the Products import modal (parse +
// preview) and `POST /api/products/import` (authoritative validation). No DB or
// DOM access here so both sides can use it.
//
// CSV format: a header row followed by one product per row. Headers are matched
// case-insensitively, ignoring spaces/underscores (e.g. "HSN Code", "hsn_code").
// Only `name` and `sku` are required. Rows are upserted by SKU: an empty cell
// on an existing product leaves that field unchanged.

export const IMPORT_COLUMNS = [
  'name',
  'sku',
  'barcode',
  'category',
  'brand',
  'price',
  'cost',
  'stock',
  'warehouse',
  'supplier',
  'hsnCode',
  'gstRate',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Partial<Record<ImportColumn, string>>;

export const REQUIRED_COLUMNS: ImportColumn[] = ['name', 'sku'];
export const MAX_IMPORT_ROWS = 1000;
const MAX_TEXT = 200;

// Error codes (not sentences) so the UI can translate them — see i18n
// `productImport.issues.*`.
export type ImportIssueCode =
  | 'required'
  | 'number'
  | 'integer'
  | 'tooLong'
  | 'duplicateSku'
  | 'unknownWarehouse'
  | 'scientificNotation';
export type ImportIssue = { code: ImportIssueCode; field: ImportColumn };

export type ImportResult = {
  index: number; // position in the submitted `rows` array
  sku: string;
  status: 'created' | 'updated' | 'failed';
  issues?: ImportIssue[];
};
export type ImportSummary = {
  created: number;
  updated: number;
  failed: number;
  results: ImportResult[];
};

const NUMBER_COLUMNS: ImportColumn[] = ['price', 'cost', 'gstRate'];
const INTEGER_COLUMNS: ImportColumn[] = ['stock'];
// Excel shows long numeric cells (e.g. a 13-digit EAN) as "8.9E+12" and saves the
// CSV that way, dropping digits. Barcodes are digit strings, so this form always
// means the real value was lost — reject it instead of storing a wrong barcode.
const SCIENTIFIC = /^[+-]?\d+(\.\d+)?e[+-]?\d+$/i;

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_MAP = new Map<string, ImportColumn>(IMPORT_COLUMNS.map((c) => [headerKey(c), c]));

type CsvRecord = { cells: string[]; line: number }; // line = 1-based line the record starts on

/**
 * RFC 4180-style CSV parser: quoted fields (may span lines), escaped quotes
 * (""), CRLF, BOM. Blank records (empty or only commas) are dropped.
 */
export function parseCsv(text: string): CsvRecord[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRecord = () => {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) records.push({ cells: row, line: start });
    row = [];
    field = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\r' && src[i + 1] === '\n') continue; // CRLF: handled by the '\n'
    const newline = ch === '\n' || ch === '\r';
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += newline ? '\n' : ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (newline) {
      endRecord();
      start = line + 1;
    } else field += ch;
    if (newline) line++;
  }
  if (field !== '' || row.length) endRecord();
  return records;
}

export type ParsedImport = {
  rows: ImportRow[];
  lines: number[]; // 1-based CSV line of each row, for user-facing messages
  missingColumns: ImportColumn[];
};

/** Parse CSV text into product rows keyed by known column. Unknown columns are ignored. */
export function rowsFromCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], lines: [], missingColumns: [...REQUIRED_COLUMNS] };
  const cols = table[0].cells.map((h) => HEADER_MAP.get(headerKey(h)));
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
  const rows: ImportRow[] = [];
  const lines: number[] = [];
  for (const { cells, line } of table.slice(1)) {
    const row: ImportRow = {};
    cols.forEach((c, j) => {
      if (c && cells[j] != null) row[c] = cells[j].trim();
    });
    rows.push(row);
    lines.push(line);
  }
  return { rows, lines, missingColumns };
}

/** Parse a numeric cell, tolerating ₹ and en-IN grouping ("₹1,299.00"). NaN if invalid. */
export function importNumber(v: string | undefined): number {
  const s = (v ?? '').replace(/[₹,\s]/g, '');
  return s === '' ? Number.NaN : Number(s);
}

/** Field-level checks for one row (no DB lookups). */
export function validateImportRow(row: ImportRow): ImportIssue[] {
  const issues: ImportIssue[] = [];
  for (const f of REQUIRED_COLUMNS) if (!row[f]) issues.push({ code: 'required', field: f });
  for (const f of IMPORT_COLUMNS)
    if ((row[f]?.length ?? 0) > MAX_TEXT) issues.push({ code: 'tooLong', field: f });
  if (row.barcode && SCIENTIFIC.test(row.barcode))
    issues.push({ code: 'scientificNotation', field: 'barcode' });
  for (const f of [...NUMBER_COLUMNS, ...INTEGER_COLUMNS]) {
    if (!row[f]) continue;
    const n = importNumber(row[f]);
    if (!Number.isFinite(n) || n < 0) issues.push({ code: 'number', field: f });
    else if (INTEGER_COLUMNS.includes(f) && !Number.isInteger(n))
      issues.push({ code: 'integer', field: f });
  }
  return issues;
}

/** Validate every row, including SKUs repeated within the file (later copies fail). */
export function validateImportRows(rows: ImportRow[]): ImportIssue[][] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const issues = validateImportRow(row);
    const key = row.sku?.toLowerCase();
    if (key) {
      if (seen.has(key)) issues.push({ code: 'duplicateSku', field: 'sku' });
      seen.add(key);
    }
    return issues;
  });
}

/** Downloadable template: header row + one example product. */
export function importTemplateCsv(): string {
  const example = [
    'Personalized Ceramic Mug',
    'MUG-CER-001',
    '', // barcode left blank: a long number here is mangled when the file is saved from Excel

    'Gifts',
    'Kalki',
    '349',
    '180',
    '25',
    '',
    'Local Supplier',
    '6912',
    '12',
  ];
  return `${IMPORT_COLUMNS.join(',')}\n${example.join(',')}\n`;
}
