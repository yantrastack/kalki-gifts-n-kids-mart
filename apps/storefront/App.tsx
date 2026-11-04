import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  AppState,
  BackHandler,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getBrand, getProducts, type Brand, type Product } from './src/api';
import { buildTheme, money } from './src/theme';
import { I18nProvider, useI18n, LANGS } from './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen, { type CartItem } from './src/screens/CartScreen';
import GiftFinderScreen from './src/screens/GiftFinderScreen';
import ReelsScreen from './src/screens/ReelsScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import { SAVED_TINT } from './src/components/WishlistHeart';
import { WishlistProvider, useWishlist } from './src/wishlistStore';
import { AppFrame, useAppWidth } from './src/layout';
import { addCapped, productIdFromSearch, productLink, PRODUCT_PARAM } from './src/reels';

type Screen = 'home' | 'gift' | 'product' | 'cart' | 'reels' | 'wishlist';

/**
 * Browser history entry for a screen (web). `depth` counts entries pushed above home, so
 * in-app back buttons and the browser/Android back button walk the same stack. YAN-110.
 */
type NavState = { sw: Screen; depth: number; pid?: string };
const isWeb = Platform.OS === 'web';
const webHistory = (): any => (isWeb ? (globalThis as any).history : null);
const webLocation = (): any => (isWeb ? (globalThis as any).location : null);

/** Dark page around the reel on desktop web, so Discover reads as a stage. */
const DISCOVER_PAGE = '#0E0D0C';
/**
 * Below this app width the header tightens (smaller gaps and language toggle) so the
 * back/brand mark, title, EN / తె, Discover, Wishlist and Cart fit from 320px, and the
 * shop name keeps room on common phones (360–393px).
 */
const NARROW_HEADER = 400;

export default function App() {
  return (
    <I18nProvider>
      <WishlistProvider>
        <Shop />
      </WishlistProvider>
    </I18nProvider>
  );
}

function LangToggle({
  theme,
  narrow = false,
}: {
  theme: ReturnType<typeof buildTheme>;
  narrow?: boolean;
}) {
  const { lang, setLang, t } = useI18n();
  return (
    <View
      style={[
        styles.langWrap,
        { backgroundColor: theme.card, borderRadius: theme.r.pill },
        theme.shadow,
      ]}
    >
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLang(l.code)}
            hitSlop={6}
            style={[
              styles.langBtn,
              narrow && styles.langBtnNarrow,
              {
                borderRadius: theme.r.pill,
                backgroundColor: active ? theme.accent : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active ? theme.onAccent : theme.sub,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {l.code === 'en' ? 'EN' : 'తె'}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ display: 'none' }}>
        <Text>{t('lang.label')}</Text>
      </View>
    </View>
  );
}

