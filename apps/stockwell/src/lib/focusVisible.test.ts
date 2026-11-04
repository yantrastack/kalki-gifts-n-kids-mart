import { describe, expect, it } from 'vitest';
import {
  isNavigationKey,
  shouldShowFocusRing,
} from '../../../storefront/src/components/focusVisible';

// Storefront keyboard focus ring (YAN-111): a mouse click must never leave a ring behind.

describe('isNavigationKey', () => {
  it('counts keys that move around the page', () => {
    for (const key of ['Tab', 'Enter', ' ', 'ArrowDown', 'Escape', 'a']) {
      expect(isNavigationKey({ key })).toBe(true);
    }
  });

  it('ignores modifiers on their own (window switching, screenshots)', () => {
    for (const key of ['Alt', 'Control', 'Meta', 'OS', 'Shift', 'AltGraph']) {
      expect(isNavigationKey({ key })).toBe(false);
    }
  });

  it('ignores shortcuts held with Ctrl, Alt or Cmd', () => {
    expect(isNavigationKey({ key: 'Tab', altKey: true })).toBe(false);
    expect(isNavigationKey({ key: 's', metaKey: true })).toBe(false);
    expect(isNavigationKey({ key: 'c', ctrlKey: true })).toBe(false);
    // Shift+Tab still moves focus backwards.
    expect(isNavigationKey({ key: 'Tab' })).toBe(true);
  });

  it('ignores events with no key', () => {
    expect(isNavigationKey({})).toBe(false);
  });
});

describe('shouldShowFocusRing', () => {
  const el = (focusVisible: boolean) => ({
    matches: (s: string) => s === ':focus-visible' && focusVisible,
  });

  it("follows the browser's :focus-visible over the key fallback", () => {
    // Mouse-clicked heart, focus back after Alt+Tab: no ring even if a key was pressed.
    expect(shouldShowFocusRing(el(false), true)).toBe(false);
    // Tabbed to: ring.
    expect(shouldShowFocusRing(el(true), false)).toBe(true);
  });

  it('falls back to the last input when :focus-visible is unsupported', () => {
    const old = {
      matches: () => {
        throw new SyntaxError('unsupported selector');
      },
    };
    expect(shouldShowFocusRing(old, true)).toBe(true);
    expect(shouldShowFocusRing(old, false)).toBe(false);
    expect(shouldShowFocusRing(null, true)).toBe(true);
    expect(shouldShowFocusRing(undefined, false)).toBe(false);
  });
});
