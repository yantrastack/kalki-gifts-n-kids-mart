import { useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import VideoPlayer from './VideoPlayer';
import { type Theme, thumbColor, initials } from '../theme';
import { mediaUrl } from '../api';
import { useAppWidth } from '../layout';
import type { ShopMedia } from '@stockwell/shared';

/** Gallery of a product's photos and videos: swipe, arrows (web), tappable dots, counter. */
function CarouselImage({
  uri,
  width,
  theme,
  label,
}: {
  uri: string;
  width: number;
  theme: Theme;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <View
        style={{
          width,
          height: width,
          backgroundColor: theme.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="image" size={28} color={theme.faint} />
        <Text style={{ color: theme.sub, marginTop: 6 }}>{label}</Text>
      </View>
    );
  return (
    <Image
      source={{ uri }}
      style={{ width, height: width, backgroundColor: theme.muted }}
      contentFit="cover"
      transition={250}
      onError={() => setFailed(true)}
    />
  );
}

export default function MediaCarousel({
  media,
  productName,
  theme,
}: {
  media: ShopMedia[];
  productName: string;
  theme: Theme;
}) {
  const width = useAppWidth();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<ShopMedia>>(null);

  const goTo = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };
  const showArrows = Platform.OS === 'web' && media.length > 1;

  if (!media.length) {
    return (
      <View
        style={[
          styles.fallback,
          { width, height: width, backgroundColor: thumbColor(productName) },
        ]}
      >
        <Text style={styles.fallbackText}>{initials(productName)}</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={media}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) =>
          item.type === 'video' ? (
            <VideoPlayer uri={mediaUrl(item.url)} width={width} height={width} theme={theme} />
          ) : (
            <CarouselImage
              uri={mediaUrl(item.url)}
              width={width}
              theme={theme}
              label={t('product.imageUnavailable')}
            />
          )
        }
      />
      {showArrows && index > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('product.prevImage')}
          onPress={() => goTo(index - 1)}
          style={[styles.arrow, styles.arrowLeft]}
        >
          <Feather name="chevron-left" size={22} color={theme.accent} />
        </Pressable>
      )}
      {showArrows && index < media.length - 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('product.nextImage')}
          onPress={() => goTo(index + 1)}
          style={[styles.arrow, styles.arrowRight]}
        >
          <Feather name="chevron-right" size={22} color={theme.accent} />
        </Pressable>
      )}
      {media.length > 1 && (
        <>
          <View style={styles.dots}>
            {media.map((m, i) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={t('product.goToImage', { n: i + 1 })}
                hitSlop={8}
                onPress={() => goTo(i)}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? theme.accent : 'rgba(255,255,255,0.7)' },
                  i === index && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1} / {media.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 64, fontWeight: '800' },
  // bottom clears the 20px the product sheet overlaps onto the gallery.
  dots: { position: 'absolute', bottom: 34, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 18 },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
