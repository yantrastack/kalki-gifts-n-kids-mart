// Supplier create/edit validation — one Zod schema shared by the admin form
// (inline errors) and POST /api/suppliers + PUT /api/suppliers/[id] (server
// enforcement). Issue messages are error *codes*, not English text; the UI
// translates them via `suppliers.errors.<code>`.
//
// Rules: name, email and phone are required; contact person is optional. Name,
// email and phone must each be unique across suppliers, compared normalized
// (see `supplierKeys`). The `suppliers` table has no unique constraints, so the
// API runs this check and its write inside one write transaction.
import { z } from 'zod';

export const SUPPLIER_LIMITS = { nameMin: 2, nameMax: 100, contactMax: 100, emailMax: 254 };
// Digits with optional leading +, spaces, dashes, dots or parentheses; 10–15 digits (E.164 max).
const PHONE_CHARS = /^\+?[\d\s().-]+$/;
const UNIQUE_FIELDS = ['name', 'email', 'phone'] as const;

export type SupplierField = 'name' | 'contact' | 'email' | 'phone';
export type SupplierErrorCode =
  | 'required'
  | 'tooShort'
  | 'tooLong'
  | 'invalidEmail'
  | 'invalidPhone'
  | 'duplicate';
export type SupplierErrors = Partial<Record<SupplierField, SupplierErrorCode>>;
/** Another supplier's unique fields, for duplicate checks (DB rows may hold nulls). */
export type SupplierIdentity = { name?: unknown; email?: unknown; phone?: unknown };

// Missing / non-string values become '' so they report `required`, not a type error.
const text = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v : ''), schema);

const supplierSchema = z.object({
  name: text(
    z
      .string()
      .trim()
      .min(1, 'required')
      .min(SUPPLIER_LIMITS.nameMin, 'tooShort')
      .max(SUPPLIER_LIMITS.nameMax, 'tooLong'),
  ),
  contact: text(z.string().trim().max(SUPPLIER_LIMITS.contactMax, 'tooLong')),
  email: text(
    z
      .string()
      .trim()
      .min(1, 'required')
      .max(SUPPLIER_LIMITS.emailMax, 'tooLong')
      .email('invalidEmail'),
  ),
  phone: text(
    z
      .string()
      .trim()
      .min(1, 'required')
      .regex(PHONE_CHARS, 'invalidPhone')
      .refine((v) => {
        const digits = v.replace(/\D/g, '').length;
        return digits >= 10 && digits <= 15;
      }, 'invalidPhone'),
  ),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

/**
 * Comparison keys for the unique fields. Name and email are case-insensitive.
 * Phone compares digits only, dropping India's +91 country code and 0 trunk
 * prefix, so "+91 98765 43210", "098765 43210" and "9876543210" all match.
 */
function supplierKeys(s: SupplierIdentity) {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  let phone = str(s.phone).replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);
  return { name: str(s.name).toLowerCase(), email: str(s.email).toLowerCase(), phone };
}

/** Which of `v`'s unique fields already belong to one of `others`. */
function duplicateFields(v: SupplierIdentity, others: SupplierIdentity[]) {
  const keys = supplierKeys(v);
  const taken = others.map(supplierKeys);
  return UNIQUE_FIELDS.filter((f) => keys[f] && taken.some((t) => t[f] === keys[f]));
}

/**
 * Validate raw input against the rules + uniqueness against `others` — every
 * *other* supplier (when editing, leave the edited one out so its own values
 * don't count as duplicates). `data` is the cleaned (trimmed) input when valid,
 * else null; `errors` holds the first issue per field.
 */
export function parseSupplier(
  raw: unknown,
  others: SupplierIdentity[] = [],
): { data: SupplierInput | null; errors: SupplierErrors } {
  const result = supplierSchema
    .superRefine((v, ctx) => {
      for (const field of duplicateFields(v, others))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'duplicate' });
    })
    .safeParse(raw);
  if (result.success) return { data: result.data, errors: {} };
  const errors: SupplierErrors = {};
  for (const issue of result.error.issues)
    errors[issue.path[0] as SupplierField] ??= issue.message as SupplierErrorCode;
  // Zod skips superRefine while any base rule fails; still flag duplicates on the
  // fields that are otherwise fine, so the form shows every problem at once.
  const fields = raw && typeof raw === 'object' ? (raw as SupplierIdentity) : {};
  for (const field of duplicateFields(fields, others)) errors[field] ??= 'duplicate';
  return { data: null, errors };
}

/** API error string for a failed validation (`"email: required"`). */
export function supplierErrorMessage(errors: SupplierErrors): string {
  const [field, code] = Object.entries(errors)[0] ?? ['supplier', 'invalid'];
  return `${field}: ${code}`;
}
