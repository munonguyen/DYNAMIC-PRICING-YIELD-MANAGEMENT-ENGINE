import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoleCode } from '@/types/domain';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  activeRole: RoleCode;
  isAuthenticated: boolean;
  unreadChatCount: number;
  onOpenChat: () => void;
  onOpenAuth: () => void;
  onBack?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'ArenaPulse.vn',
  subtitle,
  activeRole,
  isAuthenticated,
  unreadChatCount,
  onOpenChat,
  onOpenAuth,
  onBack,
}) => (
  <View style={styles.container}>
    <View style={styles.leftRow}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Quay lại</Text>
        </Pressable>
      ) : (
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>AP</Text>
        </View>
      )}
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>

    <View style={styles.rightRow}>
      <Pressable onPress={onOpenAuth} style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>
          {isAuthenticated ? activeRole : 'Đăng nhập'}
        </Text>
      </Pressable>

      <Pressable onPress={onOpenChat} style={styles.chatBtn}>
        <Text style={styles.chatBtnText}>Chat</Text>
        {unreadChatCount > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{unreadChatCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  backBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: { ...TYPOGRAPHY.caption, color: COLORS.ink, fontWeight: '600' },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: RADII.md,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: COLORS.mint, fontSize: 13, fontWeight: '800' },
  titleBlock: { flex: 1 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  subtitle: { ...TYPOGRAPHY.micro, color: COLORS.muted, fontWeight: '400' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  roleBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  roleBadgeText: { ...TYPOGRAPHY.micro, color: COLORS.ink },
  chatBtn: {
    position: 'relative',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.forest,
  },
  chatBtnText: { ...TYPOGRAPHY.micro, color: COLORS.mint },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadDotText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
});

