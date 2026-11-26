import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  PublishedListing,
  VenueProviderInfo,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';

interface LessorShopViewProps {
  listings: PublishedListing[];
  selectedProviderId: string | null;
  followedProviderIds: string[];
  onSelectProviderId: (providerId: string) => void;
  onToggleFollowProvider: (providerId: string) => void;
  onOpenLessorChat: (providerId: string, contextListing?: PublishedListing) => void;
  onSelectCourtFromShop: (listing: PublishedListing, preferredSlotStart?: string) => void;
  onBackToCourts: () => void;
}

type ShopTabId = 'OVERVIEW' | 'ALL_COURTS' | 'LEGAL_REVIEWS' | string;
type ShopSortId = 'POPULAR' | 'PRICE_ASC' | 'AVAILABILITY' | 'RATING_DESC';

interface VerifiedPlayerReview {
  id: string;
  playerName: string;
  sportTag: string;
  rating: number;
  dateLabel: string;
  comment: string;
}

function formatCompactCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return count.toLocaleString('vi-VN');
}

function buildVerifiedReviews(providerName: string, sportName: string): VerifiedPlayerReview[] {
  return [
    {
      id: 'rev-1',
      playerName: 'Nguyễn Minh Quân',
      sportTag: sportName,
      rating: 5,
      dateLabel: '2 ngày trước • Đã check-in QR',
      comment: `Mặt sân tại ${providerName} rất êm, ánh sáng đèn LED không chói mắt. Quét mã QR vào thẳng sân không phải chờ quầy.`,
    },
    {
      id: 'rev-2',
      playerName: 'Trần Khánh Linh',
      sportTag: sportName,
      rating: 5,
      dateLabel: '5 ngày trước • Đã check-in QR',
      comment:
        'Chủ sân phản hồi chat cực nhanh trong vài phút, hỗ trợ mượn vợt và nước uống đầy đủ. Giá khóa 10 phút minh bạch đúng như niêm yết.',
    },
    {
      id: 'rev-3',
      playerName: 'Lê Hoàng Nam',
      sportTag: sportName,
      rating: 4.8,
      dateLabel: 'Tuần trước • Đã check-in QR',
      comment:
        'Bãi để xe rộng, phòng thay đồ sạch sẽ. Hôm trước mưa to được sàn ArenaPulse tự động hoàn 100% cọc rất yên tâm.',
    },
  ];
}

