'use client';
import { useEffect, useRef, useState } from 'react';
import {
  GIFT_OCCASIONS,
  GIFT_RECIPIENTS,
  GIFT_TYPES,
  giftTagKey,
  giftTagLabel,
  type GiftOptions,
} from '@stockwell/shared';
import { Icon } from './Icon';
import { jget } from '@/lib/api';
import { useI18n } from '@/i18n';

// The "Gift finder details" fields, shared by the Add product popup and the product's
// Gifting tab. Occasions and Gift type are dynamic: the built-in choices plus every custom
// one already used on any product, and a "+" to add a new word.

export type GiftValue = {
  occasions: string[];
  recipients: string[];
  types: string[];
  interests: string;
  ageMin: string | number;
  ageMax: string | number;
};

export const EMPTY_GIFT: GiftValue = {
  occasions: [],
  recipients: [],
  types: [],
  interests: '',
  ageMin: '',
  ageMax: '',
};

// The built-in lists show straight away; custom words used on other products are added
// when the fetch returns (and stay missing if it fails).
function useGiftOptions(): GiftOptions {
  const [opts, setOpts] = useState<GiftOptions>({
    occasions: [...GIFT_OCCASIONS],
    types: [...GIFT_TYPES],
  });
  useEffect(() => {
    let live = true;
    jget<GiftOptions>('/api/gift-options')
      .then((o) => live && setOpts(o))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return opts;
}

const unique = (...lists: string[][]) => [...new Set(lists.flat())];

function ChipToggles({
  options,
  value,
  onChange,
  removable,
  onRemove,
  addLabel,
  onAdd,
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  // Chips added in this form but not saved on a product yet can be taken back out.
  removable?: Set<string>;
  onRemove?: (o: string) => void;
  addLabel?: string;
  // Returns an error message, or null when the word was added.
  onAdd?: (raw: string) => string | null;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);

  const closeAdd = () => {
    setAdding(false);
    setText('');
    setError('');
  };
  const commit = () => {
    if (!text.trim()) return;
    const err = onAdd?.(text) ?? null;
    if (err) setError(err);
    else closeAdd();
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <span key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o)}
                className={on ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                style={{ textTransform: 'capitalize' }}
              >
                {giftTagLabel(o)}
              </button>
              {removable?.has(o) && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('productForm.removeOption', { name: giftTagLabel(o) })}
                  title={t('productForm.removeOption', { name: giftTagLabel(o) })}
                  onClick={() => onRemove?.(o)}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </span>
          );
        })}
        {onAdd && !adding && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={addLabel}
            title={addLabel}
            onClick={() => setAdding(true)}
          >
            <Icon name="plus" size={12} />
          </button>
        )}
      </div>
      {onAdd && adding && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
          <input
            className="input"
            style={{ maxWidth: 220 }}
            ref={addInputRef}
            value={text}
            aria-label={addLabel}
            aria-invalid={!!error}
            placeholder={t('productForm.newOptionPlaceholder')}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.stopPropagation(); // close this input, not the surrounding popup
                closeAdd();
              }
            }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={commit}>
            {t('productForm.addOption')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeAdd}>
            {t('productForm.cancelOption')}
          </button>
        </div>
      )}
      {error && (
        <div className="field-error" role="alert" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function GiftFields({
  value,
  onChange,
}: {
  value: GiftValue;
  onChange: (patch: Partial<GiftValue>) => void;
}) {
  const { t } = useI18n();
  const known = useGiftOptions();
  // Words typed in this form that no saved product carries yet.
  const [newOccasions, setNewOccasions] = useState<string[]>([]);
  const [newTypes, setNewTypes] = useState<string[]>([]);

  // Selected values are always shown, even if the lists above don't know them.
  const occasionOptions = unique(known.occasions, newOccasions, value.occasions);
  const typeOptions = unique(known.types, newTypes, value.types);

  const addTo =
    (
      options: string[],
      setNew: (fn: (l: string[]) => string[]) => void,
      field: 'occasions' | 'types',
    ) =>
    (raw: string): string | null => {
      if (raw.includes(',')) return t('productForm.optionNoComma');
      const key = giftTagKey(raw);
      if (!key) return null;
      if (options.some((o) => o.toLowerCase() === key))
        return t('productForm.optionExists', { name: giftTagLabel(key) });
      setNew((l) => [...l, key]);
      onChange({ [field]: [...value[field], key] });
      return null;
    };
  const removeFrom =
    (setNew: (fn: (l: string[]) => string[]) => void, field: 'occasions' | 'types') =>
    (key: string) => {
      setNew((l) => l.filter((o) => o !== key));
      onChange({ [field]: value[field].filter((o) => o !== key) });
    };

  return (
    <div className="dp-section" style={{ margin: 0 }}>
      <h4>{t('productForm.giftTitle')}</h4>
      <p className="muted tiny" style={{ marginBottom: 14 }}>
        {t('productForm.giftHelp')}
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            {t('productForm.occasions')}
          </div>
          <ChipToggles
            options={occasionOptions}
            value={value.occasions}
            onChange={(v) => onChange({ occasions: v })}
            removable={new Set(newOccasions)}
            onRemove={removeFrom(setNewOccasions, 'occasions')}
            addLabel={t('productForm.addOccasion')}
            onAdd={addTo(occasionOptions, setNewOccasions, 'occasions')}
          />
        </div>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            {t('productForm.recipients')}
          </div>
          <ChipToggles
            options={GIFT_RECIPIENTS}
            value={value.recipients}
            onChange={(v) => onChange({ recipients: v })}
          />
        </div>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            {t('productForm.giftType')}
          </div>
          <ChipToggles
            options={typeOptions}
            value={value.types}
            onChange={(v) => onChange({ types: v })}
            removable={new Set(newTypes)}
            onRemove={removeFrom(setNewTypes, 'types')}
            addLabel={t('productForm.addGiftType')}
            onAdd={addTo(typeOptions, setNewTypes, 'types')}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field">
            <span>{t('productForm.ageFrom')}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={value.ageMin}
              onChange={(e) => onChange({ ageMin: e.target.value })}
              placeholder={t('productForm.ageFromPlaceholder')}
            />
          </label>
          <label className="field">
            <span>{t('productForm.ageTo')}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={value.ageMax}
              onChange={(e) => onChange({ ageMax: e.target.value })}
              placeholder={t('productForm.ageToPlaceholder')}
            />
          </label>
        </div>
        <label className="field">
          <span>{t('productForm.interests')}</span>
          <input
            className="input"
            value={value.interests}
            onChange={(e) => onChange({ interests: e.target.value })}
            placeholder={t('productForm.interestsPlaceholder')}
          />
        </label>
      </div>
    </div>
  );
}
