import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';

interface PillChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export const PillChip: React.FC<PillChipProps> = ({ label, active = false, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
  >
    <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.xs + 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  pillActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  pillIdle: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  text: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  textActive: { color: COLORS.mint },
  textIdle: { color: COLORS.muted },
});

