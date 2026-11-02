import { useRef, useState } from 'react';
import { View, FlatList, Pressable, Platform, PixelRatio, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import VideoPlayer from './VideoPlayer';
import type { Theme } from '../theme';
import ProductImage, { ImageFallback } from './ProductImage';
import { mediaUrl } from '../api';
import { useAppWidth } from '../layout';
import { useFocusRing } from './focusRing';
import { prefersReducedMotion } from './hover';
import { pageAt, sizedImageUrl, stepIndex } from './gallery';
import { GalleryArrows, GalleryCounter } from './GalleryControls';
import type { ShopMedia } from '@stockwell/shared';

const CALM = prefersReducedMotion();
const THUMB = 56;

/**
 * Product gallery: the selected photo or video large, then (with 2+ items) a row of
 * thumbnails. Swipe, arrow buttons (web), thumbnails and the keyboard (← / → while the
 * gallery has focus, web) all move the same index, so photo, thumbnail and counter stay
 * in sync. Screen readers hear "Photo 2 of 3" when it changes.
 */
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
  const count = media.length;

  const goTo = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: !CALM });
  };
  const step = (delta: number) => goTo(stepIndex(index, delta, count));

  if (!count) {
    return (
      <ImageFallback
        theme={theme}
        iconSize={56}
        caption={t('card.noPhoto')}
        style={{ width, height: width }}
      />
    );
  }

  const position = t('product.imagePosition', { n: index + 1, total: count });

  // Web only: ← / → steps through the gallery while focus is inside it.
  const keyHandler =
    Platform.OS === 'web' && count > 1
      ? {
          onKeyDown: (e: any) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              step(e.key === 'ArrowLeft' ? -1 : 1);
            }
          },
        }
      : null;

  return (
    <View {...(keyHandler as any)}>
      <View>
        <FlatList
          ref={listRef}
          data={media}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          // onScroll (not onMomentumScrollEnd): mobile web never fires momentum events.
          scrollEventThrottle={32}
          onScroll={(e) => {
            const i = pageAt(e.nativeEvent.contentOffset.x, width, count);
            if (i !== index) setIndex(i);
          }}
          renderItem={({ item, index: i }) =>
            item.type === 'video' ? (
              // Only the slide on screen plays; the others stay paused.
              <VideoPlayer
                uri={mediaUrl(item.url)}
                width={width}
                height={width}
                theme={theme}
                active={i === index}
              />
            ) : (
              <ProductImage
                uri={sizedImageUrl(mediaUrl(item.url), width, PixelRatio.get())}
                // Whole product visible (no crop) on a neutral background.
                fit="contain"
                label={
                  count > 1
                    ? `${t('card.photo', { name: productName })}, ${t('product.imagePosition', { n: i + 1, total: count })}`
                    : t('card.photo', { name: productName })
                }
                theme={theme}
                style={{ width, height: width }}
                // The gallery is the top of the product page: load the first photo first.
                priority={i === 0}
                transition={CALM ? 0 : 250}
                iconSize={56}
                caption={t('product.imageUnavailable')}
              />
            )
          }
        />
        <GalleryArrows
          count={count}
          theme={theme}
          prevLabel={t('product.prevImage')}
          nextLabel={t('product.nextImage')}
          onStep={step}
        />
        <GalleryCounter index={index} count={count} label={position} />
      </View>

      {count > 1 && (
        <View
          style={[styles.thumbs, { backgroundColor: theme.bg }]}
          accessibilityRole={Platform.OS === 'web' ? ('list' as any) : undefined}
        >
          {media.map((m, i) => (
            <Thumb
              key={m.id}
              media={m}
              selected={i === index}
              theme={theme}
              label={t('product.goToImage', { n: i + 1, total: count })}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Thumb({
  media,
  selected,
  theme,
  label,
  onPress,
}: {
  media: ShopMedia;
  selected: boolean;
  theme: Theme;
  label: string;
  onPress: () => void;
}) {
  const ring = useFocusRing(theme, 12);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // Web: aria-current marks the shown photo (aria-selected is not valid on a button).
      {...({ 'aria-current': selected ? 'true' : undefined } as any)}
      onPress={onPress}
      {...ring.handlers}
      style={[
        styles.thumb,
        {
          borderColor: selected ? theme.accentInk : theme.border,
          backgroundColor: theme.muted,
          opacity: selected ? 1 : 0.75,
        },
        ring.ring,
      ]}
    >
      {media.type === 'video' ? (
        <View style={styles.thumbVideo}>
          <Feather name="play" size={18} color={theme.sub} />
        </View>
      ) : (
        // Decorative: the button's label already says which photo it shows.
        <ProductImage
          uri={mediaUrl(media.url)}
          label=""
          theme={theme}
          style={styles.thumbImg}
          transition={0}
          iconSize={16}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // paddingBottom: the product sheet below overlaps the gallery by 20px.
  thumbs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 32,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
