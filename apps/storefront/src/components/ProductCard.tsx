import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import { type Theme, thumbColor, initials, money } from '../theme';
import { type Product, mediaUrl } from '../api';

export default function ProductCard({
  product,
  theme,
  currency,
  onPress,
  onAdd,
}: {
  product: Product;
  theme: Theme;
  currency: string;
  onPress: () => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  const low = product.inStock <= 10;
  const cover = product.media.find((m) => m.type === 'image') ?? product.media[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderRadius: theme.r.lg },
        theme.shadow,
        pressed && { transform: [{ scale: 0.975 }], opacity: 0.92 },
      ]}
    >
      <View
        style={[
          styles.thumb,
          {
            borderRadius: theme.r.md,
            backgroundColor: cover ? theme.muted : thumbColor(product.name),
          },
        ]}
      >
        {cover ? (
          <Image
            source={{ uri: mediaUrl(cover.url) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={styles.thumbText}>{initials(product.name)}</Text>
        )}
        {cover?.type === 'video' && (
          <View style={styles.playBadge}>
            <Feather name="play" size={14} color="#fff" />
          </View>
        )}
        {product.tag ? (
          <View style={[styles.tag, { backgroundColor: theme.accent }]}>
            <Text style={styles.tagText}>{product.tag}</Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>
        {product.name}
      </Text>
      <Text style={[styles.cat, { color: theme.faint }]} numberOfLines={1}>
        {product.category}
      </Text>

      <View style={styles.row}>
        <Text style={[styles.price, { color: theme.text }]}>{money(currency, product.price)}</Text>
        <Pressable
          onPress={onAdd}
          hitSlop={10}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: theme.accent },
            pressed && { transform: [{ scale: 0.9 }] },
          ]}
        >
          <Feather name="plus" size={17} color={theme.onAccent} />
        </Pressable>
      </View>
      {low ? (
        <Text style={[styles.low, { color: theme.warn }]}>
          {t('card.onlyLeft', { count: product.inStock })}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 10, margin: 6 },
  thumb: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  thumbText: { color: '#fff', fontSize: 24, fontWeight: '700' },
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
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', lineHeight: 18, minHeight: 36 },
  cat: { fontSize: 11, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: { fontSize: 16, fontWeight: '700' },
  add: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  low: { fontSize: 10, marginTop: 5, fontWeight: '600' },
});
