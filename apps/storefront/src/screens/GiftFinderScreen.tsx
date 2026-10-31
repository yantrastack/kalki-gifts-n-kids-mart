import type React from 'react';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  GIFT_BUDGET_BOUNDS,
  GIFT_BUDGETS,
  GIFT_OCCASIONS,
  GIFT_RECIPIENTS,
  GIFT_TYPES,
  type GiftBudget,
  type GiftBudgetCounts,
  type GiftMatch,
  type GiftOptions,
  budgetToPriceRange,
  money,
} from '@stockwell/shared';
import ProductCard from '../components/ProductCard';
import ThemedInput, { FOCUS_RING } from '../components/ThemedInput';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import { type Product, findGifts, getGiftBudgetCounts, getGiftOptions } from '../api';

/** Budget choice: a preset bucket, no limit, or a custom min/max. */
type BudgetChoice = GiftBudget | 'any' | 'custom';
const isPreset = (b: string): b is GiftBudget => (GIFT_BUDGETS as readonly string[]).includes(b);
const digitsOnly = (v: string) => v.replace(/\D/g, '');

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
  const { t, giftReason, giftTag } = useI18n();
  // Built-in choices show at once; words the shop added arrive with the fetch.
  const [options, setOptions] = useState<GiftOptions>({
    occasions: [...GIFT_OCCASIONS],
    types: [...GIFT_TYPES],
  });
  useEffect(() => {
    getGiftOptions().then(setOptions);
  }, []);
  const [occasion, setOccasion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [age, setAge] = useState('');
  const [likes, setLikes] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetChoice>('any');
  const [budgetCounts, setBudgetCounts] = useState<GiftBudgetCounts | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [results, setResults] = useState<GiftMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  // Hide presets with no in-stock products; if counts can't load, show them all.
  useEffect(() => {
    let alive = true;
    getGiftBudgetCounts().then((counts) => {
      if (!alive || !counts) return;
      setBudgetCounts(counts);
      setBudget((b) => (isPreset(b) && !counts[b] ? 'any' : b));
    });
    return () => {
      alive = false;
    };
  }, []);

  const budgetOptions: BudgetChoice[] = [
    'any',
    ...GIFT_BUDGETS.filter((b) => !budgetCounts || budgetCounts[b] > 0),
    'custom',
  ];
  const budgetLabel = (b: string) => {
    if (!isPreset(b)) return t(`gift.budget.${b}`);
    const { min, below } = GIFT_BUDGET_BOUNDS[b];
    if (min === null) return t('gift.budget.under', { amount: money(currency, below ?? 0, 0) });
    if (below === null) return t('gift.budget.above', { amount: money(currency, min, 0) });
    return t('gift.budget.between', {
      from: money(currency, min, 0),
      to: money(currency, below, 0),
    });
  };
  const customInvalid =
    budget === 'custom' && !!minPrice && !!maxPrice && Number(minPrice) > Number(maxPrice);

  const toggleType = (val: string) =>
    setTypes((v) => (v.includes(val) ? v.filter((x) => x !== val) : [...v, val]));

  const search = async () => {
    if (customInvalid) return;
    const priceRange = isPreset(budget)
      ? budgetToPriceRange(budget)
      : budget === 'custom'
        ? {
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
          }
        : {};
    setSearching(true);
    setError('');
    try {
      const found = await findGifts({
        occasion: occasion || undefined,
        recipient: recipient || undefined,
        age: age ? Number(age) : undefined,
        likes: likes || undefined,
        types: types.length ? types : undefined,
        ...priceRange,
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
          label={(o) => giftTag('occasion', o)}
          options={options.occasions}
          selected={occasion ? [occasion] : []}
          onPress={(o) => setOccasion(o === occasion ? '' : o)}
        />
      </Section>

      <Section theme={theme} title={t('gift.recipientQ')}>
        <Chips
          theme={theme}
          label={(r) => t(`gift.recipient.${r}`)}
          options={GIFT_RECIPIENTS}
          selected={recipient ? [recipient] : []}
          onPress={(r) => setRecipient(r === recipient ? '' : r)}
        />
      </Section>

      <Section theme={theme} title={t('gift.budgetQ')}>
        <Chips
          theme={theme}
          options={budgetOptions}
          label={budgetLabel}
          selected={[budget]}
          onPress={(b) => setBudget(b === budget ? 'any' : (b as BudgetChoice))}
        />
        {budget === 'custom' && (
          <>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <ThemedInput
                theme={theme}
                value={minPrice}
                onChangeText={(v) => setMinPrice(digitsOnly(v))}
                keyboardType="number-pad"
                placeholder={t('gift.min')}
                placeholderTextColor={theme.faint}
                accessibilityLabel={t('gift.min')}
                containerStyle={[
                  styles.input,
                  { backgroundColor: theme.card, borderRadius: theme.r.md, flex: 1 },
                ]}
                inputStyle={[styles.inputText, { color: theme.text }]}
              />
              <Text style={{ color: theme.faint }}>—</Text>
              <ThemedInput
                theme={theme}
                value={maxPrice}
                onChangeText={(v) => setMaxPrice(digitsOnly(v))}
                keyboardType="number-pad"
                placeholder={t('gift.max')}
                placeholderTextColor={theme.faint}
                accessibilityLabel={t('gift.max')}
                containerStyle={[
                  styles.input,
                  { backgroundColor: theme.card, borderRadius: theme.r.md, flex: 1 },
                ]}
                inputStyle={[styles.inputText, { color: theme.text }]}
              />
            </View>
            {customInvalid ? (
              <Text
                accessibilityRole="alert"
                style={{ color: theme.danger, marginTop: 8, fontSize: 13 }}
              >
                {t('gift.minAboveMax')}
              </Text>
            ) : null}
          </>
        )}
      </Section>

      <Section theme={theme} title={t('gift.ageQ')}>
        <ThemedInput
          theme={theme}
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder={t('gift.agePlaceholder')}
          placeholderTextColor={theme.faint}
          accessibilityLabel={t('gift.ageQ')}
          containerStyle={[
            styles.input,
            { backgroundColor: theme.card, borderRadius: theme.r.md, width: 110 },
          ]}
          inputStyle={[styles.inputText, { color: theme.text }]}
        />
      </Section>

      <Section theme={theme} title={t('gift.likesQ')}>
        <ThemedInput
          theme={theme}
          value={likes}
          onChangeText={setLikes}
          placeholder={t('gift.likesPlaceholder')}
          placeholderTextColor={theme.faint}
          accessibilityLabel={t('gift.likesQ')}
          containerStyle={[styles.input, { backgroundColor: theme.card, borderRadius: theme.r.md }]}
          inputStyle={[styles.inputText, { color: theme.text }]}
        />
      </Section>

      <Section theme={theme} title={t('gift.typeQ')}>
        <Chips
          theme={theme}
          label={(o) => giftTag('type', o)}
          options={options.types}
          selected={types}
          onPress={toggleType}
        />
      </Section>

      {error ? (
        <Text style={{ color: theme.danger, marginTop: 14, fontSize: 13 }}>{error}</Text>
      ) : null}

      <Pressable
        onPress={search}
        disabled={searching || customInvalid}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.accent, borderRadius: theme.r.lg },
          pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
          customInvalid && { opacity: 0.5 },
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
  label,
  options,
  selected,
  onPress,
}: {
  theme: Theme;
  label: (option: string) => string;
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
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
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
              {label(o)}
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
  // Padding is reduced by the reserved focus-ring border so inputs keep their size.
  input: { paddingHorizontal: 14 - FOCUS_RING },
  inputText: { paddingVertical: 11 - FOCUS_RING, fontSize: 15 },
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
