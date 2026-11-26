import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  KeyRound,
  Minus,
  Package,
  Phone,
  Plus,
  QrCode,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type {
  CheckinVerificationMode,
  CourtServiceCategory,
  CourtServiceOption,
  LessorBookingOrder,
  PublishedListing,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { getActiveLessorServices, resolveCourtThumbnail } from '../data/courtServicesData';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

interface BookingOrderDetailModalProps {
  order: LessorBookingOrder | null;
  courtListing: PublishedListing | null;
  isStaffOnly: boolean;
  onClose: () => void;
  onStartCheckIn: (order: LessorBookingOrder, mode: CheckinVerificationMode) => void;
  onMarkNoShow: (orderId: string) => void;
  onUpdateOrderAddOns: (
    orderId: string,
    nextSummary: string | undefined,
    nextAddOnTotal: number,
    nextQuantities: Record<string, number>
  ) => void;
  onOpenManageCourtServices?: (groupId: string) => void;
}

const CATEGORY_LABELS: Record<CourtServiceCategory, string> = {
  DRINKS: 'Nước & Điện giải',
  EQUIPMENT: 'Dụng cụ thi đấu',
  SUPPORT: 'Hỗ trợ trận đấu',
  FACILITY: 'Tiện ích & Hậu cần',
};

function maskPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length < 7) return 'Đã bảo mật';
  return `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`;
}

