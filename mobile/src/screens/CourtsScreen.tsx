import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PublishedListing } from '@/types/domain';
import { SEED_SPORTS } from '@/data/seedData';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { PillChip } from '@/components/common/PillChip';
import { CourtCard } from '@/components/courts/CourtCard';

interface CourtsScreenProps {
  listings: PublishedListing[];
  selectedSport: string;
  onSelectSport: (code: string) => void;
  onOpenCourt: (listing: PublishedListing) => void;
  onOpenLessorShop: (providerId: string) => void;
  onOpenChatForListing: (listing: PublishedListing) => void;
}

export const CourtsScreen: React.FC<CourtsScreenProps> = ({
  listings,
  selectedSport,
  onSelectSport,
  onOpenCourt,
  onOpenLessorShop,
  onOpenChatForListing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((item) => {
      const matchSport = selectedSport === 'ALL' || item.sportCode === selectedSport;
      const matchQuery =
        !q ||
        item.groupName.toLowerCase().includes(q) ||
        item.provider.providerName.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q);
      const hasOpen = item.upcomingSlots.some((s) => s.availableCourts > 0);
      return matchSport && matchQuery && (!onlyAvailable || hasOpen);
    });
  }, [listings, selectedSport, searchQuery, onlyAvailable]);

  return (
    <View style={styles.container}>
      {/* Sticky Filter & Search Area */}
      <View style={styles.filterHeader}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm tên sân, quận/TP, chủ sân..."
          placeholderTextColor={COLORS.subtleText}
          style={styles.searchInput}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <PillChip
            label="Tất cả môn"
            active={selectedSport === 'ALL'}
            onPress={() => onSelectSport('ALL')}
          />
          {SEED_SPORTS.map((sp) => (
            <PillChip
              key={sp.code}
              label={`${sp.icon} ${sp.name}`}
              active={selectedSport === sp.code}
              onPress={() => onSelectSport(sp.code)}
            />
          ))}
          <PillChip
            label="Còn sân trống"
            active={onlyAvailable}
            onPress={() => setOnlyAvailable((v) => !v)}
          />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.resultMeta}>
          Hiển thị {filtered.length} cụm sân mở đặt lịch
        </Text>

        {filtered.map((listing) => (
          <CourtCard
            key={listing.groupId}
            listing={listing}
            onPressCourt={onOpenCourt}
            onPressLessor={onOpenLessorShop}
            onPressAskChat={onOpenChatForListing}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  filterHeader: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    fontSize: 13,
    color: COLORS.ink,
  },
  chipsRow: { gap: SPACING.xs + 2 },
  listContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  resultMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted },
});

