import { type ReactNode, useState } from 'react';
import {
  Platform,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import type { Theme } from '../theme';

/** Width of the focus ring. It is always reserved (transparent when blurred) so focus never shifts layout. */
export const FOCUS_RING = 2;

type Props = Omit<TextInputProps, 'style'> & {
  theme: Theme;
  /** Style for the rounded container (background, radius, padding, size, shadow). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Style for the text itself (color, font size, vertical padding). */
  inputStyle?: TextInputProps['style'];
  /** Content before / after the text, e.g. a search icon or clear button. */
  left?: ReactNode;
  right?: ReactNode;
};

/**
 * Text input whose focus indicator follows the rounded container.
 *
 * On web, react-native-web renders a square `<input>` with no outline reset, so the
 * browser draws its default black focus ring inside the pill. We remove that ring and
 * instead show a themed accent border on the container.
 */
export default function ThemedInput({
  theme,
  containerStyle,
  inputStyle,
  left,
  right,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.container,
        containerStyle,
        { borderColor: focused ? theme.accent : 'transparent' },
      ]}
    >
      {left}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, inputStyle, Platform.OS === 'web' && styles.noOutline]}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderWidth: FOCUS_RING },
  input: { flex: 1, minWidth: 0 },
  noOutline: { outlineStyle: 'none', outlineWidth: 0 } as any,
});
