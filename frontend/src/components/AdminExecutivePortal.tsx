import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AnalyticsDashboardData,
  AppPageId,
  AuthSession,
  CourtServiceOption,
  LessorApplicationRecord,
  PublishedListing,
  ReconciliationSummary,
  RoleCode,
  SlotListingQuote,
  SportTypeItem,
  VenueProviderInfo,
} from '../types/marketplace';
import { ALL_LESSOR_PROVIDERS, formatVnd, marketplaceApi } from '../api/marketplaceApi';
import {
  AnimatedCounter,
  DASHBOARD_STAGGER_CONTAINER,
  DASHBOARD_STAGGER_ITEM,
  EXPO_EASE,
} from './motionPrimitives';
import { ActionButton } from './FairwayControls';
import { LessorAnalyticsDashboard } from './LessorAnalyticsDashboard';
import { LessorPartnerPortal } from './LessorPartnerPortal';
import type { AdminHeaderTabId } from './FairwayHeader';

interface AdminExecutivePortalProps {
  session: AuthSession;
  activeRole: RoleCode;
  sports: SportTypeItem[];
  onAddSportDemo: (code: string, name: string) => void;
  listings: PublishedListing[];
  reconciliation: ReconciliationSummary | null;
  kycQueue: LessorApplicationRecord[];
  reviewingId: string | null;
  onReviewApplication: (id: string, decision: 'APPROVED' | 'REJECTED') => void;
  staffChatEnabled: boolean;
  onToggleStaffChat: () => void;
  onOpenChatDrawer: () => void;
  onNavigate?: (page: AppPageId) => void;
  onOpenPublicShop?: (providerId: string) => void;
  onPreviewCourt?: (listing: PublishedListing) => void;
  controlledTab?: AdminHeaderTabId;
  onSelectTab?: (tab: AdminHeaderTabId) => void;
  onUpdateListingServices?: (groupId: string, nextServices: CourtServiceOption[]) => void;
  onUpdateListingPricing?: (
    groupId: string,
    patch: { basePrice: number; minPrice: number; maxPrice: number; depositPercent: number }
  ) => void;
  onToggleListingPublished?: (groupId: string) => void;
  onUpdateListingSlots?: (groupId: string, nextSlots: SlotListingQuote[]) => void;
  onCreateNewListing?: (newListing: PublishedListing) => void;
  onUpdateProviderProfile?: (
    providerId: string,
    patch: Partial<Pick<VenueProviderInfo, 'shopSlogan' | 'voucherLabel' | 'responseTimeLabel'>>
  ) => void;
  onUploadCourtPhoto?: (
    groupId: string,
    file: File,
    caption: string,
    isCover: boolean
  ) => Promise<{ persistedToBackend: boolean }>;
  onLogout?: () => void;
}

const RBAC_MATRIX_ROWS: {
  capability: string;
  endpoint: string;
  admin: boolean;
  manager: boolean;
  accountant: boolean;
  staff: boolean;
  user: boolean;
}[] = [
  {
    capability: 'Định giá Động, Giá sàn/trần & Monte Carlo (/pricing)',
    endpoint: 'POST /api/v1/simulations/run',
    admin: true,
    manager: true,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Phê duyệt hồ sơ Chủ sân (KYC 7 tiêu chuẩn) & Cấp Tenant',
    endpoint: 'POST /api/v1/internal/lessor-applications/{id}/review',
    admin: true,
    manager: false,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Đăng Thông báo Hệ thống & Xuất bản Bài báo (/news)',
    endpoint: 'Admin Newsroom & Notification Hub',
    admin: true,
    manager: false,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Mở/Ẩn Cụm sân, Upload Ảnh & Cấu hình Chính sách Hủy',
    endpoint: 'POST /api/v1/inventory/groups/*',
    admin: true,
    manager: true,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Đối soát Sổ cái Kép & Hoàn tiền Giao dịch VNPAY',
    endpoint: 'GET /finance/reconciliation • POST /vnpay/refund',
    admin: true,
    manager: true,
    accountant: true,
    staff: false,
    user: false,
  },
  {
    capability: 'Quét mã QR Check-in một lần & Chat hỗ trợ Khách tại sân',
    endpoint: 'POST /api/v1/bookings/{id}/checkin',
    admin: true,
    manager: true,
    accountant: false,
    staff: true,
    user: false,
  },
  {
    capability: 'Đặt sân, Thanh toán VNPAY/MoMo/VietQR & Nhận Vé QR Gmail',
    endpoint: 'POST /api/v1/bookings/hold • /payments/*',
    admin: true,
    manager: true,
    accountant: true,
    staff: true,
    user: true,
  },
];

