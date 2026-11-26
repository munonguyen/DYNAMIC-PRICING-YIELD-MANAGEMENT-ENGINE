import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { KeyRound, Lock, QrCode, ShieldCheck } from 'lucide-react';
import type {
  AuthSession,
  CancelBookingResult,
  CheckInResult,
  HoldSlotResult,
  MoMoPaymentSession,
  MyTicketRecord,
  VnPayPaymentUrlResult,
  PaymentGatewayCode,
  PaymentPlanMode,
  PaymentReceiptInfo,
  PriceQuote,
  PublishedListing,
  QrCodeTicket,
  RoleCode,
  VenueAnnouncement,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { getActiveLessorServices } from '../data/courtServicesData';
import { isValidVietnamTaxCode } from '../utils/lessorLegalValidator';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';

interface BookingPipelineAndQrSectionProps {
  activeListing: PublishedListing | null;
  activeQuote: PriceQuote | null;
  activeRole?: RoleCode;
  session?: AuthSession | null;
  isHoldExpired?: boolean;
  venueAnnouncements: VenueAnnouncement[];
  onBackToCourts: () => void;
  onRequireLogin?: () => void;
  onOpenAnnouncementsPage: () => void;
  holdResult: HoldSlotResult | null;
  qrTicket: QrCodeTicket | null;
  paymentReceipt: PaymentReceiptInfo | null;
  checkInResult: CheckInResult | null;
  cancelResult: CancelBookingResult | null;
  busyStep: string | null;
  countdownLabel: string;
  onHoldSlot: () => void;
  onConfirmPayment: (payload: {
    provider: PaymentGatewayCode;
    providerLabel: string;
    planMode: PaymentPlanMode;
    paidAmount: number;
    remainingAtVenue: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    needVatInvoice: boolean;
    vatCompanyName: string;
    vatTaxCode: string;
    note: string;
  }) => Promise<void> | void;
  onScanQr: () => void;
  onCancelBooking: (hoursBefore: number, venueInitiated: boolean) => void;
  onResetFlow: () => void;
  selectedServiceQuantities?: Record<string, number>;
  onChangeServiceQuantity?: (serviceId: string, nextQty: number) => void;
}

const GATEWAYS: {
  code: PaymentGatewayCode;
  title: string;
  subtitle: string;
  badge: string;
}[] = [
  {
    code: 'VIETQR_NAPAS',
    title: 'Chuyển khoản VietQR 24/7',
    subtitle: 'Quét mã ngân hàng nội địa • Xác nhận tự động tức thì',
    badge: 'Phổ biến nhất',
  },
  {
    code: 'VNPAY_ESCROW',
    title: 'Cổng VNPAY-QR Ký quỹ',
    subtitle: 'Thanh toán qua ứng dụng Mobile Banking / Ví VNPAY',
    badge: 'Miễn phí GD',
  },
  {
    code: 'MOMO_WALLET',
    title: 'Ví điện tử MoMo',
    subtitle: 'Xác nhận nhanh một chạm trên ứng dụng MoMo',
    badge: 'Siêu tốc',
  },
  {
    code: 'INTL_CARD',
    title: 'Thẻ Quốc tế Visa / Master',
    subtitle: 'Hỗ trợ thẻ tín dụng & ghi nợ quốc tế chuẩn bảo mật 3DS',
    badge: 'Quốc tế',
  },
];

function isValidLuhnCard(rawNumber: string): boolean {
  const digits = rawNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isValidExpiryMmYy(val: string): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(val.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

const GatewayIcon: React.FC<{ code: PaymentGatewayCode; active: boolean }> = ({ code, active }) => {
  if (code === 'VIETQR_NAPAS') {
    return (
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-white/15 text-[#E7F7D4]' : 'bg-[#E7F7D4] text-[#16422C]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h3v3h-3zm4 3h3v4h-4v-1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (code === 'VNPAY_ESCROW') {
    return (
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-white/15 text-[#93C5FD]' : 'bg-[#E6F1F8] text-[#0E4F7E]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
          <path d="M9.5 12l2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (code === 'MOMO_WALLET') {
    return (
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-white/15 text-pink-300' : 'bg-pink-50 text-pink-700'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M15 12.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" fill="currentColor" stroke="none" />
          <path d="M3 10h18" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        active ? 'bg-white/15 text-amber-200' : 'bg-neutral-200/70 text-[#0F172A]'
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h4" strokeLinecap="round" />
      </svg>
    </span>
  );
};

export const BookingPipelineAndQrSection: React.FC<BookingPipelineAndQrSectionProps> = ({
  activeListing,
  activeQuote,
  activeRole = 'USER',
  session = null,
  isHoldExpired = false,
  venueAnnouncements,
  onBackToCourts,
  onRequireLogin,
  onOpenAnnouncementsPage,
  holdResult,
  qrTicket,
  paymentReceipt,
  checkInResult,
  cancelResult,
  busyStep,
  countdownLabel,
  onHoldSlot,
  onConfirmPayment,
  onScanQr,
  onCancelBooking,
  onResetFlow,
  selectedServiceQuantities = {},
  onChangeServiceQuantity,
}) => {
  const [planMode, setPlanMode] = useState<PaymentPlanMode>('DEPOSIT_ESCROW');
  const [gateway, setGateway] = useState<PaymentGatewayCode>('VIETQR_NAPAS');
  const [customerName, setCustomerName] = useState<string>(session?.fullName ?? '');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>(session?.email ?? '');
  const [bookingNote, setBookingNote] = useState<string>('');
  const [needVatInvoice, setNeedVatInvoice] = useState<boolean>(false);
  const [vatCompanyName, setVatCompanyName] = useState<string>('');
  const [vatTaxCode, setVatTaxCode] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');

  const [simHoursBefore, setSimHoursBefore] = useState<number>(14);
  const [venueCancelMode, setVenueCancelMode] = useState<boolean>(false);
  const [myTickets, setMyTickets] = useState<MyTicketRecord[]>([]);
  const [resendEmailStatus, setResendEmailStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [momoSession, setMomoSession] = useState<MoMoPaymentSession | null>(null);
  const [momoInitBusy, setMomoInitBusy] = useState<boolean>(false);
  const [momoCallbackStatus, setMomoCallbackStatus] = useState<string | null>(null);
  const [vnpayBankCode, setVnpayBankCode] = useState<string>('');
  const [vnpaySession, setVnpaySession] = useState<VnPayPaymentUrlResult | null>(null);
  const [vnpayBusy, setVnpayBusy] = useState<boolean>(false);
  const [vnpayCallbackStatus, setVnpayCallbackStatus] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setCustomerName((prev) => prev || session.fullName);
      setCustomerEmail((prev) => prev || session.email);
    }
  }, [session]);

  useEffect(() => {
    setMomoSession(null);
    setMomoCallbackStatus(null);
    setVnpaySession(null);
    setVnpayCallbackStatus(null);
  }, [holdResult?.reservationId, planMode, gateway]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);

    if (sp.get('vnp_TxnRef') && sp.get('vnp_SecureHash')) {
      marketplaceApi
        .verifyVnPayReturnParams(window.location.search)
        .then((res) => {
          setVnpayCallbackStatus(
            res.paymentSucceeded
              ? `VNPAY thanh toán thành công! Mã GD VNPAY: ${res.transactionNo ?? res.txnRef} (${res.bankCode ?? 'VNPAY'}).`
              : `VNPAY trả về mã ${res.responseCode ?? res.code}: ${res.message}`
          );
          marketplaceApi.getMyTickets().then(setMyTickets);
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((err) => {
          setVnpayCallbackStatus(
            err instanceof Error ? err.message : 'Không xác thực được chữ ký phản hồi VNPAY.'
          );
        });
      return;
    }

    const orderId = sp.get('orderId');
    const signature = sp.get('signature');
    const resultCodeRaw = sp.get('resultCode');
    if (!orderId || !signature || resultCodeRaw === null) return;

    const resultCode = Number(resultCodeRaw);
    marketplaceApi
      .completeMoMoIpnCallback({
        partnerCode: sp.get('partnerCode') ?? '',
        orderId,
        requestId: sp.get('requestId') ?? orderId,
        amount: Number(sp.get('amount') ?? '0'),
        orderInfo: sp.get('orderInfo') ?? '',
        orderType: sp.get('orderType') ?? 'momo_wallet',
        transId: Number(sp.get('transId') ?? '0'),
        resultCode,
        message: sp.get('message') ?? '',
        payType: sp.get('payType') ?? 'qr',
        responseTime: Number(sp.get('responseTime') ?? '0'),
        extraData: sp.get('extraData') ?? '',
        signature,
      })
      .then((verified) => {
        setMomoCallbackStatus(
          resultCode === 0
            ? `MoMo xác thực giao dịch ${orderId} thành công (Trạng thái: ${verified.status}).`
            : `MoMo báo giao dịch ${orderId} không thành công (Mã ${resultCode}).`
        );
        marketplaceApi.getMyTickets().then(setMyTickets);
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((err) => {
        setMomoCallbackStatus(
          err instanceof Error ? err.message : 'Không xác thực được phản hồi thanh toán MoMo.'
        );
      });
  }, []);

  const handleInitLiveMoMoSession = async () => {
    if (!holdResult) {
      setPaymentError('Vui lòng nhấn "Bước 01 → Giữ sân & Khởi tạo thanh toán" ở khung bên phải trước.');
      return;
    }
    setPaymentError(null);
    setMomoInitBusy(true);
    try {
      const sessionResp = await marketplaceApi.createMoMoPaymentSession(holdResult, {
        amount: payableNow,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.replace(/\s+/g, '') || undefined,
        customerEmail: customerEmail.trim() || undefined,
        needVatInvoice,
        vatCompanyName: vatCompanyName.trim() || undefined,
        vatTaxCode: vatTaxCode.trim() || undefined,
        bookingNote: bookingNote.trim() || undefined,
      });
      setMomoSession(sessionResp);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Chưa thể kết nối cổng thanh toán MoMo.');
    } finally {
      setMomoInitBusy(false);
    }
  };

  const handleInitVnPayUrl = async () => {
    if (!holdResult) {
      setPaymentError('Vui lòng nhấn "Bước 01 → Giữ sân & Khởi tạo thanh toán" ở khung bên phải trước.');
      return;
    }
    setPaymentError(null);
    setVnpayBusy(true);
    try {
      const resp = await marketplaceApi.createVnPayPaymentUrl(holdResult, {
        amount: payableNow,
        bankCode: vnpayBankCode || undefined,
        locale: 'vn',
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.replace(/\s+/g, '') || undefined,
        customerEmail: customerEmail.trim() || undefined,
        needVatInvoice,
        vatCompanyName: vatCompanyName.trim() || undefined,
        vatTaxCode: vatTaxCode.trim() || undefined,
        bookingNote: bookingNote.trim() || undefined,
      });
      setVnpaySession(resp);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Chưa khởi tạo được URL thanh toán VNPAY.');
    } finally {
      setVnpayBusy(false);
    }
  };

  useEffect(() => {
    marketplaceApi.getMyTickets().then(setMyTickets);
  }, [qrTicket, cancelResult]);

  const handleSendQrEmailNow = async (reservationId: string, targetEmail: string) => {
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setResendEmailStatus('Vui lòng nhập email nhận vé hợp lệ trước khi gửi.');
      return;
    }
    setSendingEmail(true);
    setResendEmailStatus(null);
    try {
      const res = await marketplaceApi.resendQrTicketEmail(reservationId, targetEmail);
      setResendEmailStatus(res.detailMessage);
    } catch (err) {
      setResendEmailStatus(err instanceof Error ? err.message : 'Chưa thể gửi email vé QR.');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    if (session?.fullName && !customerName) setCustomerName(session.fullName);
    if (session?.email && !customerEmail) setCustomerEmail(session.email);
  }, [session, customerName, customerEmail]);

  const basePrice = activeListing?.basePrice ?? 200_000;
  const lockedPrice = holdResult?.lockedPrice ?? activeQuote?.currentPrice ?? 193_000;
  const dynamicDelta = lockedPrice - basePrice;
  const depositPct = activeListing?.depositPercent ?? 35;
  const depositAmount = holdResult?.depositAmount ?? Math.floor((lockedPrice * depositPct) / 100);

  const sportServices = getActiveLessorServices(activeListing);
  const selectedServiceItems = sportServices
    .map((service) => ({ service, quantity: selectedServiceQuantities[service.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0);
  const addOnsTotal = selectedServiceItems.reduce(
    (sum, item) => sum + item.service.unitPrice * item.quantity,
    0
  );
  const grandTotal = lockedPrice + addOnsTotal;

  const payableNow = paymentReceipt
    ? paymentReceipt.paidAmount
    : planMode === 'FULL_ONLINE'
      ? grandTotal
      : depositAmount;
  const remainingAtVenue = paymentReceipt
    ? paymentReceipt.remainingAtVenue
    : Math.max(0, grandTotal - payableNow);

  const paymentLocked = Boolean(paymentReceipt || cancelResult);
  const canVenueOperate = activeRole === 'STAFF' || activeRole === 'MANAGER' || activeRole === 'ADMIN';

  const transferMemo = `CV ${holdResult ? holdResult.reservationId.slice(0, 8).toUpperCase() : 'HOLD2026'}`;
  const virtualAccount = '968868202688';

  const previewRefundPct = venueCancelMode
    ? 100
    : simHoursBefore >= 11
      ? 100
      : simHoursBefore >= 4
        ? 50
        : 0;
  const previewRefundVnd = Math.floor((depositAmount * previewRefundPct) / 100);
  const previewForfeitVnd = depositAmount - previewRefundVnd;

  const currentStage = checkInResult ? 4 : qrTicket ? 4 : holdResult ? 3 : 2;

  const copyText = (key: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedField(key);
    window.setTimeout(() => setCopiedField(null), 1800);
  };

  const selectedGatewayObj = GATEWAYS.find((g) => g.code === gateway) ?? GATEWAYS[0];

  const validateAndSubmitPayment = async () => {
    setPaymentError(null);
    if (isHoldExpired) {
      setPaymentError('Phiên khóa giá / giữ sân 10 phút đã hết hạn. Vui lòng cập nhật lại khung giờ.');
      return;
    }
    const cleanPhone = customerPhone.replace(/\s+/g, '');
    if (customerName.trim().split(/\s+/).length < 2) {
      setPaymentError('Vui lòng nhập đầy đủ họ tên người nhận sân (ít nhất 2 từ).');
      return;
    }
    if (!/^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/.test(cleanPhone)) {
      setPaymentError('Số điện thoại nhận vé phải là số di động Việt Nam hợp lệ (10 số).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setPaymentError('Vui lòng nhập địa chỉ email hợp lệ để nhận biên lai điện tử.');
      return;
    }
    if (needVatInvoice) {
      if (vatCompanyName.trim().length < 3 || !isValidVietnamTaxCode(vatTaxCode)) {
        setPaymentError('Thông tin xuất hóa đơn VAT (Tên đơn vị & Mã số thuế) chưa chính xác.');
        return;
      }
    }
    if (gateway === 'INTL_CARD') {
      if (!isValidLuhnCard(cardNumber)) {
        setPaymentError('Số thẻ quốc tế không hợp lệ.');
        return;
      }
      if (cardHolder.trim().length < 3 || !isValidExpiryMmYy(cardExpiry) || !/^\d{3,4}$/.test(cardCvc.trim())) {
        setPaymentError('Tên chủ thẻ, ngày hết hạn (MM/YY) hoặc mã CVC chưa đúng.');
        return;
      }
    }

    try {
      await onConfirmPayment({
        provider: gateway,
        providerLabel: selectedGatewayObj.title,
        planMode,
        paidAmount: payableNow,
        remainingAtVenue,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim(),
        needVatInvoice,
        vatCompanyName: vatCompanyName.trim(),
        vatTaxCode: vatTaxCode.trim(),
        note: bookingNote.trim(),
      });
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Giao dịch thanh toán chưa hoàn tất.');
    }
  };

  const steps = [
    { step: 1, title: 'Khóa giá 10 phút', sub: 'Đã cố định giá thuê ca' },
    { step: 2, title: 'Giữ sân vật lý', sub: 'Khóa sân chống đặt trùng' },
    { step: 3, title: 'Thanh toán ký quỹ', sub: 'VietQR / VNPAY / MoMo / Thẻ' },
    { step: 4, title: 'Biên lai & Vé QR', sub: 'Quét mã một lần vào sân' },
  ];

  const matchingVenueNotice =
    venueAnnouncements.find((a) => a.venueName === activeListing?.venueName) ??
    venueAnnouncements[0];

  // Hard Authentication Gate: Customers MUST log in before holding a court or paying
  if (!session) {
    return (
      <section id="booking-flow" className="bg-[#F6F8F6] py-16 sm:py-24">
        <div className="mx-auto max-w-[820px] px-4 sm:px-8">
          <ScrollReveal className="rounded-[30px] border border-neutral-200/90 bg-white p-7 sm:p-10 shadow-[0_24px_60px_rgba(15,23,42,0.06)] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#16422C]">
                Bắt buộc Xác thực Khách hàng • ArenaPulse
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-900">
                <Lock className="h-3 w-3" />
                Chưa đăng nhập tài khoản
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-[32px] font-bold tracking-[-0.025em] leading-tight text-[#0F172A]">
                Vui lòng đăng nhập tài khoản để giữ sân &amp; thanh toán đặt cọc
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-600">
                Để bảo vệ quyền lợi hoàn cọc hai chiều và cấp mã vé QR check-in một lần đúng danh
                tính người đặt, hệ thống yêu cầu khách hàng đăng nhập trước khi khóa sân vật lý.
              </p>
            </div>

            {activeListing && (
              <div className="flex items-center gap-4 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4">
                <img
                  src={activeListing.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                  alt={activeListing.groupName}
                  className="h-16 w-24 shrink-0 rounded-xl object-cover border border-neutral-200 bg-white"
                />
                <div className="min-w-0 text-xs">
                  <span className="font-semibold text-[#16422C]">
                    Lựa chọn đang được giữ tạm cho bạn:
                  </span>
                  <div className="mt-0.5 truncate text-sm font-bold text-[#0F172A]">
                    {activeListing.groupName}
                  </div>
                  <div className="mt-0.5 text-neutral-600">
                    {activeListing.venueName} • Tổng tạm tính:{' '}
                    <strong className="tabular-nums text-[#16422C]">
                      {formatVnd(grandTotal)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
              <ActionButton variant="outline" size="md" arrow="back" onClick={onBackToCourts}>
                Quay lại xem danh sách sân
              </ActionButton>
              <ActionButton
                variant="forest"
                size="lg"
                arrow="right"
                onClick={() => onRequireLogin?.()}
              >
                Đăng nhập / Đăng ký để đặt sân ngay
              </ActionButton>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  return (
    <section id="booking-flow" className="bg-[#F6F8F6] py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* Top Breadcrumb & Venue Operational Notice */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToCourts}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-neutral-400"
          >
            <span aria-hidden="true">←</span>
            <span>Quay lại Chọn sân &amp; khung giờ</span>
          </button>

          {matchingVenueNotice && (
            <button
              type="button"
              onClick={onOpenAnnouncementsPage}
              className="rounded-full bg-white border border-neutral-200 px-4 py-1.5 text-xs text-neutral-600 hover:border-[#16422C]"
            >
              Lưu ý tại cơ sở: <strong className="text-[#0F172A]">{matchingVenueNotice.title}</strong> →
            </button>
          )}
        </div>

        {/* Section Header */}
        <ScrollReveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
              02 • Thanh Toán Ký Quỹ, Hóa Đơn Chi Tiết &amp; Phát Hành Vé QR
            </div>
            <h2 className="mt-2.5 text-3xl sm:text-[42px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
              Trung tâm thanh toán bảo vệ hai chiều
            </h2>
          </div>

          {holdResult && (
            <button
              type="button"
              onClick={onResetFlow}
              className="fairway-interactive self-start rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A]"
            >
              Đặt thêm lượt sân mới
            </button>
          )}
        </ScrollReveal>

        {/* Clean 4-Stage Progress Bar */}
        <ScrollReveal delay={0.04} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map(({ step, title, sub }) => {
            const done = currentStage >= step;
            const current = currentStage === step;
            return (
              <div
                key={step}
                className={`rounded-2xl p-4 border transition-colors ${
                  current
                    ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-md'
                    : done
                      ? 'bg-white text-[#0F172A] border-[#16422C]/35'
                      : 'bg-white/60 text-neutral-400 border-neutral-200/80'
                }`}
              >
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 tabular-nums text-[11px] font-semibold ${
                    current
                      ? 'bg-[#E7F7D4] text-[#204E18]'
                      : done
                        ? 'bg-[#16422C] text-white'
                        : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  Bước 0{step}
                </span>
                <div className="mt-2.5 text-sm font-semibold">{title}</div>
                <div className={`mt-0.5 text-[11px] ${current ? 'text-white/75' : 'text-neutral-500'}`}>
                  {sub}
                </div>
              </div>
            );
          })}
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* LEFT 7 COLUMNS */}
          <div className="lg:col-span-7 space-y-6">
            {/* BLOCK 1: Choose Deposit Escrow vs Full Payment */}
            <ScrollReveal className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                  1. Chọn mức thanh toán hôm nay
                </h3>
                <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] font-medium text-neutral-600">
                  {paymentLocked ? 'Đã chốt gói thanh toán' : 'Tài khoản Ký quỹ Sàn bảo vệ'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={paymentLocked}
                  onClick={() => setPlanMode('DEPOSIT_ESCROW')}
                  className={`rounded-2xl p-4 text-left border transition-colors ${
                    planMode === 'DEPOSIT_ESCROW'
                      ? 'border-[#16422C] bg-[#F4F8F4] ring-1 ring-[#16422C]'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  } disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#16422C]">
                      Đặt cọc giữ sân ({depositPct}%)
                    </span>
                    <span className="rounded-full bg-[#E7F7D4] px-2 py-0.5 text-[10px] font-semibold text-[#204E18]">
                      Khuyên dùng
                    </span>
                  </div>
                  <div className="mt-2 tabular-nums text-xl font-bold text-[#0F172A]">
                    {formatVnd(depositAmount)}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Phần còn lại ({formatVnd(Math.max(0, grandTotal - depositAmount))}) thanh toán tại quầy khi check-in
                    {addOnsTotal > 0 ? ' (đã bao gồm dịch vụ đi kèm).' : '.'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={paymentLocked}
                  onClick={() => setPlanMode('FULL_ONLINE')}
                  className={`rounded-2xl p-4 text-left border transition-colors ${
                    planMode === 'FULL_ONLINE'
                      ? 'border-[#16422C] bg-[#F4F8F4] ring-1 ring-[#16422C]'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  } disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0E4F7E]">
                      Tất toán trọn gói (100%)
                    </span>
                    <span className="rounded-full bg-[#E6F1F8] px-2 py-0.5 text-[10px] font-semibold text-[#0E4F7E]">
                      Vào sân thẳng
                    </span>
                  </div>
                  <div className="mt-2 tabular-nums text-xl font-bold text-[#0F172A]">
                    {formatVnd(grandTotal)}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {addOnsTotal > 0
                      ? `Trọn gói tiền sân (${formatVnd(lockedPrice)}) + dịch vụ (${formatVnd(addOnsTotal)}); phần hủy chỉ tính trên ${depositPct}% cọc sân.`
                      : `Không cần thanh toán thêm tại sân; phần hủy cọc (nếu có) chỉ khấu trừ trên phần ${depositPct}% cọc.`}
                  </p>
                </button>
              </div>
            </ScrollReveal>

            {/* BLOCK 2: Multi-Gateway Payment Method Selector */}
            <ScrollReveal delay={0.05} className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                2. Phương thức thanh toán
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {GATEWAYS.map((item) => {
                  const active = gateway === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      disabled={paymentLocked}
                      onClick={() => {
                        setGateway(item.code);
                        setPaymentError(null);
                      }}
                      className={`rounded-2xl p-3.5 text-left border transition-colors ${
                        active
                          ? 'border-[#0F172A] bg-[#0F172A] text-white'
                          : 'border-neutral-200 bg-[#F8F9FA] text-[#0F172A] hover:bg-white'
                      } disabled:opacity-75 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GatewayIcon code={item.code} active={active} />
                          <span className="text-xs sm:text-[13px] font-semibold leading-snug">
                            {item.title}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            active
                              ? 'bg-[#E7F7D4] text-[#204E18]'
                              : 'bg-white text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p
                        className={`mt-2 pl-[42px] text-[11px] leading-snug ${
                          active ? 'text-white/75' : 'text-neutral-500'
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] p-5">
                {gateway === 'VIETQR_NAPAS' && (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="mx-auto sm:mx-0 shrink-0 rounded-2xl border border-neutral-200 bg-white p-3 text-center">
                      <QRCodeSVG
                        value={`VIETQR|970436|${virtualAccount}|${payableNow}|${transferMemo}`}
                        size={128}
                        level="M"
                        bgColor="#FFFFFF"
                        fgColor="#0F172A"
                      />
                      <div className="mt-1.5 text-[10px] font-semibold text-[#16422C]">
                        Napas 247 • VietQR
                      </div>
                    </div>

                    <div className="flex-1 space-y-2.5 text-xs">
                      <div>
                        <span className="text-neutral-500">Đơn vị thụ hưởng Ký quỹ:</span>
                        <div className="font-semibold text-[#0F172A]">
                          CTCP SAN THE THAO ARENAPULSE ESCROW (VCB)
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-neutral-200/70">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">
                            Số tài khoản định danh tự động
                          </span>
                          <span className="tabular-nums font-semibold text-[#0F172A]">
                            {virtualAccount}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText('VA', virtualAccount)}
                          className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-neutral-200"
                        >
                          {copiedField === 'VA' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-neutral-200/70">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">
                            Nội dung chuyển khoản chính xác
                          </span>
                          <span className="tabular-nums font-semibold text-[#16422C]">
                            {transferMemo}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText('MEMO', transferMemo)}
                          className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-neutral-200"
                        >
                          {copiedField === 'MEMO' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {gateway === 'VNPAY_ESCROW' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="font-semibold text-[#0E4F7E]">
                          Cổng Thanh Toán VNPAY
                        </div>
                        <p className="text-neutral-500 leading-relaxed">
                          Chuyển hướng trực tiếp tới cổng thanh toán VNPAY bảo mật, hỗ trợ VNPAYQR, thẻ nội địa và thẻ quốc tế.
                        </p>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-right border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">Số tiền thanh toán</div>
                        <div className="tabular-nums text-base font-bold text-[#0E4F7E]">
                          {formatVnd(payableNow)}
                        </div>
                      </div>
                    </div>

                    {vnpayCallbackStatus && (
                      <div className="rounded-xl border border-[#0E4F7E]/25 bg-[#F4F8FB] px-3.5 py-2.5 text-[11px] font-medium text-[#0E4F7E]">
                        {vnpayCallbackStatus}
                      </div>
                    )}

                    {!paymentLocked && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-full sm:w-72">
                          <PillSelect
                            variant="field"
                            ariaLabel="Chọn kênh VNPAY"
                            value={vnpayBankCode}
                            onChange={setVnpayBankCode}
                            options={[
                              { value: '', label: 'Chọn trên cổng VNPAY (Tất cả)' },
                              { value: 'VNPAYQR', label: 'Ứng dụng hỗ trợ VNPAYQR' },
                              { value: 'NCB', label: 'Ngân hàng Test NCB (ATM)' },
                              { value: 'VNBANK', label: 'Thẻ nội địa / Tài khoản NH' },
                              { value: 'INTCARD', label: 'Thẻ quốc tế Visa/Master/JCB' },
                            ]}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={vnpayBusy || !holdResult || isHoldExpired}
                          onClick={handleInitVnPayUrl}
                          className="rounded-xl bg-[#0E4F7E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D62] disabled:opacity-50"
                        >
                          {vnpayBusy ? 'Đang tạo URL VNPAY…' : 'Tạo URL thanh toán VNPAY'}
                        </button>
                      </div>
                    )}

                    {vnpaySession && (
                      <div className="rounded-2xl border border-[#0E4F7E]/25 bg-white p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#0F172A]">
                            Mã giao dịch: <code className="tabular-nums">{vnpaySession.txnRef}</code>
                          </span>
                          <span className="rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10px] font-semibold text-[#0E4F7E]">
                            {vnpaySession.status} • Hết hạn {vnpaySession.expireDate}
                          </span>
                        </div>
                        <a
                          href={vnpaySession.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-[#0E4F7E] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#0B3D62]"
                        >
                          Tiếp tục tới cổng thanh toán VNPAY ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {gateway === 'MOMO_WALLET' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-[#A50064]">
                          <span>Ví Điện Tử MoMo</span>
                        </div>
                        <p className="text-neutral-500 leading-relaxed">
                          Tạo mã QR thanh toán MoMo hoặc chuyển hướng trực tiếp sang ứng dụng ví MoMo bảo mật.
                        </p>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-right border border-neutral-200">
                        <div className="text-[10px] text-neutral-400">Số tiền thanh toán</div>
                        <div className="tabular-nums text-base font-bold text-[#A50064]">
                          {formatVnd(payableNow)}
                        </div>
                      </div>
                    </div>

                    {momoCallbackStatus && (
                      <div className="rounded-xl border border-[#16422C]/25 bg-[#F4F8F4] px-3.5 py-2.5 text-[11px] font-medium text-[#16422C]">
                        {momoCallbackStatus}
                      </div>
                    )}

                    {!paymentLocked && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={momoInitBusy || !holdResult || isHoldExpired}
                          onClick={handleInitLiveMoMoSession}
                          className="rounded-xl bg-[#A50064] px-4 py-2 text-xs font-semibold text-white hover:bg-[#8A0053] disabled:opacity-50"
                        >
                          {momoInitBusy
                            ? 'Đang tạo phiên thanh toán MoMo…'
                            : 'Tạo thanh toán MoMo & Lấy mã QR'}
                        </button>
                        {!holdResult && (
                          <span className="text-[11px] text-neutral-500">
                            Hãy nhấn &quot;Bước 01 → Giữ sân&quot; ở cột bên phải trước để mở khóa nút lấy mã MoMo.
                          </span>
                        )}
                      </div>
                    )}

                    {momoSession && (
                      <div className="flex flex-col gap-4 rounded-2xl border border-[#A50064]/25 bg-white p-4 sm:flex-row sm:items-center">
                        <div className="mx-auto sm:mx-0 shrink-0 rounded-xl border border-neutral-200 bg-white p-2.5 text-center">
                          <QRCodeSVG
                            value={momoSession.qrCodeUrl}
                            size={120}
                            level="M"
                            bgColor="#FFFFFF"
                            fgColor="#A50064"
                          />
                          <div className="mt-1 text-[10px] font-semibold text-[#A50064]">
                            {momoSession.liveGatewayResponse ? 'Live MoMo QR' : 'Local Signed QR'}
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-[#0F172A]">
                              OrderId: <code className="tabular-nums">{momoSession.orderId}</code>
                            </span>
                            <span className="rounded-full bg-[#E7F7D4] px-2 py-0.5 text-[10px] font-semibold text-[#204E18]">
                              resultCode={momoSession.resultCode} • {momoSession.message}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <a
                              href={momoSession.payUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-xl bg-[#A50064] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#8A0053]"
                            >
                              Mở cổng thanh toán MoMo Test ↗
                            </a>
                            {momoSession.deeplink && (
                              <a
                                href={momoSession.deeplink}
                                className="inline-flex items-center gap-1 rounded-xl border border-[#A50064]/30 bg-[#FDF2F8] px-3 py-2 text-[11px] font-semibold text-[#A50064]"
                              >
                                Mở app MoMo
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {gateway === 'INTL_CARD' && (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 text-xs">
                    <div className="sm:col-span-2">
                      <label htmlFor="card-num" className="mb-1 block font-medium text-neutral-700">
                        Số thẻ quốc tế (Visa / Mastercard / JCB) *
                      </label>
                      <input
                        id="card-num"
                        name="cardNumber"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        disabled={paymentLocked}
                        placeholder="Nhập 16 chữ số trên mặt thẻ"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-holder" className="mb-1 block font-medium text-neutral-700">
                        Tên in trên thẻ *
                      </label>
                      <input
                        id="card-holder"
                        name="cardHolder"
                        type="text"
                        autoComplete="cc-name"
                        disabled={paymentLocked}
                        placeholder="NGUYEN VAN A"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="card-exp" className="mb-1 block font-medium text-neutral-700">
                          Hết hạn (MM/YY) *
                        </label>
                        <input
                          id="card-exp"
                          name="cardExpiry"
                          type="text"
                          autoComplete="cc-exp"
                          disabled={paymentLocked}
                          placeholder="08/29"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 tabular-nums text-sm text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label htmlFor="card-cvc" className="mb-1 block font-medium text-neutral-700">
                          CVC / CVV *
                        </label>
                        <input
                          id="card-cvc"
                          name="cardCvc"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          autoComplete="cc-csc"
                          disabled={paymentLocked}
                          placeholder="•••"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 tabular-nums text-sm text-[#0F172A]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollReveal>

            {/* BLOCK 3: Booker Contact & VAT Invoice */}
            <ScrollReveal delay={0.08} className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                3. Thông tin người nhận sân &amp; biên lai điện tử
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <label htmlFor="booker-name" className="mb-1 block font-medium text-neutral-700">
                    Họ và tên người nhận sân *
                  </label>
                  <input
                    id="booker-name"
                    name="customerName"
                    type="text"
                    autoComplete="name"
                    disabled={paymentLocked}
                    placeholder="Nguyễn Văn A"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                  />
                </div>
                <div>
                  <label htmlFor="booker-phone" className="mb-1 block font-medium text-neutral-700">
                    Số điện thoại nhận vé *
                  </label>
                  <input
                    id="booker-phone"
                    name="customerPhone"
                    type="tel"
                    autoComplete="tel"
                    disabled={paymentLocked}
                    placeholder="09xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                  />
                </div>
                <div>
                  <label htmlFor="booker-email" className="mb-1 block font-medium text-neutral-700">
                    Email nhận biên lai *
                  </label>
                  <input
                    id="booker-email"
                    name="customerEmail"
                    type="email"
                    autoComplete="email"
                    disabled={paymentLocked}
                    placeholder="email@domain.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="booker-note" className="mb-1 block font-medium text-neutral-700">
                    Ghi chú chuẩn bị sân (tùy chọn)
                  </label>
                  <input
                    id="booker-note"
                    name="bookingNote"
                    type="text"
                    disabled={paymentLocked}
                    placeholder="Ví dụ: Thuê thêm 4 vợt thi đấu, chuẩn bị sẵn bóng mới tại sân…"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <label className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  name="needVatInvoice"
                  disabled={paymentLocked}
                  checked={needVatInvoice}
                  onChange={(e) => setNeedVatInvoice(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#16422C]"
                />
                <span>Yêu cầu xuất hóa đơn VAT điện tử cho công ty / câu lạc bộ sau khi hoàn tất ca chơi</span>
              </label>

              {needVatInvoice && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl border border-neutral-200 bg-[#F8F9FA] p-3.5 text-xs">
                  <div>
                    <label className="mb-1 block font-medium text-neutral-700">Tên đơn vị xuất VAT *</label>
                    <input
                      type="text"
                      disabled={paymentLocked}
                      placeholder="Công ty TNHH / CLB…"
                      value={vatCompanyName}
                      onChange={(e) => setVatCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-neutral-700">Mã số thuế doanh nghiệp *</label>
                    <input
                      type="text"
                      disabled={paymentLocked}
                      placeholder="Nhập 10 hoặc 13 số MST"
                      value={vatTaxCode}
                      onChange={(e) => setVatTaxCode(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 tabular-nums text-sm text-[#0F172A]"
                    />
                  </div>
                </div>
              )}
            </ScrollReveal>

            {/* BLOCK 4: Frozen Cancellation Policy & Refund Calculator */}
            <ScrollReveal delay={0.1} className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                    4. Chính sách hoàn cọc đóng băng theo mốc giờ
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Chính sách được chụp cứng vào đơn lúc giữ sân — áp dụng tính khấu trừ trên phần cọc {depositPct}%.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#16422C] cursor-pointer">
                  <input
                    type="checkbox"
                    name="venueCancelMode"
                    checked={venueCancelMode}
                    onChange={(e) => setVenueCancelMode(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#16422C]"
                  />
                  <span>Xem mức hoàn nếu chủ sân hủy</span>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="rounded-xl bg-[#F4F8F4] p-3 border border-[#16422C]/20">
                  <div className="font-semibold text-[#16422C]">Trước ≥ 11 giờ</div>
                  <div className="mt-0.5 tabular-nums font-bold text-[#0F172A]">Hoàn 100% cọc</div>
                </div>
                <div className="rounded-xl bg-[#F8F9FA] p-3 border border-neutral-200">
                  <div className="font-semibold text-[#0E4F7E]">Từ 4h đến &lt; 11h</div>
                  <div className="mt-0.5 tabular-nums font-bold text-[#0F172A]">Hoàn 50% cọc</div>
                </div>
                <div className="rounded-xl bg-[#F8F9FA] p-3 border border-neutral-200">
                  <div className="font-semibold text-neutral-600">Sát giờ &lt; 4h</div>
                  <div className="mt-0.5 tabular-nums font-bold text-neutral-700">Khấu trừ cọc</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs">
                  <label htmlFor="refund-hours" className="text-neutral-600">
                    Ước tính hoàn tiền cọc nếu hủy trước giờ chơi:
                  </label>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    Trước {simHoursBefore} giờ
                  </span>
                </div>
                <input
                  id="refund-hours"
                  name="simHoursBefore"
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  disabled={venueCancelMode}
                  value={simHoursBefore}
                  onChange={(e) => setSimHoursBefore(Number(e.target.value))}
                  className="w-full accent-[#16422C] disabled:opacity-40"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F6F8F6] px-4 py-3">
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Hoàn cọc ước tính ({previewRefundPct}%)</span>
                    <strong className="tabular-nums text-base text-[#16422C]">
                      {formatVnd(previewRefundVnd)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Khấu trừ bảo vệ lịch</span>
                    <strong className="tabular-nums text-base text-neutral-700">
                      {formatVnd(previewForfeitVnd)}
                    </strong>
                  </div>
                </div>

                {holdResult && !cancelResult && !checkInResult && (
                  <button
                    type="button"
                    onClick={() =>
                      onCancelBooking(
                        simHoursBefore,
                        canVenueOperate ? venueCancelMode : false
                      )
                    }
                    className="fairway-interactive rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-[#0F172A] hover:border-[#0F172A]"
                  >
                    Hủy đơn đặt sân
                  </button>
                )}
              </div>
            </ScrollReveal>
          </div>

          {/* RIGHT 5 COLUMNS */}
          <div className="lg:col-span-5 lg:sticky lg:top-22 space-y-6">
            <div className="rounded-[28px] border border-neutral-200 bg-white p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={activeListing?.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                    alt=""
                    className="h-14 w-16 shrink-0 rounded-2xl object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-[#0E4F7E]">
                      {activeListing?.venueName ?? 'ArenaPulse Multi-Sport Complex'}
                    </div>
                    <h3 className="mt-0.5 text-base font-semibold leading-snug text-[#0F172A]">
                      {activeListing?.groupName ?? 'Cụm 10 sân Pickleball chuẩn thi đấu'}
                    </h3>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 tabular-nums text-[11px] font-semibold ${
                    isHoldExpired
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-[#E7F7D4] text-[#204E18]'
                  }`}
                >
                  {countdownLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-[#F8F9FA] p-3.5 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 block">Khung giờ thuê</span>
                  <strong className="tabular-nums text-[#0F172A]">
                    {activeQuote
                      ? formatSlotWindow(activeQuote.slotStart, activeQuote.slotEnd)
                      : '18:00–19:00 • Hôm nay'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">Mã sân vật lý</span>
                  <strong className="tabular-nums text-[#16422C]">
                    {holdResult?.unitNumber ?? 'Tự động cấp khi giữ chỗ'}
                  </strong>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 border-b border-neutral-100 pb-4 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Giá tiêu chuẩn cơ sở ({activeListing?.slotMinutes ?? 60} phút)</span>
                  <span className="tabular-nums font-medium text-[#0F172A]">
                    {formatVnd(basePrice)}
                  </span>
                </div>

                <div className="flex justify-between text-neutral-600">
                  <span>
                    Điều chỉnh khung giờ &amp; độ lấp đầy (
                    {activeQuote
                      ? `${activeQuote.audit.timeMultiplier.toFixed(2)}×${activeQuote.audit.matrixMultiplier.toFixed(2)}`
                      : '1.00×'}
                    )
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      dynamicDelta <= 0 ? 'text-[#16422C]' : 'text-[#0E4F7E]'
                    }`}
                  >
                    {dynamicDelta >= 0 ? `+${formatVnd(dynamicDelta)}` : formatVnd(dynamicDelta)}
                  </span>
                </div>

                <div className="flex justify-between text-neutral-600">
                  <span>Phí nền tảng người chơi</span>
                  <span className="font-medium text-[#16422C]">0₫ (Miễn phí)</span>
                </div>

                {activeListing?.provider && (
                  <div className="rounded-xl bg-[#F4F8FB] border border-[#0E4F7E]/15 p-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-500">Đối tác cung cấp sân</span>
                      <span className="font-semibold text-[#0F172A] truncate max-w-[200px]">
                        {activeListing.provider.providerName}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-500">
                        Chiết khấu đối tác ({activeListing.provider.commissionRatePct}% trừ từ chủ sân)
                      </span>
                      <span className="tabular-nums font-semibold text-[#0E4F7E]">
                        {formatVnd(
                          Math.floor((lockedPrice * activeListing.provider.commissionRatePct) / 100)
                        )}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-neutral-500">
                      Sàn trung gian ArenaPulse giữ hộ ký quỹ &amp; bảo vệ hoàn tiền 100%.
                    </div>
                  </div>
                )}

                {selectedServiceItems.length > 0 && (
                  <div className="rounded-xl border border-[#16422C]/20 bg-[#F4F8F4]/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#16422C]">
                      <span>Dịch vụ đi kèm đã chọn ({selectedServiceItems.length} loại)</span>
                      <span className="tabular-nums">+{formatVnd(addOnsTotal)}</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedServiceItems.map(({ service, quantity }) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0 flex-1 text-neutral-700 truncate">
                            <span className="font-semibold text-[#0F172A]">{quantity}×</span>{' '}
                            {service.name}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!paymentLocked && onChangeServiceQuantity && (
                              <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-1 py-0.5">
                                <button
                                  type="button"
                                  aria-label={`Giảm ${service.name}`}
                                  onClick={() => onChangeServiceQuantity(service.id, quantity - 1)}
                                  className="h-4 w-4 rounded-full text-[10px] font-bold text-neutral-600 hover:bg-neutral-100"
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Tăng ${service.name}`}
                                  disabled={quantity >= service.maxQty}
                                  onClick={() =>
                                    onChangeServiceQuantity(
                                      service.id,
                                      Math.min(service.maxQty, quantity + 1)
                                    )
                                  }
                                  className="h-4 w-4 rounded-full text-[10px] font-bold text-[#16422C] hover:bg-[#E7F7D4] disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            )}
                            <span className="tabular-nums font-semibold text-[#0F172A]">
                              {formatVnd(service.unitPrice * quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-1.5 text-sm font-semibold text-[#0F172A]">
                  <span>
                    {addOnsTotal > 0 ? 'Tổng cộng (Sân + Dịch vụ)' : 'Tổng giá ca thuê đã khóa'}
                  </span>
                  <span className="tabular-nums">{formatVnd(grandTotal)}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#16422C] block">
                      Thanh toán ngay (
                      {(paymentReceipt?.paymentType ?? planMode) === 'FULL_ONLINE' ||
                      paymentReceipt?.paymentType === 'FULL_SETTLEMENT'
                        ? '100% trọn gói'
                        : `Cọc ${depositPct}%`}
                      )
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Qua {paymentReceipt?.providerLabel ?? selectedGatewayObj.title}
                    </span>
                  </div>
                  <span className="tabular-nums text-2xl font-bold text-[#16422C]">
                    {formatVnd(payableNow)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Còn lại thanh toán tại sân khi check-in</span>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {formatVnd(remainingAtVenue)}
                  </span>
                </div>
              </div>

              {paymentError && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {paymentError}
                </div>
              )}

              <div className="mt-6 space-y-2.5">
                {isHoldExpired && !qrTicket && !cancelResult && (
                  <ActionButton variant="ink" size="lg" fullWidth onClick={onResetFlow}>
                    Hết hạn giữ giá 10 phút • Khóa giá lại ngay
                  </ActionButton>
                )}

                {!isHoldExpired && !holdResult && (
                  <ActionButton
                    variant="ink"
                    size="lg"
                    fullWidth
                    disabled={busyStep === 'HOLD' || !activeListing || !activeQuote}
                    onClick={onHoldSlot}
                  >
                    {busyStep === 'HOLD'
                      ? 'Đang khóa sân vật lý…'
                      : 'Bước 01 → Giữ sân & Khởi tạo thanh toán'}
                  </ActionButton>
                )}

                {!isHoldExpired && holdResult && !qrTicket && !cancelResult && (
                  <ActionButton
                    variant="forest"
                    size="lg"
                    fullWidth
                    disabled={busyStep === 'PAY'}
                    onClick={validateAndSubmitPayment}
                  >
                    {busyStep === 'PAY'
                      ? 'Đang đối soát giao dịch ký quỹ…'
                      : `Xác nhận thanh toán ${formatVnd(payableNow)}`}
                  </ActionButton>
                )}

                {qrTicket && !checkInResult && !cancelResult && canVenueOperate && (
                  <ActionButton
                    variant="sky"
                    size="lg"
                    fullWidth
                    disabled={busyStep === 'SCAN'}
                    onClick={onScanQr}
                  >
                    {busyStep === 'SCAN'
                      ? 'Đang xác thực vé QR…'
                      : 'Quét QR Check-in cho khách (Nhân viên / Chủ sân)'}
                  </ActionButton>
                )}
              </div>

              {paymentReceipt && !cancelResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EXPO_EASE }}
                  role="status"
                  className="mt-4 rounded-2xl bg-[#F4F8F4] border border-[#16422C]/20 p-4 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-semibold text-[#16422C]">
                    <span>Biên lai thanh toán thành công</span>
                    <span className="tabular-nums">{paymentReceipt.providerRef}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Người nhận sân: {paymentReceipt.customerName} ({paymentReceipt.customerPhone})</span>
                    <span className="tabular-nums font-semibold text-[#0F172A]">
                      Đã thu: {formatVnd(paymentReceipt.paidAmount)}
                    </span>
                  </div>
                  {paymentReceipt.needVatInvoice && (
                    <div className="text-[11px] text-[#0E4F7E]">
                      Hóa đơn VAT: {paymentReceipt.vatCompanyName} (MST: {paymentReceipt.vatTaxCode})
                    </div>
                  )}
                  <div className="text-[11px] text-neutral-500">
                    Xác nhận thanh toán lúc {paymentReceipt.paidAt}. Còn trả tại quầy:{' '}
                    <strong className="text-[#0F172A]">{formatVnd(paymentReceipt.remainingAtVenue)}</strong>.
                  </div>
                </motion.div>
              )}

              {cancelResult && (
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950">
                  <strong>Đơn đã hủy &amp; mở khóa sân!</strong> Hoàn trả:{' '}
                  <strong className="tabular-nums">{formatVnd(cancelResult.refundAmount)}</strong> (
                  {cancelResult.appliedRefundPercent}%) • Khấu trừ:{' '}
                  <strong className="tabular-nums">{formatVnd(cancelResult.forfeitedAmount)}</strong>.
                </div>
              )}
            </div>

            {/* Mode-Specific Electronic Check-in Pass (QR for Scanner Venues / 6-Digit PIN for No-Scanner Venues) */}
            {(() => {
              const isPinOnlyCourt =
                activeListing?.checkinMode === 'PIN_COUNTER' ||
                activeListing?.checkinMode === 'MANUAL';
              const customerPinCode = (() => {
                if (!qrTicket) return '';
                const seed = `${holdResult?.reservationId ?? ''}:${qrTicket.qrJti}`;
                let h = 0x811c9dc5;
                for (let i = 0; i < seed.length; i++) {
                  h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
                }
                return String((h % 900_000) + 100_000);
              })();

              return (
                <div className="chamfer-top-right overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-md">
                  <div className="relative h-28 w-full overflow-hidden">
                    <img
                      src={activeListing?.imageUrl || '/images/real-football-turf.jpg'}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A1E15]/90 via-[#0A1E15]/40 to-transparent" />
                    <div className="absolute inset-x-5 bottom-3 text-white">
                      <div className="flex items-center justify-between text-[11px] text-white/80 pr-8">
                        <span>ArenaPulse E-Pass</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          {isPinOnlyCourt ? (
                            <>
                              <KeyRound className="h-3 w-3" /> Mã PIN 1 Lần
                            </>
                          ) : (
                            <>
                              <QrCode className="h-3 w-3" /> Vé QR 1 Lần
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-sm font-semibold">
                        Sân {holdResult?.unitNumber ?? 'PIC-04'} •{' '}
                        {checkInResult
                          ? 'ĐÃ NHẬN SÂN'
                          : cancelResult
                            ? 'ĐÃ HỦY VÉ'
                            : qrTicket
                              ? 'ĐÃ KÍCH HOẠT'
                              : 'CHỜ THANH TOÁN'}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 text-center">
                    {isPinOnlyCourt ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4] px-4 py-5">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10.5px] font-bold text-[#16422C] shadow-2xs">
                            <KeyRound className="h-3.5 w-3.5" />
                            Xác thực bằng Mã Số (Cơ sở không dùng máy quét)
                          </div>

                          <div className="mt-3 font-mono text-3xl font-extrabold tracking-[0.28em] text-[#0F172A]">
                            {qrTicket ? `${customerPinCode.slice(0, 3)} ${customerPinCode.slice(3)}` : '• • •  • • •'}
                          </div>

                          <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-600">
                            {checkInResult
                              ? `Đã check-in thành công lúc ${new Date(checkInResult.scannedAt).toLocaleTimeString('vi-VN')}`
                              : qrTicket
                                ? 'Đọc mã PIN 6 chữ số này kèm 4 số cuối SĐT cho nhân viên trực sân (tự vô hiệu hóa sau 1 lần dùng).'
                                : 'Mã PIN 6 chữ số bí mật sẽ tự động kích hoạt ngay sau khi xác nhận thanh toán đặt cọc.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                          <QRCodeSVG
                            value={
                              qrTicket?.qrToken ??
                              `ARENAPULSE_PENDING:${holdResult?.reservationId ?? 'DRAFT'}`
                            }
                            size={156}
                            level="M"
                            bgColor="#FFFFFF"
                            fgColor="#0F172A"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-600">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#16422C] shrink-0" />
                          <span>
                            {checkInResult
                              ? `Đã check-in thành công lúc ${new Date(checkInResult.scannedAt).toLocaleTimeString('vi-VN')}`
                              : qrTicket
                                ? 'Đưa mã QR này cho nhân viên quét tại quầy kèm 4 số cuối SĐT đăng ký.'
                                : 'Mã QR điện tử sẽ kích hoạt ngay sau khi xác nhận thanh toán.'}
                          </span>
                        </div>
                      </>
                    )}

                    {qrTicket && holdResult && !cancelResult && (
                      <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3.5 text-left">
                        <ActionButton
                          variant="outline"
                          size="sm"
                          fullWidth
                          disabled={sendingEmail}
                          onClick={() =>
                            handleSendQrEmailNow(
                              holdResult.reservationId,
                              customerEmail || paymentReceipt?.customerEmail || ''
                            )
                          }
                        >
                          {sendingEmail
                            ? 'Đang gửi phiếu nhận sân qua Email…'
                            : isPinOnlyCourt
                              ? `Gửi Mã PIN 6 số về Gmail (${customerEmail || 'nhập email ở mục 3'})`
                              : `Gửi Vé QR về Gmail (${customerEmail || 'nhập email ở mục 3'})`}
                        </ActionButton>
                        {resendEmailStatus && (
                          <div className="rounded-xl bg-[#F4F8F4] px-3 py-2 text-[11px] text-[#16422C] border border-[#16422C]/20">
                            {resendEmailStatus}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Persistent "Vé của tôi" Saved Tickets */}
            {myTickets.length > 0 && (
              <div className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#0F172A]">
                    Vé QR của tôi trên hệ thống ({myTickets.length})
                  </h4>
                  <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[10px] font-semibold text-[#204E18]">
                    Không mất khi F5
                  </span>
                </div>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {myTickets.map((tk) => (
                    <div
                      key={tk.reservationId}
                      className="rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-[#0F172A] truncate">{tk.venueName}</strong>
                        <span className="shrink-0 rounded-full bg-[#16422C] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {tk.unitNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatSlotWindow(tk.slotStart, tk.slotEnd)} • Đã trả: {formatVnd(tk.paidOnlineAmount)}
                      </div>
                      {tk.contactEmail && (
                        <div className="text-[10.5px] text-[#0E4F7E]">
                          Email nhận QR: {tk.contactEmail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
