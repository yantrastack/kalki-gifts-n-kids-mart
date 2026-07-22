import { useEffect, useMemo, useState, useCallback } from 'react';
import {
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
import { Feather } from '@expo/vector-icons';
import { getBrand, getProducts, type Brand, type Product } from './src/api';
import { buildTheme, money } from './src/theme';
import { I18nProvider, useI18n, LANGS } from './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen, { type CartItem } from './src/screens/CartScreen';
import GiftFinderScreen from './src/screens/GiftFinderScreen';
import ReelsScreen from './src/screens/ReelsScreen';

type Screen = 'home' | 'gift' | 'product' | 'cart' | 'reels';

export default function App() {
  return (
    <I18nProvider>
      <Shop />
    </I18nProvider>
  );
}

function LangToggle({ theme }: { theme: ReturnType<typeof buildTheme> }) {
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
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<Product | null>(null);
  const [productFrom, setProductFrom] = useState<Screen>('home'); // where "back" from a product goes
  const [cart, setCart] = useState<CartItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [b, p] = await Promise.all([getBrand(), getProducts()]);
      setBrand(b);
      setProducts(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const theme = useMemo(() => buildTheme(brand?.accentColor || '#2f9e8f'), [brand?.accentColor]);
  const currency = brand?.currency ?? '₹';
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0);

  const addToCart = (p: Product) =>
    setCart((c) => {
      const e = c.find((i) => i.product.id === p.id);
      return e
        ? c.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { product: p, qty: 1 }];
    });
  const inc = (id: string) =>
    setCart((c) => c.map((i) => (i.product.id === id ? { ...i, qty: i.qty + 1 } : i)));
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
    const url = g?.location?.href;
    if (g?.navigator?.share) {
      try {
        await g.navigator.share({ title: brand?.appName ?? p.name, text, url });
        return true;
      } catch (e: any) {
        if (e?.name === 'AbortError') return false; // user dismissed the sheet
      }
    }
    const num = (brand?.whatsapp || brand?.phone || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(text);
    Linking.openURL(num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`);
    return true;
  };

  const openProduct = (p: Product) => {
    setProductFrom(screen === 'product' ? productFrom : screen);
    setSelected(p);
    setScreen('product');
  };
  const goBack = () => setScreen(screen === 'product' ? productFrom : 'home');
  const title =
    screen === 'cart'
      ? t('header.cart')
      : screen === 'gift'
        ? t('header.findGift')
        : screen === 'product'
          ? ''
          : brand?.appName;

  // Discover reels take over the whole viewport (immersive, edge-to-edge black).
  if (screen === 'reels') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
          ...(Platform.OS === 'web'
            ? { height: '100vh' as any, overflow: 'hidden' as const }
            : null),
        }}
      >
        <StatusBar style="light" />
        <ReelsScreen
          theme={theme}
          currency={currency}
          onClose={() => setScreen('home')}
          onOpenProduct={openProduct}
          onAdd={addToCart}
          onShare={shareProduct}
        />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
        // On web the page root grows with content; pin the app to the viewport
        // so bottom bars stay on screen and lists scroll internally.
        ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as const } : null),
      }}
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        {screen !== 'home' ? (
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={[
              styles.hbtn,
              { backgroundColor: theme.card, borderRadius: theme.r.pill },
              theme.shadow,
            ]}
          >
            <Feather name="chevron-left" size={20} color={theme.text} />
          </Pressable>
        ) : (
          <View style={[styles.mark, { backgroundColor: theme.accent, borderRadius: theme.r.md }]}>
            <Text style={styles.markText}>{brand?.brandInitial ?? 'S'}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
          <Text
            style={[styles.title, { color: theme.text }, screen !== 'home' && { fontSize: 18 }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {screen === 'home' && brand?.tagline ? (
            <Text style={{ color: theme.faint, fontSize: 11 }} numberOfLines={1}>
              {brand.tagline}
            </Text>
          ) : null}
        </View>
        <LangToggle theme={theme} />
        {screen === 'home' && (
          <Pressable
            onPress={() => setScreen('reels')}
            hitSlop={10}
            style={[
              styles.hbtn,
              { backgroundColor: theme.accent, borderRadius: theme.r.pill, marginLeft: 8 },
              theme.shadow,
            ]}
          >
            <Feather name="film" size={18} color={theme.onAccent} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setScreen('cart')}
          hitSlop={10}
          style={[
            styles.hbtn,
            { backgroundColor: theme.card, borderRadius: theme.r.pill, marginLeft: 8 },
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
            style={{ color: theme.sub, textAlign: 'center', paddingHorizontal: 32, marginTop: 12 }}
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
              onGift={() => setScreen('gift')}
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
                setScreen('cart');
              }}
              onCall={callShop}
              onWhatsApp={() => whatsappOrder(selected)}
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
              onBrowse={() => setScreen('home')}
            />
          )}
        </>
      )}

      {/* Floating cart summary on home */}
      {screen === 'home' && !loading && !error && count > 0 && (
        <Pressable
          onPress={() => setScreen('cart')}
          style={({ pressed }) => [
            styles.cartBar,
            { backgroundColor: theme.text, borderRadius: theme.r.lg },
            theme.shadow,
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={[styles.cartBarBadge, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 13 }}>{count}</Text>
          </View>
          <Text style={styles.cartBarText}>{t('common.viewCart')}</Text>
          <Text style={[styles.cartBarText, { marginLeft: 'auto' }]}>{money(currency, total)}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hbtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 19 },
  langWrap: { flexDirection: 'row', alignItems: 'center', padding: 3, gap: 2 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6, minWidth: 34, alignItems: 'center' },
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
