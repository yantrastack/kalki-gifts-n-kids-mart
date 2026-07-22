import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { type Theme, thumbColor, initials } from '../theme';
import { mediaUrl } from '../api';
import type { ShopMedia } from '@stockwell/shared';

/** Swipeable gallery of a product's photos and videos, with dot indicators. */
export default function MediaCarousel({
  media,
  productName,
  theme,
}: {
  media: ShopMedia[];
  productName: string;
  theme: Theme;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

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
        data={media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) =>
          item.type === 'video' ? (
            <VideoSlide uri={mediaUrl(item.url)} size={width} theme={theme} />
          ) : (
            <Image
              source={{ uri: mediaUrl(item.url) }}
              style={{ width, height: width, backgroundColor: theme.muted }}
              contentFit="cover"
              transition={250}
            />
          )
        }
      />
      {media.length > 1 && (
        <>
          <View style={styles.dots}>
            {media.map((m, i) => (
              <View
                key={m.id}
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

function VideoSlide({ uri, size, theme }: { uri: string; size: number; theme: Theme }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: size, height: size, backgroundColor: theme.text }}
      contentFit="cover"
      nativeControls
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 64, fontWeight: '800' },
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 18 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
