import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
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
  type GiftFinderResponse,
  type GiftMatch,
  type GiftOptions,
  type GiftQuery,
  budgetToPriceRange,
  money,
  parseGiftAge,
} from '@stockwell/shared';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/Skeleton';
import ThemedInput, { FOCUS_RING } from '../components/ThemedInput';
import { useFocusRing } from '../components/focusRing';
import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import { type Product, findGifts, getGiftBudgetCounts, getGiftOptions } from '../api';

/** Budget choice: a preset bucket, no limit, or a custom min/max. */
type BudgetChoice = GiftBudget | 'any' | 'custom';
const isPreset = (b: string): b is GiftBudget => (GIFT_BUDGETS as readonly string[]).includes(b);
const digitsOnly = (v: string) => v.replace(/\D/g, '');

/** Every answer on the form; '' / [] / 'any' = not answered. */
type Answers = {
  occasion: string;
  recipient: string;
  age: string;
  likes: string;
  types: string[];
  budget: BudgetChoice;
  minPrice: string;
  maxPrice: string;
};
const NO_ANSWERS: Answers = {
  occasion: '',
  recipient: '',
  age: '',
  likes: '',
  types: [],
  budget: 'any',
  minPrice: '',
  maxPrice: '',
};

const ageInvalid = (a: Answers) => a.age !== '' && parseGiftAge(a.age) === null;
const rangeInvalid = (a: Answers) =>
  a.budget === 'custom' && !!a.minPrice && !!a.maxPrice && Number(a.minPrice) > Number(a.maxPrice);

const toQuery = (a: Answers): GiftQuery => ({
  occasion: a.occasion || undefined,
  recipient: a.recipient || undefined,
  age: parseGiftAge(a.age) ?? undefined,
  likes: a.likes.trim() || undefined,
  types: a.types.length ? a.types : undefined,
  ...(isPreset(a.budget)
    ? budgetToPriceRange(a.budget)
    : a.budget === 'custom'
      ? {
          minPrice: a.minPrice ? Number(a.minPrice) : undefined,
          maxPrice: a.maxPrice ? Number(a.maxPrice) : undefined,
        }
      : {}),
});

