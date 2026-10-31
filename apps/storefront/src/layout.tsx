import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

/**
 * On web the storefront keeps its mobile-app layout: it renders inside a
 * centered column no wider than this, with a neutral page around it on
 * desktop. Native apps always use the full device width.
 */
export const APP_MAX_WIDTH = 480;

const isWeb = Platform.OS === 'web';

/** Width of the app column — use instead of `useWindowDimensions().width`. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return isWeb ? Math.min(width, APP_MAX_WIDTH) : width;
}

/** Web-only centered, mobile-width frame. A no-op on native. */
export function AppFrame({ children, background }: { children: ReactNode; background: string }) {
  if (!isWeb) return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={[styles.column, { backgroundColor: background }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    height: '100vh' as any,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#E7E3DC',
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
