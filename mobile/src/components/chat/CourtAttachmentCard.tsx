import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatAttachedCourtCard } from '@/types/domain';
import { COLORS, RADII, SPACING } from '@/theme';
import { formatVnd } from '@/utils/formatters';

interface CourtAttachmentCardProps {
  card: ChatAttachedCourtCard;
  isOwnBubble?: boolean;
  onPress: () => void;
}

export const CourtAttachmentCard: React.FC<CourtAttachmentCardProps> = ({
  card,
  isOwnBubble = false,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.container,
      isOwnBubble ? styles.ownBg : styles.partnerBg,
    ]}
  >
    <View style={styles.iconBox}>
      <Text style={styles.iconText}>🏟️</Text>
    </View>
    <View style={styles.meta}>
      <Text
        style={[styles.title, isOwnBubble && styles.ownText]}
        numberOfLines={1}
      >
        {card.groupName}
      </Text>
      <Text style={[styles.price, isOwnBubble && styles.ownPrice]}>
        {formatVnd(card.minPrice)} – {formatVnd(card.maxPrice)}
      </Text>
      <Text style={[styles.sub, isOwnBubble && styles.ownSub]}>
        {card.sportName} • Còn {card.availableCourts} sân • Nhấn để đặt ca →
      </Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADII.md,
    padding: SPACING.sm,
    marginBottom: 6,
  },
  ownBg: { backgroundColor: 'rgba(255,255,255,0.14)' },
  partnerBg: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  meta: { flex: 1, gap: 1 },
  title: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  ownText: { color: COLORS.white },
  price: { fontSize: 11.5, fontWeight: '700', color: COLORS.coral },
  ownPrice: { color: COLORS.mint },
  sub: { fontSize: 10, color: COLORS.muted },
  ownSub: { color: 'rgba(255,255,255,0.78)' },
});