/** One answer shown on the results view; tapping it removes that answer. */
type Pill = { key: string; label: string; suggestion: string; clear: (a: Answers) => Answers };

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
  // Built-in choices show at once; words the shop added (and stock counts) arrive with the fetch.
  const [options, setOptions] = useState<GiftOptions>({
    occasions: [...GIFT_OCCASIONS],
    types: [...GIFT_TYPES],
  });
  useEffect(() => {
    getGiftOptions().then(setOptions);
  }, []);

  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const [budgetCounts, setBudgetCounts] = useState<GiftBudgetCounts | null>(null);
  // Hide presets with no in-stock products; if counts can't load, show them all.
  useEffect(() => {
    let alive = true;
    getGiftBudgetCounts().then((counts) => {
      if (!alive || !counts) return;
      setBudgetCounts(counts);
      setAnswers((a) => (isPreset(a.budget) && !counts[a.budget] ? { ...a, budget: 'any' } : a));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Results: the answers they were found for, the response, and the request state.
  const [showResults, setShowResults] = useState(false);
  const [submitted, setSubmitted] = useState<Answers>(NO_ANSWERS);
  const [response, setResponse] = useState<GiftFinderResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  // Only the latest request may update the screen (pills can fire requests back to back).
  const requestId = useRef(0);

  const run = async (a: Answers, keepPrevious = false) => {
    if (ageInvalid(a) || rangeInvalid(a)) return;
    const id = ++requestId.current;
    setSubmitted(a);
    setShowResults(true);
    setStatus('loading');
    if (!keepPrevious) setResponse(null);
    try {
      const found = await findGifts(toQuery(a));
      if (id !== requestId.current) return;
      setResponse(found);
      setStatus('idle');
    } catch {
      if (id === requestId.current) setStatus('error');
    }
  };

  const startOver = () => {
    requestId.current++; // drop any request still in flight
    setAnswers(NO_ANSWERS);
    setSubmitted(NO_ANSWERS);
    setResponse(null);
    setStatus('idle');
    setShowResults(false);
  };

  const budgetOptions: BudgetChoice[] = [
    'any',
    ...GIFT_BUDGETS.filter((b) => !budgetCounts || budgetCounts[b] > 0),
    'custom',
  ];
  const whole = (n: number) => money(currency, n, 0);
  const budgetLabel = (b: string) => {
    if (!isPreset(b)) return t(`gift.budget.${b}`);
    const { min, below } = GIFT_BUDGET_BOUNDS[b];
    if (min === null) return t('gift.budget.under', { amount: whole(below ?? 0) });
    if (below === null) return t('gift.budget.above', { amount: whole(min) });
    return t('gift.budget.between', { from: whole(min), to: whole(below) });
  };

  const pillsFor = (a: Answers): Pill[] => {
    const pills: Pill[] = [];
    const add = (key: string, label: string, clear: Pill['clear'], suggestion?: string) =>
      pills.push({
        key,
        label,
        clear,
        suggestion: suggestion ?? t('gift.removeFilter', { filter: label }),
      });
    if (a.occasion) {
      add('occasion', giftTag('occasion', a.occasion), (x) => ({ ...x, occasion: '' }));
    }
    if (a.recipient) {
      add('recipient', t(`gift.recipient.${a.recipient}`), (x) => ({ ...x, recipient: '' }));
    }
    const age = parseGiftAge(a.age);
    if (age !== null) add('age', t('gift.pill.age', { age }), (x) => ({ ...x, age: '' }));
    let budget = '';
    if (isPreset(a.budget)) budget = budgetLabel(a.budget);
    else if (a.budget === 'custom' && a.minPrice && a.maxPrice) {
      budget = t('gift.budget.between', {
        from: whole(Number(a.minPrice)),
        to: whole(Number(a.maxPrice)),
      });
    } else if (a.budget === 'custom' && a.minPrice) {
      budget = t('gift.budget.above', { amount: whole(Number(a.minPrice)) });
    } else if (a.budget === 'custom' && a.maxPrice) {
      budget = t('gift.pill.upTo', { amount: whole(Number(a.maxPrice)) });
    }
    if (budget) {
      add(
        'budget',
        budget,
        (x) => ({ ...x, budget: 'any', minPrice: '', maxPrice: '' }),
        t('gift.anyBudget'),
      );
    }
    if (a.likes.trim()) {
      add('likes', t('gift.pill.likes', { likes: a.likes.trim() }), (x) => ({ ...x, likes: '' }));
    }
    for (const type of a.types) {
      add(`type:${type}`, giftTag('type', type), (x) => ({
        ...x,
        types: x.types.filter((v) => v !== type),
      }));
    }
    return pills;
  };

  const removePill = (p: Pill) => {
    const next = p.clear(submitted);
    setAnswers(next);
    run(next, true);
  };

  /* -------- results view -------- */
  if (showResults) {
    const pills = pillsFor(submitted);
    const matches = response?.matches ?? [];
    const alternatives = response?.alternatives ?? [];
    const relaxed = response?.relaxed ?? [];
    const refreshing = status === 'loading' && !!response;

    let body: React.ReactNode;
    if (status === 'error') {
      body = (
        <View style={styles.empty} accessibilityRole="alert">
          <Feather name="wifi-off" size={32} color={theme.faint} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('gift.searchError')}</Text>
          <Btn
            theme={theme}
            icon="refresh-cw"
            label={t('common.retry')}
            onPress={() => run(submitted, true)}
            style={{ marginTop: 16 }}
          />
        </View>
      );
    } else if (!response) {
      body = <SkeletonGrid theme={theme} label={t('gift.loading')} />;
    } else {
      body = (
        <View
          style={refreshing && { opacity: 0.5 }}
          aria-busy={refreshing}
          pointerEvents={refreshing ? 'none' : 'auto'}
        >
          {matches.length > 0 ? (
            <>
              <SectionTitle theme={theme}>
                {alternatives.length
                  ? t('gift.bestMatches')
                  : t('gift.resultsCount', { count: matches.length })}
              </SectionTitle>
              <Grid
                items={matches}
                theme={theme}
                currency={currency}
                giftReason={giftReason}
                onOpen={onOpen}
                onAdd={onAdd}
              />
            </>
          ) : (
            <View style={styles.empty}>
              <Feather name="gift" size={36} color={theme.faint} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {pills.length ? t('gift.noExact') : t('gift.noMatches')}
              </Text>
              <Text style={[styles.emptySub, { color: theme.sub }]}>
                {pills.length ? t('gift.noExactSub') : t('gift.noMatchesSub')}
              </Text>
              <View style={[styles.wrapRow, { justifyContent: 'center', marginTop: 14 }]}>
                {pills.map((p) => (
                  <Btn
                    key={p.key}
                    theme={theme}
                    variant="secondary"
                    icon="x"
                    label={p.suggestion}
                    onPress={() => removePill(p)}
                  />
                ))}
                <Btn
                  theme={theme}
                  variant="secondary"
                  icon="sliders"
                  label={t('gift.editAnswers')}
                  onPress={() => setShowResults(false)}
                />
              </View>
            </View>
          )}

          {alternatives.length > 0 && (
            <>
              <SectionTitle theme={theme}>{t('gift.alsoLike')}</SectionTitle>
              <Text style={[styles.note, { color: theme.sub }]}>
                {relaxed.length
                  ? t('gift.relaxedNote', {
                      fields: relaxed.map((r) => t(`gift.relaxed.${r}`)).join(', '),
                    })
                  : t('gift.relaxedNone')}
              </Text>
              <Grid
                items={alternatives}
                theme={theme}
                currency={currency}
                giftReason={giftReason}
                onOpen={onOpen}
                onAdd={onAdd}
              />
            </>
          )}
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={{ padding: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
          <View style={[styles.wrapRow, { alignItems: 'center' }]}>
            <Btn
              theme={theme}
              variant="secondary"
              icon="sliders"
              label={t('gift.editAnswers')}
              onPress={() => setShowResults(false)}
            />
            <Btn
              theme={theme}
              variant="secondary"
              icon="rotate-ccw"
              label={t('gift.startOver')}
              onPress={startOver}
            />
            {refreshing && (
              <ActivityIndicator
                color={theme.accent}
                accessibilityLabel={t('gift.loading')}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
          {pills.length > 0 && (
            <View
              style={[styles.wrapRow, { marginTop: 12 }]}
              role="group"
              aria-label={t('gift.yourAnswers')}
            >
              {pills.map((p) => (
                <FilterPill
                  key={p.key}
                  theme={theme}
                  label={p.label}
                  a11yLabel={t('gift.removeFilter', { filter: p.label })}
                  onPress={() => removePill(p)}
                />
              ))}
            </View>
          )}
        </View>
        {body}
      </ScrollView>
    );
  }

  /* -------- question form -------- */
  const answered = pillsFor(answers).length;
  const blocked = ageInvalid(answers) || rangeInvalid(answers);
  const typeCounts = options.typeCounts;
  const field = (width?: number): StyleProp<ViewStyle> => [
    styles.input,
    { backgroundColor: theme.card, borderRadius: theme.r.md },
    width ? { width } : { flex: 1 },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.hero, { backgroundColor: theme.accentSoft, borderRadius: theme.r.lg }]}
        >
          <Feather name="gift" size={22} color={theme.accent} />
          <Text
            style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 }}
          >
            {t('gift.intro')}
          </Text>
        </View>

        <Section theme={theme} icon="calendar" title={t('gift.occasionQ')}>
          <Chips
            theme={theme}
            label={(o) => giftTag('occasion', o)}
            options={options.occasions}
            selected={answers.occasion ? [answers.occasion] : []}
            onPress={(o) => set('occasion', o === answers.occasion ? '' : o)}
          />
        </Section>

        <Section theme={theme} icon="user" title={t('gift.recipientQ')}>
          <Chips
            theme={theme}
            label={(r) => t(`gift.recipient.${r}`)}
            options={GIFT_RECIPIENTS}
            selected={answers.recipient ? [answers.recipient] : []}
            onPress={(r) => set('recipient', r === answers.recipient ? '' : r)}
          />
          <Text style={[styles.subLabel, { color: theme.text }]}>{t('gift.ageQ')}</Text>
          <ThemedInput
            theme={theme}
            value={answers.age}
            onChangeText={(v) => set('age', digitsOnly(v))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
            placeholder={t('gift.agePlaceholder')}
            placeholderTextColor={theme.faint}
            accessibilityLabel={t('gift.ageQ')}
            accessibilityHint={t('gift.ageHelp')}
            containerStyle={field(110)}
            inputStyle={[styles.inputText, { color: theme.text }]}
          />
          {ageInvalid(answers) ? (
            <Text accessibilityRole="alert" style={[styles.help, { color: theme.danger }]}>
              {t('gift.ageInvalid')}
            </Text>
          ) : (
            <Text style={[styles.help, { color: theme.sub }]}>{t('gift.ageHelp')}</Text>
          )}
        </Section>

        <Section theme={theme} icon="tag" title={t('gift.budgetQ')}>
          <Chips
            theme={theme}
            options={budgetOptions}
            label={budgetLabel}
            selected={[answers.budget]}
            onPress={(b) => set('budget', b === answers.budget ? 'any' : (b as BudgetChoice))}
          />
          {answers.budget === 'custom' && (
            <>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 }}>
                <ThemedInput
                  theme={theme}
                  value={answers.minPrice}
                  onChangeText={(v) => set('minPrice', digitsOnly(v))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder={t('gift.min')}
                  placeholderTextColor={theme.faint}
                  accessibilityLabel={t('gift.min')}
                  containerStyle={field()}
                  inputStyle={[styles.inputText, { color: theme.text }]}
                />
                <Text style={{ color: theme.faint }}>—</Text>
                <ThemedInput
                  theme={theme}
                  value={answers.maxPrice}
                  onChangeText={(v) => set('maxPrice', digitsOnly(v))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder={t('gift.max')}
                  placeholderTextColor={theme.faint}
                  accessibilityLabel={t('gift.max')}
                  containerStyle={field()}
                  inputStyle={[styles.inputText, { color: theme.text }]}
                />
              </View>
              {rangeInvalid(answers) ? (
                <Text accessibilityRole="alert" style={[styles.help, { color: theme.danger }]}>
                  {t('gift.minAboveMax')}
                </Text>
              ) : null}
            </>
          )}
        </Section>

        <Section theme={theme} icon="heart" title={t('gift.likesQ')}>
          <ThemedInput
            theme={theme}
            value={answers.likes}
            onChangeText={(v) => set('likes', v)}
            placeholder={t('gift.likesPlaceholder')}
            placeholderTextColor={theme.faint}
            accessibilityLabel={t('gift.likesQ')}
            containerStyle={field()}
            inputStyle={[styles.inputText, { color: theme.text }]}
          />
        </Section>

        <Section theme={theme} icon="package" title={t('gift.typeQ')}>
          <Chips
            theme={theme}
            multi
            label={(o) => giftTag('type', o)}
            options={options.types}
            selected={answers.types}
            // A type with nothing in stock can't be picked (it can still be un-picked).
            isDisabled={(o) => !!typeCounts && !typeCounts[o] && !answers.types.includes(o)}
            disabledHint={t('gift.typeNone')}
            onPress={(o) =>
              set(
                'types',
                answers.types.includes(o)
                  ? answers.types.filter((x) => x !== o)
                  : [...answers.types, o],
              )
            }
          />
        </Section>
      </ScrollView>

      {/* Always-visible actions, so Find gifts is reachable without scrolling. */}
      <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
        <Btn
          theme={theme}
          variant="secondary"
          label={t('gift.clearAll')}
          onPress={() => setAnswers(NO_ANSWERS)}
          disabled={JSON.stringify(answers) === JSON.stringify(NO_ANSWERS)}
        />
        <Btn
          theme={theme}
          icon="search"
          label={t('gift.find')}
          a11yLabel={answered ? t('gift.findCount', { count: answered }) : t('gift.find')}
          badge={answered || undefined}
          onPress={() => run(answers)}
          disabled={blocked}
          busy={status === 'loading'}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ pieces */

function SectionTitle({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={2}
      style={{
        color: theme.text,
        fontSize: 15,
        fontWeight: '700',
        marginTop: 18,
        marginBottom: 4,
        paddingHorizontal: 12,
      }}
    >
      {children}
    </Text>
  );
}

function Section({
  theme,
  icon,
  title,
  children,
}: {
  theme: Theme;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Feather name={icon} size={15} color={theme.accent} />
        <Text
          accessibilityRole="header"
          aria-level={2}
          style={{ color: theme.text, fontSize: 14, fontWeight: '700', flex: 1 }}
        >
          {title}
        </Text>
      </View>
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
  multi,
  isDisabled,
  disabledHint,
}: {
  theme: Theme;
  label: (option: string) => string;
  options: readonly string[];
  selected: string[];
  onPress: (o: string) => void;
  multi?: boolean;
  isDisabled?: (o: string) => boolean;
  disabledHint?: string;
}) {
  return (
    <View style={styles.wrapRow} role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <Chip
          key={o}
          theme={theme}
          label={label(o)}
          on={selected.includes(o)}
          multi={multi}
          disabled={isDisabled?.(o) ?? false}
          disabledHint={disabledHint}
          onPress={() => onPress(o)}
        />
      ))}
    </View>
  );
}

function Chip({
  theme,
  label,
  on,
  multi,
  disabled,
  disabledHint,
  onPress,
}: {
  theme: Theme;
  label: string;
  on: boolean;
  multi?: boolean;
  disabled: boolean;
  disabledHint?: string;
  onPress: () => void;
}) {
  const { handlers, ring } = useFocusRing(theme, theme.r.pill);
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      disabled={disabled}
      // aria-* props: react-native-web ignores accessibilityState.
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      aria-disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={disabled ? disabledHint : undefined}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.r.pill,
          backgroundColor: on ? theme.accentInk : disabled ? theme.muted : theme.card,
          borderColor: on ? theme.accentInk : theme.border,
          borderStyle: disabled ? 'dashed' : 'solid',
        },
        pressed && { transform: [{ scale: 0.97 }] },
        ring,
      ]}
    >
      {on && <Feather name="check" size={13} color={theme.onAccent} />}
      <Text
        style={{
          color: on ? theme.onAccent : disabled ? theme.faint : theme.sub,
          fontSize: 13,
          fontWeight: '600',
          textDecorationLine: disabled ? 'line-through' : 'none',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Primary (filled) or secondary (card) action button with an optional count badge. */
function Btn({
  theme,
  label,
  onPress,
  icon,
  variant = 'primary',
  a11yLabel,
  badge,
  disabled,
  busy,
  style,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  variant?: 'primary' | 'secondary';
  a11yLabel?: string;
  badge?: number;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === 'primary';
  const radius = primary ? theme.r.lg : theme.r.pill;
  const { handlers, ring } = useFocusRing(theme, radius);
  const fg = primary ? theme.onAccent : theme.text;
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      aria-disabled={!!disabled}
      aria-busy={!!busy}
      style={({ pressed }) => [
        primary ? styles.cta : styles.secondary,
        primary
          ? { backgroundColor: theme.accent, borderRadius: radius }
          : {
              backgroundColor: theme.card,
              borderRadius: radius,
              borderColor: theme.border,
            },
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.5 },
        ring,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && (
            <Feather name={icon} size={primary ? 17 : 14} color={primary ? fg : theme.accent} />
          )}
          <Text
            style={{ color: fg, fontSize: primary ? 16 : 13, fontWeight: primary ? '700' : '600' }}
          >
            {label}
          </Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: theme.onAccent }]}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>{badge}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function FilterPill({
  theme,
  label,
  a11yLabel,
  onPress,
}: {
  theme: Theme;
  label: string;
  a11yLabel: string;
  onPress: () => void;
}) {
  const { handlers, ring } = useFocusRing(theme, theme.r.pill);
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.accentSoft, borderRadius: theme.r.pill },
        pressed && { opacity: 0.8 },
        ring,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: theme.text, fontSize: 12, fontWeight: '600', maxWidth: 200 }}
      >
        {label}
      </Text>
      <Feather name="x" size={13} color={theme.sub} />
    </Pressable>
  );
}

