/*
 * When to show a keyboard focus ring (web), as the browser's own :focus-visible decides.
 * Pure (no React Native imports) so it is unit-tested from stockwell's vitest.
 */

/** Keys that only modify another key, or switch away from the page (Alt+Tab, Win, Cmd). */
const MODIFIER_KEYS = new Set(['Alt', 'AltGraph', 'Control', 'Meta', 'OS', 'Shift', 'Fn']);

/**
 * Whether a keydown means the user is moving around the page with the keyboard. A
 * modifier on its own, or a shortcut held with Ctrl / Alt / Cmd (switching windows,
 * taking a screenshot), is not: otherwise the ring would show on the last button clicked
 * with the mouse as soon as the window gets focus back.
 */
export function isNavigationKey(e: {
  key?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return false;
  return !!e.key && !MODIFIER_KEYS.has(e.key);
}

/**
 * Whether a control that just got focus should show its ring. Asks the browser
 * (`:focus-visible`), which also keeps a mouse-clicked button ring-free when focus comes
 * back to the window. Browsers without `:focus-visible` fall back to whether the last
 * input was a navigation key.
 */
export function shouldShowFocusRing(
  el: { matches?: (selector: string) => boolean } | null | undefined,
  keyboardNav: boolean,
): boolean {
  if (el && typeof el.matches === 'function') {
    try {
      return el.matches(':focus-visible');
    } catch {
      // Selector not supported: fall through.
    }
  }
  return keyboardNav;
}
