import { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import { useWishlist } from '../wishlistStore';
import { useFocusRing } from './focusRing';
import { prefersReducedMotion } from './hover';

/** Saved heart colour: the same pink as a liked reel. */
export const SAVED_TINT = '#ff4d6d';
/** Touch target (a11y minimum); the visible circle inside is smaller. */
export const HEART_TARGET = 44;
const CALM = prefersReducedMotion();
const isWeb = Platform.OS === 'web';

/**
 * Save / unsave a product to the wishlist (YAN-111). Used over product card photos and on
 * the product page. It is always a sibling of the card's own button, never inside it, so
 * a tap here never opens the product or adds it to the cart.
 */
export default function WishlistHeart({
  product,
  theme,
  size = 32,
  style,
}: {
  product: { id: string; name: string };
  theme: Theme;
  /** Diameter of the visible circle (the touch target stays at least 44). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const { has, toggle } = useWishlist();
  const ring = useFocusRing(theme, size / 2);
  const pop = useRef(new Animated.Value(1)).current;
  const saved = has(product.id);

  const onPress = (e?: GestureResponderEvent) => {
    // Belt and braces on web: never let the click reach a parent handler.
    (e as any)?.stopPropagation?.();
    const { on } = toggle(product);
    if (on && !CALM) {
      pop.setValue(0.7);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  };

  const label = saved
    ? t('wishlist.remove', { name: product.name })
    : t('wishlist.save', { name: product.name });
  const target = Math.max(HEART_TARGET, size);

  return (
    <Pressable
      onPress={onPress}
      {...ring.handlers}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Toggle state: aria-pressed on web (as the reel buttons do), selected on native.
      accessibilityState={isWeb ? undefined : { selected: saved }}
      {...(isWeb ? ({ 'aria-pressed': saved } as any) : null)}
      style={({ pressed }) => [
        styles.target,
        { width: target, height: target, borderRadius: target / 2 },
        pressed && { transform: [{ scale: 0.88 }] },
        // The 44px target is invisible, so no outline on it (not even the browser's own):
        // the keyboard ring goes round the visible circle below.
        isWeb && styles.noOutline,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pop }] },
          ring.visible && { ...styles.focused, outlineColor: theme.accent },
        ]}
      >
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={Math.round(size * 0.56)}
          color={saved ? SAVED_TINT : theme.text}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { alignItems: 'center', justifyContent: 'center' },
  // Near-white backdrop keeps the dark outline / pink fill readable over any photo.
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  noOutline: { outlineWidth: 0 },
  // Keyboard focus (web): fits inside the 44px target, so it never touches the card edge.
  focused: { outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
});
