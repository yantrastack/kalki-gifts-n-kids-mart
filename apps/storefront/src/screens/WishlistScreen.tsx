import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import { type Theme, money } from '../theme';
import { getProductsByIds, mediaUrl, type Product } from '../api';
import ProductImage from '../components/ProductImage';
import Skeleton from '../components/Skeleton';
import { useFocusRing } from '../components/focusRing';
import { SAVED_TINT } from '../components/WishlistHeart';
import { useWishlist } from '../wishlistStore';
import { resolveWishlist, type WishlistRow } from '../wishlist';

/**
 * Saved products (YAN-111). The ids come from the shared wishlist store; price and stock
 * are looked up fresh each time the screen opens. A product that sold out or that the
 * shop no longer lists stays in the list, greyed out as unavailable, until it is removed.
 */
export default function WishlistScreen({
  theme,
  currency,
  onOpen,
  onAdd,
  onBrowse,
}: {
  theme: Theme;
  currency: string;
  onOpen: (p: Product) => void;
  /** Adds one; false when the cart already holds all the stock. */
  onAdd: (p: Product) => boolean;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  const { entries, remove } = useWishlist();
  // Fresh product data by id, and every id already looked up (found or not).
  const [fresh, setFresh] = useState<Map<string, Product>>(new Map());
  const looked = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(entries.length > 0);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);

  const lookUp = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setError(false);
    try {
      const found = await getProductsByIds(ids);
      for (const id of ids) looked.current.add(id);
      setFresh((prev) => {
        const next = new Map(prev);
        for (const p of found) next.set(p.id, p);
        return next;
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Look up saved ids not seen yet: all of them on open, then any saved in another tab.
  const pending = entries.filter((e) => !looked.current.has(e.id)).map((e) => e.id);
  const pendingKey = pending.join(',');
  useEffect(() => {
    if (pendingKey) lookUp(pendingKey.split(','));
  }, [pendingKey, lookUp]);

  const retry = () => {
    setLoading(true);
    lookUp(entries.map((e) => e.id));
  };

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(id);
  }, [note]);

  const rows = useMemo(
    () =>
      resolveWishlist(
        entries.filter((e) => looked.current.has(e.id)),
        [...fresh.values()],
      ),
    // `looked` is a ref filled together with `fresh`, so `fresh` covers it.
    [entries, fresh],
  );

  const add = (p: Product) => {
    const text = onAdd(p) ? t('reels.added') : t('reels.maxInCart', { count: p.inStock });
    setNote({ id: Date.now(), text });
  };

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="heart-outline" size={32} color={theme.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('wishlist.empty')}</Text>
        <Text style={[styles.emptySub, { color: theme.sub }]}>{t('wishlist.emptySub')}</Text>
        <Pressable
          onPress={onBrowse}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.browse,
            { backgroundColor: theme.accent, borderRadius: theme.r.pill },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: '700', fontSize: 14 }}>
            {t('wishlist.continue')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (error && rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="wifi-off" size={32} color={theme.faint} />
        <Text style={[styles.emptySub, { color: theme.sub, marginTop: 12 }]}>
          {t('wishlist.loadError')}
        </Text>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.browse,
            { backgroundColor: theme.accent, borderRadius: theme.r.pill },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: '700' }}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={{ padding: 14 }} accessibilityRole="progressbar">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} theme={theme} style={{ height: 108, marginBottom: 10 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        ListHeaderComponent={
          <Text style={[styles.count, { color: theme.sub }]}>
            {t('wishlist.count', { count: entries.length })}
          </Text>
        }
        renderItem={({ item }) => (
          <Row
            row={item}
            theme={theme}
            currency={currency}
            t={t}
            onOpen={onOpen}
            onAdd={add}
            onRemove={() => remove(item.id)}
          />
        )}
      />
      {note && (
        <View
          key={note.id}
          style={[styles.note, { backgroundColor: theme.text, borderRadius: theme.r.pill }]}
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.noteText}>{note.text}</Text>
        </View>
      )}
    </View>
  );
}

