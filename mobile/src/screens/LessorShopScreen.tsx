import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PublishedListing, VenueProviderInfo } from '@/types/domain';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { LessorProfileHeader } from '@/components/shop/LessorProfileHeader';
import { ShopTabsBar, type ShopTabOption } from '@/components/shop/ShopTabsBar';
import { CourtCard } from '@/components/courts/CourtCard';

interface LessorShopScreenProps {
  listings: PublishedListing[];
  selectedProviderId: string;
  followedProviderIds: string[];
  onSelectProviderId: (providerId: string) => void;
  onToggleFollow: (providerId: string) => void;
  onOpenChat: (providerId: string, court?: PublishedListing) => void;
  onOpenCourt: (listing: PublishedListing) => void;
}

export const LessorShopScreen: React.FC<LessorShopScreenProps> = ({
  listings,
  selectedProviderId,
  followedProviderIds,
  onToggleFollow,
  onOpenChat,
  onOpenCourt,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const providers = useMemo<VenueProviderInfo[]>(() => {
    const map = new Map<string, VenueProviderInfo>();
    listings.forEach((l) => {
      if (!map.has(l.provider.providerId)) {
        map.set(l.provider.providerId, l.provider);
      }
    });
    return Array.from(map.values());
  }, [listings]);

  const activeProvider =
    providers.find((p) => p.providerId === selectedProviderId) ?? providers[0];

  const shopListings = useMemo(
    () => listings.filter((l) => l.provider.providerId === activeProvider.providerId),
    [listings, activeProvider.providerId]
  );

  const sportTabs = useMemo<ShopTabOption[]>(() => {
    const seen = new Map<string, string>();
    shopListings.forEach((item) => {
      if (!seen.has(item.sportCode)) seen.set(item.sportCode, item.sportName);
    });
    return [
      { id: 'OVERVIEW', label: 'Dạo Gian Hàng' },
      { id: 'ALL', label: `Tất Cả (${shopListings.length})` },
      ...Array.from(seen.entries()).map(([code, name]) => ({ id: code, label: name })),
      { id: 'POLICY', label: 'Chính Sách' },
    ];
  }, [shopListings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shopListings.filter((item) => {
      const matchTab =
        activeTabId === 'OVERVIEW' || activeTabId === 'ALL' || activeTabId === 'POLICY'
          ? true
          : item.sportCode === activeTabId;
      const matchQuery = !q || item.groupName.toLowerCase().includes(q);
      return matchTab && matchQuery;
    });
  }, [shopListings, activeTabId, searchQuery]);

  const isFollowed = followedProviderIds.includes(activeProvider.providerId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Single-Lessor Profile Context Tag */}
      <View style={styles.profileRibbon}>
        <Text style={styles.profileRibbonText}>
          Hồ sơ Bên cho thuê • ✓ Đã thẩm định KYC
        </Text>
      </View>

      {/* Shopee-Style Lessor Header Card */}
      <LessorProfileHeader
        provider={activeProvider}
        courtGroupsCount={shopListings.length}
        isFollowed={isFollowed}
        onToggleFollow={() => onToggleFollow(activeProvider.providerId)}
        onPressChat={() => onOpenChat(activeProvider.providerId, shopListings[0])}
      />

      {/* Horizontal Category Tabs Bar */}
      <View style={styles.tabsWrapper}>
        <ShopTabsBar
          tabs={sportTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
        />

        {activeTabId !== 'POLICY' ? (
          <View style={styles.searchPad}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Tìm sân tại ${activeProvider.providerName}...`}
              placeholderTextColor={COLORS.subtleText}
              style={styles.searchInput}
            />
          </View>
        ) : null}
      </View>

      {/* Shop Content */}
      {activeTabId === 'POLICY' ? (
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Hồ sơ Pháp lý &amp; Chính sách Ký quỹ</Text>
          <Text style={styles.policyText}>• Pháp nhân: {activeProvider.legalEntityType}</Text>
          <Text style={styles.policyText}>{activeProvider.platformGuarantee}</Text>
          <View style={styles.refundBox}>
            <Text style={styles.refundItem}>✓ Hủy ≥ 11h trước ca: Hoàn 100% cọc</Text>
            <Text style={styles.refundItem}>✓ Hủy 4h – 11h: Hoàn 50% cọc</Text>
            <Text style={styles.refundItem}>✓ Mưa bão / Lỗi sân: Hoàn 100% tức thì</Text>
          </View>
        </View>
      ) : (
        <View style={styles.gridWrap}>
          <Text style={styles.shelfHeading}>
            {activeTabId === 'OVERVIEW'
              ? 'GỢI Ý CHO BẠN TẠI GIAN HÀNG'
              : 'DANH SÁCH CỤM SÂN CỦA CHỦ SÂN'}
          </Text>

          {filteredListings.map((listing) => (
            <CourtCard
              key={listing.groupId}
              listing={listing}
              onPressCourt={onOpenCourt}
              onPressAskChat={(item) => onOpenChat(activeProvider.providerId, item)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  profileRibbon: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.mint,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  profileRibbonText: { fontSize: 11, fontWeight: '700', color: COLORS.mintInk },
  tabsWrapper: {
    borderRadius: RADII.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  searchPad: { padding: SPACING.md, backgroundColor: COLORS.white },
  searchInput: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 12.5,
    color: COLORS.ink,
  },
  gridWrap: { gap: SPACING.md },
  shelfHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: COLORS.muted,
    marginTop: 2,
  },
  policyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  policyTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  policyText: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  refundBox: {
    backgroundColor: COLORS.forestSoft,
    borderRadius: RADII.md,
    padding: SPACING.md,
    gap: 6,
    marginTop: 4,
  },
  refundItem: { fontSize: 12.5, fontWeight: '600', color: COLORS.forest },
});

