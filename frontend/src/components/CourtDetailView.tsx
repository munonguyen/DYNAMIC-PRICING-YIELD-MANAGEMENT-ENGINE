import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  CourtMediaItem,
  CourtServiceCategory,
  PriceQuote,
  PublishedListing,
  RoleCode,
  SlotListingQuote,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd } from '../api/marketplaceApi';
import {
  COURT_SERVICE_CATEGORY_LABELS,
  getActiveLessorServices,
} from '../data/courtServicesData';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton } from './FairwayControls';

interface CourtDetailViewProps {
  listing: PublishedListing;
  activeRole?: RoleCode;
  isAuthenticated?: boolean;
  activeSlotStart: string | null;
  activeQuote: PriceQuote | null;
  quoteLoading: boolean;
  countdownLabel: string;
  onBack: () => void;
  onSelectSlot: (listing: PublishedListing, slotStart: string) => void;
  onProceedToHold: () => void;
  onOpenVenueChat: (listing: PublishedListing) => void;
  onFilterByProvider: (venueName: string) => void;
  onOpenLessorShop?: (providerId: string) => void;
  selectedServiceQuantities?: Record<string, number>;
  onChangeServiceQuantity?: (serviceId: string, nextQty: number) => void;
  onClearServices?: () => void;
  onOpenManageServicesInternal?: () => void;
  onUploadCourtPhoto?: (
    groupId: string,
    file: File,
    caption: string,
    isCover: boolean
  ) => Promise<{ persistedToBackend: boolean }>;
  onSetCoverCourtPhoto?: (groupId: string, mediaId: string) => Promise<void>;
  onDeleteCourtPhoto?: (groupId: string, mediaId: string) => Promise<void>;
}

const PERIOD_LABELS: Record<'MORNING' | 'AFTERNOON' | 'EVENING', string> = {
  MORNING: 'Ca sáng',
  AFTERNOON: 'Ca chiều',
  EVENING: 'Ca tối cao điểm',
};

