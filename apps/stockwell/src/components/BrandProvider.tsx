'use client';
import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

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

const BrandContext = createContext<{
  brand: Brand;
  refresh: () => void;
  // Live-preview an unsaved accent (Settings). Pass null to go back to the saved one.
  previewAccent: (accent: string | null) => void;
}>({
  brand: DEFAULT,
  refresh: () => {},
  previewAccent: () => {},
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
  // Unsaved accent being previewed on the Settings page. It wins over the saved accent
  // until it is saved or discarded, so a theme flip doesn't drop it.
  const [preview, setPreview] = useState<string | null>(null);
  const savedAccent = useRef(DEFAULT.accentColor);

  const load = useCallback(() => {
    fetch('/api/brand')
      .then((r) => r.json())
      .then((b: Brand) => {
        setBrand({ ...DEFAULT, ...b });
        document.title = `${b.appName} · Inventory`;
        savedAccent.current = b.accentColor;
        setPreview(null); // the saved value is now what's on the server
        applyAccent(b.accentColor);
      })
      .catch(() => {});
  }, []);

  const previewAccent = useCallback((accent: string | null) => {
    setPreview(accent);
    applyAccent(accent || savedAccent.current);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // re-apply accent when theme flips (light/dark derive differently)
  const accent = preview || brand.accentColor;
  useEffect(() => {
    const obs = new MutationObserver(() => applyAccent(accent));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [accent]);

  return (
    <BrandContext.Provider value={{ brand, refresh: load, previewAccent }}>
      {children}
    </BrandContext.Provider>
  );
}
export const useBrand = () => useContext(BrandContext);
