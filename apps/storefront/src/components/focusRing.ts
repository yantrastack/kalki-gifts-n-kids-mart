import { useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import type { Theme } from '../theme';
import { isNavigationKey, shouldShowFocusRing } from './focusVisible';

/*
 * Keyboard focus ring for Pressables on web (CSS :focus-visible). react-native-web
 * renders Pressables as focusable divs, so the browser would draw its own black outline,
 * or show a ring after every mouse click if we styled every focus. On focus we ask the
 * browser whether the focus is keyboard focus, and only then show an accent ring that
 * follows the radius. `keyboardNav` is the fallback for browsers without :focus-visible.
 */
let keyboardNav = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e) => {
      if (isNavigationKey(e)) keyboardNav = true;
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    () => {
      keyboardNav = false;
    },
    true,
  );
}

/**
 * Spread `handlers` on a Pressable and add `ring` to its style. `visible` says whether
 * the ring shows, for a control that draws it on an inner element instead.
 */
export function useFocusRing(theme: Theme, radius: number) {
  const [visible, setVisible] = useState(false);
  const handlers = {
    onFocus: (e?: any) => {
      const el = e?.nativeEvent?.target ?? e?.currentTarget ?? e?.target;
      setVisible(shouldShowFocusRing(el, keyboardNav));
    },
    onBlur: () => setVisible(false),
  };
  const ring: ViewStyle | null =
    Platform.OS !== 'web'
      ? null
      : visible
        ? {
            outlineStyle: 'solid',
            outlineWidth: 2,
            outlineColor: theme.accent,
            outlineOffset: 2,
            borderRadius: radius,
          }
        : { outlineWidth: 0 };
  return { handlers, ring, visible: Platform.OS === 'web' && visible };
}
