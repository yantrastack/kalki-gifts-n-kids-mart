import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  PixelRatio,
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type ViewToken,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { FeedProduct } from '@stockwell/shared';
import { getFeed, mediaUrl, recordEvent, type Product } from '../api';
import { useI18n } from '../i18n';
import { useAppWidth } from '../layout';
import { type Theme, money } from '../theme';
import ProductImage, { ImageFallback } from '../components/ProductImage';
import ProductBadge from '../components/ProductBadge';
import Skeleton from '../components/Skeleton';
import { useFocusRing } from '../components/focusRing';
import { pageAt, sizedImageUrl, stepIndex } from '../components/gallery';
import { GalleryArrows, GalleryCounter } from '../components/GalleryControls';
import {
  clampReel,
  reelDensity,
  reelStepForKey,
  scrimGradient,
  toggleLiked,
  WHEEL_OPEN,
  wheelStep,
} from '../reels';

/** Placeholder tone on the black Discover feed (the light app tone would glare here). */
const REEL_FALLBACK = '#24211D';
// Gallery counter position, under the header and category chips.
const COUNTER_TOP = 108;
// Reel gallery arrows (40px tall) go in the clear band between the counter (~140px) and
// the right action rail. On short screens the rail fills that side, so the right arrow
// steps in to the left of the rail instead. Before the rail is measured: mid-height.
const BAND_TOP = 140;
const reelArrows = (railTop: number | null) => {
  if (railTop == null) return {};
  if (railTop - BAND_TOP >= 56) return { top: Math.round((BAND_TOP + railTop) / 2) };
  return { top: BAND_TOP + 28, rightInset: 72 };
};
/**
 * The rail and info panel live below this line (top bar + chips + counter above it), side
 * by side and anchored to the bottom, so they can never overlap each other or the top.
 */
const OVERLAY_TOP = BAND_TOP;
/** Height the info panel needs to also show the "More like this" strip. */
const RELATED_NEEDS = 330;

const isWeb = Platform.OS === 'web';

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

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

/** Is a key press aimed at a control that uses it itself (typing, pressing a button)? */
function keyBelongsToTarget(e: KeyboardEvent): boolean {
  const el = e.target as any;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
  // Space activates the focused button / chip / link.
  return e.key === ' ' && !!el.closest('button, a, [role="button"], [role="tab"], [role="link"]');
}

