import React, { useEffect, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  CourtSearchResponseData,
  PriceQuote,
  PublishedListing,
  RoleCode,
  SportTypeItem,
  VenueAnnouncement,
  VenueLocationInfo,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';
import { CourtDetailView } from './CourtDetailView';

interface MarketplaceExplorerSectionProps {
  sports: SportTypeItem[];
  listings: PublishedListing[];
  locations: VenueLocationInfo[];
  announcements: VenueAnnouncement[];
  activeRole?: RoleCode;
  isAuthenticated?: boolean;
  selectedLocationId: string;
  onSelectLocationId: (id: string) => void;
  onOpenAnnouncementsPage: () => void;
  selectedSport: string;
  onSelectSport: (code: string) => void;
  checkinFilter: 'ALL' | 'QR_STAFF' | 'MANUAL';
  onChangeCheckinFilter: (mode: 'ALL' | 'QR_STAFF' | 'MANUAL') => void;
  activeListing: PublishedListing | null;
  activeSlotStart: string | null;
  activeQuote: PriceQuote | null;
  quoteLoading: boolean;
  countdownLabel: string;
  onSelectSlot: (listing: PublishedListing, slotStart: string) => void;
  onProceedToHold: () => void;
  onOpenVenueChat: (listing: PublishedListing) => void;
  onOpenLessorShop?: (providerId: string) => void;
  requestedDetailGroupId?: string | null;
  onClearRequestedDetail?: () => void;
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

export const MarketplaceExplorerSection: React.FC<MarketplaceExplorerSectionProps> = ({
  sports,
  listings,
  locations,
  announcements,
  activeRole = 'USER',
  isAuthenticated = false,
  selectedLocationId,
  onSelectLocationId,
  onOpenAnnouncementsPage,
  selectedSport,
  onSelectSport,
  checkinFilter,
  onChangeCheckinFilter,
  activeListing,
  activeSlotStart,
  activeQuote,
  quoteLoading,
  countdownLabel,
  onSelectSlot,
  onProceedToHold,
  onOpenVenueChat,
  onOpenLessorShop,
  requestedDetailGroupId,
  onClearRequestedDetail,
  selectedServiceQuantities,
  onChangeServiceQuantity,
  onClearServices,
  onOpenManageServicesInternal,
  onUploadCourtPhoto,
  onSetCoverCourtPhoto,
  onDeleteCourtPhoto,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'PLENTY'>('ALL');
  const [timePeriodFilter, setTimePeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING'>('ALL');
  const [durationFilter, setDurationFilter] = useState<'ALL' | '60' | '90'>('ALL');
  const [sortBy, setSortBy] = useState<'RECOMMENDED' | 'PRICE_ASC' | 'CAPACITY_DESC' | 'RATING_DESC'>('RECOMMENDED');
  const [detailListingId, setDetailListingId] = useState<string | null>(null);
  const [esSearchInfo, setEsSearchInfo] = useState<CourtSearchResponseData | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q && selectedSport === 'ALL') {
      setEsSearchInfo(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      marketplaceApi.searchCourtsFast(q, selectedSport).then((resp) => {
        if (active && resp) setEsSearchInfo(resp);
      });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, selectedSport]);

  const selectedLocationObj =
    locations.find((loc) => loc.locationId === selectedLocationId) ?? null;

  const contextualNotice =
    announcements.find((a) =>
      selectedLocationObj ? a.locationId === selectedLocationObj.locationId : a.pinned
    ) ?? announcements[0];

  const getMatchingSlots = (item: PublishedListing) =>
    item.upcomingSlots.filter((slot) => {
      const matchPeriod = timePeriodFilter === 'ALL' || slot.timePeriod === timePeriodFilter;
      const matchAvail =
        availabilityFilter === 'ALL'
          ? true
          : availabilityFilter === 'AVAILABLE'
            ? slot.availableCourts > 0
            : slot.availableCourts >= 3;
      return matchPeriod && matchAvail;
    });

  const filteredListings = listings
    .filter((item) => {
      const matchSport = selectedSport === 'ALL' || item.sportCode === selectedSport;
      const matchCheckin = checkinFilter === 'ALL' || item.checkinMode === checkinFilter;
      const matchLoc = !selectedLocationObj || item.venueName === selectedLocationObj.venueName;
      const matchDuration = durationFilter === 'ALL' || String(item.slotMinutes) === durationFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        item.groupName.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.venueAddress.toLowerCase().includes(q) ||
        (item.provider?.providerName.toLowerCase().includes(q) ?? false);

      const slots = getMatchingSlots(item);
      const matchSlots =
        availabilityFilter === 'ALL' && timePeriodFilter === 'ALL' ? true : slots.length > 0;

      return matchSport && matchCheckin && matchLoc && matchDuration && matchQuery && matchSlots;
    })
    .sort((a, b) => {
      if (sortBy === 'PRICE_ASC') return a.basePrice - b.basePrice;
      if (sortBy === 'RATING_DESC') return (b.rating ?? 4.8) - (a.rating ?? 4.8);
      if (sortBy === 'CAPACITY_DESC') {
        const capA = a.upcomingSlots.reduce((sum, s) => sum + s.availableCourts, 0);
        const capB = b.upcomingSlots.reduce((sum, s) => sum + s.availableCourts, 0);
        return capB - capA;
      }
      return 0;
    });

  const totalOpenCourts = filteredListings.reduce(
    (acc, item) => acc + Math.max(0, ...item.upcomingSlots.map((s) => s.availableCourts)),
    0
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedLocationId !== 'ALL' ||
    selectedSport !== 'ALL' ||
    availabilityFilter !== 'ALL' ||
    timePeriodFilter !== 'ALL' ||
    durationFilter !== 'ALL' ||
    checkinFilter !== 'ALL';

  const resetAllFilters = () => {
    setSearchQuery('');
    onSelectLocationId('ALL');
    onSelectSport('ALL');
    setAvailabilityFilter('ALL');
    setTimePeriodFilter('ALL');
    setDurationFilter('ALL');
    onChangeCheckinFilter('ALL');
    setSortBy('RECOMMENDED');
  };

  const detailListing = detailListingId
    ? listings.find((l) => l.groupId === detailListingId) ?? null
    : null;

  const snapViewportTop = () => {
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

  useLayoutEffect(() => {
    if (!detailListingId) return;
    snapViewportTop();
    const timer = window.setTimeout(snapViewportTop, 60);
    return () => window.clearTimeout(timer);
  }, [detailListingId]);

  useEffect(() => {
    if (!requestedDetailGroupId) return;
    const matched = listings.find((l) => l.groupId === requestedDetailGroupId);
    if (matched) {
      setDetailListingId(matched.groupId);
      onClearRequestedDetail?.();
    }
  }, [requestedDetailGroupId, listings, onClearRequestedDetail]);

  const openDetail = (listing: PublishedListing, preferredSlotStart?: string) => {
    snapViewportTop();
    setDetailListingId(listing.groupId);
    const chosenSlot =
      (preferredSlotStart &&
        listing.upcomingSlots.find((s) => s.slotStart === preferredSlotStart)) ||
      listing.upcomingSlots.find((s) => s.availableCourts > 0) ||
      listing.upcomingSlots[0];
    if (
      chosenSlot &&
      (preferredSlotStart || !activeListing || activeListing.groupId !== listing.groupId)
    ) {
      onSelectSlot(listing, chosenSlot.slotStart);
    }
  };

  return (
    <section
      id="marketplace"
      style={{ overflowAnchor: 'none' }}
      className={detailListing ? 'bg-white pt-4 pb-16 sm:pt-6 sm:pb-20' : 'bg-white py-10 sm:py-14'}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {detailListing ? (
          <CourtDetailView
            listing={detailListing}
            activeRole={activeRole}
            isAuthenticated={isAuthenticated}
            activeSlotStart={activeSlotStart}
            activeQuote={activeQuote}
            quoteLoading={quoteLoading}
            countdownLabel={countdownLabel}
            onBack={() => {
              setDetailListingId(null);
              snapViewportTop();
            }}
            onSelectSlot={onSelectSlot}
            onProceedToHold={onProceedToHold}
            onOpenVenueChat={onOpenVenueChat}
            onOpenLessorShop={onOpenLessorShop}
            selectedServiceQuantities={selectedServiceQuantities}
            onChangeServiceQuantity={onChangeServiceQuantity}
            onClearServices={onClearServices}
            onOpenManageServicesInternal={onOpenManageServicesInternal}
            onUploadCourtPhoto={onUploadCourtPhoto}
            onSetCoverCourtPhoto={onSetCoverCourtPhoto}
            onDeleteCourtPhoto={onDeleteCourtPhoto}
            onFilterByProvider={(venueName) => {
              const found = locations.find((l) => l.venueName === venueName);
              if (found) onSelectLocationId(found.locationId);
              setDetailListingId(null);
              snapViewportTop();
            }}
          />
        ) : (
          <>
            {/* Contextual Location Announcement Banner */}
            {contextualNotice && (
              <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/75 px-4 py-3.5 sm:flex-row sm:items-center text-xs">
                <div className="min-w-0">
                  <span className="mr-2 inline-block rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-950">
                    Thông báo tại {contextualNotice.venueName}
                  </span>
                  <strong className="text-[#0F172A]">{contextualNotice.title}</strong>
                  <span className="hidden xl:inline text-neutral-600">
                    {' '}
                    — {contextualNotice.effectiveWindow}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAnnouncementsPage}
                  className="shrink-0 font-semibold text-[#16422C] hover:underline text-left"
                >
                  Xem chi tiết bảng tin cơ sở →
                </button>
              </div>
            )}

            {/* Structured Section Header */}
            <ScrollReveal className="flex flex-col gap-4 border-b border-neutral-200/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
                  Sàn Trung Gian Đa Địa Điểm • Kết Nối Đối Tác Cho Thuê Sân
                </div>
                <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#0F172A]">
                  Tìm kiếm &amp; chọn sân từ nhiều đối tác trên toàn quốc
                </h2>
                <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-neutral-500">
                  Bấm vào từng cụm sân để xem bộ ảnh thực tế, hồ sơ bên cho thuê, tỷ lệ chiết khấu
                  sàn minh bạch và khóa giá đặt cọc ký quỹ ngay.
                </p>
              </div>

              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] px-4 py-3 text-xs shrink-0">
                <div className="font-semibold text-[#16422C]">Bảo lãnh bởi ArenaPulse</div>
                <div className="mt-0.5 text-neutral-600">
                  Giữ hộ cọc ký quỹ • Hoàn 100% nếu đối tác hủy
                </div>
              </div>
            </ScrollReveal>

            {/* =============================================================== */}
            {/* PROFESSIONAL MULTI-FACET FILTER WORKSPACE                       */}
            {/* =============================================================== */}
            <ScrollReveal
              delay={0.04}
              className="mt-7 rounded-[28px] border border-neutral-200/90 bg-[#F7F8F7] p-4 sm:p-6 space-y-4"
            >
              {/* Row 1: Search + Availability Status + Sport Tabs */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-5 relative">
                  <svg
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="9" r="6" />
                    <path d="M13.5 13.5L17 17" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    aria-label="Tìm theo tên sân, khu vực hoặc đối tác cho thuê"
                    placeholder="Tìm tên sân, quận/huyện hoặc bên cho thuê…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-neutral-200/90 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-[13px] text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:outline-none"
                  />
                  {esSearchInfo && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#16422C]">
                      <span>
                        {esSearchInfo.dataSource === 'ELASTICSEARCH_CQRS'
                          ? '⚡ Đọc từ Elasticsearch'
                          : '🗄 Đọc từ PostgreSQL DB'}
                      </span>
                      <span className="text-neutral-400">•</span>
                      <span className="tabular-nums">{esSearchInfo.queryLatencyMs}ms</span>
                    </div>
                  )}
                </div>

                {/* Availability Filter (Còn sân hay không) */}
                <div className="lg:col-span-7 flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mr-1">
                    Tình trạng sân:
                  </span>
                  <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-white p-1 border border-neutral-200/90">
                    {[
                      { id: 'ALL' as const, label: 'Tất cả' },
                      { id: 'AVAILABLE' as const, label: 'Chỉ hiện còn sân' },
                      { id: 'PLENTY' as const, label: 'Còn nhiều sân (≥ 3)' },
                    ].map((opt) => {
                      const active = availabilityFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAvailabilityFilter(opt.id)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-[#16422C] text-white shadow-xs'
                              : 'text-neutral-600 hover:text-[#0F172A]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Sport Discipline Pills */}
              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200/70 pt-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mr-1">
                  Lĩnh vực:
                </span>
                {[{ code: 'ALL', name: `Tất cả (${listings.length})` }, ...sports].map((sp) => {
                  const active = selectedSport === sp.code;
                  return (
                    <button
                      key={sp.code}
                      type="button"
                      onClick={() => onSelectSport(sp.code)}
                      className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'text-white font-semibold'
                          : 'border border-neutral-200 bg-white text-neutral-700 hover:border-[#16422C]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="daylight-sport-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-[#0F172A]"
                        />
                      )}
                      <span className="relative z-10">{sp.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Row 3: Location, Time Slot Window, Rental Duration, Check-in & Sort */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-neutral-200/70 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <PillSelect
                    prefix="Địa điểm:"
                    ariaLabel="Lọc theo địa điểm cơ sở"
                    value={selectedLocationId}
                    onChange={onSelectLocationId}
                    options={[
                      { value: 'ALL', label: `Tất cả (${locations.length} cơ sở)` },
                      ...locations.map((loc) => ({
                        value: loc.locationId,
                        label: `${loc.city} — ${loc.district}`,
                      })),
                    ]}
                  />

                  <PillSelect
                    prefix="Khung giờ:"
                    ariaLabel="Lọc theo khung giờ thuê"
                    value={timePeriodFilter}
                    onChange={(v) => setTimePeriodFilter(v as typeof timePeriodFilter)}
                    options={[
                      { value: 'ALL', label: 'Mọi khung giờ' },
                      { value: 'MORNING', label: 'Sáng (06:00–12:00)' },
                      { value: 'AFTERNOON', label: 'Chiều (12:00–17:00)' },
                      { value: 'EVENING', label: 'Tối cao điểm (17:00–22:00)' },
                    ]}
                  />

                  <PillSelect
                    prefix="Thời lượng:"
                    ariaLabel="Lọc theo thời lượng ca thuê"
                    value={durationFilter}
                    onChange={(v) => setDurationFilter(v as typeof durationFilter)}
                    options={[
                      { value: 'ALL', label: 'Mọi thời lượng' },
                      { value: '60', label: '60 phút / ca' },
                      { value: '90', label: '90 phút / ca (Bóng đá)' },
                    ]}
                  />

                  <PillSelect
                    prefix="Nhận sân:"
                    ariaLabel="Lọc theo hình thức check-in"
                    value={checkinFilter}
                    onChange={(v) => onChangeCheckinFilter(v as typeof checkinFilter)}
                    options={[
                      { value: 'ALL', label: 'Mọi hình thức' },
                      { value: 'QR_STAFF', label: 'Quét vé QR 1 lần' },
                      { value: 'MANUAL', label: 'Tự check-in' },
                    ]}
                  />
                </div>

                <PillSelect
                  id="listing-sort"
                  prefix="Sắp xếp:"
                  ariaLabel="Sắp xếp danh sách cụm sân"
                  value={sortBy}
                  onChange={(val) => setSortBy(val as typeof sortBy)}
                  options={[
                    { value: 'RECOMMENDED', label: 'Đề xuất nổi bật' },
                    { value: 'PRICE_ASC', label: 'Giá thấp → cao' },
                    { value: 'CAPACITY_DESC', label: 'Còn nhiều sân trống nhất' },
                    { value: 'RATING_DESC', label: 'Đánh giá cao nhất' },
                  ]}
                />
              </div>

              {/* Filter Summary & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="text-neutral-600">
                  Hiển thị <strong className="tabular-nums text-[#0F172A]">{filteredListings.length}</strong>{' '}
                  cụm sân từ các đối tác • Tối đa{' '}
                  <strong className="tabular-nums text-[#16422C]">{totalOpenCourts}</strong> sân trống
                  phù hợp
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="font-semibold text-[#0E4F7E] hover:underline"
                  >
                    Đặt lại tất cả bộ lọc ↺
                  </button>
                )}
              </div>
            </ScrollReveal>

            {/* =============================================================== */}
            {/* MULTI-VENDOR 3-COLUMN COURT CARDS GRID                          */}
            {/* =============================================================== */}
            {filteredListings.length === 0 ? (
              <div className="mt-8 rounded-[28px] border border-neutral-200 bg-[#F8F9FA] p-12 text-center">
                <div className="text-base font-semibold text-[#0F172A]">
                  Không tìm thấy cụm sân phù hợp với bộ lọc hiện tại
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Hãy thử bỏ bớt điều kiện giờ hoặc chọn lại "Tất cả" để xem thêm địa điểm còn trống.
                </p>
                <ActionButton variant="ink" size="md" onClick={resetAllFilters} className="mt-5">
                  Xem lại toàn bộ cụm sân
                </ActionButton>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((listing, idx) => {
                  const visibleSlots = getMatchingSlots(listing);
                  const maxAvailable = Math.max(0, ...listing.upcomingSlots.map((s) => s.availableCourts));
                  const isAllSoldOut = maxAvailable === 0;
                  const galleryCount = listing.galleryImages?.length ?? 1;

                  return (
                    <ScrollReveal
                      key={listing.groupId}
                      delay={Math.min(idx * 0.04, 0.2)}
                      className="group flex flex-col justify-between rounded-[26px] border border-neutral-200/80 bg-[#F7F8F7] p-3.5 transition-all duration-300 hover:bg-white hover:border-transparent hover:ring-2 hover:ring-[#16422C] hover:shadow-[0_22px_54px_rgba(22,66,44,0.12)]"
                    >
                      <div>
                        {/* Clickable Image Opening Shopee-Style Detail View */}
                        <div
                          onClick={() => openDetail(listing)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') openDetail(listing);
                          }}
                          className="relative h-52 w-full cursor-pointer overflow-hidden rounded-[20px] bg-neutral-200"
                        >
                          <img
                            src={listing.imageUrl || '/images/sport-tennis-sunny.jpg'}
                            alt={listing.groupName}
                            loading="lazy"
                            decoding="async"
                            className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                              isAllSoldOut ? 'grayscale-[30%] opacity-85' : ''
                            }`}
                          />
                          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#0F172A] shadow-xs">
                              {listing.sportName}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 tabular-nums text-[11px] font-semibold ${
                                isAllSoldOut
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-[#16422C] text-[#E7F7D4]'
                              }`}
                            >
                              {isAllSoldOut ? 'Hết sân' : `Còn ${maxAvailable} sân`}
                            </span>
                          </div>

                          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 tabular-nums text-[10px] font-medium text-white backdrop-blur-xs">
                            {galleryCount} ảnh
                          </span>

                          <div className="absolute bottom-0 right-0 rounded-tl-[16px] bg-white px-3.5 py-1.5 tabular-nums text-xs font-semibold text-[#16422C]">
                            Cọc {listing.depositPercent}%
                          </div>
                        </div>

                        <div className="px-2 pt-4">
                          {/* Provider Badge (Click -> Lessor Shop) & Star Rating */}
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                listing.provider &&
                                onOpenLessorShop?.(listing.provider.providerId)
                              }
                              className="truncate text-left font-semibold text-[#0E4F7E] hover:text-[#16422C] hover:underline"
                            >
                              {listing.provider?.providerName ?? listing.venueName}
                            </button>
                            <span className="shrink-0 tabular-nums font-semibold text-amber-600">
                              ★ {(listing.rating ?? 4.9).toFixed(1)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openDetail(listing)}
                            className="mt-1 text-left text-[16.5px] font-semibold leading-snug tracking-[-0.015em] text-[#0F172A] hover:text-[#16422C]"
                          >
                            {listing.groupName}
                          </button>

                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {listing.district}, {listing.city} • {listing.venueAddress}
                          </p>

                          {/* Price & Commission Row */}
                          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs border border-neutral-200/70">
                            <span className="text-neutral-500">
                              Từ{' '}
                              <strong className="tabular-nums text-[#0F172A]">
                                {formatVnd(listing.minPrice)}
                              </strong>
                            </span>
                            <span className="tabular-nums text-[11px] font-medium text-[#16422C]">
                              Hoa hồng sàn {listing.provider?.commissionRatePct ?? 10}% •{' '}
                              {listing.slotMinutes}p/ca
                            </span>
                          </div>

                          {/* Slot Buttons (Hover highlights forest green) */}
                          <div className="mt-3.5 space-y-2 pb-1">
                            {(visibleSlots.length > 0 ? visibleSlots : listing.upcomingSlots).map((slot) => {
                              const soldOut = slot.availableCourts <= 0;
                              const isSurge = slot.demandTag === 'PRIME_SURGE';
                              return (
                                <button
                                  key={slot.slotStart}
                                  type="button"
                                  disabled={soldOut}
                                  onClick={() => openDetail(listing, slot.slotStart)}
                                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left border transition-all duration-200 ${
                                    soldOut
                                      ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 border-neutral-200/70 opacity-75'
                                      : 'fairway-interactive group/slot cursor-pointer bg-white text-[#0F172A] border-neutral-200/90 hover:bg-[#16422C] hover:text-white hover:border-[#16422C] hover:shadow-sm'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="tabular-nums text-xs font-semibold">
                                        {formatSlotWindow(slot.slotStart, slot.slotEnd)}
                                      </span>
                                      {isSurge && !soldOut && (
                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200 transition-colors group-hover/slot:bg-[#E7F7D4] group-hover/slot:text-[#204E18] group-hover/slot:border-transparent">
                                          Cao điểm
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`mt-0.5 text-[11px] transition-colors ${
                                        soldOut
                                          ? 'text-rose-600 font-medium'
                                          : 'text-neutral-500 group-hover/slot:text-white/80'
                                      }`}
                                    >
                                      {soldOut ? (
                                        'Đã kín hết sân'
                                      ) : (
                                        <>
                                          Trống{' '}
                                          <strong className="tabular-nums">
                                            {slot.availableCourts}/{slot.totalCapacity}
                                          </strong>{' '}
                                          sân
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div
                                      className={`tabular-nums text-sm font-semibold transition-colors ${
                                        soldOut
                                          ? 'text-neutral-400'
                                          : 'text-[#0F172A] group-hover/slot:text-[#E7F7D4]'
                                      }`}
                                    >
                                      {formatVnd(slot.currentDynamicPrice)}
                                    </div>
                                    <div
                                      className={`text-[10px] font-medium transition-colors ${
                                        soldOut
                                          ? 'text-neutral-400'
                                          : 'text-[#0E4F7E] group-hover/slot:text-white/90'
                                      }`}
                                    >
                                      {soldOut ? 'Hết chỗ' : 'Khóa giá →'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Card Footer: Detail View + Chat */}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200/70 px-2 pt-3">
                        <button
                          type="button"
                          onClick={() => onOpenVenueChat(listing)}
                          className="text-[11.5px] font-medium text-neutral-500 hover:text-[#16422C]"
                        >
                          Chat bên cho thuê
                        </button>
                        <button
                          type="button"
                          onClick={() => openDetail(listing)}
                          className="text-xs font-semibold text-[#16422C] hover:underline"
                        >
                          Xem chi tiết sân &amp; đối tác →
                        </button>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}

            {/* Selected Slot Summary Strip -> Leads Directly into Checkout */}
            {activeQuote && activeListing && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EXPO_EASE }}
                role="status"
                aria-live="polite"
                className="mt-8 flex flex-col justify-between gap-4 rounded-[24px] border border-[#16422C]/25 bg-[#F4F8F4] p-4 sm:p-5 lg:flex-row lg:items-center"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={activeListing.imageUrl || '/images/sport-football-pitch.jpg'}
                    alt={activeListing.groupName}
                    className="h-14 w-18 shrink-0 rounded-2xl object-cover"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#16422C]">
                        {quoteLoading ? 'Đang cập nhật khóa giá…' : 'Ca thuê đã khóa giá thành công'}
                      </span>
                      <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 tabular-nums text-[11px] font-semibold text-[#204E18]">
                        Giữ giá trong {countdownLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#0F172A]">
                      <strong>{activeListing.groupName}</strong> • Tổng giá ca:{' '}
                      <strong className="tabular-nums text-[#16422C]">
                        {formatVnd(activeQuote.currentPrice)}
                      </strong>{' '}
                      • Đặt cọc {activeListing.depositPercent}%:{' '}
                      <strong className="tabular-nums">
                        {formatVnd(
                          Math.floor((activeQuote.currentPrice * activeListing.depositPercent) / 100)
                        )}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <ActionButton
                    variant="outline"
                    size="md"
                    onClick={() => openDetail(activeListing)}
                  >
                    Xem chi tiết sân
                  </ActionButton>
                  <ActionButton
                    variant="ink"
                    size="md"
                    arrow="right"
                    onClick={onProceedToHold}
                  >
                    {isAuthenticated
                      ? 'Tiếp tục thanh toán & Nhận vé QR'
                      : 'Đăng nhập để Đặt sân & Nhận vé QR'}
                  </ActionButton>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
