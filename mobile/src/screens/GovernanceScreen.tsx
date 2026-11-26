import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthSession, RoleCode } from '@/types/domain';
import { ROLE_MATRIX } from '@/constants/rbac';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { MetricCard } from '@/components/common/MetricCard';

interface GovernanceScreenProps {
  session: AuthSession | null;
  activeRole: RoleCode;
  onSwitchRole: (role: RoleCode) => void;
  onOpenPricingStudio: () => void;
  onOpenLogin: () => void;
  onSignOut: () => void;
}

export const GovernanceScreen: React.FC<GovernanceScreenProps> = ({
  session,
  activeRole,
  onOpenPricingStudio,
  onOpenLogin,
  onSignOut,
}) => {
  const [kycPendingCount, setKycPendingCount] = useState(2);
  const canOpenPricing = Boolean(
    session && (activeRole === 'MANAGER' || activeRole === 'ADMIN')
  );
  const isAdmin = Boolean(session && activeRole === 'ADMIN');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Account Summary Card */}
      <View style={styles.accountCard}>
        <Text style={styles.accountTag}>HỆ THỐNG NỘI BỘ ARENAPULSE</Text>
        <Text style={styles.accountName}>
          {session ? `${session.fullName} (${activeRole})` : 'Chế độ Khách vãng lai'}
        </Text>
        <Text style={styles.accountSub}>
          {ROLE_MATRIX[activeRole].displayName} • Phân tách rõ quyền Người thuê, Chủ sân &amp; Admin.
        </Text>

        <View style={styles.accountBtns}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={session ? 'Đổi Tài Khoản' : 'Đăng Nhập Nội Bộ'}
              onPress={onOpenLogin}
              variant="forest"
              compact
            />
          </View>
          {session ? (
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Đăng xuất" onPress={onSignOut} variant="outline" compact />
            </View>
          ) : null}
        </View>
      </View>

      {/* Shortcut to Lessor/Admin Pricing */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Công cụ Định Giá Chủ Sân &amp; Sàn</Text>
        <Text style={styles.cardSub}>
          {canOpenPricing
            ? 'Tài khoản hiện tại được cấp quyền chỉnh Giá gốc, Giá sàn/trần & Đặt cọc.'
            : 'Chỉ hiển thị cho tài khoản Chủ sân (MANAGER) hoặc Quản trị viên (ADMIN).'}
        </Text>
        <PrimaryButton
          label={canOpenPricing ? 'Mở Định Giá Chủ Sân →' : 'Khóa: Yêu cầu Quyền Chủ Sân / Admin'}
          onPress={onOpenPricingStudio}
          variant={canOpenPricing ? 'ink' : 'outline'}
        />
      </View>

      {/* Finance & Admin KYC Counters */}
      <View style={styles.metricsRow}>
        <MetricCard label="Quỹ Escrow Sàn" value="248,5M ₫" accentColor={COLORS.forest} />
        <MetricCard label="Hồ sơ KYC Chờ" value={`${kycPendingCount} cơ sở`} accentColor={COLORS.coral} />
      </View>

      {isAdmin && kycPendingCount > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Duyệt Hồ Sơ Chủ Sân Mới (ADMIN)</Text>
          <Text style={styles.cardSub}>
            Cơ sở Phú Mỹ Hưng Arena đang chờ duyệt cấp Tenant &amp; kích hoạt gian hàng.
          </Text>
          <PrimaryButton
            label="Duyệt KYC ngay ✓"
            onPress={() => setKycPendingCount((c) => Math.max(0, c - 1))}
            variant="forest"
            compact
          />
        </View>
      ) : null}

      {/* RBAC Matrix */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ma Trận Phân Quyền RBAC</Text>
        {(Object.keys(ROLE_MATRIX) as RoleCode[]).map((roleKey) => {
          const rule = ROLE_MATRIX[roleKey];
          const isCurrent = roleKey === activeRole;
          return (
            <Pressable
              key={roleKey}
              style={[styles.matrixRow, isCurrent && styles.matrixRowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.matrixRole}>
                  {rule.role} — {rule.displayName}
                </Text>
                <Text style={styles.matrixPerms}>
                  Định giá: {rule.canAccessPricingStudio ? 'Có' : 'Không'} • Thông báo:{' '}
                  {rule.canPublishSystemAnnouncements ? 'ADMIN' : 'Đọc'} • KYC/Sổ cái:{' '}
                  {rule.canManageVenueKycAndLedger ? 'Có' : 'Không'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  accountCard: {
    backgroundColor: COLORS.forestDark,
    borderRadius: RADII.xxl,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  accountTag: { fontSize: 10.5, fontWeight: '800', color: COLORS.mint },
  accountName: { ...TYPOGRAPHY.screenTitle, color: COLORS.white },
  accountSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 18 },
  accountBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: 6 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  cardSub: { fontSize: 12.5, color: COLORS.muted, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: SPACING.sm },
  matrixRow: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceSoft,
    padding: SPACING.md,
  },
  matrixRowActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forestSoft },
  matrixRole: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  matrixPerms: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
});