export const BookingOrderDetailModal: React.FC<BookingOrderDetailModalProps> = ({
  order,
  courtListing,
  isStaffOnly,
  onClose,
  onStartCheckIn,
  onMarkNoShow,
  onUpdateOrderAddOns,
  onOpenManageCourtServices,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const courtServices = useMemo<CourtServiceOption[]>(
    () => getActiveLessorServices(courtListing),
    [courtListing]
  );

  useEffect(() => {
    if (!order) return;
    setSavedNotice(null);
    if (order.addOnQuantities) {
      setQuantities(order.addOnQuantities);
      return;
    }
    const inferred: Record<string, number> = {};
    if (order.addOnSummary && courtServices.length > 0) {
      const parts = order.addOnSummary.split(',').map((s) => s.trim());
      for (const part of parts) {
        const match = part.match(/^(\d+)\s*x\s+(.+)$/i);
        const qty = match ? Number(match[1]) : 1;
        const namePart = (match ? match[2] : part).trim().toLowerCase();
        const found = courtServices.find(
          (svc) =>
            svc.name.toLowerCase().includes(namePart) ||
            namePart.includes(svc.name.toLowerCase())
        );
        if (found && qty > 0) {
          inferred[found.id] = qty;
        }
      }
    }
    setQuantities(inferred);
  }, [order, courtServices]);

  useEffect(() => {
    if (!order) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [order, onClose]);

  if (!order) {
    return null;
  }

  const effectiveMode: CheckinVerificationMode =
    courtListing?.checkinMode ?? order.checkinMode ?? 'QR_STAFF';
  const usesPinCounter = effectiveMode === 'PIN_COUNTER' || effectiveMode === 'MANUAL';

  const selectedList = courtServices
    .map((svc) => ({ svc, qty: quantities[svc.id] ?? 0 }))
    .filter((entry) => entry.qty > 0);

  const computedCatalogTotal = selectedList.reduce(
    (sum, item) => sum + item.svc.unitPrice * item.qty,
    0
  );
  const hasCatalogSelection = selectedList.length > 0 || Boolean(order.addOnQuantities);
  const effectiveAddOnTotal = hasCatalogSelection ? computedCatalogTotal : order.addOnTotal;
  const effectiveSummary = hasCatalogSelection
    ? selectedList.map((item) => `${item.qty}x ${item.svc.name}`).join(', ') || undefined
    : order.addOnSummary;

  const grandTotal = order.courtPrice + effectiveAddOnTotal;
  const remainingAtVenue = Math.max(0, grandTotal - order.paidEscrow);
  const hasUnsavedChanges =
    effectiveAddOnTotal !== order.addOnTotal ||
    (effectiveSummary ?? '') !== (order.addOnSummary ?? '');

  const handleSaveServices = () => {
    onUpdateOrderAddOns(order.orderId, effectiveSummary, effectiveAddOnTotal, quantities);
    setSavedNotice('Đã cập nhật dịch vụ đi kèm cho đơn đặt sân.');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: EXPO_EASE }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.34)]"
        >
          {/* STICKY MODAL HEADER */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-white px-6 py-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="h-14 w-16 sm:h-16 sm:w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                <img
                  src={resolveCourtThumbnail(courtListing?.imageUrl, order.sportName)}
                  alt={order.groupName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums rounded-lg bg-[#0F172A] px-2.5 py-0.5 text-xs font-bold text-white">
                    {order.orderId}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      order.status === 'CONFIRMED'
                        ? 'bg-amber-100 text-amber-900'
                        : order.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {order.status === 'CONFIRMED'
                      ? usesPinCounter
                        ? 'Chờ đối chiếu PIN'
                        : 'Chờ quét QR'
                      : order.status === 'COMPLETED'
                        ? 'Đã nhận sân'
                        : 'Khách bỏ lịch'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      usesPinCounter
                        ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                        : 'bg-[#F4F8F4] text-[#16422C]'
                    }`}
                  >
                    {usesPinCounter ? (
                      <>
                        <KeyRound className="h-3 w-3" /> PIN 6 số
                      </>
                    ) : (
                      <>
                        <QrCode className="h-3 w-3" /> Quét QR tại quầy
                      </>
                    )}
                  </span>
                </div>
                <h3 id="order-detail-modal-title" className="truncate text-lg font-bold text-[#0F172A]">
                  Chi tiết Đơn Đặt Sân — {order.groupName}
                </h3>
                <p className="text-xs text-neutral-500">
                  {order.unitNumber} • {order.sportName} · {order.slotLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng chi tiết đơn đặt sân"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
            {savedNotice && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#16422C]/25 bg-[#E7F7D4]/70 px-4 py-2.5 font-semibold text-[#16422C]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{savedNotice}</span>
              </div>
            )}

            {/* TOP INFO CARDS: CUSTOMER + PAYMENT */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <User className="h-3.5 w-3.5 text-[#16422C]" />
                  Thông tin Khách đặt &amp; Vé sân
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Họ tên khách:</span>
                    <strong className="text-[#0F172A]">{order.customerName}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Số điện thoại:</span>
                    <strong className="inline-flex items-center gap-1 text-[#0F172A] tabular-nums">
                      <Phone className="h-3 w-3 text-neutral-400" />
                      {maskPhoneDisplay(order.customerPhone)}
                    </strong>
                  </div>
                  {order.customerEmail && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">Email nhận vé:</span>
                      <strong className="text-[#0F172A] truncate max-w-[220px]">
                        {order.customerEmail}
                      </strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Xác thực vào sân:</span>
                    <strong className="text-[#16422C]">
                      {usesPinCounter
                        ? 'Đối chiếu Mã PIN 6 số (Email)'
                        : `Mã vé ${order.qrCode}`}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Trạng thái ghi nhận:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                      <Clock className="h-3 w-3 text-neutral-400" />
                      {order.createdAtLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4]/70 p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                  <CreditCard className="h-3.5 w-3.5" />
                  Chi tiết Thanh toán ({order.paymentGateway})
                </div>
                <div className="space-y-1.5 tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Tiền thuê sân ({order.unitNumber}):</span>
                    <span className="font-semibold text-[#0F172A]">{formatVnd(order.courtPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Dịch vụ đi kèm tại sân:</span>
                    <span className="font-semibold text-[#16422C]">
                      +{formatVnd(effectiveAddOnTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-neutral-200/80 pt-1.5">
                    <span className="font-semibold text-[#0F172A]">Tổng giá trị đơn:</span>
                    <span className="font-bold text-[#0F172A]">{formatVnd(grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Đã thanh toán ký quỹ online:</span>
                    <span className="font-bold text-[#16422C]">−{formatVnd(order.paidEscrow)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-neutral-200/80 mt-1">
                    <span className="font-bold text-[#0F172A]">Cần thu thêm tại sân:</span>
                    <span className="text-sm font-bold text-[#B45309]">
                      {formatVnd(remainingAtVenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FULL SERVICES MENU FOR THIS COURT */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#0F172A]">
                    <Package className="h-4 w-4 text-[#16422C]" />
                    Dịch vụ đi kèm của sân này ({courtServices.length} dịch vụ)
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Kiểm tra đồ uống, dụng cụ khách đã đặt hoặc thêm nhanh dịch vụ phát sinh trực tiếp tại sân.
                  </p>
                </div>

                {!isStaffOnly && onOpenManageCourtServices && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenManageCourtServices(order.groupId);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[#16422C]/25 bg-[#F4F8F4] px-3 py-1.5 text-[11px] font-semibold text-[#16422C] hover:bg-[#E7F7D4]"
                  >
                    <Sparkles className="h-3 w-3" />
                    Quản lý menu sân này →
                  </button>
                )}
              </div>

              {/* Selected summary banner */}
              <div className="rounded-xl border border-neutral-200/80 bg-[#F8FAFC] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] text-neutral-600">
                  <strong className="text-[#0F172A]">Đang kèm trong đơn:</strong>{' '}
                  {effectiveSummary ? (
                    <span className="font-semibold text-[#16422C]">{effectiveSummary}</span>
                  ) : (
                    <span className="text-neutral-500">Chưa chọn dịch vụ đi kèm</span>
                  )}
                </span>
                <span className="tabular-nums font-bold text-[#16422C]">
                  {formatVnd(effectiveAddOnTotal)}
                </span>
              </div>

              {courtServices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-[#F8FAFC] p-6 text-center space-y-2">
                  <p className="font-semibold text-[#0F172A]">
                    Cụm sân này chưa bật dịch vụ nước uống hoặc thuê dụng cụ đi kèm.
                  </p>
                  {!isStaffOnly && onOpenManageCourtServices && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenManageCourtServices(order.groupId);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#16422C] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#0F172A]"
                    >
                      + Thêm dịch vụ cho cụm sân này
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {courtServices.map((svc) => {
                    const qty = quantities[svc.id] ?? 0;
                    const maxAllowed = svc.maxQty ?? 10;
                    return (
                      <div
                        key={svc.id}
                        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                          qty > 0
                            ? 'border-[#16422C]/45 bg-[#F4F8F4]/75 shadow-2xs'
                            : 'border-neutral-200/85 bg-white hover:border-neutral-300'
                        }`}
                      >
                        <img
                          src={svc.imageUrl}
                          alt={svc.name}
                          className="h-14 w-14 shrink-0 rounded-xl object-cover border border-neutral-200 bg-neutral-100"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-semibold text-neutral-600">
                              {CATEGORY_LABELS[svc.category]}
                            </span>
                            {svc.popular && (
                              <span className="rounded-full bg-[#E7F7D4] px-2 py-0.5 text-[9.5px] font-bold text-[#16422C]">
                                Phổ biến
                              </span>
                            )}
                          </div>
                          <div className="truncate font-bold text-[#0F172A]">{svc.name}</div>
                          <div className="text-[11px] text-neutral-500 line-clamp-1">
                            {svc.description}
                          </div>
                          <div className="tabular-nums font-bold text-[#16422C]">
                            {formatVnd(svc.unitPrice)}{' '}
                            <span className="font-normal text-neutral-500">/ {svc.unitLabel}</span>
                          </div>
                        </div>

                        {/* Quick +/- Quantity Stepper */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={qty <= 0 || order.status === 'NO_SHOW' || order.status === 'CANCELLED'}
                            onClick={() =>
                              setQuantities((prev) => ({
                                ...prev,
                                [svc.id]: Math.max(0, (prev[svc.id] ?? 0) - 1),
                              }))
                            }
                            aria-label={`Giảm ${svc.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-[#0F172A] hover:bg-neutral-100 disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[22px] text-center tabular-nums font-bold text-[#0F172A]">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={
                              qty >= maxAllowed ||
                              order.status === 'NO_SHOW' ||
                              order.status === 'CANCELLED'
                            }
                            onClick={() =>
                              setQuantities((prev) => ({
                                ...prev,
                                [svc.id]: Math.min(maxAllowed, (prev[svc.id] ?? 0) + 1),
                              }))
                            }
                            aria-label={`Thêm ${svc.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-[#0F172A] hover:bg-neutral-100 disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-[#F8FAFC] px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {order.status === 'CONFIRMED' && (
                <>
                  <ActionButton
                    variant="forest"
                    size="sm"
                    onClick={() => {
                      if (hasUnsavedChanges) handleSaveServices();
                      onClose();
                      onStartCheckIn(order, effectiveMode);
                    }}
                  >
                    {usesPinCounter ? (
                      <>
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                        Nhập PIN 6 số mở sân
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-1.5 h-3.5 w-3.5" />
                        Quét QR nhận sân
                      </>
                    )}
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkNoShow(order.orderId);
                      onClose();
                    }}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Đánh dấu bỏ lịch
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <ActionButton variant="forest" size="sm" onClick={handleSaveServices}>
                  ✓ Lưu dịch vụ bổ sung
                </ActionButton>
              )}
              <ActionButton variant="outline" size="sm" onClick={onClose}>
                Đóng
              </ActionButton>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