function Row({
  row,
  theme,
  currency,
  t,
  onOpen,
  onAdd,
  onRemove,
}: {
  row: WishlistRow;
  theme: Theme;
  currency: string;
  t: (k: string, p?: any) => string;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
  onRemove: () => void;
}) {
  const openRing = useFocusRing(theme, theme.r.md);
  const addRing = useFocusRing(theme, theme.r.pill);
  const removeRing = useFocusRing(theme, theme.r.pill);
  const p = row.product;
  const available = row.status === 'available' && !!p;
  const name = row.name || t('wishlist.unknownProduct');
  const cover = p?.media.find((m) => m.type === 'image');
  const low = !!p && p.inStock > 0 && p.inStock <= 10;
  const price = p ? money(currency, p.price) : null;

  const body = (
    <>
      <View style={[styles.thumb, { borderRadius: theme.r.md, backgroundColor: theme.muted }]}>
        <ProductImage
          uri={cover ? mediaUrl(cover.url) : null}
          label={t('card.photo', { name })}
          theme={theme}
          style={StyleSheet.absoluteFill}
          transition={150}
          iconSize={20}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {name}
        </Text>
        {price ? <Text style={[styles.price, { color: theme.text }]}>{price}</Text> : null}
        <View style={styles.statusRow}>
          {available ? (
            <Text style={[styles.status, { color: low ? theme.warn : theme.success }]}>
              {low ? t('product.onlyLeft', { count: p!.inStock }) : t('product.inStock')}
            </Text>
          ) : (
            <>
              <View
                style={[styles.pill, { backgroundColor: theme.muted, borderRadius: theme.r.pill }]}
              >
                <Text style={[styles.pillText, { color: theme.sub }]}>
                  {t('wishlist.unavailable')}
                </Text>
              </View>
              <Text style={[styles.status, { color: theme.faint }]} numberOfLines={1}>
                {row.status === 'missing'
                  ? t('wishlist.noLongerSold')
                  : t('wishlist.unavailableSub')}
              </Text>
            </>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View
      style={[styles.row, { backgroundColor: theme.card, borderRadius: theme.r.lg }, theme.shadow]}
    >
      {/* Only a product that is on sale opens its page; the others are greyed out. */}
      {available ? (
        <Pressable
          onPress={() => onOpen(p!)}
          {...openRing.handlers}
          accessibilityRole="button"
          accessibilityLabel={t('card.view', { name, price: price ?? '' })}
          style={[styles.main, openRing.ring]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={[styles.main, styles.dim]}>{body}</View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={onRemove}
          {...removeRing.handlers}
          accessibilityRole="button"
          accessibilityLabel={t('wishlist.remove', { name })}
          style={({ pressed }) => [
            styles.action,
            { borderRadius: theme.r.pill },
            pressed && { opacity: 0.6 },
            removeRing.ring,
          ]}
        >
          <Ionicons name="heart-dislike-outline" size={17} color={SAVED_TINT} />
          <Text style={[styles.actionText, { color: theme.sub }]}>{t('wishlist.removeShort')}</Text>
        </Pressable>
        <Pressable
          onPress={available ? () => onAdd(p!) : undefined}
          disabled={!available}
          {...addRing.handlers}
          accessibilityRole="button"
          accessibilityLabel={t('card.addToCart', { name })}
          accessibilityState={{ disabled: !available }}
          style={({ pressed }) => [
            styles.action,
            styles.addAction,
            {
              borderRadius: theme.r.pill,
              backgroundColor: available ? theme.accent : theme.muted,
            },
            pressed && { opacity: 0.85 },
            addRing.ring,
          ]}
        >
          <Feather name="shopping-bag" size={15} color={available ? theme.onAccent : theme.faint} />
          <Text style={[styles.actionText, { color: available ? theme.onAccent : theme.faint }]}>
            {t('product.addToCart')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  browse: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, minHeight: 44 },
  count: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 2 },
  row: { marginBottom: 10, overflow: 'hidden' },
  main: { flexDirection: 'row', padding: 12 },
  dim: { opacity: 0.55 },
  thumb: { width: 76, height: 76, overflow: 'hidden' },
  name: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  price: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  status: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  addAction: { paddingHorizontal: 16 },
  actionText: { fontSize: 13, fontWeight: '700' },
  note: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  noteText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
