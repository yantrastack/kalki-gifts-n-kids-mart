import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import { type Theme, money, thumbColor, initials } from '../theme';
import { type Product, type Brand, mediaUrl } from '../api';

export type CartItem = { product: Product; qty: number };

export default function CartScreen({
  items,
  theme,
  brand,
  onInc,
  onDec,
  onRemove,
  onCall,
  onWhatsApp,
  onBrowse,
}: {
  items: CartItem[];
  theme: Theme;
  brand: Brand;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
          <Feather name="shopping-bag" size={30} color={theme.accent} />
        </View>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 16 }}>
          {t('cart.empty')}
        </Text>
        <Text style={{ color: theme.sub, fontSize: 13, marginTop: 4 }}>{t('cart.emptySub')}</Text>
        <Pressable
          onPress={onBrowse}
          style={({ pressed }) => [
            styles.browse,
            { backgroundColor: theme.accent, borderRadius: theme.r.pill },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: '700', fontSize: 14 }}>
            {t('cart.browse')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.product.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const cover = item.product.media.find((m) => m.type === 'image') ?? item.product.media[0];
          return (
            <View
              style={[
                styles.row,
                { backgroundColor: theme.card, borderRadius: theme.r.lg },
                theme.shadow,
              ]}
            >
              <View
                style={[
                  styles.thumb,
                  {
                    borderRadius: theme.r.md,
                    backgroundColor: cover ? theme.muted : thumbColor(item.product.name),
                  },
                ]}
              >
                {cover ? (
                  <Image
                    source={{ uri: mediaUrl(cover.url) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {initials(item.product.name)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={{ color: theme.sub, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                  {money(brand.currency, item.product.price)}
                </Text>
                <View style={styles.qtyRow}>
                  <QtyBtn theme={theme} icon="minus" onPress={() => onDec(item.product.id)} />
                  <Text
                    style={{
                      color: theme.text,
                      minWidth: 28,
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {item.qty}
                  </Text>
                  <QtyBtn theme={theme} icon="plus" onPress={() => onInc(item.product.id)} />
                  <Pressable
                    onPress={() => onRemove(item.product.id)}
                    hitSlop={10}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Feather name="trash-2" size={16} color={theme.faint} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <View style={styles.totalRow}>
          <Text style={{ color: theme.sub, fontSize: 14 }}>{t('cart.items', { count })}</Text>
          <Text style={[styles.total, { color: theme.text }]}>{money(brand.currency, total)}</Text>
        </View>
        <Pressable
          onPress={onWhatsApp}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: '#1FAF57', borderRadius: theme.r.lg },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="message-circle" size={18} color="#fff" />
          <Text style={styles.ctaText}>{t('cart.orderWhatsapp')}</Text>
        </Pressable>
        <Pressable
          onPress={onCall}
          style={({ pressed }) => [
            styles.cta,
            styles.ctaSecondary,
            { borderColor: theme.border, borderRadius: theme.r.lg },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="phone" size={17} color={theme.text} />
          <Text style={[styles.ctaText, { color: theme.text }]}>{t('cart.callToOrder')}</Text>
        </Pressable>
        <Text style={{ color: theme.faint, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          {t('cart.payNote')}
        </Text>
      </View>
    </View>
  );
}

function QtyBtn({ theme, icon, onPress }: { theme: Theme; icon: any; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.qbtn,
        { backgroundColor: theme.muted, borderRadius: theme.r.sm },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Feather name={icon} size={14} color={theme.text} />
    </Pressable>
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
  browse: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12 },
  row: { flexDirection: 'row', padding: 12, marginBottom: 10 },
  thumb: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qbtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1, padding: 16, paddingBottom: 24 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  total: { fontSize: 22, fontWeight: '800' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    marginTop: 8,
  },
  ctaSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
