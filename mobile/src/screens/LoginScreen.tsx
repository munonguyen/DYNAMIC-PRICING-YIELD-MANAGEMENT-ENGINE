import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoleCode } from '@/types/domain';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';

interface LoginScreenProps {
  onSelectAccount: (role: RoleCode, fullName: string) => void;
  onBack: () => void;
}

const DEMO_ACCOUNTS: { role: RoleCode; fullName: string; desc: string }[] = [
  { role: 'USER', fullName: 'Nguyễn Minh Quân', desc: 'Người thuê sân • Đặt ca, theo dõi gian hàng & chat' },
  { role: 'MANAGER', fullName: 'Chủ sân Mỹ Đình Arena', desc: 'Người cho thuê • Toàn quyền Cấu hình Giá & Gian hàng' },
  { role: 'ADMIN', fullName: 'Quản trị ArenaPulse', desc: 'Admin Sàn • Duyệt KYC, Tạo Thông báo & Quản lý Giá sàn' },
  { role: 'ACCOUNTANT', fullName: 'Kế toán Đối soát', desc: 'Xem Sổ cái Escrow & Đối soát MoMo / VNPAY' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSelectAccount, onBack }) => (
  <SafeAreaView style={styles.root} edges={['top']}>
    <View style={styles.topBar}>
      <Pressable onPress={onBack}>
        <Text style={styles.backText}>← Quay lại</Text>
      </Pressable>
      <Text style={styles.topTitle}>Đăng nhập ArenaPulse</Text>
      <View style={{ width: 64 }} />
    </View>

    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Chọn nhanh vai trò trải nghiệm RBAC Mobile</Text>
      {DEMO_ACCOUNTS.map((acc) => (
        <Pressable
          key={acc.role}
          onPress={() => onSelectAccount(acc.role, acc.fullName)}
          style={styles.card}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{acc.role}</Text>
          </View>
          <Text style={styles.name}>{acc.fullName}</Text>
          <Text style={styles.desc}>{acc.desc}</Text>
        </Pressable>
      ))}
    </ScrollView>
  </SafeAreaView>
);

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
  content: { padding: SPACING.lg, gap: SPACING.md },
  heading: { fontSize: 13, color: COLORS.muted },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.mint,
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10.5, fontWeight: '800', color: COLORS.mintInk },
  name: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  desc: { fontSize: 12.5, color: COLORS.muted, lineHeight: 18 },
});

