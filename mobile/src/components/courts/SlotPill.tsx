import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SlotListingQuote } from '@/types/domain';
import { COLORS, RADII, SPACING } from '@/theme';
import { formatSlotWindow, formatVnd } from '@/utils/formatters';

interface SlotPillProps {
  slot: SlotListingQuote;
  selected: boolean;
  onPress: () => void;
}

export const SlotPill: React.FC<SlotPillProps> = ({ slot, selected, onPress }) => {
  const soldOut = slot.availableCourts <= 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={soldOut}
      style={[
        styles.container,
        soldOut ? styles.soldOut : selected ? styles.selected : styles.idle,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.windowText, selected && styles.textSelected]}>
          {formatSlotWindow(slot.slotStart, slot.slotEnd)}
        </Text>
        <Text
          style={[
            styles.tagText,
            selected
              ? styles.tagSelected
              : slot.demandTag === 'PRIME_SURGE'
                ? styles.tagSurge
                : styles.tagNormal,
          ]}
        >
          {soldOut
            ? 'Hết sân'
            : slot.demandTag === 'PRIME_SURGE'
              ? 'Cao điểm'
              : 'Khả dụng'}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={[styles.availText, selected && styles.subSelected]}>
          Còn {slot.availableCourts}/{slot.totalCapacity} sân
        </Text>
        <Text style={[styles.priceText, selected && styles.priceSelected]}>
          {formatVnd(slot.currentDynamicPrice)}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADII.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 6,
  },
  idle: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  selected: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  soldOut: { backgroundColor: COLORS.surfaceSoft, borderColor: COLORS.border, opacity: 0.5 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  windowText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  textSelected: { color: COLORS.white },
  tagText: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  tagSelected: { backgroundColor: COLORS.mint, color: COLORS.mintInk },
  tagSurge: { backgroundColor: COLORS.amberBg, color: COLORS.amberText },
  tagNormal: { backgroundColor: COLORS.surfaceSoft, color: COLORS.muted },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  availText: { fontSize: 11.5, color: COLORS.muted },
  subSelected: { color: 'rgba(255,255,255,0.82)' },
  priceText: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  priceSelected: { color: COLORS.mint },
});

