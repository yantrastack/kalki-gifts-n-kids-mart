import { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/Skeleton';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import type { Product } from '../api';

export default function HomeScreen({
  products,
  theme,
  currency,
  loading,
  onOpen,
  onAdd,
  onGift,
}: {
  products: Product[];
  theme: Theme;
  currency: string;
  loading: boolean;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
  onGift: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const cats = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const filtered = products.filter(
    (p) =>
      (cat === 'All' || p.category === cat) &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase())),
  );

  const header = (
    <View style={{ paddingHorizontal: 6 }}>
      <Pressable
        onPress={onGift}
        style={({ pressed }) => [
          styles.giftBanner,
          { backgroundColor: theme.accent, borderRadius: theme.r.lg },
          theme.shadow,
          pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={styles.giftIcon}>
          <Feather name="gift" size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.onAccent, fontSize: 15, fontWeight: '700' }}>
            {t('home.giftBannerTitle')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 }}>
            {t('home.giftBannerSub')}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.onAccent} />
      </Pressable>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.card, borderRadius: theme.r.pill },
          theme.shadow,
        ]}
      >
        <Feather name="search" size={17} color={theme.faint} style={{ marginRight: 8 }} />
        <TextInput
          placeholder={t('common.search')}
          placeholderTextColor={theme.faint}
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1, color: theme.text, paddingVertical: 12, fontSize: 15 }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Feather name="x" size={16} color={theme.faint} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginVertical: 12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {cats.map((c) => {
          const active = c === cat;
          return (
            <Pressable
              key={c}
              onPress={() => setCat(c)}
              style={[
                styles.chip,
                {
                  borderRadius: theme.r.pill,
                  backgroundColor: active ? theme.accent : theme.card,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.onAccent : theme.sub,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {c === 'All' ? t('common.all') : c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={{ padding: 12 }}>
        <Skeleton theme={theme} style={{ height: 46, borderRadius: theme.r.pill }} />
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
          {[70, 90, 80].map((w, i) => (
            <Skeleton
              key={i}
              theme={theme}
              style={{ width: w, height: 32, borderRadius: theme.r.pill }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: '50%', padding: 6 }}>
              <Skeleton theme={theme} style={{ aspectRatio: 0.72, borderRadius: theme.r.lg }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      key="grid"
      numColumns={2}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 8, paddingBottom: 110 }}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          theme={theme}
          currency={currency}
          onPress={() => onOpen(item)}
          onAdd={() => onAdd(item)}
        />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="package" size={36} color={theme.faint} />
          <Text style={{ color: theme.sub, marginTop: 10, fontSize: 15 }}>
            {t('home.noResults')}
          </Text>
          <Text style={{ color: theme.faint, marginTop: 2, fontSize: 13 }}>
            {t('home.noResultsSub')}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  giftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 12,
  },
  giftIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  chip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9 },
  empty: { alignItems: 'center', marginTop: 60 },
});
