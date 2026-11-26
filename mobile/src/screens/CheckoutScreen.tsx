import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { COLORS, SPACING, TYPOGRAPHY } from '@/theme';
import type { PublishedListing } from '@/types/domain';

interface Props {
  listing: PublishedListing;
  onBack: () => void;
}

const webCheckoutUrl = process.env.EXPO_PUBLIC_WEB_CHECKOUT_URL;

export const CheckoutScreen: React.FC<Props> = ({ listing, onBack }) => {
  const [message, setMessage] = useState<string>();

  async function openCheckout() {
    if (!webCheckoutUrl) return;
    try {
      const url = new URL(webCheckoutUrl);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported checkout URL');
      await Linking.openURL(url.href);
    } catch {
      setMessage('Chưa mở được trang thanh toán trên trình duyệt.');
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.back}>← Quay lại</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>Đặt sân và thanh toán</Text>
        <Text style={styles.court}>{listing.groupName}</Text>
        <Text style={styles.message}>
          Mở ArenaPulse trên web để chọn lại ca, đăng nhập và thanh toán qua cổng được cấu hình.
          Hệ thống cấp vé khi cổng xác nhận giao dịch.
        </Text>
        {webCheckoutUrl ? (
          <PrimaryButton label="Mở ArenaPulse trên web" variant="forest" onPress={() => void openCheckout()} />
        ) : <Text style={styles.message}>Bản mobile này chưa cấu hình địa chỉ thanh toán web.</Text>}
        {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas, padding: SPACING.lg, gap: SPACING.lg },
  back: { color: COLORS.ink, fontWeight: '700', paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, padding: SPACING.lg, gap: SPACING.md },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  court: { color: COLORS.ink, fontWeight: '700' },
  message: { color: COLORS.ink, lineHeight: 20 },
});
