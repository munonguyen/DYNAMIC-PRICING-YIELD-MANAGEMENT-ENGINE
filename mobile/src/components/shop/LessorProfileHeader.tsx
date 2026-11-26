import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VenueProviderInfo } from '@/types/domain';
import { COLORS, RADII, SHADOWS, SPACING, TYPOGRAPHY } from '@/theme';
import { formatCompactCount, getInitials } from '@/utils/formatters';

interface LessorProfileHeaderProps {
  provider: VenueProviderInfo;
  courtGroupsCount: number;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onPressChat: () => void;
}

export const LessorProfileHeader: React.FC<LessorProfileHeaderProps> = ({
  provider,
  courtGroupsCount,
  isFollowed,
  onToggleFollow,
  onPressChat,
}) => {
  const followerTotal = provider.followersCount + (isFollowed ? 1 : 0);

  return (
    <View style={styles.wrapper}>
      {/* Dark Shopee-Style Identity Banner */}
      <View style={styles.darkBanner}>
        <View style={styles.topRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(provider.providerName)}</Text>
            </View>
            <View style={styles.preferredPill}>
              <Text style={styles.preferredText}>Yêu Thích</Text>
            </View>
          </View>

          <View style={styles.identityMeta}>
            <View style={styles.badges}>
              <Text style={styles.badgeText}>{provider.badge}</Text>
              {provider.verified ? (
                <Text style={styles.kycText}>✓ KYC Pháp lý</Text>
              ) : null}
            </View>
            <Text style={styles.shopName} numberOfLines={1}>
              {provider.providerName}
            </Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{provider.onlineStatusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Action Row: + Theo Dõi & Chat */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={onToggleFollow}
            style={[
              styles.bannerBtn,
              isFollowed ? styles.followingBtn : styles.followIdleBtn,
            ]}
          >
            <Text style={[styles.bannerBtnText, isFollowed && styles.followingBtnText]}>
              {isFollowed ? '✓ Đang Theo Dõi' : '+ Theo Dõi'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onPressChat}
            style={[styles.bannerBtn, styles.chatBannerBtn]}
          >
            <Text style={styles.bannerBtnText}>💬 Chat Ngay</Text>
          </Pressable>
        </View>
      </View>

      {/* 2-Column Storefront Metrics Grid (Image 2 style) */}
      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Số Sân &amp; Cụm</Text>
          <Text style={[styles.statValue, { color: COLORS.forest }]}>
            {provider.totalManagedCourts} sân ({courtGroupsCount} cụm)
          </Text>
        </View>

        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Người Theo Dõi</Text>
          <Text style={[styles.statValue, { color: COLORS.forest }]}>
            {formatCompactCount(followerTotal)}
          </Text>
        </View>

        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Phản Hồi Chat</Text>
          <Text style={[styles.statValue, { color: COLORS.coral }]}>
            {provider.responseRatePct}% ({provider.responseTimeLabel})
          </Text>
        </View>

        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Tham Gia &amp; Chiết Khấu</Text>
          <Text style={styles.statValue}>
            {provider.joinedLabel} • {provider.commissionRatePct}%/đơn
          </Text>
        </View>
      </View>

      {/* Voucher Strip */}
      <View style={styles.voucherRow}>
        <View style={styles.voucherTag}>
          <Text style={styles.voucherTagText}>ƯU ĐÃI</Text>
        </View>
        <Text style={styles.voucherBody} numberOfLines={2}>
          {provider.voucherLabel} • {provider.district}, {provider.city}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  darkBanner: {
    backgroundColor: COLORS.forestDark,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatarWrap: { position: 'relative', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.forest,
    borderWidth: 2,
    borderColor: 'rgba(231,247,212,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.mint },
  preferredPill: {
    marginTop: -10,
    backgroundColor: COLORS.coral,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  preferredText: { fontSize: 9, fontWeight: '800', color: COLORS.white },
  identityMeta: { flex: 1, gap: 3 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.mint,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  kycText: { fontSize: 10, fontWeight: '700', color: '#6EE7B7' },
  shopName: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  onlineText: { fontSize: 11.5, color: 'rgba(255,255,255,0.78)' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  bannerBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADII.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followIdleBtn: { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.08)' },
  followingBtn: { borderColor: COLORS.mint, backgroundColor: COLORS.mint },
  chatBannerBtn: { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.12)' },
  bannerBtnText: { fontSize: 12.5, fontWeight: '700', color: COLORS.white },
  followingBtnText: { color: COLORS.forest },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statCell: {
    width: '48%',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADII.md,
    padding: SPACING.sm + 2,
  },
  statLabel: { ...TYPOGRAPHY.micro, color: COLORS.muted, fontWeight: '500' },
  statValue: { fontSize: 12.5, fontWeight: '700', color: COLORS.ink, marginTop: 2 },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.forestSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  voucherTag: {
    backgroundColor: COLORS.coral,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  voucherTagText: { fontSize: 9.5, fontWeight: '800', color: COLORS.white },
  voucherBody: { flex: 1, fontSize: 11.5, fontWeight: '600', color: COLORS.ink },
});