export const CourtDetailView: React.FC<CourtDetailViewProps> = ({
  listing,
  activeRole = 'USER',
  isAuthenticated = false,
  activeSlotStart,
  activeQuote,
  quoteLoading,
  countdownLabel,
  onBack,
  onSelectSlot,
  onProceedToHold,
  onOpenVenueChat,
  onFilterByProvider,
  onOpenLessorShop,
  selectedServiceQuantities = {},
  onChangeServiceQuantity,
  onClearServices,
  onOpenManageServicesInternal,
  onUploadCourtPhoto,
  onSetCoverCourtPhoto,
  onDeleteCourtPhoto,
}) => {
  const mediaList: CourtMediaItem[] =
    listing.galleryMedia && listing.galleryMedia.length > 0
      ? listing.galleryMedia
      : (listing.galleryImages && listing.galleryImages.length > 0
          ? listing.galleryImages
          : [listing.imageUrl || '/images/real-pickleball-outdoor.jpg']
        ).map((url, idx) => ({
          mediaId: `static-${listing.groupId}-${idx}`,
          groupId: listing.groupId,
          url,
          caption:
            listing.galleryCaptions?.[idx] ||
            'Ảnh chủ sân chụp trực tiếp • Góc nhìn thực tế tại cơ sở',
          sourceType: 'STATIC_ASSET',
          isCover: idx === 0,
        }));

  const gallery = mediaList.map((m) => m.url);

  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [markAsCover, setMarkAsCover] = useState<boolean>(true);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [serviceCatFilter, setServiceCatFilter] = useState<CourtServiceCategory | 'ALL'>('ALL');
  const [localServiceQty, setLocalServiceQty] = useState<Record<string, number>>({});
  const servicesTrackRef = useRef<HTMLDivElement | null>(null);

  const scrollServicesBy = (deltaX: number) => {
    servicesTrackRef.current?.scrollBy({ left: deltaX, behavior: 'smooth' });
  };

  const effectiveServiceQty = onChangeServiceQuantity
    ? selectedServiceQuantities
    : localServiceQty;

  const updateServiceQty = (serviceId: string, nextQty: number) => {
    const safeQty = Math.max(0, nextQty);
    if (onChangeServiceQuantity) {
      onChangeServiceQuantity(serviceId, safeQty);
    } else {
      setLocalServiceQty((prev) => {
        const next = { ...prev };
        if (safeQty === 0) delete next[serviceId];
        else next[serviceId] = safeQty;
        return next;
      });
    }
  };

  const clearAllSelectedServices = () => {
    if (onClearServices) {
      onClearServices();
    } else {
      setLocalServiceQty({});
    }
  };

  const canManagePhotos =
    Boolean(onUploadCourtPhoto) &&
    (activeRole === 'MANAGER' || activeRole === 'STAFF' || activeRole === 'ADMIN');

  useLayoutEffect(() => {
    const snapTop = () => {
      const html = document.documentElement;
      const prevBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      html.scrollTop = 0;
      document.body.scrollTop = 0;
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        html.scrollTop = 0;
        html.style.scrollBehavior = prevBehavior;
      });
    };
    snapTop();
    const t = window.setTimeout(snapTop, 80);
    return () => window.clearTimeout(t);
  }, [listing.groupId]);

  useEffect(() => {
    setActiveImageIdx(0);
    setUploadNotice(null);
  }, [listing.groupId]);

  useEffect(() => {
    if (activeImageIdx >= mediaList.length) {
      setActiveImageIdx(0);
    }
  }, [activeImageIdx, mediaList.length]);

  const activeMedia = mediaList[activeImageIdx] ?? mediaList[0];

  const handlePhotoUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !onUploadCourtPhoto) return;
    setUploadingPhoto(true);
    setUploadNotice(null);
    try {
      const result = await onUploadCourtPhoto(
        listing.groupId,
        selectedFile,
        photoCaption || 'Ảnh chủ sân vừa chụp cập nhật • Thực tế mặt sân hôm nay',
        markAsCover
      );
      setSelectedFile(null);
      setPhotoCaption('');
      setActiveImageIdx(0);
      setUploadNotice(
        result.persistedToBackend
          ? 'Đã tải lên và lưu trữ ảnh cụm sân thành công.'
          : 'Đã lưu ảnh thực tế vào bộ nhớ phiên để xem trước.'
      );
    } catch {
      setUploadNotice('Không thể đọc hoặc lưu tệp ảnh. Vui lòng chọn ảnh JPEG, PNG hoặc WebP dưới 10MB.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const provider = listing.provider;
  const commissionPct = provider?.commissionRatePct ?? 10;

  const selectedSlotObj: SlotListingQuote | undefined =
    listing.upcomingSlots.find((s) => s.slotStart === activeSlotStart) ??
    listing.upcomingSlots.find((s) => s.availableCourts > 0) ??
    listing.upcomingSlots[0];

  const hasAnyAvailable = listing.upcomingSlots.some((s) => s.availableCourts > 0);
  const effectivePrice =
    activeQuote && activeListingMatches(activeQuote, listing)
      ? activeQuote.currentPrice
      : selectedSlotObj?.currentDynamicPrice ?? listing.basePrice;
  const depositAmount = Math.floor((effectivePrice * listing.depositPercent) / 100);
  const platformFeeFromPartner = Math.floor((effectivePrice * commissionPct) / 100);

  const availableServices = getActiveLessorServices(listing);
  const filteredServices =
    serviceCatFilter === 'ALL'
      ? availableServices
      : availableServices.filter((s) => s.category === serviceCatFilter);
  const selectedServiceItems = availableServices
    .map((service) => ({ service, quantity: effectiveServiceQty[service.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0);
  const totalSelectedServiceCount = selectedServiceItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const addOnsTotal = selectedServiceItems.reduce(
    (sum, item) => sum + item.service.unitPrice * item.quantity,
    0
  );
  const grandTotal = effectivePrice + addOnsTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EXPO_EASE }}
      className="space-y-8"
    >
      {/* Top Breadcrumb & Escrow Accountability Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] px-4 py-3">
        <ActionButton variant="outline" size="sm" arrow="back" onClick={onBack}>
          Quay lại danh sách sân
        </ActionButton>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[#E7F7D4] px-3 py-1 font-semibold text-[#204E18]">
            Sàn trung gian bảo vệ cọc 100%
          </span>
          <span className="text-neutral-500">
            {listing.city} • {listing.district} • {listing.sportName}
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SHOPEE-GRADE 12-COL PRODUCT DETAIL STAGE                              */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-8 rounded-[30px] border border-neutral-200/90 bg-white p-5 sm:p-8 shadow-[0_20px_54px_rgba(15,23,42,0.06)] lg:grid-cols-12">
        {/* LEFT 6 COLS: INTERACTIVE GALLERY + SPECS HIGHLIGHTS */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative h-72 sm:h-96 w-full overflow-hidden rounded-[24px] bg-neutral-100">
            <img
              src={gallery[activeImageIdx] ?? gallery[0]}
              alt={`${listing.groupName} - Ảnh ${activeImageIdx + 1}`}
              className="h-full w-full object-cover transition-all duration-500"
            />

            <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-xs">
                {listing.sportName}
              </span>
              {listing.architecturalBadge && (
                <span className="rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
                  {listing.architecturalBadge}
                </span>
              )}
            </div>

            <span className="absolute bottom-3.5 right-3.5 rounded-full bg-black/65 px-3 py-1 tabular-nums text-xs font-medium text-white backdrop-blur-xs">
              Ảnh {activeImageIdx + 1}/{gallery.length}
            </span>
          </div>

          {/* Authentic Owner-Photo Caption Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#16422C]/15 bg-[#F4F8F4] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 rounded-full bg-[#16422C] px-2.5 py-0.5 text-[10px] font-semibold text-[#E7F7D4]">
                {activeMedia?.sourceType === 'LOCAL_DISK'
                  ? 'Ảnh chủ sân (BE)'
                  : activeMedia?.sourceType === 'CLIENT_PREVIEW'
                    ? 'Ảnh vừa tải lên'
                    : 'Ảnh thực tế tại sân'}
              </span>
              <span className="truncate font-medium text-[#0F172A]">
                {activeMedia?.caption || 'Ảnh chủ sân chụp trực tiếp tại cơ sở'}
              </span>
            </div>
            {canManagePhotos &&
              activeMedia &&
              !activeMedia.isCover &&
              onSetCoverCourtPhoto && (
                <button
                  type="button"
                  onClick={() => onSetCoverCourtPhoto(listing.groupId, activeMedia.mediaId)}
                  className="shrink-0 rounded-full bg-white border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-[#16422C] hover:border-[#16422C]"
                >
                  Đặt làm ảnh bìa
                </button>
              )}
          </div>

          {/* Clickable Thumbnail Strip */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {mediaList.map((media, idx) => {
              const active = idx === activeImageIdx;
              const isRemovable =
                canManagePhotos &&
                onDeleteCourtPhoto &&
                !media.mediaId.startsWith('static-');
              return (
                <div key={media.mediaId} className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-full h-20 sm:h-22 overflow-hidden rounded-2xl border-2 transition-all block ${
                      active
                        ? 'border-[#16422C] ring-2 ring-[#16422C]/25'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={media.url}
                      alt={`${listing.groupName} góc nhìn ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>
                  {media.isCover && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-[#16422C]/90 px-2 py-0.5 text-[9px] font-semibold text-[#E7F7D4]">
                      Bìa
                    </span>
                  )}
                  {isRemovable && (
                    <button
                      type="button"
                      title="Xóa ảnh đã tải lên"
                      onClick={() => onDeleteCourtPhoto(listing.groupId, media.mediaId)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lessor / Admin Photo Upload Panel (Stored on Backend Disk + PostgreSQL) */}
          {canManagePhotos ? (
            <form
              onSubmit={handlePhotoUploadSubmit}
              className="rounded-2xl border border-[#16422C]/25 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#16422C]">
                  Tải thêm ảnh thực tế do Chủ sân chụp
                </span>
                <span className="rounded-full bg-[#F4F8F4] px-2.5 py-0.5 text-[10px] font-semibold text-[#204E18]">
                  POST /api/v1/listings/…/media
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-[#F8F9FA] px-3 py-2 text-xs font-medium text-[#0F172A] hover:border-[#16422C]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : 'Chọn ảnh sân (JPG/PNG/WebP)…'}
                  </span>
                </label>

                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Chú thích góc chụp (VD: Mặt sân buổi chiều)…"
                  className="rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3 py-2 text-xs text-[#0F172A]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markAsCover}
                    onChange={(e) => setMarkAsCover(e.target.checked)}
                    className="rounded border-neutral-300 accent-[#16422C]"
                  />
                  Đặt làm ảnh đại diện đầu trang
                </label>

                <ActionButton
                  type="submit"
                  variant="forest"
                  size="sm"
                  disabled={!selectedFile || uploadingPhoto}
                >
                  {uploadingPhoto ? 'Đang lưu ảnh…' : 'Lưu ảnh lên hệ thống'}
                </ActionButton>
              </div>

              {uploadNotice && (
                <div className="rounded-xl bg-[#E7F7D4] px-3 py-2 text-[11px] font-medium text-[#204E18]">
                  {uploadNotice}
                </div>
              )}
            </form>
          ) : (
            <div className="rounded-2xl border border-neutral-200/70 bg-[#F8F9FA] px-3.5 py-2.5 text-[11px] text-neutral-500">
              Ảnh được đối tác chủ sân chụp thực tế để người thuê kiểm tra mặt sân trước khi đặt cọc. Đăng nhập tài khoản <strong>Chủ sân / Admin</strong> để đăng tải hoặc thay ảnh mới.
            </div>
          )}

          {/* Quick Transaction Progress Bar */}
          <div className="rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Tiến trình giao dịch qua sàn ArenaPulse
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2 text-center text-[11px]">
              {[
                { step: '01', label: 'Chọn ca trống', active: true },
                { step: '02', label: 'Khóa giá 10p', active: true },
                { step: '03', label: 'Đặt cọc ký quỹ', active: false },
                { step: '04', label: 'Vé QR vào sân', active: false },
              ].map((st) => (
                <div
                  key={st.step}
                  className={`rounded-xl px-2 py-2 border ${
                    st.active
                      ? 'border-[#16422C]/30 bg-white text-[#16422C] font-semibold'
                      : 'border-neutral-200/70 bg-white/60 text-neutral-500'
                  }`}
                >
                  <div className="tabular-nums text-[10px] opacity-75">Bước {st.step}</div>
                  <div className="mt-0.5 truncate">{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT 6 COLS: PRODUCT TITLE, PRICING, SLOT CONFIGURATOR & COMMISSION */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
          <div>
            {/* Rating & Availability Badges */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {provider && (
                <span className="rounded-full bg-[#16422C] px-3 py-0.5 font-semibold text-[#E7F7D4]">
                  {provider.badge}
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 tabular-nums">
                ★ {(listing.rating ?? 4.9).toFixed(1)}
                <span className="text-neutral-400 font-normal">
                  ({listing.reviewCount ?? 120} đánh giá)
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  hasAnyAvailable
                    ? 'bg-[#E7F7D4] text-[#204E18]'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {hasAnyAvailable ? 'Đang còn sân trống' : 'Tạm kín lịch hôm nay'}
              </span>
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-[-0.025em] leading-snug text-[#0F172A]">
              {listing.groupName}
            </h2>

            <p className="mt-1.5 text-xs sm:text-sm text-neutral-500">
              Địa điểm: <strong className="text-[#0F172A]">{listing.venueAddress}</strong> •{' '}
              {listing.checkinMode === 'QR_STAFF'
                ? 'Nhân viên quét vé QR 1 lần'
                : 'Xác thực Mã PIN 6 số qua Email (Không cần quét QR)'}
            </p>

            {/* Shopee-style Price Box (Court + Add-on Services Live Total) */}
            <div className="mt-5 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-neutral-500">
                    {addOnsTotal > 0
                      ? `Tổng tạm tính (Sân ${listing.slotMinutes}p + ${totalSelectedServiceCount} dịch vụ)`
                      : `Giá thuê ca đang chọn (${listing.slotMinutes} phút)`}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2.5">
                    <span className="tabular-nums text-3xl font-bold text-[#16422C]">
                      {formatVnd(grandTotal)}
                    </span>
                    {addOnsTotal === 0 && effectivePrice !== listing.basePrice && (
                      <span className="tabular-nums text-xs text-neutral-400 line-through">
                        {formatVnd(listing.basePrice)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block rounded-full bg-white px-3 py-1 tabular-nums text-[11px] font-semibold text-[#204E18] border border-[#16422C]/20">
                    {quoteLoading ? 'Đang tính giá…' : `Khóa giá ${countdownLabel}`}
                  </span>
                  <div className="mt-1 tabular-nums text-xs text-neutral-600">
                    Đặt cọc sân {listing.depositPercent}%:{' '}
                    <strong className="text-[#0F172A]">{formatVnd(depositAmount)}</strong>
                  </div>
                </div>
              </div>

              {addOnsTotal > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#16422C]/15 pt-2.5 text-xs">
                  <span className="text-neutral-600">
                    Tiền sân: <strong className="tabular-nums text-[#0F172A]">{formatVnd(effectivePrice)}</strong>
                    {' '}• Dịch vụ đi kèm:{' '}
                    <strong className="tabular-nums text-[#16422C]">+{formatVnd(addOnsTotal)}</strong>
                  </span>
                  <span className="text-[11px] font-medium text-[#0E4F7E]">
                    Thanh toán trọn gói hoặc trả dịch vụ tại quầy
                  </span>
                </div>
              ) : availableServices.length > 0 ? (
                <div className="mt-2.5 text-[11px] text-neutral-500">
                  Cơ sở có phục vụ <strong>{availableServices.length} sản phẩm/dịch vụ</strong> đi kèm — chọn thêm ở mục{' '}
                  <a href="#court-addon-services" className="font-semibold text-[#16422C] hover:underline">
                    Dịch vụ của chủ sân ↓
                  </a>
                </div>
              ) : null}
            </div>

            {/* Interactive Slot Matrix Picker */}
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                <span>Chọn khung giờ thuê ({listing.slotMinutes} phút/ca):</span>
                <span className="text-[11px] font-normal text-neutral-500">
                  Biên giá: {formatVnd(listing.minPrice)} – {formatVnd(listing.maxPrice)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {listing.upcomingSlots.map((slot) => {
                  const soldOut = slot.availableCourts <= 0;
                  const selected =
                    !soldOut &&
                    activeListingMatches(activeQuote, listing) &&
                    activeSlotStart === slot.slotStart;
                  const periodLabel = slot.timePeriod ? PERIOD_LABELS[slot.timePeriod] : 'Khung giờ';
                  return (
                    <button
                      key={slot.slotStart}
                      type="button"
                      disabled={soldOut}
                      onClick={() => onSelectSlot(listing, slot.slotStart)}
                      className={`rounded-2xl border p-3.5 text-left transition-all ${
                        soldOut
                          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 opacity-75'
                          : selected
                            ? 'border-[#16422C] bg-[#16422C] text-white shadow-md'
                            : 'border-neutral-200 bg-white text-[#0F172A] hover:border-[#16422C]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular-nums text-xs font-semibold">
                          {formatSlotWindow(slot.slotStart, slot.slotEnd)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            soldOut
                              ? 'bg-rose-100 text-rose-700'
                              : selected
                                ? 'bg-[#E7F7D4] text-[#204E18]'
                                : slot.demandTag === 'PRIME_SURGE'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-[#F3F4F6] text-neutral-600'
                          }`}
                        >
                          {soldOut ? 'Hết sân' : periodLabel}
                        </span>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between">
                        <span
                          className={`text-[11px] ${
                            selected ? 'text-white/80' : 'text-neutral-500'
                          }`}
                        >
                          {soldOut
                            ? '0 sân trống'
                            : `Còn ${slot.availableCourts}/${slot.totalCapacity} sân`}
                        </span>
                        <span
                          className={`tabular-nums text-sm font-bold ${
                            soldOut
                              ? 'text-neutral-400'
                              : selected
                                ? 'text-[#E7F7D4]'
                                : 'text-[#0F172A]'
                          }`}
                        >
                          {formatVnd(slot.currentDynamicPrice)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3rd-Party Platform Commission & Accountability Card */}
            <div className="mt-5 rounded-2xl border border-[#0E4F7E]/25 bg-[#F4F8FB] p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#0E4F7E]">
                  Minh bạch Sàn trung gian &amp; Trách nhiệm bảo lãnh ArenaPulse
                </span>
                <span className="rounded-full bg-white border border-[#0E4F7E]/20 px-2.5 py-0.5 tabular-nums text-[11px] font-semibold text-[#0E4F7E]">
                  Chiết khấu đối tác: {commissionPct}% ({formatVnd(platformFeeFromPartner)})
                </span>
              </div>
              <p className="mt-1.5 leading-relaxed text-neutral-600">
                {provider?.platformGuarantee ??
                  'ArenaPulse chịu trách nhiệm giữ hộ tiền cọc ký quỹ, hoàn trả 100% nếu sân lỗi/mưa và hỗ trợ đối soát 2 chiều.'}{' '}
                Người thuê sân được <strong>miễn phí 0₫</strong> phí nền tảng.
              </p>
            </div>
          </div>

          {/* Primary Transaction CTA */}
          <div className="space-y-2.5 border-t border-neutral-100 pt-4">
            {!isAuthenticated && hasAnyAvailable && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/75 px-3.5 py-2 text-xs text-amber-950">
                <span>
                  🔒 <strong>Yêu cầu đăng nhập:</strong> Khách hàng cần đăng nhập tài khoản để giữ
                  sân, thanh toán ký quỹ và nhận vé QR định danh.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <ActionButton
                variant="forest"
                size="lg"
                arrow="right"
                disabled={!hasAnyAvailable}
                onClick={onProceedToHold}
                className="flex-1"
              >
                {hasAnyAvailable
                  ? !isAuthenticated
                    ? `Đăng nhập để Đặt sân (${formatVnd(grandTotal)})`
                    : addOnsTotal > 0
                      ? `Bước 2: Giữ sân & Cọc ${formatVnd(depositAmount)} (Tổng ${formatVnd(grandTotal)})`
                      : `Bước 2: Giữ sân & Đặt cọc ${formatVnd(depositAmount)}`
                  : 'Cụm sân đã kín hết ca hôm nay'}
              </ActionButton>
              <ActionButton variant="outline" size="lg" onClick={() => onOpenVenueChat(listing)}>
                Chat hỏi bên cho thuê
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* LESSOR-CONFIGURED ADD-ON SERVICES & QUANTITY CALCULATOR               */}
      {/* ===================================================================== */}
      {availableServices.length > 0 ? (
      <ScrollReveal
        delay={0.03}
        className="rounded-[28px] border border-neutral-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-5"
      >
        <div id="court-addon-services" className="scroll-mt-24 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-neutral-100 pb-5">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#16422C]">
              <span>Dịch vụ &amp; Sản phẩm Đi kèm do Chủ sân Cung cấp</span>
              {(activeRole === 'MANAGER' || activeRole === 'ADMIN') &&
                onOpenManageServicesInternal && (
                  <button
                    type="button"
                    onClick={onOpenManageServicesInternal}
                    className="rounded-full border border-[#16422C]/30 bg-[#F4F8F4] px-2.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#16422C] hover:bg-[#16422C] hover:text-[#E7F7D4]"
                  >
                    ⚙ Chỉnh sửa danh mục trong Nội bộ →
                  </button>
                )}
            </div>
            <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-[-0.015em] text-[#0F172A]">
              Chọn thêm Nước uống, Dụng cụ &amp; Hỗ trợ tại cơ sở này
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Danh mục dưới đây do <strong>{provider?.providerName ?? listing.venueName}</strong> trực tiếp mở bán cho cụm sân này — chuẩn bị sẵn trước giờ nhận ca và cộng vào tổng hóa đơn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'DRINKS', 'EQUIPMENT', 'SUPPORT', 'FACILITY'] as const).map((cat) => {
              const countInCat =
                cat === 'ALL'
                  ? availableServices.length
                  : availableServices.filter((s) => s.category === cat).length;
              if (cat !== 'ALL' && countInCat === 0) return null;
              const active = serviceCatFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setServiceCatFilter(cat);
                    servicesTrackRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#16422C] text-[#E7F7D4] shadow-2xs'
                      : 'border border-neutral-200 bg-[#F8F9FA] text-neutral-600 hover:border-[#16422C]/40 hover:text-[#0F172A]'
                  }`}
                >
                  {COURT_SERVICE_CATEGORY_LABELS[cat]}
                </button>
              );
            })}

            {/* Horizontal Carousel Controls */}
            <div className="hidden sm:inline-flex items-center gap-1.5 pl-2 ml-1 border-l border-neutral-200">
              <button
                type="button"
                aria-label="Cuộn dịch vụ sang trái"
                onClick={() => scrollServicesBy(-340)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-semibold text-[#0F172A] shadow-2xs hover:border-[#16422C] hover:text-[#16422C] transition-colors"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Cuộn dịch vụ sang phải"
                onClick={() => scrollServicesBy(340)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-semibold text-[#0F172A] shadow-2xs hover:border-[#16422C] hover:text-[#16422C] transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Snap-Scrolling Product Carousel with Real Product Photography */}
        <div className="relative">
          <div
            ref={servicesTrackRef}
            className="no-scrollbar flex gap-4 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory scroll-smooth"
          >
            {filteredServices.map((srv) => {
              const qty = effectiveServiceQty[srv.id] ?? 0;
              const isSelected = qty > 0;
              const lineSubtotal = qty * srv.unitPrice;
              return (
                <div
                  key={srv.id}
                  className={`group snap-start shrink-0 w-[268px] sm:w-[292px] flex flex-col justify-between overflow-hidden rounded-[22px] border transition-all duration-300 ${
                    isSelected
                      ? 'border-[#16422C] bg-[#F4F8F4]/70 shadow-[0_14px_32px_rgba(22,66,44,0.12)] ring-1 ring-[#16422C]/20'
                      : 'border-neutral-200/90 bg-white hover:border-[#16422C]/45 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)]'
                  }`}
                >
                  <div>
                    {/* Product Photography Header */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F2F4F3]">
                      <img
                        src={srv.imageUrl}
                        alt={srv.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                        <span className="rounded-full bg-white/92 px-2.5 py-0.5 text-[10px] font-semibold text-[#0F172A] backdrop-blur-xs shadow-2xs">
                          {COURT_SERVICE_CATEGORY_LABELS[srv.category]}
                        </span>
                      </div>

                      {srv.popular && (
                        <span className="absolute right-2.5 top-2.5 rounded-full bg-[#16422C] px-2.5 py-0.5 text-[10px] font-bold text-[#E7F7D4] shadow-xs">
                          Phổ biến
                        </span>
                      )}

                      {isSelected && (
                        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-[#E7F7D4] px-2.5 py-0.5 tabular-nums text-[10.5px] font-extrabold text-[#0B2217] shadow-xs">
                          Đã chọn ×{qty}
                        </span>
                      )}
                    </div>

                    {/* Product Title & Description */}
                    <div className="p-4 pb-3">
                      <h4 className="line-clamp-2 min-h-[38px] text-[13.5px] font-semibold leading-snug text-[#0F172A]">
                        {srv.name}
                      </h4>
                      <p className="mt-1 line-clamp-2 min-h-[34px] text-[11.5px] leading-relaxed text-neutral-500">
                        {srv.description}
                      </p>
                    </div>
                  </div>

                  {/* Price & Quantity Stepper Footer */}
                  <div className="flex items-center justify-between gap-2.5 border-t border-neutral-100 px-4 py-3 bg-[#FAFAFA]/70">
                    <div className="min-w-0">
                      <div className="tabular-nums text-[14.5px] font-bold text-[#16422C]">
                        {formatVnd(srv.unitPrice)}
                        <span className="text-[11px] font-normal text-neutral-400">
                          /{srv.unitLabel}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="tabular-nums text-[11px] font-semibold text-[#0E4F7E]">
                          = {formatVnd(lineSubtotal)}
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-neutral-400">
                          Tối đa {srv.maxQty} {srv.unitLabel}
                        </div>
                      )}
                    </div>

                    {isSelected ? (
                      <div className="inline-flex items-center gap-1 rounded-full border border-[#16422C]/30 bg-white p-0.5 shadow-2xs shrink-0">
                        <button
                          type="button"
                          aria-label={`Giảm số lượng ${srv.name}`}
                          onClick={() => updateServiceQty(srv.id, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-[#0F172A] hover:bg-neutral-200"
                        >
                          −
                        </button>
                        <span className="min-w-[22px] text-center tabular-nums text-xs font-bold text-[#16422C]">
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Tăng số lượng ${srv.name}`}
                          disabled={qty >= srv.maxQty}
                          onClick={() => updateServiceQty(srv.id, Math.min(srv.maxQty, qty + 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#16422C] text-sm font-bold text-[#E7F7D4] hover:bg-[#0F172A] disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateServiceQty(srv.id, 1)}
                        className="shrink-0 rounded-full border border-[#16422C] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#16422C] hover:bg-[#16422C] hover:text-[#E7F7D4] transition-colors"
                      >
                        + Thêm
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400 px-1">
            <span>Vuốt ngang hoặc bấm ← / → để xem đầy đủ {filteredServices.length} sản phẩm dịch vụ</span>
            <span className="hidden sm:inline tabular-nums font-medium text-neutral-500">
              {totalSelectedServiceCount > 0
                ? `Đang chọn ${totalSelectedServiceCount} sản phẩm`
                : 'Chưa chọn dịch vụ'}
            </span>
          </div>
        </div>

        {/* Live Total Bar (Court + Add-on Services) */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span>
                Giá thuê sân:{' '}
                <strong className="tabular-nums text-[#0F172A]">{formatVnd(effectivePrice)}</strong>
              </span>
              <span>+</span>
              <span>
                Dịch vụ đi kèm ({totalSelectedServiceCount} món):{' '}
                <strong className="tabular-nums text-[#16422C]">{formatVnd(addOnsTotal)}</strong>
              </span>
              {totalSelectedServiceCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelectedServices}
                  className="ml-1 text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Xóa dịch vụ
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Tổng cộng đơn sân + dịch vụ:
              </span>
              <span className="tabular-nums text-2xl font-bold text-[#16422C]">
                {formatVnd(grandTotal)}
              </span>
            </div>
          </div>

          <ActionButton
            variant="forest"
            size="md"
            arrow="right"
            disabled={!hasAnyAvailable}
            onClick={onProceedToHold}
            className="shrink-0"
          >
            {hasAnyAvailable
              ? isAuthenticated
                ? `Đặt sân & dịch vụ (${formatVnd(grandTotal)})`
                : `Đăng nhập để Đặt sân (${formatVnd(grandTotal)})`
              : 'Đã kín lịch hôm nay'}
          </ActionButton>
        </div>
      </ScrollReveal>
      ) : (activeRole === 'MANAGER' || activeRole === 'ADMIN') && onOpenManageServicesInternal ? (
        <ScrollReveal
          delay={0.03}
          className="flex flex-col gap-3 rounded-[24px] border border-dashed border-[#16422C]/35 bg-[#F4F8F4]/70 p-5 sm:flex-row sm:items-center sm:justify-between text-xs"
        >
          <div>
            <div className="font-bold text-[#16422C]">
              Cụm sân này chưa bật bán sản phẩm / dịch vụ đi kèm trực tuyến
            </div>
            <p className="mt-0.5 text-neutral-600">
              Là Chủ sân / Admin, bạn có thể thêm nước uống, bóng, vợt hoặc trọng tài riêng cho cụm
              sân này trong Hệ thống Nội bộ.
            </p>
          </div>
          <ActionButton
            variant="forest"
            size="sm"
            arrow="right"
            onClick={onOpenManageServicesInternal}
            className="shrink-0"
          >
            Thiết lập Nước &amp; Dịch vụ Sân
          </ActionButton>
        </ScrollReveal>
      ) : null}

      {/* ===================================================================== */}
      {/* SHOPEE-STYLE PROVIDER / LESSOR SHOP PROFILE CARD                      */}
      {/* ===================================================================== */}
      {provider && (
        <ScrollReveal
          delay={0.04}
          className="rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-7 shadow-xs"
        >
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenLessorShop?.(provider.providerId)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#16422C] text-lg font-bold text-[#E7F7D4] hover:ring-2 hover:ring-[#16422C] hover:ring-offset-2 transition-all"
              >
                {provider.providerName.slice(0, 2).toUpperCase()}
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Bên cho thuê cung cấp địa điểm
                  </span>
                  <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[10px] font-semibold text-[#204E18]">
                    Đã xác thực pháp lý
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLessorShop?.(provider.providerId)}
                  className="mt-0.5 text-left text-lg font-semibold text-[#0F172A] hover:text-[#16422C] hover:underline"
                >
                  {provider.providerName}
                </button>
                <p className="text-xs text-neutral-500">
                  Cơ sở: {listing.venueName} • {provider.district}, {provider.city}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs border-y lg:border-y-0 lg:border-x border-neutral-200/80 py-3 lg:py-0 lg:px-6">
              <div>
                <div className="text-neutral-400">Số sân quản lý</div>
                <div className="mt-0.5 tabular-nums font-semibold text-[#0F172A]">
                  {provider.totalManagedCourts} sân
                </div>
              </div>
              <div>
                <div className="text-neutral-400">Tỷ lệ phản hồi</div>
                <div className="mt-0.5 tabular-nums font-semibold text-[#16422C]">
                  {provider.responseRatePct}%
                </div>
              </div>
              <div>
                <div className="text-neutral-400">Thâm niên đối tác</div>
                <div className="mt-0.5 tabular-nums font-semibold text-[#0F172A]">
                  {provider.yearsPartner} năm
                </div>
              </div>
              <div>
                <div className="text-neutral-400">Chiết khấu sàn</div>
                <div className="mt-0.5 tabular-nums font-semibold text-[#0E4F7E]">
                  {provider.commissionRatePct}% / đơn
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <ActionButton
                variant="outline"
                size="sm"
                onClick={() => onOpenVenueChat(listing)}
              >
                💬 Chat Ngay
              </ActionButton>
              <ActionButton
                variant="ink"
                size="sm"
                onClick={() =>
                  onOpenLessorShop
                    ? onOpenLessorShop(provider.providerId)
                    : onFilterByProvider(listing.venueName)
                }
              >
                Xem Gian Hàng →
              </ActionButton>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* ===================================================================== */}
      {/* TECHNICAL SPECS & FROZEN CANCELLATION COMMITMENT                      */}
      {/* ===================================================================== */}
      <ScrollReveal delay={0.08} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 lg:col-span-7">
          <h3 className="text-base font-semibold text-[#0F172A]">
            Thông số kỹ thuật mặt sân &amp; Tiện ích đi kèm
          </h3>
          {listing.specs && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-500">Chất liệu mặt sân</span>
                <span className="col-span-2 font-medium text-[#0F172A]">{listing.specs.surface}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-500">Hệ thống chiếu sáng</span>
                <span className="col-span-2 font-medium text-[#0F172A]">{listing.specs.lighting}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-500">Kích thước tiêu chuẩn</span>
                <span className="col-span-2 font-medium text-[#0F172A]">{listing.specs.dimensions}</span>
              </div>
              <div className="pt-1">
                <div className="mb-2 text-neutral-500">Tiện ích tại cơ sở cho thuê</div>
                <div className="flex flex-wrap gap-2">
                  {listing.specs.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-neutral-200 bg-[#F8F9FA] px-3 py-1 text-[11px] font-medium text-[#0F172A]"
                    >
                      ✓ {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-neutral-200/90 bg-[#F8F9FA] p-6 lg:col-span-5">
          <h3 className="text-base font-semibold text-[#0F172A]">
            Chính sách hoàn cọc &amp; Bảo vệ người thuê
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Được chụp cứng vào đơn đặt sân — sàn trung gian ArenaPulse giám sát thực thi tự động.
          </p>
          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between rounded-xl bg-white px-3.5 py-2.5 border border-neutral-200/70">
              <span className="font-medium text-[#0F172A]">Hủy trước giờ chơi ≥ 11 giờ</span>
              <span className="font-semibold text-[#16422C]">Hoàn 100% cọc</span>
            </div>
            <div className="flex justify-between rounded-xl bg-white px-3.5 py-2.5 border border-neutral-200/70">
              <span className="font-medium text-[#0F172A]">Hủy từ 4 giờ đến dưới 11 giờ</span>
              <span className="font-semibold text-[#0E4F7E]">Hoàn 50% cọc</span>
            </div>
            <div className="flex justify-between rounded-xl bg-white px-3.5 py-2.5 border border-neutral-200/70">
              <span className="font-medium text-[#0F172A]">Sát giờ &lt; 4 giờ</span>
              <span className="font-semibold text-neutral-600">Khấu trừ cọc</span>
            </div>
            <div className="flex justify-between rounded-xl bg-[#E7F7D4] px-3.5 py-2.5 text-[#204E18]">
              <span className="font-semibold">Đối tác hủy sân / Mưa lớn</span>
              <span className="font-bold">Hoàn 100% tức thì</span>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </motion.div>
  );
};

function activeListingMatches(quote: PriceQuote | null, listing: PublishedListing): boolean {
  return Boolean(quote && quote.groupId === listing.groupId);
}

