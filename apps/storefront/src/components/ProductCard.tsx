import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import { type Theme, money } from '../theme';
import { type Product, mediaUrl } from '../api';
import ProductImage from './ProductImage';
import ProductBadge from './ProductBadge';
import { useFocusRing } from './focusRing';
import { canHover, prefersReducedMotion } from './hover';
import { hoverImage } from './gallery';

// Read once: whether this device hovers (mouse) and whether the user wants less motion.
const HOVER = canHover();
const CALM = prefersReducedMotion();
// react-native-web understands CSS transitions as style props; native ignores them.
const EASE = CALM
  ? null
  : ({
      transitionProperty: 'transform, box-shadow',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease',
    } as any);
// Cross-fade for the hover photo (instant swap when the user asked for less motion).
const FADE = CALM
  ? null
  : ({
      transitionProperty: 'opacity',
      transitionDuration: '250ms',
      transitionTimingFunction: 'ease',
    } as any);

const PAD = 10;
const ADD = 34; // add-to-cart button size
const LOW_LINE = 19; // reserved stock line: marginTop 5 + lineHeight 14

export default function ProductCard({
  product,
  theme,
  currency,
  onPress,
  onAdd,
  priority = false,
}: {
  product: Product;
  theme: Theme;
  currency: string;
  onPress: () => void;
  onAdd: () => void;
  /** Above-the-fold card: load its photo first instead of lazily. */
  priority?: boolean;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  // Mouse users see the second photo on hover. Mounted on first hover only, so touch
  // devices and cards nobody points at never download it.
  const [peeked, setPeeked] = useState(false);
  const [pressed, setPressed] = useState(false);
  const cardRing = useFocusRing(theme, theme.r.lg);
  const addRing = useFocusRing(theme, 12);
  const low = product.inStock <= 10;
  // Card cover = the first photo, which is also the first image in the product gallery.
  const cover = product.media.find((m) => m.type === 'image');
  // Video-only product: the placeholder shows, with the play mark saying there is a video.
  const hasVideo = !cover && product.media.some((m) => m.type === 'video');
  const lift = HOVER && hovered;
  const second = HOVER ? hoverImage(product.media) : undefined;
  const price = money(currency, product.price);

  return (
    // The card's button and the add button are siblings: a <button> inside a <button> is
    // invalid HTML on web and confuses screen readers.
    <View
      onPointerEnter={
        HOVER
          ? () => {
              setHovered(true);
              setPeeked(true);
            }
          : undefined
      }
      onPointerLeave={HOVER ? () => setHovered(false) : undefined}
      style={[
        styles.card,
        { backgroundColor: theme.card, borderRadius: theme.r.lg },
        theme.shadow,
        EASE,
        lift && {
          shadowOpacity: 0.12,
          shadowRadius: 18,
          ...(CALM ? null : { transform: [{ translateY: -2 }] }),
        },
        // Touch keeps the press-scale feedback; mouse users get the hover lift instead.
        !HOVER && pressed && { transform: [{ scale: 0.975 }], opacity: 0.92 },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        {...cardRing.handlers}
        accessibilityRole="button"
        accessibilityLabel={t('card.view', { name: product.name, price })}
        style={[styles.main, cardRing.ring]}
      >
        <View style={[styles.thumb, { borderRadius: theme.r.md, backgroundColor: theme.muted }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              EASE,
              lift && !CALM && { transform: [{ scale: 1.05 }] },
            ]}
          >
            <ProductImage
              uri={cover ? mediaUrl(cover.url) : null}
              label={t('card.photo', { name: product.name })}
              theme={theme}
              style={StyleSheet.absoluteFill}
              priority={priority}
              caption={t('card.noPhoto')}
            />
            {second && peeked ? (
              // Decorative alternate view: the card's label already names the product.
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, FADE, { opacity: lift ? 1 : 0 }]}
              >
                <ProductImage
                  uri={mediaUrl(second.url)}
                  label=""
                  theme={theme}
                  style={StyleSheet.absoluteFill}
                  transition={0}
                  hideOnError
                />
              </View>
            ) : null}
          </View>
          {hasVideo && (
            <View style={styles.playBadge}>
              <Feather name="play" size={14} color="#fff" />
            </View>
          )}
          <ProductBadge tag={product.tag} theme={theme} style={styles.badge} />
        </View>

        <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>
          {product.name}
        </Text>
        <Text style={[styles.cat, { color: theme.faint }]} numberOfLines={1}>
          {product.category}
        </Text>

        {/* Leaves room on the right for the add button, which sits on top of this row. */}
        <View style={styles.row}>
          <Text style={[styles.price, { color: theme.text }]} numberOfLines={1}>
            {price}
          </Text>
        </View>
        {/* Always reserve the stock line, so cards in a row keep the same height. */}
        <Text style={[styles.low, { color: theme.warn }]} numberOfLines={1}>
          {low ? t('card.onlyLeft', { count: product.inStock }) : ' '}
        </Text>
      </Pressable>

      <Pressable
        onPress={onAdd}
        hitSlop={10}
        {...addRing.handlers}
        accessibilityRole="button"
        accessibilityLabel={t('card.addToCart', { name: product.name })}
        style={({ pressed: addPressed }) => [
          styles.add,
          { backgroundColor: theme.accent },
          addPressed && { transform: [{ scale: 0.9 }] },
          addRing.ring,
        ]}
      >
        <Feather name="plus" size={17} color={theme.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 6 },
  main: { flex: 1, padding: PAD },
  thumb: {
    aspectRatio: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  playBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 8, left: 8, maxWidth: '80%' },
  name: { fontSize: 14, fontWeight: '600', lineHeight: 18, minHeight: 36 },
  cat: { fontSize: 11, marginTop: 2 },
  row: {
    height: ADD,
    justifyContent: 'center',
    marginTop: 8,
    paddingRight: ADD + 6,
  },
  price: { fontSize: 16, fontWeight: '700' },
  add: {
    position: 'absolute',
    right: PAD,
    bottom: PAD + LOW_LINE,
    width: ADD,
    height: ADD,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // minHeight: a whitespace-only line collapses to 0 on web, so reserve it explicitly.
  low: { fontSize: 10, lineHeight: 14, minHeight: 14, marginTop: 5, fontWeight: '600' },
});
