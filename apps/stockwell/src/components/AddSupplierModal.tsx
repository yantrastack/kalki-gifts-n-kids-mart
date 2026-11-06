'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import * as UI from './ui';
import { jsend } from '@/lib/api';
import { useI18n } from '@/i18n';
import {
  parseSupplier,
  SUPPLIER_LIMITS,
  type SupplierErrors,
  type SupplierField,
  type SupplierInput,
} from '@/lib/supplierValidation';

const EMPTY_FORM: SupplierInput = { name: '', contact: '', email: '', phone: '' };
const ALL_TOUCHED = { name: true, contact: true, email: true, phone: true };
const FIELDS: { key: SupplierField; type: string; maxLength: number; required: boolean }[] = [
  { key: 'name', type: 'text', maxLength: SUPPLIER_LIMITS.nameMax, required: true },
  { key: 'contact', type: 'text', maxLength: SUPPLIER_LIMITS.contactMax, required: false },
  { key: 'email', type: 'email', maxLength: SUPPLIER_LIMITS.emailMax, required: true },
  { key: 'phone', type: 'tel', maxLength: 20, required: true },
];

// Quick "Add supplier" popup (same fields and validation as the Suppliers page).
// `existing` is the current supplier list, for duplicate checks; `onCreated` gets the new row.
export default function AddSupplierModal({
  open,
  onClose,
  existing,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  existing: any[];
  onCreated: (supplier: any) => void;
}) {
  const { t } = useI18n();
  const toast = UI.useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<SupplierField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<SupplierErrors>({});
  const [saving, setSaving] = useState(false);

  const parsed = parseSupplier(form, existing);
  const { errors } = parsed;

  const close = () => {
    setForm(EMPTY_FORM);
    setTouched({});
    setServerErrors({});
    onClose();
  };
  const setField = (key: SupplierField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(({ [key]: _, ...rest }) => rest);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!parsed.data) {
      setTouched(ALL_TOUCHED);
      return;
    }
    setSaving(true);
    try {
      const saved = await jsend('/api/suppliers', 'POST', parsed.data);
      toast({ message: t('suppliers.added', { name: saved.name }), icon: 'check' });
      onCreated(saved);
      close();
    } catch (err: any) {
      if (err.status === 400 && err.body?.errors) {
        setServerErrors(err.body.errors);
        setTouched(ALL_TOUCHED);
      } else {
        toast({ message: t('suppliers.saveFailed'), icon: 'alert', type: 'danger' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <UI.Modal open={open} onClose={close}>
      <form onSubmit={save} noValidate style={{ display: 'contents' }}>
        <div className="modal-header">
          <div className="modal-title">{t('suppliers.add')}</div>
          <button type="button" className="icon-btn" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FIELDS.map(({ key, type, maxLength, required }) => {
            const label = t(`suppliers.${key}`);
            const error = touched[key] ? (serverErrors[key] ?? errors[key]) : undefined;
            return (
              <label key={key} className="field">
                <span>
                  {label}
                  {required && <span className="field-required"> *</span>}
                </span>
                <input
                  className="input"
                  type={type}
                  maxLength={maxLength}
                  aria-required={required}
                  aria-invalid={!!error}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  onBlur={() => setTouched((tc) => ({ ...tc, [key]: true }))}
                />
                {error && (
                  <span className="field-error" role="alert">
                    {t(`suppliers.errors.${error === 'duplicate' ? `duplicate.${key}` : error}`, {
                      field: label,
                      min: SUPPLIER_LIMITS.nameMin,
                      max: maxLength,
                    })}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={close}>
            {t('suppliers.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Icon name="check" size={14} /> {t('suppliers.add')}
          </button>
        </div>
      </form>
    </UI.Modal>
  );
}