export const LessorShopView: React.FC<LessorShopViewProps> = ({
  listings,
  selectedProviderId,
  followedProviderIds,
  onToggleFollowProvider,
  onOpenLessorChat,
  onSelectCourtFromShop,
  onBackToCourts,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTabId>('OVERVIEW');
  const [shopSearchQuery, setShopSearchQuery] = useState<string>('');
  const [shopSort, setShopSort] = useState<ShopSortId>('POPULAR');
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);
  const [copiedProfileLink, setCopiedProfileLink] = useState<boolean>(false);

  const providers = useMemo<VenueProviderInfo[]>(() => {
    const map = new Map<string, VenueProviderInfo>();
    for (const item of listings) {
      if (item.provider && !map.has(item.provider.providerId)) {
        map.set(item.provider.providerId, item.provider);
      }
    }
    return Array.from(map.values());
  }, [listings]);

  const activeProvider = useMemo<VenueProviderInfo | null>(() => {
    if (providers.length === 0) return null;
    if (selectedProviderId) {
      const matched = providers.find((p) => p.providerId === selectedProviderId);
      if (matched) return matched;
    }
    return providers[0];
  }, [providers, selectedProviderId]);

  const shopListings = useMemo(() => {
    if (!activeProvider) return [];
    return listings.filter((l) => l.provider?.providerId === activeProvider.providerId);
  }, [listings, activeProvider]);

  const shopSportCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of shopListings) {
      if (!map.has(item.sportCode)) {
        map.set(item.sportCode, item.sportName);
      }
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [shopListings]);

  const filteredShopListings = useMemo(() => {
    const q = shopSearchQuery.trim().toLowerCase();
    const list = shopListings.filter((item) => {
      const matchesSportTab =
        activeTab === 'OVERVIEW' || activeTab === 'ALL_COURTS' || activeTab === 'LEGAL_REVIEWS'
          ? true
          : item.sportCode === activeTab;
      const matchesSearch =
        !q ||
        item.groupName.toLowerCase().includes(q) ||
        item.sportName.toLowerCase().includes(q) ||
        item.venueAddress.toLowerCase().includes(q);
      return matchesSportTab && matchesSearch;
    });

    return [...list].sort((a, b) => {
      if (shopSort === 'PRICE_ASC') return a.minPrice - b.minPrice;
      if (shopSort === 'RATING_DESC') return (b.rating ?? 4.9) - (a.rating ?? 4.9);
      if (shopSort === 'AVAILABILITY') {
        const capA = a.upcomingSlots.reduce((sum, s) => sum + s.availableCourts, 0);
        const capB = b.upcomingSlots.reduce((sum, s) => sum + s.availableCourts, 0);
        return capB - capA;
      }
      return (b.reviewCount ?? 100) - (a.reviewCount ?? 100);
    });
  }, [shopListings, activeTab, shopSearchQuery, shopSort]);

  if (!activeProvider) {
    return (
      <section className="bg-[#F8F9FA] py-16">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 text-center">
          <p className="text-sm text-neutral-500">Không tìm thấy hồ sơ đối tác cho thuê sân.</p>
          <ActionButton variant="outline" size="md" className="mt-4" onClick={onBackToCourts}>
            ← Quay lại Thuê sân
          </ActionButton>
        </div>
      </section>
    );
  }

  const isFollowed = followedProviderIds.includes(activeProvider.providerId);
  const followersDisplay = (activeProvider.followersCount ?? 12800) + (isFollowed ? 1 : 0);
  const totalReviews = shopListings.reduce((sum, l) => sum + (l.reviewCount ?? 120), 0);
  const avgRating =
    shopListings.length > 0
      ? (
          shopListings.reduce((sum, l) => sum + (l.rating ?? 4.9), 0) / shopListings.length
        ).toFixed(1)
      : '4.9';
  const coverImage =
    activeProvider.coverImageUrl ||
    shopListings[0]?.imageUrl ||
    '/images/sport-complex-aerial.jpg';
  const representativeListing = shopListings[0] ?? listings[0];
  const verifiedReviews = buildVerifiedReviews(
    activeProvider.providerName,
    shopListings[0]?.sportName ?? 'Thể thao'
  );

  const initials = activeProvider.providerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const handleCopyVoucher = () => {
    const code = `ARENA-${activeProvider.providerId.replace('PROV_', '')}`;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedVoucher(true);
    window.setTimeout(() => setCopiedVoucher(false), 1800);
  };

  const handleCopyProfileLink = () => {
    const url = `${window.location.origin}/lessor/${encodeURIComponent(activeProvider.providerId)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedProfileLink(true);
    window.setTimeout(() => setCopiedProfileLink(false), 1800);
  };

  return (
    <section className="bg-[#F5F7F6] pb-20 pt-8 sm:pt-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-6">
        {/* ================================================================= */}
        {/* CLEAN BREADCRUMB BAR (SINGLE LESSOR PROFILE — NO COMPETING SHOPS) */}
        {/* ================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-neutral-500 min-w-0">
            <button
              type="button"
              onClick={onBackToCourts}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 font-semibold text-[#0F172A] shadow-2xs hover:border-[#16422C] hover:text-[#16422C] transition-colors"
            >
              ← Quay lại Thuê sân
            </button>
            <span className="hidden sm:inline text-neutral-300">/</span>
            <span className="hidden sm:inline">Hồ sơ Bên cho thuê</span>
            <span className="hidden sm:inline text-neutral-300">/</span>
            <strong className="truncate text-[#0F172A]">{activeProvider.providerName}</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#E7F7D4] px-3 py-1 text-[11px] font-semibold text-[#204E18]">
              <span>✓</span>
              <span>Đã thẩm định KYC 7 tiêu chuẩn</span>
            </span>
            <button
              type="button"
              onClick={handleCopyProfileLink}
              className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-neutral-700 hover:border-[#16422C] hover:text-[#16422C] transition-colors"
            >
              {copiedProfileLink ? 'Đã sao chép link ✓' : 'Chia sẻ hồ sơ'}
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* REDESIGNED LUXURY LESSOR PROFILE HERO + TELEMETRY STRIP           */}
        {/* ================================================================= */}
        <motion.div
          key={activeProvider.providerId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: EXPO_EASE }}
          className="overflow-hidden rounded-[28px] border border-neutral-200/90 bg-white shadow-[0_18px_46px_rgba(15,23,42,0.06)]"
        >
          {/* Panoramic Cover Banner */}
          <div className="relative overflow-hidden px-6 pt-8 pb-7 sm:px-8 sm:pt-10 sm:pb-8 text-white">
            <img
              src={coverImage}
              alt={activeProvider.providerName}
              className="absolute inset-0 h-full w-full object-cover scale-105"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#081A12]/95 via-[#0F2C1E]/88 to-[#0F172A]/82"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(231,247,212,0.16),transparent_55%)]"
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              {/* Left Identity Block */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
                <div className="relative shrink-0 self-start sm:self-auto">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border-2 border-[#E7F7D4]/45 bg-[#16422C] text-2xl font-bold tracking-tight text-[#E7F7D4] shadow-xl">
                    {initials}
                  </div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#D9532F] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ring-2 ring-[#0B2217]">
                    Yêu Thích+
                  </span>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-semibold text-[#E7F7D4] backdrop-blur-xs">
                      {activeProvider.badge}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 border border-emerald-400/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {activeProvider.onlineStatusLabel ?? 'Đang hoạt động'}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.02em] leading-tight text-white">
                    {activeProvider.providerName}
                  </h1>

                  <p className="max-w-2xl text-xs sm:text-[13px] leading-relaxed text-white/80">
                    {activeProvider.shopSlogan ??
                      'Đối tác vận hành cụm sân chuẩn thi đấu, đặt cọc ký quỹ an toàn & check-in QR 1 chạm.'}{' '}
                    <span className="text-[#E7F7D4] font-medium">
                      • {activeProvider.district}, {activeProvider.city}
                    </span>
                  </p>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleFollowProvider(activeProvider.providerId)}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-xs font-semibold transition-all ${
                    isFollowed
                      ? 'border-[#E7F7D4] bg-[#E7F7D4] text-[#0B2217] shadow-sm'
                      : 'border-white/40 bg-white/10 text-white backdrop-blur-xs hover:bg-white/20'
                  }`}
                >
                  <span>{isFollowed ? '✓ Đang theo dõi' : '+ Theo dõi chủ sân'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenLessorChat(activeProvider.providerId, representativeListing)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#0F172A] shadow-md hover:bg-[#E7F7D4] hover:text-[#0B2217] transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h8M8 14h5m8-2a9 9 0 11-16.24 5.36L3 20l1.64-3.76A9 9 0 0121 12z"
                    />
                  </svg>
                  <span>Chat ngay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Structured 6-Metric Profile Strip (Zero awkward line-wrap) */}
          <div className="grid grid-cols-2 gap-px bg-neutral-200/75 sm:grid-cols-3 lg:grid-cols-6 border-b border-neutral-200/80">
            {[
              {
                label: 'Quy mô vận hành',
                value: `${activeProvider.totalManagedCourts} sân`,
                sub: `${shopListings.length} cụm mở đặt`,
                tone: 'text-[#16422C]',
              },
              {
                label: 'Người theo dõi',
                value: formatCompactCount(followersDisplay),
                sub: isFollowed ? 'Bạn đang theo dõi' : 'Hội viên quan tâm',
                tone: 'text-[#0F172A]',
              },
              {
                label: 'Đánh giá thực tế',
                value: `★ ${avgRating}`,
                sub: `${formatCompactCount(totalReviews)} lượt check-in`,
                tone: 'text-amber-600',
              },
              {
                label: 'Phản hồi chat',
                value: `${activeProvider.responseRatePct}%`,
                sub: activeProvider.responseTimeLabel,
                tone: 'text-[#16422C]',
              },
              {
                label: 'Thâm niên đối tác',
                value: `${activeProvider.yearsPartner} năm`,
                sub: activeProvider.joinedLabel ?? 'Đối tác lâu năm',
                tone: 'text-[#0F172A]',
              },
              {
                label: 'Chiết khấu sàn',
                value: `${activeProvider.commissionRatePct}% / đơn`,
                sub: 'Miễn phí 0₫ người thuê',
                tone: 'text-[#0E4F7E]',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white px-4 py-4">
                <div className="text-[11px] font-medium text-neutral-400">{stat.label}</div>
                <div className={`mt-1 tabular-nums text-[15px] font-bold ${stat.tone}`}>
                  {stat.value}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-neutral-500">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Partner Voucher & Escrow Ticket Row */}
          <div className="flex flex-col gap-3 bg-[#F8FAF8] px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/75">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="rounded-md bg-[#D9532F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Ưu đãi độc quyền
              </span>
              <strong className="text-[#0F172A]">
                {activeProvider.voucherLabel ?? 'Ưu đãi đặt cọc qua ArenaPulse'}
              </strong>
              <span className="hidden md:inline text-neutral-400">•</span>
              <span className="hidden md:inline text-neutral-600">
                Pháp nhân: <strong className="text-[#0E4F7E]">{activeProvider.legalEntityType ?? 'Đã xác thực KYC'}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyVoucher}
              className="self-start sm:self-auto shrink-0 rounded-full border border-[#16422C] bg-white px-4 py-1.5 text-[11.5px] font-semibold text-[#16422C] hover:bg-[#16422C] hover:text-[#E7F7D4] transition-colors"
            >
              {copiedVoucher ? 'Đã lưu mã ưu đãi ✓' : 'Lưu mã ưu đãi'}
            </button>
          </div>

          {/* Storefront Tabs & In-Profile Search Bar */}
          <div className="flex flex-col gap-3 bg-white px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'OVERVIEW', label: 'Tổng quan Gian hàng' },
                { id: 'ALL_COURTS', label: `Tất cả Cụm sân (${shopListings.length})` },
                ...shopSportCategories.map((sp) => ({ id: sp.code, label: sp.name })),
                { id: 'LEGAL_REVIEWS', label: 'Hồ sơ Pháp lý & Đánh giá' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative shrink-0 px-4 py-4 text-xs sm:text-[13px] font-semibold transition-colors ${
                      active ? 'text-[#16422C]' : 'text-neutral-500 hover:text-[#0F172A]'
                    }`}
                  >
                    {tab.label}
                    {active && (
                      <motion.span
                        layoutId="lessor-profile-tab-indicator"
                        className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-[#16422C]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab !== 'LEGAL_REVIEWS' && (
              <div className="flex flex-wrap items-center gap-2 pb-3.5 lg:pb-0">
                <input
                  type="search"
                  value={shopSearchQuery}
                  onChange={(e) => setShopSearchQuery(e.target.value)}
                  placeholder="Tìm cụm sân của chủ sân này..."
                  aria-label="Tìm cụm sân trong hồ sơ chủ sân"
                  className="w-full sm:w-56 rounded-full border border-neutral-200 bg-[#F8F9FA] px-3.5 py-1.5 text-xs text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                />
                <PillSelect
                  variant="pill"
                  menuAlign="right"
                  ariaLabel="Sắp xếp cụm sân"
                  value={shopSort}
                  onChange={(v) => setShopSort(v as ShopSortId)}
                  options={[
                    { value: 'POPULAR', label: 'Phổ biến' },
                    { value: 'PRICE_ASC', label: 'Giá thấp → cao' },
                    { value: 'AVAILABILITY', label: 'Nhiều sân trống' },
                    { value: 'RATING_DESC', label: 'Đánh giá cao nhất' },
                  ]}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* ================================================================= */}
        {/* BODY: LEGAL PROFILE & REVIEWS OR COURT STOREFRONT INVENTORY       */}
        {/* ================================================================= */}
        {activeTab === 'LEGAL_REVIEWS' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 7 Cols: Legal Profile & Verified Reviews */}
            <div className="lg:col-span-7 space-y-6">
              <ScrollReveal className="rounded-[24px] border border-neutral-200/90 bg-white p-6 shadow-2xs space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                  Hồ sơ Định danh Pháp lý &amp; Cam kết Vận hành
                </div>
                <h2 className="text-xl font-bold text-[#0F172A]">
                  {activeProvider.providerName}
                </h2>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {activeProvider.platformGuarantee}
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs pt-2">
                  <div className="rounded-2xl bg-[#F8FAFC] p-4 border border-neutral-200/70">
                    <div className="text-neutral-400">Pháp nhân xác thực KYC</div>
                    <div className="mt-1 font-semibold text-[#0F172A]">
                      {activeProvider.legalEntityType ?? 'Đã xác thực hợp lệ'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#F8FAFC] p-4 border border-neutral-200/70">
                    <div className="text-neutral-400">Khu vực quản lý</div>
                    <div className="mt-1 font-semibold text-[#0F172A]">
                      {activeProvider.district}, {activeProvider.city}
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal className="rounded-[24px] border border-neutral-200/90 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Đánh giá từ Người chơi đã Check-in QR
                  </h3>
                  <span className="tabular-nums text-xs font-bold text-amber-600">
                    ★ {avgRating} / 5.0
                  </span>
                </div>

                <div className="divide-y divide-neutral-100">
                  {verifiedReviews.map((rev) => (
                    <div key={rev.id} className="py-4 first:pt-1 last:pb-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F172A]">{rev.playerName}</span>
                          <span className="rounded-full bg-[#F4F8F4] px-2 py-0.5 text-[10px] font-semibold text-[#16422C]">
                            {rev.sportTag}
                          </span>
                        </div>
                        <span className="tabular-nums font-bold text-amber-600">
                          ★ {rev.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                        {rev.comment}
                      </p>
                      <div className="mt-1.5 text-[10.5px] text-neutral-400">{rev.dateLabel}</div>
                    </div>
                  ))}
                </div>
              </ScrollReveal>
            </div>

            {/* Right 5 Cols: Frozen Deposit Refund Tiers */}
            <ScrollReveal
              delay={0.06}
              className="lg:col-span-5 rounded-[24px] border border-neutral-200/90 bg-white p-6 shadow-2xs h-fit space-y-4"
            >
              <h3 className="text-base font-bold text-[#0F172A]">
                Chính sách Hoàn cọc Ký quỹ Tự động
              </h3>
              <p className="text-xs leading-relaxed text-neutral-500">
                Áp dụng thống nhất cho toàn bộ cụm sân thuộc {activeProvider.providerName} dưới sự
                bảo lãnh của sàn trung gian ArenaPulse.
              </p>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-[#F4F8F4] px-4 py-3">
                  <span className="font-medium text-[#0F172A]">Hủy trước giờ chơi ≥ 11 giờ</span>
                  <strong className="text-[#16422C]">Hoàn 100% cọc</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#F4F8FB] px-4 py-3">
                  <span className="font-medium text-[#0F172A]">Hủy từ 4 giờ đến dưới 11 giờ</span>
                  <strong className="text-[#0E4F7E]">Hoàn 50% cọc</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                  <span className="font-medium text-[#0F172A]">Mưa bão / Chủ sân hủy lịch</span>
                  <strong className="text-amber-800">Hoàn 100% tức thì</strong>
                </div>
              </div>
              <ActionButton
                variant="forest"
                size="md"
                className="w-full"
                onClick={() =>
                  onOpenLessorChat(activeProvider.providerId, representativeListing)
                }
              >
                💬 Nhắn tin trực tiếp với Chủ sân
              </ActionButton>
            </ScrollReveal>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Highlight Trust Pillars on Overview Tab */}
            {activeTab === 'OVERVIEW' && (
              <ScrollReveal className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    title: 'Bảo lãnh Ký quỹ 100%',
                    desc: 'Hoàn cọc tức thì nếu thời tiết mưa bão hoặc sự cố mặt sân.',
                  },
                  {
                    title: 'Check-in Vé QR 1 Chạm',
                    desc: 'Xác thực vào sân trực tiếp tại cổng, không cần đặt cọc ngoài.',
                  },
                  {
                    title: 'Hóa đơn VAT & Đối soát chuẩn',
                    desc: 'Hỗ trợ xuất hóa đơn điện tử cho CLB, công ty đặt lịch định kỳ.',
                  },
                ].map((pillar) => (
                  <div
                    key={pillar.title}
                    className="rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 shadow-2xs"
                  >
                    <div className="text-xs font-bold text-[#16422C]">{pillar.title}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
                      {pillar.desc}
                    </p>
                  </div>
                ))}
              </ScrollReveal>
            )}

            {/* Section Heading */}
            <ScrollReveal className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#0F172A]">
                  {activeTab === 'OVERVIEW'
                    ? `Các Cụm Sân Đang Mở Đặt Tại ${activeProvider.providerName}`
                    : 'Danh Sách Cụm Sân Thuộc Đối Tác'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Nhấn vào từng cụm sân để chọn khung giờ chi tiết, khóa giá 10 phút hoặc nhắn hỏi
                  chủ sân trực tiếp.
                </p>
              </div>
              {activeTab === 'OVERVIEW' && shopListings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL_COURTS')}
                  className="text-xs font-semibold text-[#16422C] hover:underline shrink-0"
                >
                  Xem Tất Cả ({shopListings.length}) &gt;
                </button>
              )}
            </ScrollReveal>

            {/* Court Cards Grid */}
            {filteredShopListings.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white py-14 text-center">
                <p className="text-sm text-neutral-500">
                  Không tìm thấy cụm sân nào khớp từ khóa tại hồ sơ này.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShopSearchQuery('');
                    setActiveTab('ALL_COURTS');
                  }}
                  className="mt-3 text-xs font-semibold text-[#16422C] hover:underline"
                >
                  Hiển thị toàn bộ cụm sân →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredShopListings.map((listing, idx) => {
                  const maxAvailable = Math.max(
                    0,
                    ...listing.upcomingSlots.map((s) => s.availableCourts)
                  );
                  const nextOpenSlot =
                    listing.upcomingSlots.find((s) => s.availableCourts > 0) ??
                    listing.upcomingSlots[0];
                  return (
                    <ScrollReveal
                      key={listing.groupId}
                      delay={Math.min(idx * 0.05, 0.2)}
                      className="group flex flex-col justify-between overflow-hidden rounded-[22px] border border-neutral-200/85 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#16422C]/60 hover:shadow-[0_18px_42px_rgba(22,66,44,0.1)]"
                    >
                      <div>
                        <div
                          onClick={() => onSelectCourtFromShop(listing)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onSelectCourtFromShop(listing);
                            }
                          }}
                          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden bg-neutral-100"
                        >
                          <img
                            src={listing.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                            alt={listing.groupName}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute left-3 top-3 flex items-center gap-1.5">
                            <span className="rounded-md bg-[#D9532F] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              Yêu thích
                            </span>
                            <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#0F172A]">
                              {listing.sportName}
                            </span>
                          </div>

                          <span
                            className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 tabular-nums text-[10.5px] font-semibold ${
                              maxAvailable > 0
                                ? 'bg-[#16422C] text-[#E7F7D4]'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {maxAvailable > 0 ? `Còn ${maxAvailable} sân` : 'Kín ca'}
                          </span>

                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3.5 pb-2.5 pt-6 text-[10.5px] text-white">
                            <span className="rounded bg-[#E7F7D4] px-2 py-0.5 font-semibold text-[#16422C]">
                              Cọc {listing.depositPercent}%
                            </span>
                            <span className="font-medium">{listing.slotMinutes} phút/ca</span>
                          </div>
                        </div>

                        <div className="p-4">
                          <button
                            type="button"
                            onClick={() => onSelectCourtFromShop(listing)}
                            className="line-clamp-2 text-left text-[15px] font-semibold leading-snug text-[#0F172A] hover:text-[#16422C]"
                          >
                            {listing.groupName}
                          </button>

                          <div className="mt-2 flex items-baseline justify-between gap-2">
                            <div className="tabular-nums text-[16px] font-bold text-[#D9532F]">
                              {formatVnd(listing.minPrice)}
                              <span className="text-[11px] font-normal text-neutral-400">
                                {' '}
                                – {formatVnd(listing.maxPrice)}
                              </span>
                            </div>
                            <span className="tabular-nums text-xs font-semibold text-amber-600">
                              ★ {(listing.rating ?? 4.9).toFixed(1)}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {listing.venueAddress}
                          </p>

                          {nextOpenSlot && (
                            <div className="mt-3 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-[#F8F9FA] px-3 py-2 text-xs">
                              <span className="tabular-nums font-medium text-[#0F172A]">
                                Ca gần: {formatSlotWindow(nextOpenSlot.slotStart, nextOpenSlot.slotEnd)}
                              </span>
                              <span className="tabular-nums font-bold text-[#16422C]">
                                {formatVnd(nextOpenSlot.currentDynamicPrice)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 border-t border-neutral-100 bg-[#FAFAFA] text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => onOpenLessorChat(activeProvider.providerId, listing)}
                          className="border-r border-neutral-100 py-3 text-neutral-600 hover:bg-white hover:text-[#16422C] transition-colors"
                        >
                          💬 Hỏi ca này
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCourtFromShop(listing, nextOpenSlot?.slotStart)}
                          className="py-3 text-[#16422C] hover:bg-[#E7F7D4]/50 transition-colors"
                        >
                          Đặt lịch →
                        </button>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
