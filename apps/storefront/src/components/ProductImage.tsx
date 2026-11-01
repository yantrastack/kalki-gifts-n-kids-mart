import { useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '../theme';

/**
 * The one placeholder for a product with no photo, or whose photo failed to load: a soft
 * tile with a gift icon (and an optional caption). Used by every product image in the app
 * so missing images look intentional and alike everywhere.
 */
export function ImageFallback({
  theme,
  iconSize = 28,
  caption,
  style,
}: {
  theme: Theme;
  iconSize?: number;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fallback, { backgroundColor: theme.muted }, style]}>
      <Feather name="gift" size={iconSize} color={theme.faint} />
      {caption ? (
        <Text style={[styles.caption, { color: theme.sub }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A product photo that falls back to {@link ImageFallback} when there is no URL or the load
 * fails. `label` becomes the image's alt text (expo-image on web only turns
 * accessibilityLabel into <img alt>). Pass `priority` for images above the fold; the rest
 * load lazily on web.
 */
export default function ProductImage({
  uri,
  label,
  theme,
  style,
  priority = false,
  transition = 200,
  iconSize,
  caption,
  hideOnError = false,
}: {
  uri?: string | null;
  label: string;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  priority?: boolean;
  transition?: number;
  iconSize?: number;
  caption?: string;
  /** Render nothing (instead of the placeholder) when missing or failed: for overlays. */
  hideOnError?: boolean;
}) {
  // Remember which URL failed, so a new URL (e.g. a recycled list cell) gets a fresh try.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) {
    if (hideOnError) return null;
    return <ImageFallback theme={theme} iconSize={iconSize} caption={caption} style={style} />;
  }
  return (
    <Image
      source={{ uri }}
      style={[{ backgroundColor: theme.muted }, style as any]}
      contentFit="cover"
      transition={transition}
      priority={priority ? 'high' : 'normal'}
      loading={priority ? 'eager' : 'lazy'}
      recyclingKey={uri}
      accessibilityLabel={label}
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  caption: { fontSize: 13, marginTop: 6, fontWeight: '600' },
});