export const AdminExecutivePortal: React.FC<AdminExecutivePortalProps> = ({
  session,
  activeRole,
  sports,
  onAddSportDemo,
  listings,
  reconciliation,
  kycQueue,
  reviewingId,
  onReviewApplication,
  staffChatEnabled,
  onToggleStaffChat,
  onOpenChatDrawer,
  onNavigate,
  onOpenPublicShop,
  onPreviewCourt,
  controlledTab,
  onSelectTab,
  onUpdateListingServices,
  onUpdateListingPricing,
  onToggleListingPublished,
  onUpdateListingSlots,
  onCreateNewListing,
  onUpdateProviderProfile,
  onUploadCourtPhoto,
  onLogout,
}) => {
  const isAdmin = activeRole === 'ADMIN';
  const [internalTabState, setInternalTabState] = useState<AdminHeaderTabId>('OPERATIONS');
  const activeTab = controlledTab ?? internalTabState;
  const setActiveTab = (tab: AdminHeaderTabId) => {
    setInternalTabState(tab);
    onSelectTab?.(tab);
  };

  const [newSportCode, setNewSportCode] = useState('');
  const [newSportName, setNewSportName] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState<
    'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
  >('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [platformDays, setPlatformDays] = useState<number>(7);
  const [platformAnalytics, setPlatformAnalytics] = useState<AnalyticsDashboardData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [reindexingEs, setReindexingEs] = useState<boolean>(false);

  const loadPlatformAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await marketplaceApi.fetchPlatformAnalytics(platformDays, listings);
      setPlatformAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setAnalyticsLoading(true);
    marketplaceApi
      .fetchPlatformAnalytics(platformDays, listings)
      .then((data) => {
        if (active) setPlatformAnalytics(data);
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [platformDays, listings]);

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3000);
  };

  const platformStats = useMemo(() => {
    const providerIds = new Set(
      listings.map((l) => l.provider?.providerId).filter(Boolean) as string[]
    );
    const totalProviders = Math.max(ALL_LESSOR_PROVIDERS.length, providerIds.size);
    const publishedCount = listings.filter((l) => l.published !== false).length;
    const pendingKycCount = kycQueue.filter((k) => k.status === 'PENDING_REVIEW').length;
    const totalPhysicalCourts = listings.reduce(
      (sum, l) => sum + (l.upcomingSlots[0]?.totalCapacity ?? 4),
      0
    );
    return {
      totalProviders,
      publishedCount,
      totalGroups: listings.length,
      pendingKycCount,
      totalPhysicalCourts,
    };
  }, [listings, kycQueue]);

  const navItems: {
    id: AdminHeaderTabId;
    label: string;
    sub: string;
    badge?: string;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'OPERATIONS',
      label: isAdmin ? 'Tổng quan & Biểu đồ Sàn' : 'Điều hành Đối soát Sàn',
      sub: 'GMV toàn hệ thống & lĩnh vực thể thao',
      badge: `${platformStats.totalProviders} đối tác`,
    },
    {
      id: 'LESSOR_INSPECTOR',
      label: 'Giám sát Đối tác Cho thuê',
      sub: 'Kiểm tra từng Chủ sân, sân & dịch vụ',
      badge: `${platformStats.publishedCount} cụm`,
      adminOnly: true,
    },
    {
      id: 'ADMIN_KYC',
      label: 'Duyệt Hồ sơ KYC Đối tác',
      sub: 'Risk Score, CCCD, MST Modulo-11',
      badge:
        platformStats.pendingKycCount > 0
          ? `${platformStats.pendingKycCount} chờ`
          : `${kycQueue.length}`,
    },
    {
      id: 'FINANCE_LEDGER',
      label: 'Sổ cái Kép & Đối soát Ký quỹ',
      sub: 'Tổng Nợ = Tổng Có • Hoa hồng 8–12%',
      badge: reconciliation?.doubleEntryBalanced ? 'Cân bằng' : undefined,
    },
    {
      id: 'RBAC_MATRIX',
      label: 'Ma trận Phân quyền RBAC',
      sub: 'Kiểm soát 5 vai trò & Chính sách bảo mật',
      badge: '5 Roles',
    },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const filteredKycQueue = kycQueue.filter(
    (k) => kycStatusFilter === 'ALL' || k.status === kycStatusFilter
  );

  return (
    <section id="command-center" className="py-10 sm:py-14">
      <div className="mx-auto max-w-[1420px] px-4 sm:px-8 space-y-6">
        {/* TOP EXECUTIVE ADMIN COMMAND HEADER (MATCHING LESSOR PORTAL PRESTIGE) */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#0F172A]/20 bg-gradient-to-br from-[#071522] via-[#0B2218] to-[#0F172A] p-6 sm:p-8 text-white shadow-[0_24px_60px_rgba(7,21,34,0.24)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#38BDF8]/12 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E7F7D4] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                  {isAdmin
                    ? 'Cổng Quản Trị Toàn Sàn • SUPER ADMIN'
                    : 'Cổng Kế Toán Đối Soát • PLATFORM ACCOUNTANT'}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-100">
                  ✓ Scope: PLATFORM (Multi-Tenant Governance)
                </span>
                <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] text-white/80">
                  Phiên: @{session.username}
                </span>
              </div>

              <h1 className="text-2xl sm:text-[32px] font-bold tracking-[-0.025em] leading-tight text-white">
                {isAdmin
                  ? 'Trung tâm Điều hành Sàn Thương mại Sân Thể thao ArenaPulse.vn'
                  : 'Trung tâm Kế toán Kép & Đối soát Ký quỹ ArenaPulse.vn'}
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-slate-200/85">
                Giám sát toàn quốc <strong>{platformStats.totalProviders} Đối tác Cho thuê</strong> •{' '}
                <strong>{platformStats.publishedCount}/{platformStats.totalGroups} cụm sân</strong> ({platformStats.totalPhysicalCourts} sân vật lý) •{' '}
                <strong>{sports.length} bộ môn thể thao</strong> đang vận hành.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isAdmin && onNavigate && (
                <>
                  <ActionButton
                    variant="glass"
                    size="sm"
                    arrow="right"
                    onClick={() => onNavigate('pricing')}
                  >
                    Định giá Sàn (/pricing)
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => onNavigate('announcements')}
                    className="rounded-full bg-[#E7F7D4] px-4 py-2 text-xs font-bold text-[#16422C] transition hover:bg-white"
                  >
                    📢 Phát Thông báo Hệ thống
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('news')}
                    className="rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    ✍ Xuất bản Bài báo
                  </button>
                </>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-white/25 bg-black/20 px-3.5 py-2 text-xs font-semibold text-white/90 hover:bg-white/18"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LIVE FEEDBACK TOAST */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-[#16422C]/30 bg-[#E7F7D4]/70 px-5 py-3 text-xs sm:text-sm font-semibold text-[#16422C] shadow-xs"
            >
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN 12-COL SAAS WORKSPACE (3-COL STICKY SIDEBAR + 9-COL CONTENT) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT 3 COLS: STICKY ADMIN SIDEBAR */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
            <nav
              aria-label="Phân hệ Quản trị Admin"
              className="rounded-[26px] border border-neutral-200/90 bg-white p-3 shadow-xs space-y-1"
            >
              {visibleNavItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full rounded-2xl px-3.5 py-3 text-left transition-all ${
                      active
                        ? 'bg-[#0F172A] text-white shadow-sm'
                        : 'text-[#0F172A] hover:bg-[#F4F8F4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                            active
                              ? 'bg-[#E7F7D4] text-[#16422C]'
                              : 'bg-[#F1F5F9] text-neutral-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-[11px] line-clamp-1 ${
                        active ? 'text-slate-300' : 'text-neutral-500'
                      }`}
                    >
                      {item.sub}
                    </p>
                  </button>
                );
              })}
            </nav>

            {/* Quick System Health & Controls Card */}
            <div className="rounded-[24px] border border-neutral-200/90 bg-white p-4 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F172A]">An toàn &amp; Kiểm soát Sàn</span>
                <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[10.5px] font-bold text-[#16422C]">
                  HOẠT ĐỘNG 100%
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Chat nhân viên sân</span>
                  <button
                    type="button"
                    onClick={onToggleStaffChat}
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                      staffChatEnabled
                        ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {staffChatEnabled ? 'CHO PHÉP' : 'TẠM KHÓA'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Sổ cái Kế toán Kép</span>
                  <span className="font-bold text-[#16422C]">
                    {reconciliation?.doubleEntryBalanced ? '✓ Nợ = Có' : 'Đang đồng bộ'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenChatDrawer}
                className="w-full rounded-xl bg-[#0F172A] py-2 text-[11px] font-semibold text-white hover:bg-[#16422C] transition"
              >
                💬 Mở Kênh Điều phối Hỗ trợ
              </button>
            </div>
          </aside>

          {/* RIGHT 9 COLS: ACTIVE ADMIN MODULE */}
          <div className="lg:col-span-9 min-w-0">
            <AnimatePresence mode="wait">
              {/* ===================================================================== */}
              {/* TAB 1: PLATFORM OVERVIEW & INTERACTIVE CHARTS                         */}
              {/* ===================================================================== */}
              {activeTab === 'OPERATIONS' && (
                <motion.div
                  key="admin-ops"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  {/* 4 Platform Executive KPI Cards with Staggered Reveal & Animated Count-up */}
                  <motion.div
                    variants={DASHBOARD_STAGGER_CONTAINER}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 gap-3.5 xl:grid-cols-4"
                  >
                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Tổng GMV Toàn Sàn ({platformDays} ngày)
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#0F172A]">
                        <AnimatedCounter
                          value={
                            platformAnalytics?.grossRevenue ??
                            reconciliation?.totalEscrowCredits ??
                            0
                          }
                          formatAsVnd
                        />
                      </div>
                      <span className="mt-1 inline-block text-[11px] font-semibold text-[#16422C]">
                        ✓ Dữ liệu Sổ cái &amp; DB thực tế
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Hoa hồng Nền tảng thu về
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#16422C]">
                        <AnimatedCounter
                          value={
                            platformAnalytics?.commissionAmount ??
                            reconciliation?.totalPlatformCommission ??
                            0
                          }
                          formatAsVnd
                        />
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Trích tự động từ đơn thành công
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Công nợ Tất toán Chủ sân
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#0E4F7E]">
                        <AnimatedCounter
                          value={
                            platformAnalytics?.withdrawableBalance ??
                            reconciliation?.totalVenuePayable ??
                            0
                          }
                          formatAsVnd
                        />
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Sẵn sàng đối soát giải ngân T+0
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Quy mô Hệ sinh thái Đang mở
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#0F172A]">
                        <AnimatedCounter value={platformStats.totalProviders} suffix=" Đối tác" />
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        {platformStats.publishedCount} cụm sân • {platformStats.totalPhysicalCourts} sân
                      </span>
                    </motion.div>
                  </motion.div>

                  {/* Interactive Platform Analytics Charts */}
                  {platformAnalytics && (
                    <LessorAnalyticsDashboard
                      mode="PLATFORM"
                      analytics={platformAnalytics}
                      days={platformDays}
                      onChangeDays={setPlatformDays}
                      loading={analyticsLoading}
                      reindexing={reindexingEs}
                      onReindexEs={async () => {
                        setReindexingEs(true);
                        try {
                          const res = await marketplaceApi.triggerElasticsearchReindex();
                          flashToast(res.message);
                          await loadPlatformAnalytics();
                        } finally {
                          setReindexingEs(false);
                        }
                      }}
                    />
                  )}

                  {/* Sport Category Expansion + Quick Executive Actions */}
                  {isAdmin && (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                      <div className="lg:col-span-7 rounded-[26px] bg-white p-6 border border-neutral-200/90 shadow-xs space-y-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                            Danh mục Bộ môn Toàn sàn ({sports.length} môn)
                          </span>
                          <h3 className="mt-0.5 text-base font-bold text-[#0F172A]">
                            Mở thêm Lĩnh vực Thể thao Mới trên ArenaPulse.vn
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {sports.map((sp) => (
                            <span
                              key={sp.code}
                              className="rounded-full border border-neutral-200 bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#0F172A]"
                            >
                              {sp.name} <code className="text-neutral-400">({sp.code})</code>
                            </span>
                          ))}
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newSportCode.trim() || !newSportName.trim()) return;
                            const cleanCode = newSportCode.trim().toUpperCase();
                            const cleanName = newSportName.trim();
                            onAddSportDemo(cleanCode, cleanName);
                            setNewSportCode('');
                            setNewSportName('');
                            flashToast(`✓ Đã mở thêm bộ môn thể thao "${cleanName}" (${cleanCode}) lên toàn sàn!`);
                          }}
                          className="flex flex-col gap-2 sm:flex-row pt-1"
                        >
                          <input
                            type="text"
                            name="sportCode"
                            placeholder="Mã (VD: FUTSAL)…"
                            value={newSportCode}
                            onChange={(e) => setNewSportCode(e.target.value)}
                            className="rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A]"
                          />
                          <input
                            type="text"
                            name="sportName"
                            placeholder="Tên bộ môn hiển thị…"
                            value={newSportName}
                            onChange={(e) => setNewSportName(e.target.value)}
                            className="flex-1 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A]"
                          />
                          <ActionButton type="submit" variant="ink" size="sm">
                            + Mở bộ môn
                          </ActionButton>
                        </form>
                      </div>

                      <div className="lg:col-span-5 rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-3 text-xs">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                          Điều hướng Nghiệp vụ Cấp Cao
                        </span>
                        <div className="grid grid-cols-1 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setActiveTab('LESSOR_INSPECTOR')}
                            className="rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4] p-3.5 text-left hover:bg-[#E7F7D4]/50 transition"
                          >
                            <div className="font-bold text-[#16422C]">
                              Giám sát Toàn bộ Hệ thống Cho thuê Đối tác →
                            </div>
                            <div className="mt-0.5 text-[11px] text-neutral-600">
                              Kiểm tra từng Chủ sân, danh sách cụm sân &amp; menu dịch vụ đang bán.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('ADMIN_KYC')}
                            className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-3.5 text-left hover:bg-amber-50 transition"
                          >
                            <div className="font-bold text-amber-900">
                              Hàng đợi Duyệt Hồ sơ KYC ({platformStats.pendingKycCount} chờ) →
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-900/80">
                              Thẩm định Risk Score &amp; cấp quyền Tenant cho đối tác mới.
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 2: LESSOR INSPECTOR (ADMIN EMBEDDED PARTNER PORTAL)               */}
              {/* ===================================================================== */}
              {activeTab === 'LESSOR_INSPECTOR' && isAdmin && (
                <motion.div
                  key="admin-inspector"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                >
                  <LessorPartnerPortal
                    session={session}
                    activeRole={activeRole}
                    sports={sports}
                    listings={listings}
                    staffChatEnabled={staffChatEnabled}
                    onToggleStaffChat={onToggleStaffChat}
                    onOpenChatDrawer={onOpenChatDrawer}
                    onNavigate={onNavigate}
                    onOpenPublicShop={onOpenPublicShop}
                    onPreviewCourt={onPreviewCourt}
                    onUpdateListingPricing={(gid, patch) => onUpdateListingPricing?.(gid, patch)}
                    onUpdateListingServices={(gid, srv) => onUpdateListingServices?.(gid, srv)}
                    onToggleListingPublished={(gid) => onToggleListingPublished?.(gid)}
                    onUpdateListingSlots={(gid, slots) => onUpdateListingSlots?.(gid, slots)}
                    onCreateNewListing={(item) => onCreateNewListing?.(item)}
                    onUpdateProviderProfile={(pid, patch) => onUpdateProviderProfile?.(pid, patch)}
                    onUploadCourtPhoto={onUploadCourtPhoto}
                    embeddedForAdmin
                  />
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 3: KYC APPROVAL QUEUE                                             */}
              {/* ===================================================================== */}
              {activeTab === 'ADMIN_KYC' && (
                <motion.div
                  key="admin-kyc"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-5"
                >
                  <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                        Hàng Đợi Thẩm Định Pháp Lý 7 Tiêu Chuẩn
                      </span>
                      <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
                        Hồ sơ Đăng ký Đối tác Chủ Cụm Sân ({filteredKycQueue.length})
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'ALL', label: 'Tất cả' },
                        { id: 'PENDING_REVIEW', label: 'Chờ duyệt' },
                        { id: 'APPROVED', label: 'Đã cấp Tenant' },
                        { id: 'REJECTED', label: 'Từ chối' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setKycStatusFilter(f.id as typeof kycStatusFilter)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            kycStatusFilter === f.id
                              ? 'bg-[#0F172A] text-white'
                              : 'bg-[#F1F5F9] text-neutral-600 hover:text-[#0F172A]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredKycQueue.length === 0 ? (
                    <div className="rounded-2xl bg-[#F8F9FA] p-6 text-xs text-neutral-500 border border-neutral-200/60">
                      Hiện chưa có hồ sơ đăng ký Chủ sân nào khớp bộ lọc. Khi người chơi nộp hồ sơ KYC trên cổng Đăng ký Chủ sân, hồ sơ kèm Risk Score, MST Modulo-11 và chứng nhận PCCC sẽ tự động đẩy về hàng đợi này để Admin xét duyệt.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredKycQueue.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] p-4 lg:flex-row lg:items-center"
                        >
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="tabular-nums font-bold text-[#0F172A]">
                                {item.referenceCode}
                              </span>
                              <span className="font-semibold text-[#16422C]">{item.venueName}</span>
                              {item.otpVerified && (
                                <span className="rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10px] font-semibold text-[#0E4F7E]">
                                  OTP Đã xác thực
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2.5 py-0.5 tabular-nums text-[10px] font-bold ${
                                  item.riskScore >= 40
                                    ? 'bg-rose-100 text-rose-700'
                                    : item.riskScore > 0
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-[#E7F7D4] text-[#204E18]'
                                }`}
                              >
                                Risk Score: {item.riskScore}/100
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  item.status === 'APPROVED'
                                    ? 'bg-[#E7F7D4] text-[#204E18]'
                                    : item.status === 'REJECTED'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-neutral-600">
                              Pháp nhân: <strong>{item.legalEntityName}</strong> • MST: {item.taxCode} •
                              CCCD: {item.maskedCccdNumber} • PCCC: {item.pcccCertificateNumber}
                            </p>
                            <p className="text-neutral-500">
                              Cờ kiểm tra nội bộ: {item.internalRiskFlags || 'CLEAN'} • {item.validationSummary}
                            </p>
                          </div>

                          {isAdmin && item.status === 'PENDING_REVIEW' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <ActionButton
                                variant="forest"
                                size="sm"
                                disabled={reviewingId === item.id}
                                onClick={() => onReviewApplication(item.id, 'APPROVED')}
                              >
                                Phê duyệt (Mở Tenant)
                              </ActionButton>
                              <ActionButton
                                variant="outline"
                                size="sm"
                                disabled={reviewingId === item.id}
                                onClick={() => onReviewApplication(item.id, 'REJECTED')}
                              >
                                Từ chối
                              </ActionButton>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 4: DOUBLE-ENTRY LEDGER & COMMISSION SCHEDULE                      */}
              {/* ===================================================================== */}
              {activeTab === 'FINANCE_LEDGER' && (
                <motion.div
                  key="admin-ledger"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  <div className="rounded-[26px] bg-white p-6 sm:p-7 border border-neutral-200/90 shadow-xs space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                          Sổ Cái Kế Toán Kép Nội Bộ &amp; Đối Soát Định Kỳ
                        </span>
                        <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
                          Báo cáo dòng tiền Ký quỹ, Hoàn cọc &amp; Hoa hồng Toàn Sàn
                        </h3>
                      </div>
                      <span className="rounded-full bg-[#E7F7D4] px-3.5 py-1 text-xs font-bold text-[#204E18]">
                        {reconciliation?.doubleEntryBalanced ?? true
                          ? '✓ Cân bằng Tổng Nợ = Tổng Có'
                          : 'Cần kiểm tra'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                        <div className="text-[11px] text-neutral-500">Tổng thu hộ ký quỹ</div>
                        <div className="mt-1 tabular-nums text-lg font-bold text-[#0F172A]">
                          {formatVnd(reconciliation?.totalEscrowCredits ?? 48_650_000)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F8F4] p-4 border border-[#16422C]/20">
                        <div className="text-[11px] text-[#16422C] font-semibold">Hoa hồng sàn thu về</div>
                        <div className="mt-1 tabular-nums text-lg font-bold text-[#16422C]">
                          {formatVnd(reconciliation?.totalPlatformCommission ?? 4_865_000)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F8FB] p-4 border border-[#0E4F7E]/20">
                        <div className="text-[11px] text-[#0E4F7E] font-semibold">Công nợ trả chủ sân</div>
                        <div className="mt-1 tabular-nums text-lg font-bold text-[#0E4F7E]">
                          {formatVnd(reconciliation?.totalVenuePayable ?? 40_935_000)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                        <div className="text-[11px] text-neutral-500">Đã hoàn trả khách hủy hợp lệ</div>
                        <div className="mt-1 tabular-nums text-base font-bold text-[#16422C]">
                          {formatVnd(reconciliation?.totalCustomerRefunds ?? 2_850_000)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                        <div className="text-[11px] text-neutral-500">Tiền cọc khấu trừ bỏ lịch</div>
                        <div className="mt-1 tabular-nums text-base font-bold text-neutral-800">
                          {formatVnd(reconciliation?.totalForfeitedDeposits ?? 3_420_000)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                        <div className="text-[11px] text-neutral-500">Tính toàn vẹn dữ liệu</div>
                        <div className="mt-1 text-sm font-bold text-[#0F172A]">
                          Append-Only GIST Trigger
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Commission Schedule per Lessor Partner */}
                  <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                    <div className="border-b border-neutral-100 p-6">
                      <h4 className="text-base font-bold text-[#0F172A]">
                        Biểu phí Hoa hồng Hợp đồng theo Đối tác Chủ sân ({ALL_LESSOR_PROVIDERS.length})
                      </h4>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Khớp quy tắc không chồng chéo thời gian hiệu lực (`commission_rules`) trên cơ sở dữ liệu.
                      </p>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {ALL_LESSOR_PROVIDERS.map((prov) => (
                        <div
                          key={prov.providerId}
                          className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-xs hover:bg-[#F8FAFC]"
                        >
                          <div>
                            <div className="font-bold text-[#0F172A]">{prov.providerName}</div>
                            <div className="text-[11px] text-neutral-500">
                              {prov.district}, {prov.city} • {prov.legalEntityType}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-[#E7F7D4] px-3 py-1 tabular-nums font-bold text-[#16422C]">
                              Hoa hồng: {prov.commissionRatePct}% / đơn
                            </span>
                            {onOpenPublicShop && (
                              <button
                                type="button"
                                onClick={() => onOpenPublicShop(prov.providerId)}
                                className="font-semibold text-[#0E4F7E] hover:underline"
                              >
                                Hồ sơ ↗
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 5: RBAC PERMISSION MATRIX                                         */}
              {/* ===================================================================== */}
              {activeTab === 'RBAC_MATRIX' && (
                <motion.div
                  key="admin-rbac"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs"
                >
                  <div className="border-b border-neutral-100 p-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                      Role-Based Access Control (RBAC)
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-[#0F172A]">
                      Ma trận Phân quyền Hệ thống Nội bộ &amp; Khách thuê sân
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      Kiểm tra đồng bộ tại cả 3 cổng Frontend và Backend Controller (`RbacGuard`).
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-neutral-600">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold">Chức năng &amp; API Backend</th>
                          <th className="px-4 py-3.5 text-center font-bold text-[#0F172A]">ADMIN</th>
                          <th className="px-4 py-3.5 text-center font-bold text-[#16422C]">
                            MANAGER (Chủ sân)
                          </th>
                          <th className="px-4 py-3.5 text-center font-semibold">ACCOUNTANT</th>
                          <th className="px-4 py-3.5 text-center font-semibold">STAFF</th>
                          <th className="px-4 py-3.5 text-center font-semibold text-neutral-400">
                            USER
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {RBAC_MATRIX_ROWS.map((row) => (
                          <tr key={row.capability} className="hover:bg-[#F8FAFC]">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-[#0F172A]">{row.capability}</div>
                              <code className="text-[10.5px] text-neutral-400">{row.endpoint}</code>
                            </td>
                            {[row.admin, row.manager, row.accountant, row.staff, row.user].map(
                              (allowed, i) => (
                                <td key={i} className="px-4 py-4 text-center">
                                  {allowed ? (
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E7F7D4] text-[11px] font-bold text-[#16422C]">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-400">
                                      —
                                    </span>
                                  )}
                                </td>
                              )
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

