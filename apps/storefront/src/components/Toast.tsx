import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

/**
 * A small non-interactive pill: it appears at once, stays, fades out over the last `fade`
 * ms, then calls `onDone` so the parent can unmount it. `duration` is the whole time it is
 * on screen, the fade included.
 *
 * Give every new message a new `id`: the timer and animation restart from scratch (the old
 * ones are cancelled), so toasts never stack or flicker. Unmounting cancels it too.
 * Screen readers hear `text` politely, without moving focus.
 */
export default function Toast({
  id,
  text,
  onDone,
  top = 102,
  duration = 1000,
  fade = 180,
}: {
  id: number | string;
  text: string;
  onDone: () => void;
  /** Distance from the top of the screen. */
  top?: number;
  duration?: number;
  fade?: number;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const done = useRef(onDone);
  done.current = onDone;

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts only when a new toast (id) arrives
  useEffect(() => {
    const native = Platform.OS !== 'web';
    // Starts fully visible: a fade-IN would keep it invisible whenever the browser pauses
    // animation frames (hidden or background window). Only the fade-out is animated.
    opacity.setValue(1);
    const run = Animated.sequence([
      Animated.delay(Math.max(duration - fade, 0)),
      Animated.timing(opacity, { toValue: 0, duration: fade, useNativeDriver: native }),
    ]);
    run.start();
    // The timer, not the animation, ends the toast: animation frames can be throttled (a
    // background tab), which would stretch the time. The fade is only the visual.
    const timer = setTimeout(() => done.current(), duration);
    return () => {
      run.stop();
      clearTimeout(timer);
    };
  }, [id]);

  return (
    <Animated.View
      style={[styles.toast, { top, opacity }]}
      pointerEvents="none"
      role="status"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 30,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    // A dimmed (soft grey, translucent) pill, not near-black, with white text. Even over a
    // white page it blends to about #727272, so white text stays at 4.8:1 (WCAG AA, 4.5:1).
    // Don't go lighter than this without changing the text colour.
    backgroundColor: 'rgba(64,60,56,0.74)',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
