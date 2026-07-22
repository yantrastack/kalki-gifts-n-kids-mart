import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { GiftReason } from '@stockwell/shared';
import { en } from './en';
import { te } from './te';

export type Lang = 'en' | 'te';
export const LANGS: { code: Lang; labelKey: 'english' | 'telugu' }[] = [
  { code: 'en', labelKey: 'english' },
  { code: 'te', labelKey: 'telugu' },
];

const DICTS = { en, te } as const;

/** Persist the chosen language on web (localStorage); no-op on native. */
const STORAGE_KEY = 'storefront-lang';
function readSavedLang(): Lang {
  try {
    const v = (globalThis as any)?.localStorage?.getItem(STORAGE_KEY);
    return v === 'te' || v === 'en' ? v : 'en';
  } catch {
    return 'en';
  }
}
function saveLang(lang: Lang) {
  try {
    (globalThis as any)?.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* native: ignore */
  }
}

/** Resolve a dot-path like "gift.reason.occasion" against a nested dictionary. */
function lookup(dict: any, path: string): string | undefined {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

type Params = Record<string, string | number>;

function translate(lang: Lang, key: string, params?: Params): string {
  // count-aware plural: prefer key_one / key_other when a count is supplied
  const tryKeys: string[] = [];
  if (params && typeof params.count === 'number') {
    tryKeys.push(`${key}_${params.count === 1 ? 'one' : 'other'}`);
  }
  tryKeys.push(key);

  let raw: string | undefined;
  for (const k of tryKeys) {
    raw = lookup(DICTS[lang], k) ?? lookup(DICTS.en, k);
    if (typeof raw === 'string') break;
  }
  if (typeof raw !== 'string') return key; // last-resort: show the key

  return params
    ? raw.replace(/\{(\w+)\}/g, (_, name) =>
        params[name] != null ? String(params[name]) : `{${name}}`,
      )
    : raw;
}

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
  /** Turn a structured GiftReason from the API into a localized sentence. */
  giftReason: (r: GiftReason) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readSavedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(l);
  }, []);

  const t = useCallback((key: string, params?: Params) => translate(lang, key, params), [lang]);

  const giftReason = useCallback(
    (r: GiftReason) => {
      switch (r.code) {
        case 'occasion':
          return t('gift.reason.occasion', { occasion: t(`gift.occasion.${r.value}`) });
        case 'recipient':
          return t('gift.reason.recipient', { recipient: t(`gift.recipient.${r.value}`) });
        case 'type': {
          const types = r.value
            .split(',')
            .map((k) => t(`gift.type.${k}`))
            .join(' / ');
          return t('gift.reason.type', { types });
        }
        case 'interests':
          return t('gift.reason.interests', { interests: r.value });
        default:
          return t(`gift.reason.${r.code}`);
      }
    },
    [t],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, giftReason }),
    [lang, setLang, t, giftReason],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
