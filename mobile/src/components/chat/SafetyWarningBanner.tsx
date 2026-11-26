import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADII, SPACING } from '@/theme';

export const SafetyWarningBanner: React.FC = () => (
  <View style={styles.box}>
    <Text style={styles.text}>
      <Text style={styles.lead}>ⓘ LƯU Ý: </Text>
      ArenaPulse <Text style={styles.bold}>KHÔNG</Text> cho phép chuyển khoản cọc riêng ngoài hệ
      thống hoặc giao dịch ngoài sàn. Vui lòng chỉ thanh toán giữ sân trực tiếp qua{' '}
      <Text style={styles.bold}>ArenaPulse (VNPAY / MoMo)</Text> để được bảo lãnh hoàn tiền 100%!
    </Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.amberBg,
    borderColor: COLORS.amberBorder,
    borderWidth: 1,
    borderRadius: RADII.md,
    padding: SPACING.md,
  },
  text: { fontSize: 11.5, lineHeight: 17, color: '#6B4F08' },
  lead: { fontWeight: '800', color: '#B45309' },
  bold: { fontWeight: '700' },
});

