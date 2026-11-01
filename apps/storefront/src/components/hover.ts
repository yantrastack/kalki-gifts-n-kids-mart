import { Platform } from 'react-native';

function matches(query: string) {
  try {
    return (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches
    );
  } catch {
    return false;
  }
}

/**
 * True on web with a real hover pointer (mouse / trackpad). Touch screens keep their
 * press feedback instead of hover effects.
 */
export const canHover = () => matches('(hover: hover) and (pointer: fine)');

/** True when the user asked the OS / browser for less motion. */
export const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)');
