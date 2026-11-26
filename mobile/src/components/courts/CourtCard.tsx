import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublishedListing } from '@/types/domain';
import { COLORS, RADII, SHADOWS, SPACING, TYPOGRAPHY } from '@/theme';
import { formatVnd } from '@/utils/formatters';

interface CourtCardProps {
  listing: PublishedListing;
  onPressCourt: (listing: PublishedListing) => void;
  onPressLessor?: (providerId: string) => void;
  onPressAskChat?: (listing: PublishedListing) => void;
  compact?: boolean;
}

export const CourtCard: React.FC<CourtCardProps> = ({
  listing,
  onPressCourt,
  onPressLessor,
  onPressAskChat,
  compact = false,
}) => {
  const maxAvailable = Math.max(0, ...listing.upcomingSlots.map((s) => s.availableCourts));

  return (
    <Pressable
      onPress={() => onPressCourt(listing)}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      {/* Top Visual Banner */}
      <View style={[styles.cover, compact && styles.coverCompact]}>
        <View style={styles.badgeRow}>
          <View style={styles.coralBadge}>
            <Text style={styles.coralBadgeText}>Yêu thích</Text>
          </View>
          <View
            style={[
              styles.availBadge,
              maxAvailable > 0 ? styles.availOk : styles.availSoldOut,
            ]}
          >
            <Text
              style={[
                styles.availText,
                maxAvailable > 0 ? styles.availTextOk : styles.availTextSoldOut,
              ]}
            >
              {maxAvailable > 0 ? `Còn ${maxAvailable} sân` : 'Kín ca'}
            </Text>
          </View>
        </View>

        <View style={styles.coverBottom}>
          <Text style={styles.sportTag}>{listing.sportName}</Text>
          <View style={styles.depositPill}>
            <Text style={styles.depositPillText}>Cọc {listing.depositPercent}%</Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.body}>
        {onPressLessor ? (
          <Pressable
            onPress={() => onPressLessor(listing.provider.providerId)}
            hitSlop={6}
          >
            <Text style={styles.providerName} numberOfLines={1}>
              {listing.provider.providerName} ›
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.providerName} numberOfLines={1}>
            {listing.provider.providerName}
          </Text>
        )}

        <Text style={styles.title} numberOfLines={2}>
          {listing.groupName}
        </Text>

        <Text style={styles.location} numberOfLines={1}>
          {listing.district}, {listing.city} • {listing.slotMinutes}p/ca
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatVnd(listing.minPrice)}</Text>
          <Text style={styles.rating}>★ {listing.rating.toFixed(1)}</Text>
        </View>
      </View>

      {onPressAskChat ? (
        <View style={styles.footerActions}>
          <Pressable
            onPress={() => onPressAskChat(listing)}
            style={styles.chatQuickBtn}
          >
            <Text style={styles.chatQuickText}>💬 Hỏi ca</Text>
          </Pressable>
          <Pressable
            onPress={() => onPressCourt(listing)}
            style={styles.bookQuickBtn}
          >
            <Text style={styles.bookQuickText}>Đặt lịch →</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardCompact: { flex: 1 },
  pressed: { opacity: 0.92 },
  cover: {
    height: 118,
    backgroundColor: COLORS.forestDark,
    padding: SPACING.sm + 2,
    justifyContent: 'space-between',
  },
  coverCompact: { height: 100 },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  coralBadge: {
    backgroundColor: COLORS.coral,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coralBadgeText: { fontSize: 9.5, fontWeight: '800', color: COLORS.white },
  availBadge: { borderRadius: RADII.pill, paddingHorizontal: 8, paddingVertical: 2 },
  availOk: { backgroundColor: COLORS.mint },
  availSoldOut: { backgroundColor: COLORS.danger },
  availText: { fontSize: 10, fontWeight: '700' },
  availTextOk: { color: COLORS.mintInk },
  availTextSoldOut: { color: COLORS.white },
  coverBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  depositPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.sm,
  },
  depositPillText: { fontSize: 10, fontWeight: '700', color: COLORS.mint },
  body: { padding: SPACING.md, gap: 4 },
  providerName: { fontSize: 10.5, fontWeight: '700', color: COLORS.sky },
  title: { ...TYPOGRAPHY.cardTitle, color: COLORS.ink },
  location: { fontSize: 11, color: COLORS.muted },
  priceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: { fontSize: 14, fontWeight: '800', color: COLORS.coral },
  rating: { fontSize: 11.5, fontWeight: '700', color: '#D97706' },
  footerActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceSoft,
  },
  chatQuickBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.borderLight,
  },
  chatQuickText: { fontSize: 11.5, fontWeight: '600', color: COLORS.muted },
  bookQuickBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  bookQuickText: { fontSize: 11.5, fontWeight: '700', color: COLORS.forest },
});

