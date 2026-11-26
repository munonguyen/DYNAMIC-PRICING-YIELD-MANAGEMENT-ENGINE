import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublishedListing, RoleCode } from '@/types/domain';
import { hasPricingAccess } from '@/constants/rbac';
import { simulateDynamicPrice } from '@/services/pricingEngine';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { formatVnd } from '@/utils/formatters';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { PillChip } from '@/components/common/PillChip';
import { MetricCard } from '@/components/common/MetricCard';

interface PricingStudioScreenProps {
  listings: PublishedListing[];
  activeRole: RoleCode;
  isAuthenticated: boolean;
  onSavePricing: (
    groupId: string,
    patch: { basePrice: number; minPrice: number; maxPrice: number; depositPercent: number }
  ) => void;
  onOpenLogin: () => void;
  onBack: () => void;
}

export const PricingStudioScreen: React.FC<PricingStudioScreenProps> = ({
  listings,
  activeRole,
  isAuthenticated,
  onSavePricing,
  onOpenLogin,
  onBack,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState(listings[0]?.groupId ?? '');
  const currentListing =
    listings.find((l) => l.groupId === selectedGroupId) ?? listings[0];

  const [baseStr, setBaseStr] = useState(String(currentListing.basePrice));
  const [minStr, setMinStr] = useState(String(currentListing.minPrice));
  const [maxStr, setMaxStr] = useState(String(currentListing.maxPrice));
  const [depositStr, setDepositStr] = useState(String(currentListing.depositPercent));
  const [demandPct, setDemandPct] = useState(70);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const allowed = hasPricingAccess(activeRole, isAuthenticated);

  const simulation = useMemo(
    () =>
      simulateDynamicPrice({
        basePrice: Number(baseStr) || currentListing.basePrice,
        minPrice: Number(minStr) || currentListing.minPrice,
        maxPrice: Number(maxStr) || currentListing.maxPrice,
        demandOccupancyPct: demandPct,
        timeWeight: 1.15,
        leadHours: 4,
      }),
    [baseStr, minStr, maxStr, demandPct, currentListing]
  );

  const selectListing = (item: PublishedListing) => {
    setSelectedGroupId(item.groupId);
    setBaseStr(String(item.basePrice));
    setMinStr(String(item.minPrice));
    setMaxStr(String(item.maxPrice));
    setDepositStr(String(item.depositPercent));
    setSavedNotice(null);
  };

  const handleSave = () => {
    const basePrice = Math.max(50_000, Number(baseStr) || currentListing.basePrice);
    const minPrice = Math.max(50_000, Math.min(basePrice, Number(minStr) || currentListing.minPrice));
    const maxPrice = Math.max(basePrice, Number(maxStr) || currentListing.maxPrice);
    const depositPercent = Math.min(100, Math.max(10, Number(depositStr) || 35));
    onSavePricing(currentListing.groupId, { basePrice, minPrice, maxPrice, depositPercent });
    setSavedNotice('Đã lưu biên giá & tỷ lệ cọc mới!');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>← Quay lại</Text>
        </Pressable>
        <Text style={styles.topTitle}>Định Giá Nội Bộ</Text>
        <Text style={styles.roleTag}>{activeRole}</Text>
      </View>

      {!allowed ? (
        <View style={styles.gateContainer}>
          <View style={styles.gateCard}>
            <Text style={styles.gateBadge}>KHU VỰC HẠN CHẾ • CHỦ SÂN &amp; ADMIN</Text>
            <Text style={styles.gateTitle}>Bạn chưa có quyền truy cập công cụ Định giá động</Text>
            <Text style={styles.gateBody}>
              Chức năng cấu hình Giá gốc, Giá sàn/trần và Mô phỏng Lấp đầy chỉ dành cho Người cho
              thuê (MANAGER) hoặc Quản trị viên sàn (ADMIN).
            </Text>
            <PrimaryButton
              label="Đăng nhập Chủ sân / Admin"
              onPress={onOpenLogin}
              variant="forest"
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {listings.map((item) => (
              <PillChip
                key={item.groupId}
                label={item.groupName}
                active={item.groupId === currentListing.groupId}
                onPress={() => selectListing(item)}
              />
            ))}
          </ScrollView>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Biên giá &amp; Đặt cọc ký quỹ</Text>
            <View style={styles.grid}>
              <View style={styles.field}>
                <Text style={styles.label}>Giá gốc (VND)</Text>
                <TextInput value={baseStr} onChangeText={setBaseStr} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Cọc giữ sân (%)</Text>
                <TextInput value={depositStr} onChangeText={setDepositStr} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Giá sàn Min</Text>
                <TextInput value={minStr} onChangeText={setMinStr} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Giá trần Max</Text>
                <TextInput value={maxStr} onChangeText={setMaxStr} keyboardType="numeric" style={styles.input} />
              </View>
            </View>
            {savedNotice ? <Text style={styles.savedText}>{savedNotice}</Text> : null}
            <PrimaryButton label="Lưu Chính Sách Giá" onPress={handleSave} variant="forest" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mô phỏng Giá Ca Cao Điểm</Text>
            <View style={styles.demandRow}>
              {[30, 55, 70, 90].map((pct) => (
                <PillChip
                  key={pct}
                  label={`Lấp đầy ${pct}%`}
                  active={demandPct === pct}
                  onPress={() => setDemandPct(pct)}
                />
              ))}
            </View>
            <View style={styles.metricsRow}>
              <MetricCard label="Giá tính ra" value={formatVnd(simulation.clampedPrice)} accentColor={COLORS.forest} />
              <MetricCard label="Biên độ Uplift" value={`${simulation.upliftPct > 0 ? '+' : ''}${simulation.upliftPct}%`} accentColor={COLORS.coral} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  topTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  roleTag: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.mintInk,
    backgroundColor: COLORS.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  gateContainer: { flex: 1, padding: SPACING.xl, justifyContent: 'center' },
  gateCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  gateBadge: { fontSize: 10.5, fontWeight: '800', color: COLORS.coral },
  gateTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  gateBody: { fontSize: 13, lineHeight: 20, color: COLORS.muted },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  pickerRow: { gap: SPACING.xs + 2 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  field: { width: '48%', gap: 4 },
  label: { fontSize: 11.5, fontWeight: '600', color: COLORS.muted },
  input: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  savedText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  demandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  metricsRow: { flexDirection: 'row', gap: SPACING.sm },
});

