import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PublishedListing, RoleCode, SportTypeItem } from '@/types/domain';
import { SEED_PROVIDERS, SEED_SPORTS } from '@/data/seedData';
import { COLORS, RADII, SHADOWS, SPACING, TYPOGRAPHY } from '@/theme';
import { formatCompactCount, formatVnd } from '@/utils/formatters';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { CourtCard } from '@/components/courts/CourtCard';

interface HomeScreenProps {
  listings: PublishedListing[];
  activeRole: RoleCode;
  onBrowseSport: (sportCode: string) => void;
  onOpenCourt: (listing: PublishedListing) => void;
  onOpenLessorShop: (providerId: string) => void;
  onOpenPricingStudio: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  listings,
  activeRole,
  onBrowseSport,
  onOpenCourt,
  onOpenLessorShop,
  onOpenPricingStudio,
}) => {
  const providers = Object.values(SEED_PROVIDERS);
  const canManagePricing = activeRole === 'MANAGER' || activeRole === 'ADMIN';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>ARENAPULSE.VN • MOBILE</Text>
        </View>
        <Text style={styles.heroTitle}>Đặt Sân Thể Thao Đa Môn &amp; Khóa Giá 10 Phút</Text>
        <Text style={styles.heroSub}>
          Thanh toán ký quỹ VNPAY / MoMo bảo lãnh hoàn tiền 100%, quét vé QR 1 chạm tại cổng.
        </Text>

        <View style={styles.heroActions}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Tìm Sân Ngay →"
              onPress={() => onBrowseSport('ALL')}
              variant="coral"
            />
          </View>
          {canManagePricing ? (
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Định Giá Chủ Sân"
                onPress={onOpenPricingStudio}
                variant="outline"
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Sport Categories Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bộ Môn Nổi Bật</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sportsRow}
      >
        {SEED_SPORTS.map((sp: SportTypeItem) => (
          <Pressable
            key={sp.code}
            onPress={() => onBrowseSport(sp.code)}
            style={styles.sportTile}
          >
            <Text style={styles.sportIcon}>{sp.icon}</Text>
            <Text style={styles.sportName} numberOfLines={1}>
              {sp.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Top Verified Lessor Storefronts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gian Hàng Chủ Sân Uy Tín</Text>
        <Text style={styles.sectionMeta}>{providers.length} đối tác KYC</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lessorRow}
      >
        {providers.map((prov) => (
          <Pressable
            key={prov.providerId}
            onPress={() => onOpenLessorShop(prov.providerId)}
            style={styles.lessorCard}
          >
            <View style={styles.lessorTop}>
              <Text style={styles.lessorBadge}>{prov.badge}</Text>
              <Text style={styles.lessorRate}>Phản hồi {prov.responseRatePct}%</Text>
            </View>
            <Text style={styles.lessorName} numberOfLines={1}>
              {prov.providerName}
            </Text>
            <Text style={styles.lessorSub} numberOfLines={1}>
              {prov.totalManagedCourts} sân • {formatCompactCount(prov.followersCount)} người theo dõi
            </Text>
            <Text style={styles.lessorLink}>Xem Gian Hàng ›</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Featured Courts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sân Đang Mở Khóa Giá</Text>
        <Text style={styles.sectionMeta}>Từ {formatVnd(95_000)}/ca</Text>
      </View>
      <View style={styles.courtsList}>
        {listings.slice(0, 3).map((item) => (
          <CourtCard
            key={item.groupId}
            listing={item}
            onPressCourt={onOpenCourt}
            onPressLessor={onOpenLessorShop}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.canvas },
  content: { padding: SPACING.lg, paddingBottom: 32, gap: SPACING.md },
  heroCard: {
    backgroundColor: COLORS.forest,
    borderRadius: RADII.xxl,
    padding: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.floating,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(231,247,212,0.16)',
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.mint, letterSpacing: 0.6 },
  heroTitle: { ...TYPOGRAPHY.heroTitle, color: COLORS.white, marginTop: 4 },
  heroSub: { fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.82)' },
  heroActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  sectionMeta: { ...TYPOGRAPHY.caption, color: COLORS.forest, fontWeight: '700' },
  sportsRow: { gap: SPACING.sm, paddingVertical: 2 },
  sportTile: {
    width: 88,
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 6,
  },
  sportIcon: { fontSize: 22 },
  sportName: { fontSize: 11.5, fontWeight: '700', color: COLORS.ink },
  lessorRow: { gap: SPACING.sm },
  lessorCard: {
    width: 240,
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 5,
    ...SHADOWS.card,
  },
  lessorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lessorBadge: { fontSize: 10, fontWeight: '700', color: COLORS.sky },
  lessorRate: { fontSize: 10, fontWeight: '700', color: COLORS.forest },
  lessorName: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  lessorSub: { fontSize: 11.5, color: COLORS.muted },
  lessorLink: { fontSize: 11.5, fontWeight: '700', color: COLORS.coral, marginTop: 2 },
  courtsList: { gap: SPACING.md },
});

