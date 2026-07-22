'use client';
import type React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Brand = {
  appName: string;
  brandInitial: string;
  accentColor: string;
  tagline: string;
  plan: string;
  seats: string;
  currency: string;
};
const DEFAULT: Brand = {
  appName: 'Stockwell',
  brandInitial: 'S',
  accentColor: '#9a3a3a',
  tagline: 'Inventory & POS',
  plan: 'Growth',
  seats: '1',
  currency: '₹',
};

const BrandContext = createContext<{ brand: Brand; refresh: () => void }>({
  brand: DEFAULT,
  refresh: () => {},
});

// --- color helpers ---
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const v = parseInt(n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
const toHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
const rgbStr = ({ r, g, b }: any) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;
function mix(hex: string, withHex: string, amt: number) {
  const a = hexToRgb(hex),
    b = hexToRgb(withHex);
  return rgbStr({
    r: a.r + (b.r - a.r) * amt,
    g: a.g + (b.g - a.g) * amt,
    b: a.b + (b.b - a.b) * amt,
  });
}
const darken = (hex: string, amt: number) => mix(hex, '#000000', amt);
const lighten = (hex: string, amt: number) => mix(hex, '#ffffff', amt);
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function applyAccent(accent: string) {
  if (typeof document === 'undefined' || !accent) return;
  const root = document.documentElement.style;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const base = dark ? lighten(accent, 0.18) : accent;
  root.setProperty('--accent', base);
  root.setProperty('--accent-hover', dark ? lighten(accent, 0.3) : darken(accent, 0.12));
  root.setProperty('--accent-soft', dark ? mix(accent, '#000000', 0.62) : lighten(accent, 0.86));
  root.setProperty('--accent-soft-fg', dark ? lighten(accent, 0.4) : darken(accent, 0.25));
  root.setProperty('--on-accent', luminance(base) > 0.6 ? '#1c1816' : '#ffffff');
  root.setProperty('--chart-1', base);
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT);

  const load = useCallback(() => {
    fetch('/api/brand')
      .then((r) => r.json())
      .then((b: Brand) => {
        setBrand({ ...DEFAULT, ...b });
        document.title = `${b.appName} · Inventory`;
        applyAccent(b.accentColor);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // re-apply accent when theme flips (light/dark derive differently)
  useEffect(() => {
    const obs = new MutationObserver(() => applyAccent(brand.accentColor));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [brand.accentColor]);

  return <BrandContext.Provider value={{ brand, refresh: load }}>{children}</BrandContext.Provider>;
}
export const useBrand = () => useContext(BrandContext);
