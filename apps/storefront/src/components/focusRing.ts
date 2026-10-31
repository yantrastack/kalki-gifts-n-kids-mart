import { useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import type { Theme } from '../theme';

/*
 * Keyboard focus ring for Pressables on web (like CSS :focus-visible). react-native-web
 * renders Pressables as focusable divs, so the browser would draw its own black outline,
 * or show a ring after every mouse click if we styled every focus. We track whether the
 * last input was the keyboard and only then show an accent ring that follows the radius.
 */
let keyboardNav = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    () => {
      keyboardNav = true;
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

/** Spread `handlers` on a Pressable and add `ring` to its style. */
export function useFocusRing(theme: Theme, radius: number) {
  const [visible, setVisible] = useState(false);
  const handlers = {
    onFocus: () => setVisible(keyboardNav),
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
  return { handlers, ring };
}
