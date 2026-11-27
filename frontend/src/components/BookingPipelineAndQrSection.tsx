import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Lock } from 'lucide-react';
import type {
  AuthSession,
  BookingPaymentStatus,
  CheckoutProvider,
  CancelBookingResult,
  HoldSlotResult,
  MyTicketRecord,
  PaymentPlanMode,
  PriceQuote,
  PublishedListing,
  RoleCode,
  VenueAnnouncement,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { getActiveLessorServices } from '../data/courtServicesData';
import { isValidVietnamTaxCode } from '../utils/lessorLegalValidator';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton } from './FairwayControls';
import { CheckoutPaymentQr } from './CheckoutPaymentQr';
import { PaymentMethodLogo } from './PaymentMethodLogo';
import { BookingCourtPicker, type BookingCourtPickerControls } from './BookingCourtPicker';

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
  cancelResult: CancelBookingResult | null;
  busyStep: string | null;
  countdownLabel: string;
  onHoldSlot: () => Promise<void>;
  courtPicker: BookingCourtPickerControls;
  onCancelBooking: (venueInitiated: boolean) => Promise<void>;
  onResetFlow: () => void;
  selectedServiceQuantities?: Record<string, number>;
  onChangeServiceQuantity?: (serviceId: string, nextQty: number) => void;
}

const qrProviders = [
  { code: 'VIETQR_NAPAS', title: 'Chuyển khoản VietQR', detail: 'Quét QR động & đối soát NAPAS 24/7' },
  { code: 'MOMO_WALLET', title: 'Ví MoMo', detail: 'Quét bằng ứng dụng MoMo PayGate v2' },
  { code: 'VNPAY_ESCROW', title: 'Cổng VNPAY', detail: 'Thẻ ATM nội địa, VNPAY-QR & Visa/Master' },
] as const;

