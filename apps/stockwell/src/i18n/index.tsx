'use client';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';
import { te } from './te';

export type Lang = 'en' | 'te';
export const LANGS: { code: Lang; short: string; labelKey: 'english' | 'telugu' }[] = [
  { code: 'en', short: 'EN', labelKey: 'english' },
  { code: 'te', short: 'తె', labelKey: 'telugu' },
];

const DICTS = { en, te } as const;
const STORAGE_KEY = 'stockwell-lang';

function lookup(dict: any, path: string): string | undefined {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

type Params = Record<string, string | number>;

function translate(lang: Lang, key: string, params?: Params): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
  if (typeof raw !== 'string') return key;
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
};
const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Start on "en" for both SSR and first client render to avoid hydration
  // mismatch; adopt the saved choice after mount.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'te' || saved === 'en') setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <LanguageProvider>');
  return ctx;
}
