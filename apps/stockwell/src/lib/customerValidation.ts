// Customer create validation — one Zod schema shared by the admin Add Customer
// form (live inline errors) and POST /api/customers (server enforcement). Issue
// messages are error *codes*, not English text; the UI translates them via
// `customers.errors.<code>`.
//
// Rules: name is required; type is business | individual; email and phone are
// optional but must be well-formed when given; address is optional. Names may
// repeat (two customers can share a name), but a given email or phone must
// belong to one customer only — compared normalized (see `customerKeys`). The
// `customers` table has no unique constraints, so the API runs this check and
// its insert inside one write transaction.
import { z } from 'zod';

export const CUSTOMER_LIMITS = { nameMax: 100, emailMax: 254, phoneMax: 20, addressMax: 300 };
export const CUSTOMER_TYPES = ['business', 'individual'] as const;
// Digits with optional leading +, spaces, dashes, dots or parentheses; 10–15 digits (E.164 max).
const PHONE_CHARS = /^\+?[\d\s().-]+$/;
const UNIQUE_FIELDS = ['email', 'phone'] as const;

export type CustomerField = 'name' | 'type' | 'email' | 'phone' | 'address';
export type CustomerErrorCode =
  | 'required'
  | 'tooLong'
  | 'invalidType'
  | 'invalidEmail'
  | 'invalidPhone'
  | 'duplicate';
export type CustomerErrors = Partial<Record<CustomerField, CustomerErrorCode>>;
/** Another customer's unique fields, for duplicate checks (DB rows may hold nulls). */
export type CustomerIdentity = { email?: unknown; phone?: unknown };

// Missing / non-string values become '' so they report `required`, not a type error.
const text = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v : ''), schema);

const customerSchema = z.object({
  name: text(z.string().trim().min(1, 'required').max(CUSTOMER_LIMITS.nameMax, 'tooLong')),
  type: z.preprocess(
    (v) => (v === undefined || v === '' ? 'business' : v),
    z.enum(CUSTOMER_TYPES, { message: 'invalidType' }),
  ),
  email: text(
    z
      .string()
      .trim()
      .max(CUSTOMER_LIMITS.emailMax, 'tooLong')
      .refine((v) => !v || z.string().email().safeParse(v).success, 'invalidEmail'),
  ),
  phone: text(
    z
      .string()
      .trim()
      .max(CUSTOMER_LIMITS.phoneMax, 'invalidPhone')
      .refine((v) => {
        if (!v) return true;
        const digits = v.replace(/\D/g, '').length;
        return PHONE_CHARS.test(v) && digits >= 10 && digits <= 15;
      }, 'invalidPhone'),
  ),
  address: text(z.string().trim().max(CUSTOMER_LIMITS.addressMax, 'tooLong')),
});
export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * Comparison keys for the unique fields. Email is trimmed and case-insensitive.
 * Phone compares digits only, dropping India's +91 country code and 0 trunk
 * prefix, so "+91 98765 43210", "098765 43210" and "9876543210" all match.
 */
function customerKeys(c: CustomerIdentity) {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  let phone = str(c.phone).replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);
  return { email: str(c.email).toLowerCase(), phone };
}

/** Which of `v`'s unique fields already belong to one of `others` (blank values never match). */
function duplicateFields(v: CustomerIdentity, others: CustomerIdentity[]) {
  const keys = customerKeys(v);
  const taken = others.map(customerKeys);
  return UNIQUE_FIELDS.filter((f) => keys[f] && taken.some((t) => t[f] === keys[f]));
}

/**
 * Validate raw input against the rules + uniqueness against `others` (the
 * existing customers). `data` is the cleaned (trimmed) input when valid, else
 * null; `errors` holds the first issue per field.
 */
export function parseCustomer(
  raw: unknown,
  others: CustomerIdentity[] = [],
): { data: CustomerInput | null; errors: CustomerErrors } {
  const result = customerSchema
    .superRefine((v, ctx) => {
      for (const field of duplicateFields(v, others))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'duplicate' });
    })
    .safeParse(raw);
  if (result.success) return { data: result.data, errors: {} };
  const errors: CustomerErrors = {};
  for (const issue of result.error.issues)
    errors[issue.path[0] as CustomerField] ??= issue.message as CustomerErrorCode;
  // Zod skips superRefine while any base rule fails; still flag duplicates on the
  // fields that are otherwise fine, so the form shows every problem at once.
  const fields = raw && typeof raw === 'object' ? (raw as CustomerIdentity) : {};
  for (const field of duplicateFields(fields, others)) errors[field] ??= 'duplicate';
  return { data: null, errors };
}

/** API error string for a failed validation (`"email: invalidEmail"`). */
export function customerErrorMessage(errors: CustomerErrors): string {
  const [field, code] = Object.entries(errors)[0] ?? ['customer', 'invalid'];
  return `${field}: ${code}`;
}
