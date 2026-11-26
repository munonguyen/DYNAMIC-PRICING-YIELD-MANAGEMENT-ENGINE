import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PriceQuote, PublishedListing } from '@/types/domain';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { formatVnd, getInitials } from '@/utils/formatters';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SlotPill } from '@/components/courts/SlotPill';

interface CourtDetailScreenProps {
  listing: PublishedListing;
  activeSlotStart: string;
  activeQuote: PriceQuote | null;
  countdownLabel: string;
  onSelectSlot: (listing: PublishedListing, slotStart: string) => void;
  onProceedToCheckout: () => void;
  onOpenLessorShop: (providerId: string) => void;
  onOpenChat: (listing: PublishedListing) => void;
  onBack: () => void;
}

export const CourtDetailScreen: React.FC<CourtDetailScreenProps> = ({
  listing,
  activeSlotStart,
  activeQuote,
  countdownLabel,
  onSelectSlot,
  onProceedToCheckout,
  onOpenLessorShop,
  onOpenChat,
  onBack,
}) => {
  const effectivePrice = activeQuote?.currentPrice ?? listing.basePrice;
  const depositAmount = Math.floor((effectivePrice * listing.depositPercent) / 100);

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            Chi tiết cụm sân
          </Text>
          <Pressable onPress={() => onOpenChat(listing)} style={styles.chatTag}>
            <Text style={styles.chatTagText}>💬 Chat</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Price Hero */}
        <View style={styles.priceHero}>
          <Text style={styles.sportPill}>
            {listing.sportName} • {listing.slotMinutes} phút/ca
          </Text>
          <Text style={styles.courtTitle}>{listing.groupName}</Text>
          <Text style={styles.address}>
            {listing.venueName} • {listing.venueAddress}
          </Text>

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.priceLabel}>Giá động ca đang chọn</Text>
              <Text style={styles.priceValue}>{formatVnd(effectivePrice)}</Text>
            </View>
            <View style={styles.lockBox}>
              <Text style={styles.lockBadge}>Khóa giá {countdownLabel}</Text>
              <Text style={styles.depositLine}>
                Đặt cọc {listing.depositPercent}%: {formatVnd(depositAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Slot Matrix Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn khung giờ thi đấu</Text>
          <View style={styles.slotsStack}>
            {listing.upcomingSlots.map((slot) => (
              <SlotPill
                key={slot.slotStart}
                slot={slot}
                selected={slot.slotStart === activeSlotStart}
                onPress={() => onSelectSlot(listing, slot.slotStart)}
              />
            ))}
          </View>
        </View>

        {/* Shopee-Style Lessor Preview Strip */}
        <View style={styles.lessorCard}>
          <View style={styles.lessorHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(listing.provider.providerName)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lessorTag}>Bên cho thuê • ✓ KYC Pháp lý</Text>
              <Text style={styles.lessorName}>{listing.provider.providerName}</Text>
              <Text style={styles.lessorStats}>
                {listing.provider.totalManagedCourts} sân • Phản hồi{' '}
                {listing.provider.responseRatePct}%
              </Text>
            </View>
          </View>

          <View style={styles.lessorBtns}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="💬 Nhắn Chủ Sân"
                onPress={() => onOpenChat(listing)}
                variant="outline"
                compact
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Xem Gian Hàng →"
                onPress={() => onOpenLessorShop(listing.provider.providerId)}
                variant="ink"
                compact
              />
            </View>
          </View>
        </View>

        {/* Technical Specs & Escrow Policy */}
        <View style={styles.specsCard}>
          <Text style={styles.sectionTitle}>Thông số mặt sân &amp; Chính sách</Text>
          <Text style={styles.specLine}>• Mặt sân: {listing.surface}</Text>
          <Text style={styles.specLine}>• Chiếu sáng: {listing.lighting}</Text>
          <Text style={styles.specLine}>• Tiện ích: {listing.amenities.join(', ')}</Text>
          <Text style={styles.guaranteeNote}>{listing.provider.platformGuarantee}</Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Checkout CTA Bar (Thumb-friendly) */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomLabel}>Tiền cọc giữ sân</Text>
            <Text style={styles.bottomAmount}>{formatVnd(depositAmount)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Giữ Ca & Đặt Cọc →"
              onPress={onProceedToCheckout}
              variant="forest"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  topSafe: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  topTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, flex: 1, textAlign: 'center' },
  chatTag: {
    backgroundColor: COLORS.forestSoft,
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chatTagText: { fontSize: 11.5, fontWeight: '700', color: COLORS.forest },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 24 },
  priceHero: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 6,
  },
  sportPill: { fontSize: 11.5, fontWeight: '700', color: COLORS.forest },
  courtTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  address: { fontSize: 12, color: COLORS.muted },
  priceBox: {
    marginTop: 8,
    backgroundColor: COLORS.forestSoft,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 11, color: COLORS.muted },
  priceValue: { fontSize: 22, fontWeight: '800', color: COLORS.forest },
  lockBox: { alignItems: 'flex-end', gap: 4 },
  lockBadge: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.mintInk,
  },
  depositLine: { fontSize: 11.5, fontWeight: '700', color: COLORS.ink },
  section: { gap: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  slotsStack: { gap: SPACING.sm },
  lessorCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  lessorHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.mint },
  lessorTag: { fontSize: 10.5, fontWeight: '700', color: COLORS.forest },
  lessorName: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  lessorStats: { fontSize: 11.5, color: COLORS.muted },
  lessorBtns: { flexDirection: 'row', gap: SPACING.sm },
  specsCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 6,
  },
  specLine: { fontSize: 12.5, color: COLORS.ink, lineHeight: 19 },
  guaranteeNote: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.sky,
    backgroundColor: COLORS.skySoft,
    padding: SPACING.md,
    borderRadius: RADII.md,
  },
  bottomSafe: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  bottomLabel: { fontSize: 11, color: COLORS.muted },
  bottomAmount: { fontSize: 16, fontWeight: '800', color: COLORS.coral },
});

