import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  HoldSlotResult,
  PaymentGatewayCode,
  PriceQuote,
  PublishedListing,
} from '@/types/domain';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { formatSlotWindow, formatVnd } from '@/utils/formatters';
import { PrimaryButton } from '@/components/common/PrimaryButton';

interface CheckoutScreenProps {
  listing: PublishedListing;
  quote: PriceQuote | null;
  countdownLabel: string;
  holdResult: HoldSlotResult | null;
  onUpdateHoldResult: (result: HoldSlotResult) => void;
  onBack: () => void;
}

const GATEWAYS: { code: PaymentGatewayCode; title: string; subtitle: string }[] = [
  { code: 'VNPAY_ESCROW', title: 'VNPAY-QR / ATM / Thẻ', subtitle: 'Bảo lãnh ký quỹ tự động v2.1.0' },
  { code: 'MOMO_WALLET', title: 'Ví Điện Tử MoMo', subtitle: 'Thanh toán 1 chạm qua MoMo PayGate' },
  { code: 'VIETQR_NAPAS', title: 'Chuyển Khoản VietQR', subtitle: 'Xác thực Napas 24/7 tức thì' },
];

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  listing,
  quote,
  countdownLabel,
  holdResult,
  onUpdateHoldResult,
  onBack,
}) => {
  const [gateway, setGateway] = useState<PaymentGatewayCode>('VNPAY_ESCROW');
  const [fullName, setFullName] = useState('Nguyễn Minh Quân');
  const [phone, setPhone] = useState('0912345678');

  const lockedPrice = quote?.currentPrice ?? listing.basePrice;
  const depositAmount = Math.floor((lockedPrice * listing.depositPercent) / 100);

  const handleHoldAndPay = () => {
    const confirmed: HoldSlotResult = {
      reservationId: `RSV-${Date.now().toString(36).toUpperCase()}`,
      unitNumber: 'Sân 02',
      groupId: listing.groupId,
      slotStart: quote?.slotStart ?? listing.upcomingSlots[0].slotStart,
      lockedPrice,
      depositAmount,
      status: 'CONFIRMED',
      qrToken: `APQR.${listing.groupCode}.${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    };
    onUpdateHoldResult(confirmed);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack}>
            <Text style={styles.backText}>← Quay lại</Text>
          </Pressable>
          <Text style={styles.topTitle}>Đặt Cọc &amp; Vé QR</Text>
          <Text style={styles.timerPill}>{countdownLabel}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Summary */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Thông tin ca giữ sân</Text>
          <Text style={styles.courtName}>{listing.groupName}</Text>
          <Text style={styles.meta}>
            {listing.venueName} •{' '}
            {quote ? formatSlotWindow(quote.slotStart, quote.slotEnd) : 'Ca tiêu chuẩn'}
          </Text>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Tổng giá khóa 10 phút:</Text>
            <Text style={styles.summaryVal}>{formatVnd(lockedPrice)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Tiền cọc ({listing.depositPercent}%):</Text>
            <Text style={styles.depositVal}>{formatVnd(depositAmount)}</Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin người nhận vé QR</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Họ và tên"
            style={styles.input}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Số điện thoại liên hệ"
            style={styles.input}
          />
        </View>

        {/* Payment Method Selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chọn cổng thanh toán ký quỹ</Text>
          {GATEWAYS.map((item) => {
            const selected = gateway === item.code;
            return (
              <Pressable
                key={item.code}
                onPress={() => setGateway(item.code)}
                style={[styles.gwRow, selected && styles.gwSelected]}
              >
                <View style={styles.radio}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gwTitle}>{item.title}</Text>
                  <Text style={styles.gwSub}>{item.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Issued QR Ticket Receipt */}
        {holdResult ? (
          <View style={styles.qrTicketCard}>
            <Text style={styles.qrSuccess}>✓ ĐẶT CỌC THÀNH CÔNG • VÉ QR SẴN SÀNG</Text>
            <Text style={styles.qrCodeTitle}>
              {holdResult.reservationId} • {holdResult.unitNumber}
            </Text>
            <View style={styles.qrSimulatedBox}>
              <Text style={styles.qrTokenText}>{holdResult.qrToken}</Text>
            </View>
            <Text style={styles.qrNote}>
              Xuất trình mã vé này cho nhân viên trực sân khi check-in. Tiền cọc được ArenaPulse
              bảo lãnh an toàn 100%.
            </Text>
          </View>
        ) : (
          <PrimaryButton
            label={`Thanh toán Cọc ${formatVnd(depositAmount)} qua ${
              gateway === 'MOMO_WALLET' ? 'MoMo' : gateway === 'VNPAY_ESCROW' ? 'VNPAY' : 'VietQR'
            }`}
            onPress={handleHoldAndPay}
            variant="forest"
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  topSafe: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  topTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  timerPill: {
    backgroundColor: COLORS.mint,
    color: COLORS.mintInk,
    fontSize: 11.5,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.forest, textTransform: 'uppercase' },
  cardTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  courtName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  meta: { fontSize: 12.5, color: COLORS.muted },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { fontSize: 13, color: COLORS.muted },
  summaryVal: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  depositVal: { fontSize: 17, fontWeight: '800', color: COLORS.coral },
  input: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 13,
    color: COLORS.ink,
  },
  gwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: SPACING.md,
  },
  gwSelected: { borderColor: COLORS.forest, backgroundColor: COLORS.forestSoft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.forest },
  gwTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.ink },
  gwSub: { fontSize: 11.5, color: COLORS.muted },
  qrTicketCard: {
    backgroundColor: COLORS.forestDark,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  qrSuccess: { fontSize: 11.5, fontWeight: '800', color: COLORS.mint },
  qrCodeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  qrSimulatedBox: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADII.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  qrTokenText: { fontSize: 13, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.6 },
  qrNote: { fontSize: 11.5, color: 'rgba(255,255,255,0.78)', textAlign: 'center', lineHeight: 17 },
});

