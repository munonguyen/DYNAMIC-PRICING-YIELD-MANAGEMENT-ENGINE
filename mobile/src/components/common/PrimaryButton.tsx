import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, RADII, SPACING } from '@/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'forest' | 'outline' | 'ink' | 'coral';
  disabled?: boolean;
  compact?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'forest',
  disabled = false,
  compact = false,
}) => {
  const isOutline = variant === 'outline';
  const bgStyle =
    variant === 'ink'
      ? styles.inkBg
      : variant === 'coral'
        ? styles.coralBg
        : isOutline
          ? styles.outlineBg
          : styles.forestBg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        bgStyle,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          isOutline ? styles.outlineText : styles.solidText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  regular: { minHeight: 46 },
  compact: { minHeight: 38, paddingHorizontal: SPACING.md },
  forestBg: { backgroundColor: COLORS.forest },
  inkBg: { backgroundColor: COLORS.ink },
  coralBg: { backgroundColor: COLORS.coral },
  outlineBg: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  label: { fontSize: 13.5, fontWeight: '700' },
  labelCompact: { fontSize: 12 },
  solidText: { color: COLORS.white },
  outlineText: { color: COLORS.ink },
});

