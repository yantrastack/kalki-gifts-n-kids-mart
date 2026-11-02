import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '../theme';
import { useFocusRing } from './focusRing';

/*
 * Gallery navigation shared by the product page gallery (MediaCarousel) and the Discover
 * reels, so both page through photos the same way: ‹ › arrows on desktop web and an
 * "n / total" counter (announced to screen readers). YAN-109.
 */

/**
 * Previous / next buttons over the gallery. Web only (touch devices swipe).
 * `top` is the arrows' centre line in px (default: mid-height); `rightInset` moves the
 * right arrow in from the edge, e.g. to clear an overlay along that side.
 */
export function GalleryArrows({
  count,
  theme,
  prevLabel,
  nextLabel,
  onStep,
  top,
  rightInset,
}: {
  count: number;
  theme: Theme;
  prevLabel: string;
  nextLabel: string;
  onStep: (delta: number) => void;
  top?: number;
  rightInset?: number;
}) {
  if (Platform.OS !== 'web' || count < 2) return null;
  const at = top == null ? null : { top };
  const rightAt = rightInset == null ? at : { ...at, right: rightInset };
  return (
    <>
      <Arrow dir="left" theme={theme} label={prevLabel} at={at} onPress={() => onStep(-1)} />
      <Arrow dir="right" theme={theme} label={nextLabel} at={rightAt} onPress={() => onStep(1)} />
    </>
  );
}

/** "2 / 5" pill; `label` ("Photo 2 of 5") is what screen readers hear. */
export function GalleryCounter({
  index,
  count,
  label,
  top = 12,
}: {
  index: number;
  count: number;
  label: string;
  top?: number;
}) {
  if (count < 2) return null;
  return (
    <View style={[styles.counter, { top }]} pointerEvents="none">
      <Text style={styles.counterText} accessibilityLabel={label} accessibilityLiveRegion="polite">
        {index + 1} / {count}
      </Text>
    </View>
  );
}

function Arrow({
  dir,
  theme,
  label,
  at,
  onPress,
}: {
  dir: 'left' | 'right';
  theme: Theme;
  label: string;
  at: { top?: number; right?: number } | null;
  onPress: () => void;
}) {
  const ring = useFocusRing(theme, 20);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...ring.handlers}
      style={[styles.arrow, dir === 'left' ? styles.arrowLeft : styles.arrowRight, at, ring.ring]}
    >
      <Feather name={`chevron-${dir}`} size={22} color={theme.accentInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  counter: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
