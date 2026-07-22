import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import type { FeedProduct } from '@stockwell/shared';
import { getFeed, mediaUrl, recordEvent, type Product } from '../api';
import { useI18n } from '../i18n';
import { type Theme, thumbColor, initials, money } from '../theme';

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

const CATEGORIES = [
  'All',
  'Candles',
  'Home Decor',
  'Jewelry',
  'Toys',
  'Chocolates',
  'Fragrance',
  'Festive',
];

/* persisted liked set (web localStorage; in-memory on native) */
function loadLiked(): Set<string> {
  try {
    return new Set(JSON.parse((globalThis as any)?.localStorage?.getItem('sf-liked') || '[]'));
  } catch {
    return new Set();
  }
}
function saveLiked(s: Set<string>) {
  try {
    (globalThis as any)?.localStorage?.setItem('sf-liked', JSON.stringify([...s]));
  } catch {
    /* native */
  }
}

export default function ReelsScreen({
  theme,
  currency,
  onClose,
  onOpenProduct,
  onAdd,
  onShare,
}: {
  theme: Theme;
  currency: string;
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
  onShare: (p: Product) => Promise<boolean> | boolean;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const [h, setH] = useState(0);
  const [items, setItems] = useState<FeedProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(loadLiked);
  const listRef = useRef<FlatList<FeedProduct>>(null);
  const viewed = useRef<Set<string>>(new Set()); // dedupe view events per session

  const loadFirst = useCallback(async (cat: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await getFeed(null, cat);
      setItems(res.items);
      setCursor(res.nextCursor);
      setActive(0);
      viewed.current.clear();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadFirst(category);
  }, [category, loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getFeed(cursor, category);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, category, loadingMore]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setActive(first.index);
      const p = first.item as FeedProduct;
      if (p && !viewed.current.has(p.id)) {
        viewed.current.add(p.id);
        recordEvent(p.id, 'view');
      }
    }
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const toggleLike = (p: FeedProduct) => {
    setLiked((prev) => {
      const next = new Set(prev);
      const on = next.has(p.id);
      if (on) next.delete(p.id);
      else next.add(p.id);
      saveLiked(next);
      recordEvent(p.id, on ? 'unlike' : 'like');
      setItems((its) =>
        its.map((it) =>
          it.id === p.id ? { ...it, likes: Math.max(0, it.likes + (on ? -1 : 1)) } : it,
        ),
      );
      return next;
    });
  };
  const share = async (p: FeedProduct) => {
    const ok = await onShare(p);
    if (ok !== false) {
      recordEvent(p.id, 'share');
      setItems((its) => its.map((it) => (it.id === p.id ? { ...it, shares: it.shares + 1 } : it)));
    }
  };
  const buy = (p: FeedProduct) => {
    onAdd(p);
    recordEvent(p.id, 'buy');
  };
  const scrollToId = (id: string) => {
    const idx = items.findIndex((p) => p.id === id);
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true });
    else loadMore();
  };

  return (
    <View style={styles.root} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {/* Top overlay: title, filter, close */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Text style={styles.topTitle}>{t('reels.title')}</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setMuted((m) => !m)} hitSlop={8} style={styles.topBtn}>
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={styles.topBtn}>
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.filterRow} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
        >
          {CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, { backgroundColor: on ? theme.accent : 'rgba(0,0,0,0.4)' }]}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  {c === 'All' ? t('common.all') : c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading || h === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={30} color="rgba(255,255,255,0.7)" />
          <Text style={{ color: '#fff', marginTop: 12 }}>{t('error.unreachable')}</Text>
          <Pressable
            onPress={() => loadFirst(category)}
            style={[styles.retry, { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="film" size={30} color="rgba(255,255,255,0.6)" />
          <Text style={{ color: '#fff', marginTop: 12 }}>{t('home.noResults')}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(p) => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          decelerationRate="fast"
          windowSize={3}
          maxToRenderPerBatch={2}
          renderItem={({ item, index }) => (
            <Reel
              product={item}
              width={width}
              height={h}
              active={index === active}
              muted={muted}
              liked={liked.has(item.id)}
              theme={theme}
              currency={currency}
              t={t}
              onLike={() => toggleLike(item)}
              onShare={() => share(item)}
              onBuy={() => buy(item)}
              onOpen={() => onOpenProduct(item)}
              onRelated={scrollToId}
            />
          )}
        />
      )}
    </View>
  );
}