const stateMessages: Record<BookingPaymentStatus['paymentStatus'], string> = {
  NOT_STARTED: 'Chưa tạo giao dịch thanh toán.',
  PENDING: 'Đang chờ cổng thanh toán xác nhận.',
  FAILED: 'Giao dịch chưa thành công. Bạn có thể thử lại nếu lượt giữ sân còn hiệu lực.',
  VERIFIED: 'Đã nhận xác nhận thanh toán từ cổng.',
  NO_DEPOSIT: 'Đã xác nhận đặt sân. Ca này thanh toán tại sân.',
  EXPIRED: 'Lượt giữ sân đã kết thúc. Hệ thống tiếp tục kiểm tra giao dịch đã gửi.',
  CANCELLED: 'Đơn đặt sân đã hủy.',
  UNVERIFIED: 'Đơn cũ cần đối soát trước khi cấp vé.',
  REVIEW_REQUIRED: 'Cổng đã báo thu tiền. Giao dịch cần được đối soát với đơn đặt sân.',
  REFUND_PENDING: 'Khoản hoàn đang chờ xác nhận từ cổng thanh toán.',
  REFUNDED: 'Cổng thanh toán đã xác nhận hoàn tiền.',
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
  cancelResult,
  busyStep,
  countdownLabel,
  onHoldSlot,
  courtPicker,
  onCancelBooking,
  onResetFlow,
  selectedServiceQuantities = {},
  onChangeServiceQuantity,
}) => {
  const [planMode, setPlanMode] = useState<PaymentPlanMode>('DEPOSIT_ESCROW');
  const [preferredProvider, setPreferredProvider] = useState<(typeof qrProviders)[number]['code']>('VIETQR_NAPAS');
  const [providers, setProviders] = useState<CheckoutProvider[] | null>(null);
  const [providersError, setProvidersError] = useState(false);
  const [providerRequest, setProviderRequest] = useState(0);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rememberedReservation, setRememberedReservation] = useState<string | null>(null);
  const [statusRequest, setStatusRequest] = useState(0);
  const [customerName, setCustomerName] = useState<string>(session?.fullName ?? '');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>(session?.email ?? '');
  const [bookingNote, setBookingNote] = useState<string>('');
  const [needVatInvoice, setNeedVatInvoice] = useState<boolean>(false);
  const [vatCompanyName, setVatCompanyName] = useState<string>('');
  const [vatTaxCode, setVatTaxCode] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [simHoursBefore, setSimHoursBefore] = useState(14);
  const [venueCancelMode, setVenueCancelMode] = useState(false);
  const [myTicket, setMyTicket] = useState<MyTicketRecord | null>(null);
  const [resendEmailStatus, setResendEmailStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const ownerId = session?.userId;
  const trackingKey =
    ownerId && activeListing?.groupId && activeQuote?.slotStart
      ? `arenapulse:checkout:${ownerId}:${activeListing.groupId}:${activeQuote.slotStart}`
      : null;
  const matchingHold =
    holdResult &&
    activeListing &&
    activeQuote &&
    holdResult.groupId === activeListing.groupId &&
    holdResult.slotStart === activeQuote.slotStart
      ? holdResult
      : null;
  const trackedReservation = matchingHold?.reservationId ?? rememberedReservation;
  const currentPayment = paymentStatus?.reservationId === trackedReservation ? paymentStatus : null;
  const state = currentPayment?.paymentStatus;
  const issued = state === 'VERIFIED' || state === 'NO_DEPOSIT';
  const activeTicket = issued && myTicket?.reservationId === trackedReservation ? myTicket : null;
  const enabledQrProviders = qrProviders.filter(({ code }) => providers?.includes(code));
  const selectedProvider = enabledQrProviders.find(({ code }) => code === preferredProvider) ?? enabledQrProviders[0];
  const shownProvider = currentPayment?.provider ?? selectedProvider?.code;
  const activePaymentQr = state === 'PENDING' ? currentPayment?.paymentQr : null;

  useEffect(() => {
    let active = true;
    if (ownerId) {
      window.sessionStorage.removeItem(`arenapulse:checkout:${ownerId}`);
    }
    if (!trackingKey) {
      setRememberedReservation(null);
      setPaymentStatus(null);
      setPaymentError(null);
      return;
    }
    setRememberedReservation(window.sessionStorage.getItem(trackingKey));
    window.sessionStorage.removeItem(`${trackingKey}:url`);
    setMyTicket(null);
    setPaymentStatus(null);
    setPaymentError(null);
    setStatusError(null);
    setReturnError(null);
    const location = window.location;
    const params = new URLSearchParams(location.search);
    if (params.has('vnp_TxnRef') && params.has('vnp_SecureHash')) {
      marketplaceApi.verifyVnPayReturnParams(location.search).then(result => {
        if (!active) return;
        if (!result.signatureValid || !result.reservationId) {
          setReturnError('Không xác minh được kết quả trả về từ VNPAY. Hãy kiểm tra trạng thái đơn.');
          return;
        }
        window.sessionStorage.setItem(trackingKey, result.reservationId);
        setRememberedReservation(result.reservationId);
      }).catch(() => {
        if (active) setReturnError('Chưa đọc được kết quả trả về từ VNPAY. Hãy kiểm tra trạng thái đơn.');
      });
      window.history.replaceState({}, '', location.pathname);
    } else if (params.has('orderId') && params.has('resultCode')) {
      window.history.replaceState({}, '', location.pathname);
    }
    return () => { active = false; };
  }, [ownerId, trackingKey]);

  useEffect(() => {
    setProviders(null);
    setProvidersError(false);
    if (!ownerId) return;
    const request = new AbortController();
    marketplaceApi.getCheckoutProviders(request.signal).then(data => {
      if (!request.signal.aborted) setProviders(data);
    }).catch(() => {
      if (!request.signal.aborted) {
        setProviders([]);
        setProvidersError(true);
      }
    });
    return () => request.abort();
  }, [ownerId, providerRequest]);

  useEffect(() => {
    if (trackingKey && matchingHold?.reservationId) {
      window.sessionStorage.setItem(trackingKey, matchingHold.reservationId);
      setRememberedReservation(matchingHold.reservationId);
    }
  }, [trackingKey, matchingHold?.reservationId]);

  useEffect(() => {
    if (
      trackingKey &&
      (state === 'VERIFIED' || state === 'NO_DEPOSIT' || state === 'CANCELLED' || state === 'EXPIRED')
    ) {
      window.sessionStorage.removeItem(trackingKey);
    }
  }, [trackingKey, state]);

  useEffect(() => {
    if (!ownerId || !trackedReservation) return;
    const request = new AbortController();
    let inFlight = false;
    let complete = false;
    let delay = 4000;
    let timer: number | undefined;

    async function refresh() {
      if (inFlight || complete || request.signal.aborted || document.hidden) return;
      window.clearTimeout(timer);
      inFlight = true;
      try {
        const status = await marketplaceApi.getBookingPaymentStatus(trackedReservation!, request.signal);
        if (request.signal.aborted) return;
        setPaymentStatus(status);
        setStatusError(null);
        complete = ['VERIFIED', 'NO_DEPOSIT', 'REFUNDED'].includes(status.paymentStatus)
          || (status.paymentStatus === 'CANCELLED' && status.reservationStatus === 'CANCELLED');
        delay = ['REVIEW_REQUIRED', 'REFUND_PENDING', 'EXPIRED'].includes(status.paymentStatus) ? 15000 : 4000;
      } catch {
        if (!request.signal.aborted) setStatusError('Chưa kiểm tra được giao dịch. Vui lòng thử lại.');
        delay = Math.min(30000, delay * 2);
      } finally {
        inFlight = false;
        if (!complete && !request.signal.aborted && !document.hidden) {
          timer = window.setTimeout(refresh, delay);
        }
      }
    }

    void refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      request.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ownerId, trackedReservation, statusRequest, cancelResult]);

  useEffect(() => {
    setMyTicket(null);
    setTicketError(null);
    if (!ownerId || !issued || !trackedReservation) return;
    const request = new AbortController();
    marketplaceApi.getMyTicket(trackedReservation, request.signal).then(ticket => {
      if (request.signal.aborted) return;
      if (!ticket) throw new Error('Vé chưa xuất hiện trong tài khoản.');
      setMyTicket(ticket);
    }).catch(() => {
      if (!request.signal.aborted) setTicketError('Đơn đã xác nhận. Chưa tải được vé nhận sân.');
    });
    return () => request.abort();
  }, [ownerId, trackedReservation, issued, statusRequest, cancelResult]);

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

  const basePrice = activeListing?.basePrice ?? 0;
  const orderCancelled = Boolean(cancelResult || currentPayment?.reservationStatus === 'CANCELLED');
  const recordedPrice = currentPayment && !orderCancelled
    ? currentPayment.remainingAtVenue + (state === 'VERIFIED' ? currentPayment.paidAmount : 0) : null;
  const lockedPrice = recordedPrice ?? matchingHold?.lockedPrice ?? activeQuote?.currentPrice ?? activeListing?.basePrice ?? 0;
  const dynamicDelta = lockedPrice - basePrice;
  const depositPct = activeListing?.depositPercent ?? 0;
  const depositAmount = matchingHold?.depositAmount ?? Math.floor((lockedPrice * depositPct) / 100);

  const sportServices = getActiveLessorServices(activeListing);
  const selectedServiceItems = sportServices
    .map((service) => ({ service, quantity: selectedServiceQuantities[service.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0);
  const addOnsTotal = selectedServiceItems.reduce(
    (sum, item) => sum + item.service.unitPrice * item.quantity,
    0
  );
  const grandTotal = lockedPrice + addOnsTotal;

  const payableNow = issued && currentPayment
    ? currentPayment.paidAmount
    : currentPayment?.requestedAmount ?? (planMode === 'FULL_ONLINE' ? lockedPrice : depositAmount);
  const remainingAtVenue = issued && currentPayment ? currentPayment.remainingAtVenue : Math.max(0, lockedPrice - payableNow);
  const displaysFullPayment = payableNow > 0 && payableNow === lockedPrice;
  const canStartPayment = Boolean(matchingHold && selectedProvider && !isHoldExpired && !cancelResult
    && (state === 'NOT_STARTED' || state === 'FAILED'));
  const paymentLocked = Boolean(paymentBusy || issued || state === 'PENDING' || state === 'REVIEW_REQUIRED' || cancelResult);
  const canVenueOperate = activeRole === 'STAFF' || activeRole === 'MANAGER' || activeRole === 'ADMIN';

  const previewRefundPct = venueCancelMode
    ? 100
    : simHoursBefore >= 11
      ? 100
      : simHoursBefore >= 4
        ? 50
        : 0;
  const previewRefundVnd = Math.floor((depositAmount * previewRefundPct) / 100);
  const previewForfeitVnd = depositAmount - previewRefundVnd;

  const currentStage = issued ? 4 : trackedReservation ? 3 : 2;

  const validateAndSubmitPayment = async () => {
    setPaymentError(null);
    if (!canStartPayment || !matchingHold || !selectedProvider) return;
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
    const customer = {
      amount: payableNow,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerEmail.trim(),
      needVatInvoice,
      vatCompanyName: vatCompanyName.trim() || undefined,
      vatTaxCode: vatTaxCode.trim() || undefined,
      bookingNote: bookingNote.trim() || undefined,
    };
    setPaymentBusy(true);
    try {
      await marketplaceApi.createInlineQrPayment(selectedProvider.code, matchingHold, customer);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Chưa tạo được giao dịch thanh toán.');
    } finally {
      setPaymentBusy(false);
      setStatusRequest(value => value + 1);
    }
  };

  const steps = [
    { step: 1, title: 'Khóa giá 10 phút', sub: 'Đã cố định giá thuê ca' },
    { step: 2, title: 'Giữ sân vật lý', sub: 'Khóa sân chống đặt trùng' },
    { step: 3, title: 'Quét mã thanh toán', sub: 'QR ngay trên checkout' },
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

          {matchingHold && (
            <button
              type="button"
              onClick={() => {
                if (trackingKey) window.sessionStorage.removeItem(trackingKey);
                setRememberedReservation(null);
                setPaymentStatus(null);
                onResetFlow();
              }}
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
            {activeListing && activeQuote && !matchingHold && !trackedReservation && !issued && (
              <BookingCourtPicker key={`${activeListing.groupId}:${activeQuote.slotStart}`} listing={activeListing}
                slotStart={activeQuote.slotStart} controls={courtPicker} disabled={busyStep === 'HOLD'} />
            )}
            {/* BLOCK 1: Choose Deposit Escrow vs Full Payment */}
            <ScrollReveal className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                  1. Chọn mức thanh toán hôm nay
                </h3>
                {paymentLocked && <span className="text-xs text-neutral-600">Đã chốt mức thanh toán</span>}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={paymentLocked}
                  onClick={() => setPlanMode('DEPOSIT_ESCROW')}
                  className={`rounded-2xl p-4 text-left border transition-colors ${
                    !displaysFullPayment
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
                    displaysFullPayment
                      ? 'border-[#16422C] bg-[#F4F8F4] ring-1 ring-[#16422C]'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  } disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0E4F7E]">
                      Trả đủ tiền sân (100%)
                    </span>
                    <span className="rounded-full bg-[#E6F1F8] px-2 py-0.5 text-[10px] font-semibold text-[#0E4F7E]">
                      Vào sân thẳng
                    </span>
                  </div>
                  <div className="mt-2 tabular-nums text-xl font-bold text-[#0F172A]">
                    {formatVnd(lockedPrice)}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {addOnsTotal > 0
                      ? `Dịch vụ đi kèm dự tính ${formatVnd(addOnsTotal)}, thanh toán tại quầy.`
                      : `Không cần thanh toán thêm tại sân; phần hủy cọc (nếu có) chỉ khấu trừ trên phần ${depositPct}% cọc.`}
                  </p>
                </button>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.05} className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs">
              <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">2. Phương thức thanh toán</h3>
              {returnError && <p role="alert" className="mt-3 text-sm text-rose-700">{returnError}</p>}
              {providersError ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-rose-700">Chưa tải được phương thức thanh toán.</p>
                  <ActionButton variant="outline" size="sm" onClick={() => setProviderRequest(value => value + 1)}>
                    Tải lại phương thức
                  </ActionButton>
                </div>
              ) : enabledQrProviders.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {enabledQrProviders.map(({ code, title, detail }) => (
                    <button type="button" key={code} disabled={paymentLocked} aria-pressed={shownProvider === code}
                      onClick={() => { setPreferredProvider(code); setPaymentError(null); }}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition cursor-pointer ${shownProvider === code
                        ? 'border-[#16422C] bg-[#F4F8F4] text-[#16422C] ring-1 ring-[#16422C]/25' : 'border-neutral-200 text-neutral-800 hover:border-neutral-300'}`}>
                      <PaymentMethodLogo code={code} size={36} />
                      <span><span className="block text-sm font-semibold">{title}</span>
                        <span className="mt-1 block text-xs opacity-80">{detail}</span></span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-neutral-700">
                  {providers === null ? 'Đang kiểm tra phương thức thanh toán…' : 'Chưa có cổng thanh toán QR được cấu hình.'}
                </p>
              )}
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

                {matchingHold && !cancelResult && state !== 'PENDING' && (
                  <button
                    type="button"
                    onClick={() =>
                      void onCancelBooking(canVenueOperate && venueCancelMode)
                        .catch(error => setPaymentError(error instanceof Error ? error.message : 'Chưa hủy được đơn.'))
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
                    {activeTicket?.unitNumber ?? matchingHold?.unitNumber ?? courtPicker.selection?.label ?? 'Tự động cấp khi giữ chỗ'}
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
                    <div className="text-[10.5px] text-neutral-500">
                      Mức hoàn cọc áp dụng theo chính sách của ca đã đặt.
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
                    {addOnsTotal > 0 ? 'Dự tính sân và dịch vụ tại quầy' : 'Tổng giá ca thuê đã khóa'}
                  </span>
                  <span className="tabular-nums">{formatVnd(grandTotal)}</span>
                </div>
              </div>

              {!orderCancelled && <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#16422C] block">
                      {state === 'NO_DEPOSIT' ? 'Đã thu online'
                        : displaysFullPayment ? 'Thanh toán ngay (100% tiền sân)' : `Thanh toán ngay (Cọc ${depositPct}%)`}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {issued && state === 'NO_DEPOSIT' ? 'Thanh toán tại sân' : shownProvider === 'VNPAY_ESCROW' ? 'Qua VNPay'
                        : qrProviders.find(({ code }) => code === shownProvider)?.title}
                    </span>
                  </div>
                  <span className="tabular-nums text-2xl font-bold text-[#16422C]">
                    {formatVnd(payableNow)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Tiền sân còn lại tại quầy</span>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {formatVnd(remainingAtVenue)}
                  </span>
                </div>
              </div>}

              {paymentError && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {paymentError}
                </div>
              )}

              <div className="mt-6 space-y-2.5">
                {isHoldExpired && !issued && state !== 'PENDING' && state !== 'REVIEW_REQUIRED' && !cancelResult && (
                  <ActionButton variant="ink" size="lg" fullWidth onClick={onResetFlow}>
                    Hết hạn giữ giá 10 phút • Khóa giá lại ngay
                  </ActionButton>
                )}

                {!isHoldExpired && !matchingHold && !issued && state !== 'PENDING' && state !== 'REVIEW_REQUIRED' && (
                  <ActionButton
                    variant="ink"
                    size="lg"
                    fullWidth
                    disabled={busyStep === 'HOLD' || !activeListing || !activeQuote}
                    onClick={() => {
                      setPaymentError(null);
                      void onHoldSlot().catch(error => setPaymentError(error instanceof Error ? error.message : 'Chưa giữ được sân.'));
                    }}
                  >
                    {busyStep === 'HOLD'
                      ? 'Đang khóa sân vật lý…'
                      : 'Bước 01 → Giữ sân & Khởi tạo thanh toán'}
                  </ActionButton>
                )}

                {canStartPayment && (
                  <ActionButton variant="forest" size="lg" fullWidth disabled={paymentBusy} onClick={validateAndSubmitPayment}>
                    {paymentBusy ? 'Đang lấy mã QR…' : `Tạo mã QR · ${formatVnd(payableNow)}`}
                  </ActionButton>
                )}
                {trackedReservation && !cancelResult && (
                  <ActionButton variant="outline" size="sm" onClick={() => setStatusRequest(value => value + 1)}>
                    Kiểm tra trạng thái thanh toán
                  </ActionButton>
                )}
              </div>

              {activePaymentQr && currentPayment?.requestedAmount != null && currentPayment.providerReference && !cancelResult && (
                <div className="space-y-2.5">
                  <CheckoutPaymentQr
                    qr={activePaymentQr}
                    provider={currentPayment.provider}
                    amount={currentPayment.requestedAmount}
                    reference={currentPayment.providerReference}
                  />
                </div>
              )}

              {trackedReservation && !cancelResult && (
                <div className="mt-4 rounded-2xl border border-neutral-200 p-4 text-sm" role="status">
                  <p className="font-semibold">{state ? stateMessages[state] : 'Đang kiểm tra trạng thái thanh toán…'}</p>
                  {state === 'VERIFIED' && currentPayment && (
                    <>
                      <p>Đã thu {formatVnd(currentPayment.paidAmount)} · Còn trả tiền sân {formatVnd(currentPayment.remainingAtVenue)}</p>
                      <p className="mt-1 text-xs text-neutral-600">Mã giao dịch {currentPayment.providerReference}</p>
                    </>
                  )}
                  {state === 'PENDING' && !activePaymentQr && !paymentBusy && (
                    <p className="mt-1 text-xs text-neutral-600">
                      {currentPayment?.provider === 'VNPAY_ESCROW'
                        ? 'Giao dịch VNPay đã tạo đang được theo dõi.'
                        : 'Chưa có mã QR cho giao dịch này. Bạn có thể kiểm tra lại trạng thái.'}
                    </p>
                  )}
                  {state === 'REVIEW_REQUIRED' && <p>Mã giao dịch {currentPayment?.providerReference}</p>}
                  {statusError && <p className="mt-2 text-xs text-rose-700">{statusError}</p>}
                </div>
              )}

              {cancelResult && (
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950">
                  <strong>Đơn đã hủy</strong> Khoản hoàn theo chính sách{' '}
                  <strong className="tabular-nums">{formatVnd(cancelResult.refundAmount)}</strong> (
                  {cancelResult.appliedRefundPercent}%) • Khấu trừ:{' '}
                  <strong className="tabular-nums">{formatVnd(cancelResult.forfeitedAmount)}</strong>.
                  {cancelResult.refundAmount > 0 && (
                    <p className="mt-2" role="status">{state === 'REFUNDED'
                      ? stateMessages.REFUNDED : stateMessages.REFUND_PENDING}</p>
                  )}
                </div>
              )}
            </div>

            <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-xs space-y-3" aria-labelledby="my-tickets-title">
              <div className="flex items-center justify-between gap-2">
                <h4 id="my-tickets-title" className="text-base font-semibold text-[#0F172A]">Vé vừa phát hành</h4>
                {issued && (
                  <button
                    type="button"
                    onClick={() => {
                      if (trackingKey) window.sessionStorage.removeItem(trackingKey);
                      setRememberedReservation(null);
                      setPaymentStatus(null);
                      onResetFlow();
                    }}
                    className="rounded-full bg-[#E7F7D4] px-3 py-1 text-[11px] font-bold text-[#16422C] hover:bg-[#16422C] hover:text-white transition cursor-pointer"
                  >
                    + Đặt ca mới
                  </button>
                )}
              </div>
              {ticketError && !cancelResult ? (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-rose-700">{ticketError}</p>
                  <ActionButton variant="outline" size="sm" onClick={() => setStatusRequest(value => value + 1)}>
                    Tải lại vé
                  </ActionButton>
                </div>
              ) : activeTicket && !cancelResult && (activeTicket.qrToken || activeTicket.checkinPinCode) ? (
                <article className="space-y-3 rounded-xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#16422C]">Vé nhận sân {activeTicket.unitNumber}</p>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#16422C] border border-[#16422C]/20">
                      Đã lưu Lịch sử Tài khoản
                    </span>
                  </div>
                  {activeTicket.qrToken && <QRCodeSVG value={activeTicket.qrToken} size={196} marginSize={2} title="Vé QR nhận sân" />}
                  {!activeTicket.qrToken && activeTicket.checkinPinCode && (
                    <p>PIN nhận sân <strong className="ml-1 font-mono text-lg tracking-widest">{activeTicket.checkinPinCode}</strong></p>
                  )}
                  {activeTicket.contactEmail && (
                    <ActionButton variant="outline" size="sm" disabled={sendingEmail}
                      onClick={() => void handleSendQrEmailNow(activeTicket.reservationId, activeTicket.contactEmail ?? '')}>
                      Gửi lại vé qua email
                    </ActionButton>
                  )}
                  {resendEmailStatus && <p role="status" className="text-xs text-neutral-700">{resendEmailStatus}</p>}
                </article>
              ) : (
                <p className="text-xs leading-relaxed text-neutral-600">
                  Sau khi xác nhận thanh toán, mã QR vào sân sẽ xuất hiện tại đây và tự động lưu vào mục <strong>Lịch sử Thanh toán &amp; Vé QR</strong> trong Card Tài khoản ở góc trên phải.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};