function Shop() {
  const { t } = useI18n();
  const wishlist = useWishlist();
  const narrow = useAppWidth() < NARROW_HEADER;
  // Header buttons: 40px, plus hit slop to reach 44px without overlapping a neighbour.
  const slop = narrow ? 2 : 10;
  const gapX = narrow ? 4 : 8;
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<Product | null>(null);
  const [productFrom, setProductFrom] = useState<Screen>('home'); // where "back" from a product goes
  const [cart, setCart] = useState<CartItem[]>([]);
  // Discover stays mounted (hidden) while a product opened from it is shown, so coming
  // back returns to the same reel, category and sound setting.
  const [reelsOpen, setReelsOpen] = useState(false);
  const depth = useRef(0);

  const lastLoad = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [b, p] = await Promise.all([getBrand(), getProducts()]);
      setBrand(b);
      setProducts(p);
      lastLoad.current = Date.now();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Products added or activated in the admin show up without reopening the app: when it
  // comes back to the foreground, reload quietly (no spinner) — at most every 30 seconds.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || Date.now() - lastLoad.current < 30_000) return;
      lastLoad.current = Date.now();
      try {
        const [b, p] = await Promise.all([getBrand(), getProducts()]);
        setBrand(b);
        setProducts(p);
      } catch {
        /* keep showing what we have */
      }
    });
    return () => sub.remove();
  }, []);

  const theme = useMemo(() => buildTheme(brand?.accentColor || '#2f9e8f'), [brand?.accentColor]);
  const currency = brand?.currency ?? '₹';
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0);

  /** Adds one, capped at the stock. Returns false when the cart already holds all of it. */
  const addToCart = (p: Product): boolean => {
    const have = cart.find((i) => i.product.id === p.id)?.qty ?? 0;
    if (addCapped(have, p.inStock) === have) return false;
    setCart((c) => {
      const e = c.find((i) => i.product.id === p.id);
      return e
        ? c.map((i) => (i.product.id === p.id ? { ...i, qty: addCapped(i.qty, p.inStock) } : i))
        : [...c, { product: p, qty: 1 }];
    });
    return true;
  };
  const inc = (id: string) =>
    setCart((c) =>
      c.map((i) => (i.product.id === id ? { ...i, qty: addCapped(i.qty, i.product.inStock) } : i)),
    );
  const dec = (id: string) =>
    setCart((c) =>
      c.flatMap((i) => (i.product.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i])),
    );
  const remove = (id: string) => setCart((c) => c.filter((i) => i.product.id !== id));

  const phoneDigits = (s: string) => s.replace(/[^\d+]/g, '');
  const callShop = () => {
    if (brand?.phone) Linking.openURL(`tel:${phoneDigits(brand.phone)}`);
  };
  const whatsappOrder = (single?: Product) => {
    if (!brand) return;
    const num = (brand.whatsapp || brand.phone || '').replace(/[^\d]/g, '');
    const lines = single
      ? [
          `Hi ${brand.appName}, I'd like to order: ${single.name} — ${money(currency, single.price)}`,
        ]
      : [
          `Hi ${brand.appName}, I'd like to order:`,
          ...cart.map(
            (i) => `• ${i.qty}× ${i.product.name} — ${money(currency, i.product.price * i.qty)}`,
          ),
          `Total: ${money(currency, total)}`,
        ];
    const text = encodeURIComponent(lines.join('\n'));
    Linking.openURL(num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`);
  };

  const shareProduct = async (p: Product): Promise<boolean> => {
    const g = globalThis as any;
    const text = `${p.name} — ${money(currency, p.price)} · ${brand?.appName ?? ''}`;
    // A link that opens this product (not just the shop's home page).
    const loc = webLocation();
    const url = loc?.origin ? productLink(loc.origin, loc.pathname, p.id) : undefined;
    if (g?.navigator?.share) {
      try {
        await g.navigator.share({ title: brand?.appName ?? p.name, text, url });
        return true;
      } catch (e: any) {
        if (e?.name === 'AbortError') return false; // user dismissed the sheet
      }
    }
    const num = (brand?.whatsapp || brand?.phone || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(url ? `${text}\n${url}` : text);
    Linking.openURL(num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`);
    return true;
  };

  /* ------------------------------------------------------------- navigation */
  // On web each screen change is a history entry, so the browser / Android back button
  // moves within the app (it used to leave the site from Discover). Native keeps the
  // in-memory "back" and handles the Android hardware back button below.
  const navigate = (next: Screen, opts: { replace?: boolean; product?: Product } = {}) => {
    const h = webHistory();
    const loc = webLocation();
    if (h && loc) {
      const pid = next === 'product' ? opts.product?.id : undefined;
      const url = pid
        ? `${loc.pathname}?${PRODUCT_PARAM}=${encodeURIComponent(pid)}`
        : loc.pathname;
      if (!opts.replace) depth.current += 1;
      const state: NavState = { sw: next, depth: depth.current, pid };
      if (opts.replace) h.replaceState(state, '', url);
      else h.pushState(state, '', url);
    }
    if (next === 'reels') setReelsOpen(true);
    setScreen(next);
  };
  const goBack = () => {
    const h = webHistory();
    if (h && depth.current > 0)
      h.back(); // the popstate handler shows the previous screen
    else setScreen(screen === 'product' ? productFrom : 'home');
  };
  const goHome = () => {
    const h = webHistory();
    if (h && depth.current > 0) h.go(-depth.current);
    else setScreen('home');
  };
  const openProduct = (p: Product) => {
    setProductFrom(screen === 'product' ? productFrom : screen);
    setSelected(p);
    navigate('product', { product: p });
  };
  const openProductById = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p) openProduct(p);
  };
  // "Buy" = add one (if stock allows) and go straight to the cart to order, as the
  // product page does. "Add to cart" only adds.
  const buyNow = (p: Product) => {
    addToCart(p);
    navigate('cart');
  };

  // Leaving to home (or the gift finder) closes Discover for good.
  useEffect(() => {
    if (screen === 'home' || screen === 'gift') setReelsOpen(false);
  }, [screen]);

  // Browser back / forward.
  const productsRef = useRef(products);
  productsRef.current = products;
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const onPop = (e: PopStateEvent) => {
      const s = e.state as NavState | null;
      depth.current = s?.depth ?? 0;
      if (s?.sw === 'product' && s.pid) {
        const p = productsRef.current.find((x) => x.id === s.pid);
        if (p) setSelected(p);
      }
      if (s?.sw === 'reels') setReelsOpen(true);
      setScreen(s?.sw ?? 'home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Android hardware back: close the current screen instead of leaving the app.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenRef.current === 'home') return false;
      goBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Shared product links (`/?product=<id>`): open that product once the catalogue is in,
  // with home underneath so "back" stays in the shop.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || loading) return;
    const h = webHistory();
    const loc = webLocation();
    if (!h || !loc) return;
    deepLinked.current = true;
    if (depth.current > 0) return; // already navigating; don't rewrite their history
    const id = productIdFromSearch(loc.search ?? '');
    const home: NavState = { sw: 'home', depth: 0 };
    h.replaceState(home, '', loc.pathname);
    const p = id ? products.find((x) => x.id === id) : undefined;
    if (p) {
      setProductFrom('home');
      setSelected(p);
      depth.current = 1;
      const state: NavState = { sw: 'product', depth: 1, pid: p.id };
      h.pushState(state, '', `${loc.pathname}?${PRODUCT_PARAM}=${encodeURIComponent(p.id)}`);
      setScreen('product');
    }
  }, [loading, products]);
  const title =
    screen === 'cart'
      ? t('header.cart')
      : screen === 'wishlist'
        ? t('header.wishlist')
        : screen === 'gift'
          ? t('header.findGift')
          : screen === 'product'
            ? ''
            : brand?.appName;

  const inReels = screen === 'reels';

  // Web: the wishlist gets its own document title while it is open (it is personal, so it
  // has no URL of its own and is never in the sitemap). The previous title comes back after.
  const shopName = brand?.appName;
  useEffect(() => {
    if (!isWeb || screen !== 'wishlist' || typeof document === 'undefined') return;
    const before = document.title;
    document.title = t('wishlist.pageTitle', { shop: shopName ?? '' }).replace(/ · $/, '');
    return () => {
      document.title = before;
    };
  }, [screen, shopName, t]);

  // On web, AppFrame pins the app to the viewport (so bottom bars stay on
  // screen and lists scroll internally) inside a centered mobile-width column.
  return (
    <AppFrame background={inReels ? '#000' : theme.bg} page={inReels ? DISCOVER_PAGE : undefined}>
      <StatusBar style={inReels ? 'light' : 'dark'} />

      {/* Discover reels take over the whole viewport (immersive, edge-to-edge black). */}
      {(inReels || reelsOpen) && (
        <SafeAreaView style={[styles.reels, { display: inReels ? 'flex' : 'none' }]}>
          <ReelsScreen
            theme={theme}
            currency={currency}
            hidden={!inReels}
            cartCount={count}
            onClose={goBack}
            onCart={() => navigate('cart')}
            onOpenProduct={openProduct}
            onOpenRelated={openProductById}
            onAdd={addToCart}
            onBuy={buyNow}
            onShare={shareProduct}
          />
        </SafeAreaView>
      )}

      <SafeAreaView
        style={{
          flex: 1,
          display: inReels ? 'none' : 'flex',
          backgroundColor: theme.bg,
          paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
        }}
      >
        {/* Header */}
        <View style={[styles.header, narrow && styles.headerNarrow]}>
          {screen !== 'home' ? (
            <Pressable
              onPress={goBack}
              hitSlop={slop}
              accessibilityRole="button"
              accessibilityLabel={t('header.back')}
              style={[
                styles.hbtn,
                { backgroundColor: theme.card, borderRadius: theme.r.pill },
                theme.shadow,
              ]}
            >
              <Feather name="chevron-left" size={20} color={theme.text} />
            </Pressable>
          ) : (
            <View
              style={[styles.mark, { backgroundColor: theme.accent, borderRadius: theme.r.md }]}
            >
              <Text style={styles.markText}>{brand?.brandInitial ?? 'S'}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: narrow ? 8 : 10, marginRight: narrow ? 4 : 6 }}>
            <Text
              style={[styles.title, { color: theme.text }, screen !== 'home' && { fontSize: 18 }]}
              numberOfLines={2}
              // The wishlist's one page heading (<h1> on web).
              {...(screen === 'wishlist'
                ? ({ accessibilityRole: 'header', 'aria-level': 1 } as any)
                : null)}
            >
              {title}
            </Text>
            {screen === 'home' && brand?.tagline ? (
              <Text style={{ color: theme.faint, fontSize: 11 }} numberOfLines={1}>
                {brand.tagline}
              </Text>
            ) : null}
          </View>
          <LangToggle theme={theme} narrow={narrow} />
          {screen === 'home' && (
            <Pressable
              onPress={() => navigate('reels')}
              hitSlop={slop}
              accessibilityRole="button"
              accessibilityLabel={t('header.discover')}
              style={[
                styles.hbtn,
                { backgroundColor: theme.accent, borderRadius: theme.r.pill, marginLeft: gapX },
                theme.shadow,
              ]}
            >
              <Feather name="film" size={18} color={theme.onAccent} />
            </Pressable>
          )}
          {screen !== 'wishlist' && (
            <Pressable
              onPress={() => navigate('wishlist')}
              hitSlop={slop}
              accessibilityRole="button"
              accessibilityLabel={t('header.openWishlist', { count: wishlist.count })}
              style={[
                styles.hbtn,
                { backgroundColor: theme.card, borderRadius: theme.r.pill, marginLeft: gapX },
                theme.shadow,
              ]}
            >
              <Ionicons
                name={wishlist.count > 0 ? 'heart' : 'heart-outline'}
                size={19}
                color={wishlist.count > 0 ? SAVED_TINT : theme.text}
              />
              {wishlist.count > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>
                    {wishlist.count > 99 ? '99+' : wishlist.count}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate('cart')}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={t('reels.cart', { count })}
            style={[
              styles.hbtn,
              { backgroundColor: theme.card, borderRadius: theme.r.pill, marginLeft: gapX },
              theme.shadow,
            ]}
          >
            <Feather name="shopping-bag" size={18} color={theme.text} />
            {count > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Body */}
        {error ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={32} color={theme.faint} />
            <Text
              style={{
                color: theme.sub,
                textAlign: 'center',
                paddingHorizontal: 32,
                marginTop: 12,
              }}
            >
              {t('error.unreachable')}
            </Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => [
                styles.retry,
                { backgroundColor: theme.accent, borderRadius: theme.r.pill },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: theme.onAccent, fontWeight: '700' }}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Home and Gift Finder stay mounted (hidden) so search state and
              gift results survive a round-trip through a product page. */}
            <View style={{ flex: 1, display: screen === 'home' || loading ? 'flex' : 'none' }}>
              <HomeScreen
                products={products}
                theme={theme}
                currency={currency}
                loading={loading}
                onOpen={openProduct}
                onAdd={addToCart}
                onGift={() => navigate('gift')}
              />
            </View>
            {!loading && (
              <View style={{ flex: 1, display: screen === 'gift' ? 'flex' : 'none' }}>
                <GiftFinderScreen
                  theme={theme}
                  currency={currency}
                  onOpen={openProduct}
                  onAdd={addToCart}
                />
              </View>
            )}
            {screen === 'product' && selected && (
              <ProductScreen
                product={selected}
                theme={theme}
                brand={brand!}
                onAdd={() => {
                  addToCart(selected);
                  // Replace the product entry, so back from the cart goes where the product
                  // was opened from (Discover, gift finder or home).
                  navigate('cart', { replace: true });
                }}
                onCall={callShop}
                onWhatsApp={() => whatsappOrder(selected)}
              />
            )}
            {screen === 'wishlist' && !loading && (
              <WishlistScreen
                theme={theme}
                currency={currency}
                onOpen={openProduct}
                onAdd={addToCart}
                onBrowse={goHome}
              />
            )}
            {screen === 'cart' && !loading && (
              <CartScreen
                items={cart}
                theme={theme}
                brand={brand!}
                onInc={inc}
                onDec={dec}
                onRemove={remove}
                onCall={callShop}
                onWhatsApp={() => whatsappOrder()}
                onBrowse={goHome}
              />
            )}
          </>
        )}

        {/* Wishlist save problems (storage blocked or full), from any screen. */}
        {wishlist.notice && (
          <View
            key={wishlist.notice.id}
            style={[styles.notice, { backgroundColor: theme.text, borderRadius: theme.r.pill }]}
            pointerEvents="none"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.noticeText}>{t(`wishlist.${wishlist.notice.key}`)}</Text>
          </View>
        )}

        {/* Floating cart summary on home */}
        {screen === 'home' && !loading && !error && count > 0 && (
          <Pressable
            onPress={() => navigate('cart')}
            style={({ pressed }) => [
              styles.cartBar,
              { backgroundColor: theme.text, borderRadius: theme.r.lg },
              theme.shadow,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[styles.cartBarBadge, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 13 }}>
                {count}
              </Text>
            </View>
            <Text style={styles.cartBarText}>{t('common.viewCart')}</Text>
            <Text style={[styles.cartBarText, { marginLeft: 'auto' }]}>
              {money(currency, total)}
            </Text>
          </Pressable>
        )}
      </SafeAreaView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  reels: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    // Keep the reel's buttons above the home indicator on notched phones (web).
    ...(Platform.OS === 'web'
      ? ({ paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as any)
      : null),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerNarrow: { paddingHorizontal: 10 },
  hbtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 19 },
  langWrap: { flexDirection: 'row', alignItems: 'center', padding: 3, gap: 2 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6, minWidth: 34, alignItems: 'center' },
  langBtnNarrow: { paddingHorizontal: 6, minWidth: 28 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  retry: { marginTop: 18, paddingHorizontal: 24, paddingVertical: 11 },
  notice: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  noticeText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cartBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cartBarBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartBarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