/* --------------------------------------------------------------------- one reel */
function Reel({
  product,
  width,
  height,
  active,
  muted,
  liked,
  theme,
  currency,
  t,
  onLike,
  onShare,
  onBuy,
  onOpen,
  onRelated,
}: {
  product: FeedProduct;
  width: number;
  height: number;
  active: boolean;
  muted: boolean;
  liked: boolean;
  theme: Theme;
  currency: string;
  t: (k: string, p?: any) => string;
  onLike: () => void;
  onShare: () => void;
  onBuy: () => void;
  onOpen: () => void;
  onRelated: (id: string) => void;
}) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const media = product.media.length ? product.media : [];
  const low = product.inStock <= 10;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Media carousel (background) */}
      {media.length ? (
        <FlatList
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          onMomentumScrollEnd={(e) =>
            setMediaIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index }) =>
            item.type === 'video' ? (
              <ReelVideo
                uri={mediaUrl(item.url)}
                width={width}
                height={height}
                active={active && mediaIndex === index}
                muted={muted}
              />
            ) : (
              <Image
                source={{ uri: mediaUrl(item.url) }}
                style={{ width, height }}
                contentFit="cover"
                transition={200}
              />
            )
          }
        />
      ) : (
        <View
          style={{
            width,
            height,
            backgroundColor: thumbColor(product.name),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 64, fontWeight: '800' }}>
            {initials(product.name)}
          </Text>
        </View>
      )}

      {/* Scrims for legibility */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
        <View style={[styles.scrim, { top: 0, height: 140, opacity: 0.35 }]} />
      </View>
      <View pointerEvents="none" style={styles.bottomScrim} />

      {/* Media dots */}
      {media.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {media.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.dot,
                { backgroundColor: i === mediaIndex ? '#fff' : 'rgba(255,255,255,0.5)' },
                i === mediaIndex && { width: 16 },
              ]}
            />
          ))}
        </View>
      )}

      {/* Right action rail */}
      <View style={styles.rail}>
        <RailBtn
          icon="heart"
          tint={liked ? '#ff4d6d' : '#fff'}
          label={compact(product.likes)}
          onPress={onLike}
        />
        <RailBtn icon="send" label={compact(product.shares)} onPress={onShare} />
        <RailBtn icon="shopping-bag" label={t('reels.buy')} onPress={onBuy} />
        <RailBtn icon="info" label={t('reels.details')} onPress={onOpen} />
      </View>

      {/* Bottom info panel */}
      <View style={styles.info}>
        {product.tag ? (
          <View style={[styles.tagPill, { backgroundColor: theme.accent }]}>
            <Text style={styles.tagText}>{product.tag}</Text>
          </View>
        ) : null}
        <Pressable onPress={onOpen}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
        </Pressable>
        <Text style={styles.meta} numberOfLines={1}>
          {[product.brand, product.category].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(currency, product.price)}</Text>
          <View
            style={[
              styles.stockPill,
              { backgroundColor: low ? 'rgba(168,118,28,0.9)' : 'rgba(31,122,77,0.9)' },
            ]}
          >
            <Text style={styles.stockText}>
              {low ? t('product.onlyLeft', { count: product.inStock }) : t('product.inStock')}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onBuy}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.accent },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="shopping-bag" size={16} color="#fff" />
          <Text style={styles.ctaText}>{t('reels.addToCart')}</Text>
        </Pressable>

        {product.related.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.relatedTitle}>{t('reels.related')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 6 }}
            >
              {product.related.map((r) => (
                <Pressable key={r.id} onPress={() => onRelated(r.id)} style={styles.relCard}>
                  {r.thumb ? (
                    <Image
                      source={{ uri: mediaUrl(r.thumb) }}
                      style={styles.relThumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.relThumb,
                        {
                          backgroundColor: thumbColor(r.name),
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{initials(r.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.relPrice}>{money(currency, r.price)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

function ReelVideo({
  uri,
  width,
  height,
  active,
  muted,
}: {
  uri: string;
  width: number;
  height: number;
  active: boolean;
  muted: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function RailBtn({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: any;
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.railBtn, pressed && { transform: [{ scale: 0.88 }] }]}
      hitSlop={6}
    >
      <View style={styles.railIcon}>
        {/* Feather has no filled heart; a liked heart is shown via tint colour. */}
        <Feather name={icon} size={26} color={tint ?? '#fff'} />
      </View>
      <Text style={styles.railLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
  },
  topTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  topBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  filterRow: { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 20, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  scrim: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 360,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dots: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
    zIndex: 15,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rail: { position: 'absolute', right: 10, bottom: 150, alignItems: 'center', gap: 20, zIndex: 15 },
  railBtn: { alignItems: 'center', gap: 4 },
  railIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  info: { position: 'absolute', left: 16, right: 78, bottom: 28, zIndex: 15 },
  tagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  price: { color: '#fff', fontSize: 22, fontWeight: '800' },
  stockPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  stockText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  relatedTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  relCard: { width: 72 },
  relThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#333' },
  relPrice: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 3 },
});
