import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MediaCarousel from '../components/MediaCarousel';
import { useI18n } from '../i18n';
import { type Theme, money } from '../theme';
import type { Product, Brand } from '../api';

export default function ProductScreen({
  product,
  theme,
  brand,
  onAdd,
  onCall,
  onWhatsApp,
}: {
  product: Product;
  theme: Theme;
  brand: Brand;
  onAdd: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
}) {
  const { t } = useI18n();
  const low = product.inStock <= 10;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <MediaCarousel media={product.media} productName={product.name} theme={theme} />

        <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
          {product.tag ? (
            <View
              style={[
                styles.tagPill,
                { backgroundColor: theme.accentSoft, borderRadius: theme.r.pill },
              ]}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                {product.tag}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
          <Text style={[styles.meta, { color: theme.faint }]}>
            {[product.brand, product.category].filter(Boolean).join(' · ')}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: theme.text }]}>
              {money(brand.currency, product.price)}
            </Text>
            <View
              style={[
                styles.stockPill,
                {
                  backgroundColor: low ? `${theme.warn}1A` : `${theme.success}1A`,
                  borderRadius: theme.r.pill,
                },
              ]}
            >
              <View
                style={[styles.stockDot, { backgroundColor: low ? theme.warn : theme.success }]}
              />
              <Text
                style={{ color: low ? theme.warn : theme.success, fontSize: 12, fontWeight: '700' }}
              >
                {low ? t('product.onlyLeft', { count: product.inStock }) : t('product.inStock')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.card, borderRadius: theme.r.lg },
              theme.shadow,
            ]}
          >
            <InfoRow theme={theme} icon="hash" label={t('product.sku')} value={product.sku} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <InfoRow
              theme={theme}
              icon="map-pin"
              label={t('product.pickup')}
              value={brand.address || t('product.atShop')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <InfoRow
              theme={theme}
              icon="credit-card"
              label={t('product.payment')}
              value={t('product.payAtShop')}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <RoundAction
              theme={theme}
              icon="phone"
              label={t('product.callShop')}
              onPress={onCall}
            />
            <RoundAction
              theme={theme}
              icon="message-circle"
              label={t('product.whatsapp')}
              onPress={onWhatsApp}
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}
      >
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.accent, borderRadius: theme.r.lg },
            pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
          ]}
        >
          <Feather name="shopping-bag" size={18} color={theme.onAccent} />
          <Text style={[styles.ctaText, { color: theme.onAccent }]}>
            {t('product.addToCart')} · {money(brand.currency, product.price)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({
  theme,
  icon,
  label,
  value,
}: {
  theme: Theme;
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={15} color={theme.faint} style={{ width: 24 }} />
      <Text style={{ color: theme.sub, fontSize: 13, width: 70 }}>{label}</Text>
      <Text
        style={{ color: theme.text, fontSize: 13, fontWeight: '500', flex: 1 }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function RoundAction({
  theme,
  icon,
  label,
  onPress,
}: {
  theme: Theme;
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.card, borderRadius: theme.r.lg },
        theme.shadow,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Feather name={icon} size={17} color={theme.accent} />
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 20 },
  tagPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  name: { fontSize: 23, fontWeight: '700', lineHeight: 29 },
  meta: { fontSize: 13, marginTop: 4 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  price: { fontSize: 27, fontWeight: '800' },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stockDot: { width: 7, height: 7, borderRadius: 4 },
  infoCard: { marginTop: 18, paddingHorizontal: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  bottomBar: { padding: 14, paddingBottom: 22, borderTopWidth: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