export default function ReelsScreen({
  theme,
  currency,
  hidden = false,
  cartCount,
  onClose,
  onCart,
  onOpenProduct,
  onOpenRelated,
  onAdd,
  onBuy,
  onShare,
}: {
  theme: Theme;
  currency: string;
  /** Kept mounted but not shown (a product opened from Discover is on top). */
  hidden?: boolean;
  cartCount: number;
  onClose: () => void;
  onCart: () => void;
  onOpenProduct: (p: Product) => void;
  /** Open a "More like this" product that is not in the loaded feed. */
  onOpenRelated: (id: string) => void;
  /** Adds one; false when the cart already holds all the stock. */
  onAdd: (p: Product) => boolean;
  onBuy: (p: Product) => void;
  onShare: (p: Product) => Promise<boolean> | boolean;
}) {
  const { t, categoryLabel } = useI18n();
  const width = useAppWidth();
  const [h, setH] = useState(0);
  const [items, setItems] = useState<FeedProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null); // null = all
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(loadLiked);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const listRef = useRef<FlatList<FeedProduct>>(null);
  const viewed = useRef<Set<string>>(new Set()); // dedupe view events per session
  const likedRef = useRef(liked);
  const activeRef = useRef(active);
  activeRef.current = active;

  const loadFirst = useCallback(async (cat: string | null) => {
    setLoading(true);
    setError(false);
    setLoadMoreError(false);
    try {
      const res = await getFeed(null, cat ?? undefined);
      setItems(res.items);
      setCursor(res.nextCursor);
      if (res.categories) setCategories(res.categories);
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
    setLoadMoreError(false);
    try {
      const res = await getFeed(cursor, category ?? undefined);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      setLoadMoreError(true); // shown on the last reel with a retry
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

  /* ------------------------------------------------------------ paging */
  const goTo = (delta: number) => {
    const n = items.length;
    if (!n) return;
    if (delta > 0 && activeRef.current >= n - 1) {
      loadMore();
      return;
    }
    const next = clampReel(activeRef.current, delta, n);
    if (next !== activeRef.current) listRef.current?.scrollToIndex({ index: next, animated: true });
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  // Keyboard: ↑/↓, PageUp/PageDown and Space move one reel (web).
  useEffect(() => {
    if (!isWeb || hidden || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const step = reelStepForKey(e.key);
      if (!step || keyBelongsToTarget(e)) return;
      e.preventDefault();
      goToRef.current(step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden]);

  // Mouse wheel / trackpad: exactly one reel per gesture (a fast flick used to fly past
  // several). Sideways swipes are left to the photo gallery.
  const listReady = items.length > 0 && h > 0 && !loading && !error;
  useEffect(() => {
    if (!isWeb || hidden || !listReady) return;
    const node: any = (listRef.current as any)?.getScrollableNode?.();
    if (!node?.addEventListener) return;
    let gate = WHEEL_OPEN;
    const onWheel = (e: WheelEvent) => {
      const r = wheelStep(gate, e.deltaX, e.deltaY, Date.now());
      gate = r.gate;
      if (!r.handled) return;
      e.preventDefault();
      if (r.step) goToRef.current(r.step);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [hidden, listReady]);

  // Back from a product page: the list was hidden, put the same reel back in view.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden && items.length) {
      const index = Math.min(activeRef.current, items.length - 1);
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
    }
    wasHidden.current = hidden;
  }, [hidden, items.length]);

  /* ------------------------------------------------------------ actions */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);
  const say = (text: string) => setToast({ id: Date.now(), text });

  // Side effects run once per tap, outside any state updater (updaters may run twice).
  const toggleLike = (p: FeedProduct) => {
    const { next, on } = toggleLiked(likedRef.current, p.id);
    likedRef.current = next;
    setLiked(next);
    saveLiked(next);
    recordEvent(p.id, on ? 'like' : 'unlike');
    setItems((its) =>
      its.map((it) =>
        it.id === p.id ? { ...it, likes: Math.max(0, it.likes + (on ? 1 : -1)) } : it,
      ),
    );
  };
  const share = async (p: FeedProduct) => {
    const ok = await onShare(p);
    if (ok !== false) {
      recordEvent(p.id, 'share');
      setItems((its) => its.map((it) => (it.id === p.id ? { ...it, shares: it.shares + 1 } : it)));
    }
  };
  const addOne = (p: FeedProduct) => {
    if (onAdd(p)) {
      recordEvent(p.id, 'buy');
      say(t('reels.added'));
    } else {
      say(t('reels.maxInCart', { count: p.inStock }));
    }
  };
  const buy = (p: FeedProduct) => {
    recordEvent(p.id, 'buy');
    onBuy(p);
  };
  const open = (p: FeedProduct) => {
    recordEvent(p.id, 'open');
    onOpenProduct(p);
  };
  // "More like this": scroll to it when it is in the loaded feed, else open its page.
  const related = (id: string) => {
    const idx = items.findIndex((p) => p.id === id);
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true });
    else onOpenRelated(id);
  };

  const chips: (string | null)[] = [null, ...categories];
  const last = items.length - 1;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        // While hidden (display: none) the layout is 0: keep the last real height so the
        // feed stays mounted with its position.
        const height = e.nativeEvent.layout.height;
        if (height > 0) setH(height);
      }}
    >
      {/* Top overlay: title, cart, sound, close */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Text style={styles.topTitle} accessibilityRole="header">
          {t('reels.title')}
        </Text>
        <View style={{ flex: 1 }} />
        <Btn
          theme={theme}
          radius={18}
          onPress={onCart}
          label={t('reels.cart', { count: cartCount })}
          style={styles.topBtn}
        >
          <Feather name="shopping-bag" size={17} color="#fff" />
          {cartCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </Btn>
        <Btn
          theme={theme}
          radius={18}
          onPress={() => setMuted((m) => !m)}
          label={muted ? t('reels.soundOn') : t('reels.soundOff')}
          style={styles.topBtn}
        >
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
        </Btn>
        <Btn
          theme={theme}
          radius={18}
          onPress={onClose}
          label={t('reels.close')}
          style={styles.topBtn}
        >
          <Feather name="x" size={20} color="#fff" />
        </Btn>
      </View>
      <View style={styles.filterRow} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
          accessibilityRole="tablist"
          accessibilityLabel={t('reels.categories')}
        >
          {chips.map((c) => {
            const on = c === category;
            return (
              <Btn
                key={c ?? '*'}
                theme={theme}
                radius={999}
                role="tab"
                selected={on}
                onPress={() => setCategory(c)}
                style={[styles.chip, { backgroundColor: on ? theme.accent : 'rgba(0,0,0,0.45)' }]}
              >
                <Text style={styles.chipText}>
                  {c == null ? t('common.all') : categoryLabel(c)}
                </Text>
              </Btn>
            );
          })}
        </ScrollView>
      </View>

      {loading || h === 0 ? (
        <ReelSkeleton theme={theme} />
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={30} color="rgba(255,255,255,0.7)" />
          <Text style={styles.stateText}>{t('error.unreachable')}</Text>
          <Btn
            theme={theme}
            radius={999}
            onPress={() => loadFirst(category)}
            style={[styles.retry, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Btn>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="film" size={30} color="rgba(255,255,255,0.6)" />
          <Text style={styles.stateText}>{t('reels.empty')}</Text>
          {category != null && (
            <Btn
              theme={theme}
              radius={999}
              onPress={() => setCategory(null)}
              style={[styles.retry, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.retryText}>{t('reels.showAll')}</Text>
            </Btn>
          )}
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
          accessibilityLabel={t('reels.feed')}
          renderItem={({ item, index }) => (
            <Reel
              product={item}
              width={width}
              height={h}
              active={!hidden && index === active}
              muted={muted}
              liked={liked.has(item.id)}
              theme={theme}
              currency={currency}
              t={t}
              categoryLabel={categoryLabel}
              footer={
                index !== last ? null : loadMoreError ? (
                  <Btn
                    theme={theme}
                    radius={999}
                    onPress={loadMore}
                    style={styles.feedNote}
                    label={`${t('reels.loadMoreError')} ${t('common.retry')}`}
                  >
                    <Feather name="refresh-cw" size={13} color="#fff" />
                    <Text style={styles.feedNoteText}>
                      {t('reels.loadMoreError')} · {t('common.retry')}
                    </Text>
                  </Btn>
                ) : !cursor && items.length > 1 ? (
                  <View style={styles.feedNote}>
                    <Feather name="check-circle" size={13} color="#fff" />
                    <Text style={styles.feedNoteText}>{t('reels.end')}</Text>
                  </View>
                ) : null
              }
              onLike={() => toggleLike(item)}
              onShare={() => share(item)}
              onBuy={() => buy(item)}
              onAdd={() => addOne(item)}
              onOpen={() => open(item)}
              onRelated={related}
            />
          )}
        />
      )}

      {toast && (
        <View
          key={toast.id}
          style={styles.toast}
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- loading skeleton */
function ReelSkeleton({ theme }: { theme: Theme }) {
  const tone = { backgroundColor: '#2A2724' };
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar">
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Skeleton theme={theme} style={{ ...tone, width: 80, height: 22 }} />
          <Skeleton theme={theme} style={{ ...tone, width: '85%', height: 22 }} />
          <Skeleton theme={theme} style={{ ...tone, width: '50%', height: 14 }} />
          <Skeleton theme={theme} style={{ ...tone, width: 110, height: 26 }} />
          <Skeleton theme={theme} style={{ ...tone, height: 46, borderRadius: 14 }} />
        </View>
        <View style={{ gap: 20, alignItems: 'center' }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              theme={theme}
              style={{ ...tone, width: 40, height: 40, borderRadius: 20 }}
            />
          ))}
        </View>
      </View>
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
  categoryLabel,
  footer,
  onLike,
  onShare,
  onBuy,
  onAdd,
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
  categoryLabel: (name: string) => string;
  /** Shown above the info on the last reel: load-more retry or end of feed. */
  footer: ReactNode;
  onLike: () => void;
  onShare: () => void;
  onBuy: () => void;
  onAdd: () => void;
  onOpen: () => void;
  onRelated: (id: string) => void;
}) {
  const [mediaIndex, setMediaIndex] = useState(0);
  // Top edge of the right action rail, measured on layout. The gallery arrows sit in the
  // clear band between the counter and the rail; at mid-height the right arrow covered the
  // like button and could not be clicked.
  const [railTop, setRailTop] = useState<number | null>(null);
  const mediaRef = useRef<FlatList<FeedProduct['media'][number]>>(null);
  const media = product.media.length ? product.media : [];
  const count = media.length;
  const low = product.inStock <= 10;
  const density = reelDensity(height);
  const tight = density === 'tight';
  const showRelated = product.related.length > 0 && height - OVERLAY_TOP - 16 >= RELATED_NEEDS;
  // Same paging as the product page gallery: arrows (web), counter, swipe.
  const step = (delta: number) => {
    const i = stepIndex(mediaIndex, delta, count);
    setMediaIndex(i);
    mediaRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Media carousel (background) */}
      {media.length ? (
        <FlatList
          ref={mediaRef}
          data={media}
          horizontal
          pagingEnabled
          // Lock each swipe to one axis: sideways pages photos, up/down pages reels.
          directionalLockEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          // onScroll (not onMomentumScrollEnd): mobile web never fires momentum events, so
          // the counter stuck on 1 and a later video slide never played.
          scrollEventThrottle={32}
          onScroll={(e) => {
            const i = pageAt(e.nativeEvent.contentOffset.x, width, count);
            if (i !== mediaIndex) setMediaIndex(i);
          }}
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
              <ProductImage
                uri={sizedImageUrl(mediaUrl(item.url), width, PixelRatio.get())}
                label={
                  count > 1
                    ? `${t('card.photo', { name: product.name })}, ${t('product.imagePosition', { n: index + 1, total: count })}`
                    : t('card.photo', { name: product.name })
                }
                theme={theme}
                style={{ width, height, backgroundColor: REEL_FALLBACK }}
                priority={active && index === 0}
                iconSize={56}
              />
            )
          }
        />
      ) : (
        <ImageFallback
          theme={theme}
          iconSize={56}
          style={{ width, height, backgroundColor: REEL_FALLBACK }}
        />
      )}

      {/* Soft gradient scrims for legibility (no hard-edged bands). */}
      <Scrim edge="top" height={170} max={0.55} />
      <Scrim edge="bottom" height={Math.min(Math.round(height * 0.6), 460)} max={0.78} />

      {/* Gallery navigation (same as the product page) */}
      <GalleryArrows
        count={count}
        theme={theme}
        prevLabel={t('product.prevImage')}
        nextLabel={t('product.nextImage')}
        onStep={step}
        {...reelArrows(railTop)}
      />
      <GalleryCounter
        index={mediaIndex}
        count={count}
        label={t('product.imagePosition', { n: mediaIndex + 1, total: count })}
        top={COUNTER_TOP}
      />

      {/* Info panel + action rail, side by side under the top area. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.info} pointerEvents="box-none">
          {footer}
          {!tight && <ProductBadge tag={product.tag} theme={theme} style={styles.tagPill} />}
          <Btn
            theme={theme}
            radius={6}
            onPress={onOpen}
            label={t('reels.detailsFor', { name: product.name })}
            style={styles.nameLink}
          >
            <Text style={[styles.name, tight && styles.nameTight]} numberOfLines={2}>
              {product.name}
            </Text>
          </Btn>
          {!tight && (
            <Text style={styles.meta} numberOfLines={1}>
              {[product.brand, product.category && categoryLabel(product.category)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          <View style={[styles.priceRow, tight && { marginTop: 4 }]}>
            <Text style={[styles.price, tight && { fontSize: 18 }]}>
              {money(currency, product.price)}
            </Text>
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

          <Btn
            theme={theme}
            radius={14}
            onPress={onAdd}
            label={t('card.addToCart', { name: product.name })}
            style={({ pressed }) => [
              styles.cta,
              tight && styles.ctaTight,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="shopping-bag" size={16} color="#fff" />
            <Text style={styles.ctaText}>{t('reels.addToCart')}</Text>
          </Btn>

          {showRelated && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.relatedTitle} accessibilityRole="header">
                {t('reels.related')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 6 }}
              >
                {product.related.map((r) => (
                  <Btn
                    key={r.id}
                    theme={theme}
                    radius={12}
                    onPress={() => onRelated(r.id)}
                    label={t('card.view', { name: r.name, price: money(currency, r.price) })}
                    style={styles.relCard}
                  >
                    <ProductImage
                      uri={r.thumb ? mediaUrl(r.thumb) : null}
                      label=""
                      theme={theme}
                      style={styles.relThumb}
                      iconSize={22}
                    />
                    <Text style={styles.relPrice}>{money(currency, r.price)}</Text>
                  </Btn>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Right action rail */}
        <View
          style={[styles.rail, { gap: tight ? 6 : density === 'compact' ? 12 : 20 }]}
          onLayout={(e) => {
            const y = OVERLAY_TOP + Math.round(e.nativeEvent.layout.y);
            if (y !== railTop) setRailTop(y);
          }}
        >
          <RailBtn
            theme={theme}
            size={tight ? 40 : 46}
            icon={
              // Filled heart when liked (Feather has no filled heart).
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={28}
                color={liked ? '#ff4d6d' : '#fff'}
              />
            }
            label={tight ? null : compact(product.likes)}
            a11y={`${t('reels.like', { name: product.name })}, ${product.likes}`}
            pressed={liked}
            onPress={onLike}
          />
          <RailBtn
            theme={theme}
            size={tight ? 40 : 46}
            icon={<Feather name="send" size={25} color="#fff" />}
            label={tight ? null : compact(product.shares)}
            a11y={`${t('reels.share', { name: product.name })}, ${product.shares}`}
            onPress={onShare}
          />
          <RailBtn
            theme={theme}
            size={tight ? 40 : 46}
            icon={<Feather name="zap" size={25} color="#fff" />}
            label={tight ? null : t('reels.buy')}
            a11y={t('reels.buyNow', { name: product.name })}
            onPress={onBuy}
          />
          <RailBtn
            theme={theme}
            size={tight ? 40 : 46}
            icon={<Feather name="info" size={25} color="#fff" />}
            label={tight ? null : t('reels.details')}
            a11y={t('reels.detailsFor', { name: product.name })}
            onPress={onOpen}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * A smooth gradient, darkest at the edge, fading to clear. One CSS gradient (web) /
 * native background image, not stacked flat bands (those showed as stripes on light photos).
 */
function Scrim({ edge, height, max }: { edge: 'top' | 'bottom'; height: number; max: number }) {
  const gradient = scrimGradient(edge, max);
  const fill = (
    isWeb ? { backgroundImage: gradient } : { experimental_backgroundImage: gradient }
  ) as ViewStyle;
  return (
    <View
      pointerEvents="none"
      style={[styles.scrim, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height }, fill]}
    />
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

/** Pressable with a translated label and a keyboard focus ring (web). */
function Btn({
  theme,
  radius,
  label,
  role = 'button',
  selected,
  pressed: isPressed,
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  theme: Theme;
  radius: number;
  label?: string;
  role?: 'button' | 'tab';
  selected?: boolean;
  /** Toggle button state (like). */
  pressed?: boolean;
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: ReactNode;
}) {
  const ring = useFocusRing(theme, radius);
  const state =
    selected != null ? { selected } : isPressed != null ? { checked: isPressed } : undefined;
  // aria-pressed is the web toggle-button state; RN types don't list it.
  const web = isWeb && isPressed != null ? ({ 'aria-pressed': isPressed } as any) : null;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={isWeb && isPressed != null ? undefined : state}
      {...web}
      {...ring.handlers}
      {...rest}
      style={(s) => [typeof style === 'function' ? style(s) : style, ring.ring]}
    >
      {children}
    </Pressable>
  );
}

function RailBtn({
  theme,
  size,
  icon,
  label,
  a11y,
  pressed,
  onPress,
}: {
  theme: Theme;
  size: number;
  icon: ReactNode;
  label: string | null;
  a11y: string;
  pressed?: boolean;
  onPress: () => void;
}) {
  return (
    <Btn
      theme={theme}
      radius={size / 2}
      // The visible caption is decoration: a11y already names the action (and any count).
      label={a11y}
      pressed={pressed}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed: down }) => [styles.railBtn, down && { transform: [{ scale: 0.88 }] }]}
    >
      <View style={[styles.railIcon, { width: size, height: size, borderRadius: size / 2 }]}>
        {icon}
      </View>
      {label != null && (
        <Text style={styles.railLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Btn>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  stateText: { color: '#fff', marginTop: 12, textAlign: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  retryText: { color: '#fff', fontWeight: '700' },
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  filterRow: { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 20, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  skeleton: { flex: 1, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: '#000' },
  scrim: { position: 'absolute', left: 0, right: 0 },
  overlay: {
    position: 'absolute',
    top: OVERLAY_TOP,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 16,
    overflow: 'hidden',
  },
  info: { flex: 1, paddingLeft: 16, paddingRight: 8 },
  rail: { alignItems: 'center', marginRight: 10, marginBottom: 4 },
  railBtn: { alignItems: 'center', gap: 4 },
  // Translucent dark circle so white icons read on light photos. No border: a light ring
  // doubled up with the outline heart icon.
  railIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  railLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  tagPill: { marginBottom: 8, alignSelf: 'flex-start' },
  nameLink: { alignSelf: 'flex-start' },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  nameTight: { fontSize: 17, lineHeight: 21 },
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
  ctaTight: { paddingVertical: 9, marginTop: 8 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  relatedTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  relCard: { width: 72 },
  relThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#333' },
  relPrice: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 3 },
  feedNote: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  feedNoteText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  toast: {
    position: 'absolute',
    top: 148, // under the chips and the photo counter

    alignSelf: 'center',
    zIndex: 30,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(20,18,16,0.92)',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
