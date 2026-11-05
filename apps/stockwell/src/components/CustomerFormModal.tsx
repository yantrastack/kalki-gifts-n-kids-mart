'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import * as UI from './ui';
import { useI18n } from '@/i18n';
import { jsend } from '@/lib/api';
import {
  CUSTOMER_LIMITS,
  type CustomerErrors,
  type CustomerField,
  parseCustomer,
} from '@/lib/customerValidation';

const EMPTY_FORM: Record<CustomerField, string> = {
  name: '',
  type: 'business',
  email: '',
  phone: '',
  address: '',
};
const ALL_TOUCHED = { name: true, type: true, email: true, phone: true, address: true };
const TEXT_FIELDS: {
  key: Exclude<CustomerField, 'name' | 'type'>;
  type: string;
  maxLength: number;
  autoComplete: string;
}[] = [
  { key: 'email', type: 'email', maxLength: CUSTOMER_LIMITS.emailMax, autoComplete: 'email' },
  { key: 'phone', type: 'tel', maxLength: CUSTOMER_LIMITS.phoneMax, autoComplete: 'tel' },
  {
    key: 'address',
    type: 'text',
    maxLength: CUSTOMER_LIMITS.addressMax,
    autoComplete: 'street-address',
  },
];

// Shared "Add customer" popup — used by the Customers page and the POS. `customers` is the
// loaded list, used for the live duplicate check (the API re-checks against the DB).
// `onCreated` gets the saved row.
export default function CustomerFormModal({
  open,
  onClose,
  customers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  customers: any[];
  onCreated: (row: any) => void;
}) {
  const { Modal, useToast } = UI;
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  // A field's error shows once the user has changed or left it, or for every field
  // after a submit attempt — never on a pristine form.
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  // Field errors returned by the API; cleared when that field changes.
  const [serverErrors, setServerErrors] = useState<CustomerErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setTouched({});
      setServerErrors({});
    }
  }, [open]);

  // Same Zod schema as the API, re-run on every render so errors track the input live.
  const parsed = parseCustomer(form, customers);
  const errorFor = (key: CustomerField) =>
    touched[key] ? (serverErrors[key] ?? parsed.errors[key]) : undefined;
  const errorText = (key: CustomerField, maxLength: number) => {
    const error = errorFor(key);
    return error
      ? t(`customers.errors.${error === 'duplicate' ? `duplicate.${key}` : error}`, {
          field: t(`customers.${key}`),
          max: maxLength,
        })
      : null;
  };

  const close = () => {
    if (!saving) onClose();
  };
  const touch = (key: CustomerField) => setTouched((tc) => ({ ...tc, [key]: true }));
  const setField = (key: CustomerField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    touch(key);
    setServerErrors(({ [key]: _, ...rest }) => rest);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    if (!parsed.data) {
      setTouched(ALL_TOUCHED);
      return;
    }
    setSaving(true);
    try {
      const row = await jsend('/api/customers', 'POST', parsed.data);
      toast({ message: t('customers.added', { name: row.name }), icon: 'check' });
      onCreated(row);
      onClose();
    } catch (err: any) {
      if (err.status === 400 && err.body?.errors) {
        setServerErrors(err.body.errors);
        setTouched(ALL_TOUCHED);
      } else toast({ message: t('customers.saveFailed'), icon: 'alert', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close}>
      <form onSubmit={save} noValidate style={{ display: 'contents' }}>
        <div className="modal-header">
          <div className="modal-title">{t('customers.add')}</div>
          <button type="button" className="icon-btn" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field">
            <span>
              {t('customers.name')}
              <span className="field-required"> *</span>
            </span>
            <input
              className="input"
              autoComplete="name"
              maxLength={CUSTOMER_LIMITS.nameMax}
              aria-required
              aria-invalid={!!errorFor('name')}
              aria-describedby={errorFor('name') ? 'customer-name-error' : undefined}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              onBlur={() => touch('name')}
            />
            {errorFor('name') && (
              <span id="customer-name-error" className="field-error" role="alert">
                {errorText('name', CUSTOMER_LIMITS.nameMax)}
              </span>
            )}
          </label>
          <div className="field">
            <span>{t('customers.type')}</span>
            <UI.Select
              aria-label={t('customers.type')}
              value={form.type}
              onChange={(v) => setField('type', v)}
              options={[
                { value: 'business', label: t('customers.business') },
                { value: 'individual', label: t('customers.individual') },
              ]}
            />
            {errorFor('type') && (
              <span className="field-error" role="alert">
                {errorText('type', 0)}
              </span>
            )}
          </div>
          {TEXT_FIELDS.map(({ key, type, maxLength, autoComplete }) => {
            const error = errorFor(key);
            return (
              <label key={key} className="field">
                <span>{t(`customers.${key}`)}</span>
                <input
                  className="input"
                  type={type}
                  maxLength={maxLength}
                  autoComplete={autoComplete}
                  aria-invalid={!!error}
                  aria-describedby={error ? `customer-${key}-error` : undefined}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  onBlur={() => touch(key)}
                />
                {error && (
                  <span id={`customer-${key}-error`} className="field-error" role="alert">
                    {errorText(key, maxLength)}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>
            {t('customers.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Icon name="check" size={14} /> {t('customers.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
