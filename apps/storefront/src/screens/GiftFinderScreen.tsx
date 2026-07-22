import type React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GIFT_OCCASIONS, GIFT_RECIPIENTS, GIFT_TYPES, type GiftMatch } from '@stockwell/shared';
import ProductCard from '../components/ProductCard';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import { type Product, findGifts } from '../api';

export default function GiftFinderScreen({
  theme,
  currency,
  onOpen,
  onAdd,
}: {
  theme: Theme;
  currency: string;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  const { t, giftReason } = useI18n();
  const [occasion, setOccasion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [age, setAge] = useState('');
  const [likes, setLikes] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [results, setResults] = useState<GiftMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const toggleType = (val: string) =>
    setTypes((v) => (v.includes(val) ? v.filter((x) => x !== val) : [...v, val]));

  const search = async () => {
    setSearching(true);
    setError('');
    try {
      const found = await findGifts({
        occasion: occasion || undefined,
        recipient: recipient || undefined,
        age: age ? Number(age) : undefined,
        likes: likes || undefined,
        types: types.length ? types : undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      });
      setResults(found);
    } catch {
      setError(t('gift.searchError'));
    } finally {
      setSearching(false);
    }
  };

  /* -------- results view -------- */
  if (results) {
    return (
      <FlatList
        data={results}
        key="gift-grid"
        numColumns={2}
        keyExtractor={(m) => m.product.id}
        contentContainerStyle={{ padding: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 6, marginBottom: 6 }}>
            <Pressable
              onPress={() => setResults(null)}
              style={({ pressed }) => [
                styles.refine,
                { backgroundColor: theme.card, borderRadius: theme.r.pill },
                theme.shadow,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="sliders" size={14} color={theme.accent} />
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
                {t('gift.refine')}
              </Text>
            </Pressable>
            <Text style={{ color: theme.sub, fontSize: 13, marginTop: 10 }}>
              {results.length ? t('gift.resultsCount', { count: results.length }) : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductCard
              product={item.product}
              theme={theme}
              currency={currency}
              onPress={() => onOpen(item.product)}
              onAdd={() => onAdd(item.product)}
            />
            {item.reasons.length > 0 && (
              <View style={styles.reasonWrap}>
                <Feather name="check-circle" size={11} color={theme.success} />
                <Text
                  style={{ color: theme.success, fontSize: 11, fontWeight: '600', flex: 1 }}
                  numberOfLines={2}
                >
                  {giftReason(item.reasons[0])}
                </Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="gift" size={36} color={theme.faint} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>
              {t('gift.noMatches')}
            </Text>
            <Text style={{ color: theme.sub, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              {t('gift.noMatchesSub')}
            </Text>
          </View>
        }
      />
    );
  }

  /* -------- filter form -------- */
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: theme.accentSoft, borderRadius: theme.r.lg }]}>
        <Feather name="gift" size={22} color={theme.accent} />
        <Text
          style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 }}
        >
          {t('gift.intro')}
        </Text>
      </View>

      <Section theme={theme} title={t('gift.occasionQ')}>
        <Chips
          theme={theme}
          t={t}
          prefix="gift.occasion"
          options={GIFT_OCCASIONS}
          selected={occasion ? [occasion] : []}
          onPress={(o) => setOccasion(o === occasion ? '' : o)}
        />
      </Section>

      <Section theme={theme} title={t('gift.recipientQ')}>
        <Chips
          theme={theme}
          t={t}
          prefix="gift.recipient"
          options={GIFT_RECIPIENTS}
          selected={recipient ? [recipient] : []}
          onPress={(r) => setRecipient(r === recipient ? '' : r)}
        />
      </Section>

      <Section theme={theme} title={t('gift.ageQ')}>
        <TextInput
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder={t('gift.agePlaceholder')}
          placeholderTextColor={theme.faint}
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderRadius: theme.r.md,
              width: 110,
            },
          ]}
        />
      </Section>

      <Section theme={theme} title={t('gift.likesQ')}>
        <TextInput
          value={likes}
          onChangeText={setLikes}
          placeholder={t('gift.likesPlaceholder')}
          placeholderTextColor={theme.faint}
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text, borderRadius: theme.r.md },
          ]}
        />
      </Section>

      <Section theme={theme} title={t('gift.typeQ')}>
        <Chips
          theme={theme}
          t={t}
          prefix="gift.type"
          options={GIFT_TYPES}
          selected={types}
          onPress={toggleType}
        />
      </Section>

      <Section theme={theme} title={t('gift.budgetQ')}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="number-pad"
            placeholder={t('gift.min')}
            placeholderTextColor={theme.faint}
            style={[
              styles.input,
              { backgroundColor: theme.card, color: theme.text, borderRadius: theme.r.md, flex: 1 },
            ]}
          />
          <Text style={{ color: theme.faint }}>—</Text>
          <TextInput
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="number-pad"
            placeholder={t('gift.max')}
            placeholderTextColor={theme.faint}
            style={[
              styles.input,
              { backgroundColor: theme.card, color: theme.text, borderRadius: theme.r.md, flex: 1 },
            ]}
          />
        </View>
      </Section>

      {error ? (
        <Text style={{ color: theme.danger, marginTop: 14, fontSize: 13 }}>{error}</Text>
      ) : null}

      <Pressable
        onPress={search}
        disabled={searching}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.accent, borderRadius: theme.r.lg },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        ]}
      >
        {searching ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <>
            <Feather name="search" size={17} color={theme.onAccent} />
            <Text style={{ color: theme.onAccent, fontSize: 16, fontWeight: '700' }}>
              {t('gift.find')}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Section({
  theme,
  title,
  children,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chips({
  theme,
  t,
  prefix,
  options,
  selected,
  onPress,
}: {
  theme: Theme;
  t: (key: string) => string;
  prefix: string;
  options: readonly string[];
  selected: string[];
  onPress: (o: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onPress(o)}
            style={[
              styles.chip,
              {
                borderRadius: theme.r.pill,
                backgroundColor: on ? theme.accent : theme.card,
                borderColor: on ? theme.accent : theme.border,
              },
            ]}
          >
            <Text
              style={{ color: on ? theme.onAccent : theme.sub, fontSize: 13, fontWeight: '600' }}
            >
              {t(`${prefix}.${o}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 28,
  },
  refine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reasonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    marginTop: -2,
    marginBottom: 8,
  },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
});
