import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

/**
 * On web the storefront keeps its mobile-app layout: it renders inside a
 * centered column no wider than this, with a neutral page around it on
 * desktop. Native apps always use the full device width.
 */
export const APP_MAX_WIDTH = 480;

const isWeb = Platform.OS === 'web';

/** Page colour around the column on desktop web. */
const PAGE_BG = '#E7E3DC';

/**
 * Full viewport height on web. `100dvh` follows the mobile browser toolbar (with `100vh`
 * the bottom of the screen sat under it); older browsers without `dvh` get `100vh`.
 */
const VIEWPORT_HEIGHT =
  isWeb && (globalThis as any).CSS?.supports?.('height', '100dvh') ? '100dvh' : '100vh';

/** Width of the app column — use instead of `useWindowDimensions().width`. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return isWeb ? Math.min(width, APP_MAX_WIDTH) : width;
}

/**
 * Web-only centered, mobile-width frame. A no-op on native. `page` overrides the colour
 * around the column (Discover uses a dark backdrop so the reel stands on a stage).
 */
export function AppFrame({
  children,
  background,
  page = PAGE_BG,
}: {
  children: ReactNode;
  background: string;
  page?: string;
}) {
  if (!isWeb) return <>{children}</>;
  return (
    <View style={[styles.page, { backgroundColor: page }]}>
      <View style={[styles.column, { backgroundColor: background }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    height: VIEWPORT_HEIGHT as any,
    overflow: 'hidden',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    overflow: 'hidden',
    // Only visible once the window is wider than the column.
    shadowColor: '#1A140D',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
});
