import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import type { Theme } from '../theme';

/** Soft pulsing placeholder block shown while content loads. */
export default function Skeleton({ theme, style }: { theme: Theme; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ backgroundColor: theme.muted, borderRadius: theme.r.md, opacity: pulse }, style]}
    />
  );
}
