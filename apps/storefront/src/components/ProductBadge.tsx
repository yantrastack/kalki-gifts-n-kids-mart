import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { giftTagLabel, productBadgeKey } from '@stockwell/shared';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';

/**
 * The one product badge ("Bestseller", "New", …) used on cards, the product page and
 * Discover. Known codes are translated; a word the shop typed itself is shown as typed.
 * Solid, contrast-safe accent (white text ≥ 4.5:1) so it stays readable over photos.
 */
export default function ProductBadge({
  tag,
  theme,
  style,
}: {
  tag: string | null | undefined;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const key = productBadgeKey(tag);
  if (!key) return null;
  const path = `badge.${key}`;
  const translated = t(path);
  const label =
    translated === path ? giftTagLabel(key).replace(/^\w/, (c) => c.toUpperCase()) : translated;

  return (
    <View style={[styles.badge, { backgroundColor: theme.accentInk }, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '100%',
  },
  text: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
