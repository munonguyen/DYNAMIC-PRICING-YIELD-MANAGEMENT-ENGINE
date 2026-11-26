import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';

interface MetricCardProps {
  label: string;
  value: string;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  accentColor = COLORS.ink,
}) => (
  <View style={styles.card}>
    <Text style={styles.label} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 135,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  label: { ...TYPOGRAPHY.micro, color: COLORS.muted, fontWeight: '500' },
  value: { fontSize: 15, fontWeight: '700', marginTop: 4 },
});