function Grid({
  items,
  theme,
  currency,
  giftReason,
  onOpen,
  onAdd,
}: {
  items: GiftMatch[];
  theme: Theme;
  currency: string;
  giftReason: ReturnType<typeof useI18n>['giftReason'];
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  return (
    <View style={styles.grid}>
      {items.map((m) => (
        <View key={m.product.id} style={styles.cell}>
          <ProductCard
            product={m.product}
            theme={theme}
            currency={currency}
            onPress={() => onOpen(m.product)}
            onAdd={() => onAdd(m.product)}
          />
          {m.reasons.slice(0, 2).map((r) => (
            <View key={r.code} style={styles.reasonWrap}>
              <Feather name="check-circle" size={11} color={theme.success} />
              <Text
                style={{ color: theme.success, fontSize: 11, fontWeight: '600', flex: 1 }}
                numberOfLines={2}
              >
                {giftReason(r)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SkeletonGrid({ theme, label }: { theme: Theme; label: string }) {
  return (
    <View style={[styles.grid, { marginTop: 14 }]} accessible accessibilityLabel={label} aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.cell}>
          <View
            style={[styles.skeletonCard, { backgroundColor: theme.card, borderRadius: theme.r.lg }]}
          >
            <Skeleton theme={theme} style={{ aspectRatio: 1, marginBottom: 10 }} />
            <Skeleton theme={theme} style={{ height: 14, width: '80%', marginBottom: 6 }} />
            <Skeleton theme={theme} style={{ height: 12, width: '45%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subLabel: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  help: { fontSize: 12, marginTop: 6 },
  // Padding is reduced by the reserved focus-ring border so inputs keep their size.
  input: { paddingHorizontal: 14 - FOCUS_RING },
  inputText: { paddingVertical: 11 - FOCUS_RING, fontSize: 15 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%' },
  skeletonCard: { flex: 1, padding: 10, margin: 6 },
  note: { fontSize: 12, paddingHorizontal: 12, marginBottom: 2 },
  reasonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    marginTop: -2,
    marginBottom: 6,
  },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontWeight: '700', fontSize: 16, marginTop: 12, textAlign: 'center' },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
});
