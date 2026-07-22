export { money, initials } from '@stockwell/shared';

/** Design tokens for the storefront. Accent comes from the shop's branding. */
export function buildTheme(accent: string) {
  return {
    accent,
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
