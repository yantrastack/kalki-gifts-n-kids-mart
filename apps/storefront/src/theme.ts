export { money, initials } from '@stockwell/shared';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The brand accent, darkened just enough for white text on it to reach 4.5:1 (WCAG AA).
 * The accent is admin-chosen, so light brand colours would otherwise give unreadable chips.
 */
export function readableAccent(accent: string) {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return accent;
  let rgb = [1, 3, 5].map((i) => Number.parseInt(accent.slice(i, i + 2), 16));
  const hex = () => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  for (let i = 0; i < 40 && 1.05 / (luminance(hex()) + 0.05) < 4.5; i++) {
    rgb = rgb.map((v) => v * 0.96);
  }
  return hex();
}

/** Design tokens for the storefront. Accent comes from the shop's branding. */
export function buildTheme(accent: string) {
  return {
    accent,
    accentInk: readableAccent(accent), // accent safe for white text (selected chips)
    accentSoft: `${accent}14`, // ~8% alpha tint for chips/badges
    bg: '#F6F6F3',
    card: '#FFFFFF',
    text: '#191510',
    sub: '#6C6660',
    faint: '#A39C93',
    border: '#EBE7E0',
    muted: '#F1EDE7',
    onAccent: '#FFFFFF',
    success: '#1F7A4D',
    warn: '#A8761C',
    danger: '#C2453A',
    r: { sm: 10, md: 14, lg: 20, pill: 999 },
    shadow: {
      shadowColor: '#1A140D',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  };
}
export type Theme = ReturnType<typeof buildTheme>;

const PALETTE = ['#9a3a3a', '#2c5e8a', '#a8761c', '#2a7d4f', '#6b4e8a', '#8a5a36'];
export function thumbColor(name: string) {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
}
