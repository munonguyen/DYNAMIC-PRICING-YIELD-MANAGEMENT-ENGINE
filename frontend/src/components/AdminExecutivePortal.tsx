import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Building2,
  CheckCircle2,
  Database,
  FileEdit,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  AdminAuditLogEntry,
  AdminUserAccount,
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
import { EXPO_EASE } from './motionPrimitives';
import { ActionButton } from './FairwayControls';
import { AdminPlatformDashboard } from './AdminPlatformDashboard';
import { AdminAccountManager } from './AdminAccountManager';
import { VietQrReviewPanel } from './VietQrReviewPanel';
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
  scope: string;
  admin: boolean;
  manager: boolean;
  accountant: boolean;
  staff: boolean;
  user: boolean;
}[] = [
  {
    capability: 'Định giá Động, Giá sàn/trần & Mô phỏng Doanh thu',
    scope: 'Phân hệ Mô phỏng & Định giá Động',
    admin: true,
    manager: true,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Phê duyệt hồ sơ Chủ sân (KYC 7 tiêu chuẩn) & Cấp tài khoản đối tác',
    scope: 'Phê duyệt Đối tác & Quản trị Hệ thống',
    admin: true,
    manager: false,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Đăng Thông báo Hệ thống & Xuất bản Tin tức',
    scope: 'Bản tin & Thông báo Hệ thống',
    admin: true,
    manager: false,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Mở/Ẩn Cụm sân, Upload Ảnh & Cấu hình Chính sách Hủy',
    scope: 'Quản lý Quỹ sân & Chính sách Hủy',
    admin: true,
    manager: true,
    accountant: false,
    staff: false,
    user: false,
  },
  {
    capability: 'Đối soát Doanh thu & Hoàn tiền Giao dịch VNPAY',
    scope: 'Đối soát Tài chính & Hoàn tiền',
    admin: true,
    manager: true,
    accountant: true,
    staff: false,
    user: false,
  },
  {
    capability: 'Soát vé QR / PIN một lần & Chat hỗ trợ Khách tại sân',
    scope: 'Điều phối Ca & Soát vé tại Sân',
    admin: true,
    manager: true,
    accountant: false,
    staff: true,
    user: false,
  },
  {
    capability: 'Đặt sân, Thanh toán VNPAY/MoMo/VietQR & Nhận Vé Email',
    scope: 'Cổng Đặt sân & Thanh toán Trực tuyến',
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
  const [reindexingEs, setReindexingEs] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<AdminUserAccount[]>([]);
  const [accountsLive, setAccountsLive] = useState<boolean>(false);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLogEntry[]>([]);

  const loadPlatformAnalytics = async () => {
    setReindexingEs(true);
    try {
      const data = await marketplaceApi.fetchPlatformAnalytics(platformDays, listings);
      setPlatformAnalytics(data);
    } finally {
      setReindexingEs(false);
    }
  };

  const loadAdminAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await marketplaceApi.listAdminAccounts();
      setAccounts(res.accounts);
      setAccountsLive(res.live);
      if (res.live) {
        marketplaceApi
          .fetchAdminAuditLogsStrict(undefined, undefined, 8)
          .then((logs) => setRecentAuditLogs(logs))
          .catch(() => {
            // Silently ignore if backend audit endpoint is unavailable
          });
      }
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    marketplaceApi.fetchPlatformAnalytics(platformDays, listings).then((data) => {
      if (active) setPlatformAnalytics(data);
    });
    return () => {
      active = false;
    };
  }, [platformDays, listings]);

  useEffect(() => {
    void loadAdminAccounts();
  }, [loadAdminAccounts, activeRole]);

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3000);
  };

  const accountStats = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE').length;
    const lockedAccounts = accounts.length - activeAccounts;
    const byRole: Record<RoleCode, number> = {
      ADMIN: 0,
      MANAGER: 0,
      ACCOUNTANT: 0,
      STAFF: 0,
      USER: 0,
    };
    for (const acc of accounts) {
      const seen = new Set<RoleCode>();
      for (const r of acc.roles) {
        if (!seen.has(r.roleCode)) {
          seen.add(r.roleCode);
          byRole[r.roleCode] = (byRole[r.roleCode] ?? 0) + 1;
        }
      }
    }
    return {
      totalAccounts: accounts.length,
      activeAccounts,
      lockedAccounts,
      byRole,
    };
  }, [accounts]);

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
    subtitle: string;
    badge?: string;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'OPERATIONS',
      label: isAdmin ? 'Tổng quan & Biểu đồ Sàn' : 'Điều hành Đối soát Sàn',
      subtitle: 'GMV toàn hệ thống & lĩnh vực thể thao',
      badge: `${platformStats.totalProviders} đối tác`,
    },
    {
      id: 'USER_ACCOUNTS',
      label: 'Quản lý Tài khoản',
      subtitle: 'Tạo tài khoản, cấp quyền & khóa/mở',
      badge: `${accountStats.totalAccounts} TK`,
      adminOnly: true,
    },
    {
      id: 'LESSOR_INSPECTOR',
      label: 'Giám sát Đối tác Cho thuê',
      subtitle: 'Kiểm tra từng Chủ sân, sân & dịch vụ',
      badge: `${platformStats.publishedCount} cụm`,
      adminOnly: true,
    },
    {
      id: 'ADMIN_KYC',
      label: 'Duyệt Hồ sơ KYC Đối tác',
      subtitle: 'Risk Score, CCCD, MST Modulo-11',
      badge:
        platformStats.pendingKycCount > 0
          ? `${platformStats.pendingKycCount} chờ`
          : `${kycQueue.length}`,
    },
    {
      id: 'FINANCE_LEDGER',
      label: 'Sổ cái Kép & Đối soát Ký quỹ',
      subtitle: 'Tổng Nợ = Tổng Có • Hoa hồng 8–12%',
      badge: reconciliation?.doubleEntryBalanced ? 'Cân bằng' : undefined,
    },
    {
      id: 'RBAC_MATRIX',
      label: 'Ma trận Phân quyền RBAC',
      subtitle: 'Kiểm soát 5 vai trò & Chính sách bảo mật',
      badge: '5 Roles',
    },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const filteredKycQueue = kycQueue.filter(
    (k) => kycStatusFilter === 'ALL' || k.status === kycStatusFilter
  );

  return (
    <section id="command-center" className="py-10 sm:py-12">
      <div className="mx-auto max-w-[1420px] px-4 sm:px-8 space-y-6">
        {/* ===================================================================== */}
        {/* FULL-WIDTH CLASSIC ADMIN HERO BANNER                                  */}
        {/* ===================================================================== */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#0E4F7E]/25 bg-gradient-to-br from-[#0A192F] via-[#0D2E4D] to-[#0E4F7E] p-6 sm:p-8 text-white shadow-[0_22px_54px_rgba(10,25,47,0.2)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0A192F]">
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
                  : 'Trung tâm Kế toán Kép & Đối soát Ký quỹ'}
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-sky-100/85">
                Giám sát toàn quốc <strong>{platformStats.totalProviders} Đối tác Cho thuê</strong> •{' '}
                <strong>
                  {platformStats.publishedCount}/{platformStats.totalGroups} cụm sân
                </strong>{' '}
                ({platformStats.totalPhysicalCourts} sân vật lý) •{' '}
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-4 py-2 text-xs font-bold text-[#0A192F] transition hover:bg-white cursor-pointer"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Phát Thông báo Hệ thống
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('news')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    Xuất bản Bài báo
                  </button>
                </>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center rounded-full border border-white/25 bg-black/20 px-4 py-2 text-xs font-semibold text-white hover:bg-black/35 transition cursor-pointer"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CLASSIC 12-COL SPLIT: 3-COL STICKY SIDEBAR + 9-COL MAIN DASHBOARD     */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT 3 COLS: STICKY CLASSIC SIDEBAR + SYSTEM GOVERNANCE POD */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
            <nav
              aria-label="Menu Điều hành Admin"
              className="rounded-[26px] border border-neutral-200/90 bg-white p-3.5 shadow-xs space-y-1.5"
            >
              {visibleNavItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full rounded-[18px] px-4 py-3 text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0A192F] text-white shadow-sm'
                        : 'text-[#0F172A] hover:bg-[#F4F8FB]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold leading-snug">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                            active
                              ? 'bg-white/15 text-sky-100'
                              : 'bg-[#F1F5F9] text-neutral-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-snug ${
                        active ? 'text-sky-100/75' : 'text-neutral-500'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F172A]">Trạng thái Hệ thống Sàn</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10px] font-bold text-[#0E4F7E]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  100%
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 border border-neutral-200/60">
                  <span className="text-neutral-600">Chat nhân viên tại sân</span>
                  <button
                    type="button"
                    onClick={onToggleStaffChat}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                      staffChatEnabled
                        ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {staffChatEnabled ? 'CHO PHÉP' : 'TẠM KHÓA'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 border border-neutral-200/60">
                  <span className="text-neutral-600">Sổ cái Kế toán Kép</span>
                  <span className="font-bold text-[#0F766E]">
                    {reconciliation
                      ? reconciliation.doubleEntryBalanced
                        ? '✓ Nợ = Có'
                        : 'Cần kiểm tra'
                      : 'Đang đồng bộ'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 border border-neutral-200/60">
                  <span className="text-neutral-600">Tài khoản Hoạt động</span>
                  <span className="font-bold text-[#0E4F7E] tabular-nums">
                    {accountStats.activeAccounts}/{accountStats.totalAccounts}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenChatDrawer}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F172A] py-2.5 text-[11px] font-semibold text-white hover:bg-[#0E4F7E] transition cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Kênh Điều phối Chủ sân
              </button>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[10.5px] font-semibold text-neutral-500">
                <Database className="h-3 w-3 text-[#0E4F7E]" />
                {accountsLive ? 'DB PostgreSQL Trực tiếp' : 'Phiên làm việc Đồng bộ'}
              </div>
            </div>
          </aside>

          {/* RIGHT 9 COLS: UPGRADED MULTI-CHART ADMIN WORKSPACE */}
          <div className="lg:col-span-9 min-w-0 space-y-6">
            {/* LIVE FEEDBACK TOAST */}
            <AnimatePresence>
              {toastMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-[#0E4F7E]/30 bg-[#E6F1F8]/80 px-5 py-3 text-xs sm:text-sm font-semibold text-[#0E4F7E] shadow-xs"
                >
                  {toastMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* TAB 1: UPGRADED MULTI-CHART ADMIN DASHBOARD */}
              {activeTab === 'OPERATIONS' && (
                <motion.div
                  key="admin-ops"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  {platformAnalytics && (
                    <AdminPlatformDashboard
                      analytics={platformAnalytics}
                      reconciliation={reconciliation}
                      listings={listings}
                      days={platformDays}
                      onChangeDays={setPlatformDays}
                      syncing={reindexingEs}
                      totalProviders={platformStats.totalProviders}
                      publishedGroups={platformStats.publishedCount}
                      totalGroups={platformStats.totalGroups}
                      totalPhysicalCourts={platformStats.totalPhysicalCourts}
                      totalAccounts={accountStats.totalAccounts}
                      activeAccounts={accountStats.activeAccounts}
                      pendingKycCount={platformStats.pendingKycCount}
                      isLiveDb={marketplaceApi.backendConnected}
                      onJumpToTab={(tab) => setActiveTab(tab)}
                      onSyncAll={async () => {
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

              {/* Bottom Asymmetric Grid: Sport Category Catalogue + Fast Governance Shortcuts */}
              {isAdmin && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-7 rounded-[26px] bg-white p-6 border border-neutral-200/90 shadow-xs space-y-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
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
                          {sp.name} <code className="text-[#0E4F7E]">({sp.code})</code>
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
                        flashToast(
                          `✓ Đã mở thêm bộ môn thể thao "${cleanName}" (${cleanCode}) lên toàn sàn!`
                        );
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
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                      Điều hướng Nghiệp vụ Cấp Cao
                    </span>
                    <div className="grid grid-cols-1 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('USER_ACCOUNTS')}
                        className="rounded-2xl border border-[#0F766E]/25 bg-[#F0FDFA] p-3.5 text-left hover:bg-teal-50 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between font-bold text-[#0F766E]">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            Quản lý Tài khoản &amp; Phân quyền ({accountStats.totalAccounts} TK)
                          </span>
                          <span>→</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-teal-900/75">
                          Cấp tài khoản nhân sự, gán vai trò RBAC, khóa/mở quyền truy cập.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('LESSOR_INSPECTOR')}
                        className="rounded-2xl border border-[#0E4F7E]/25 bg-[#F4F8FB] p-3.5 text-left hover:bg-[#E6F1F8]/70 transition cursor-pointer"
                      >
                        <div className="font-bold text-[#0E4F7E]">
                          Giám sát Toàn bộ Hệ thống Cho thuê Đối tác →
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-600">
                          Kiểm tra từng Chủ sân, danh sách cụm sân &amp; menu dịch vụ đang bán.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('ADMIN_KYC')}
                        className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-3.5 text-left hover:bg-amber-50 transition cursor-pointer"
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

          {/* TAB 1B: PLATFORM USER ACCOUNTS & RBAC ASSIGNMENT */}
          {activeTab === 'USER_ACCOUNTS' && isAdmin && (
            <motion.div
              key="admin-accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
            >
              <AdminAccountManager
                accounts={accounts}
                liveFromDb={accountsLive}
                loading={accountsLoading}
                currentUsername={session.username}
                isAdmin={isAdmin}
                onRefresh={loadAdminAccounts}
                onFlashToast={flashToast}
              />
            </motion.div>
          )}

          {/* TAB 2: LESSOR INSPECTOR */}
          {activeTab === 'LESSOR_INSPECTOR' && isAdmin && (
            <motion.div
              key="admin-inspector"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-3 rounded-[24px] border border-[#0E4F7E]/20 bg-gradient-to-r from-[#F4F8FB] via-white to-[#F0FDFA] p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0E4F7E] text-white">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                      Chế độ Giám sát Đối tác (Admin Inspection)
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      Đang giám sát <strong>{platformStats.totalProviders} Đối tác</strong> •{' '}
                      <strong>{platformStats.publishedCount}/{platformStats.totalGroups} cụm sân</strong>{' '}
                      • <strong>{platformStats.totalPhysicalCourts} sân vật lý</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ADMIN_KYC')}
                    className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-semibold text-[#0F172A] hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Hồ sơ KYC ({platformStats.pendingKycCount} chờ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('USER_ACCOUNTS')}
                    className="rounded-xl bg-[#0E4F7E] px-3.5 py-2 font-semibold text-white hover:bg-[#0A192F] transition cursor-pointer"
                  >
                    Tài khoản Chủ sân ({accountStats.byRole.MANAGER})
                  </button>
                </div>
              </div>

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

          {/* TAB 3: KYC APPROVAL QUEUE */}
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
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
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
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        kycStatusFilter === f.id
                          ? 'bg-[#0E4F7E] text-white'
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
                  Hiện chưa có hồ sơ đăng ký Chủ sân nào khớp bộ lọc.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {filteredKycQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-[#F8F9FA] p-5"
                    >
                      <div className="space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums font-bold text-[#0F172A]">
                            {item.referenceCode}
                          </span>
                          <span className="font-semibold text-[#0E4F7E]">{item.venueName}</span>
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
                                  : 'bg-teal-50 text-[#0F766E]'
                            }`}
                          >
                            Risk Score: {item.riskScore}/100
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              item.status === 'APPROVED'
                                ? 'bg-teal-50 text-[#0F766E]'
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
                          Cờ kiểm tra: {item.internalRiskFlags || 'CLEAN'} • {item.validationSummary}
                        </p>
                      </div>

                      {isAdmin && item.status === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-200/70">
                          <ActionButton
                            variant="ink"
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

          {/* TAB 4: 5-COL RECONCILIATION + 7-COL COMMISSION SCHEDULE */}
          {activeTab === 'FINANCE_LEDGER' && (
            <motion.div
              key="admin-ledger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
              className="grid grid-cols-1 gap-5 lg:grid-cols-12"
            >
              <div className="lg:col-span-5 rounded-[26px] bg-white p-6 border border-neutral-200/90 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                      Sổ Cái Kế Toán Kép Nội Bộ
                    </span>
                    <h3 className="mt-0.5 text-lg font-bold text-[#0F172A]">
                      Cân bằng Tổng Nợ = Tổng Có
                    </h3>
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-[#0F766E]">
                    {reconciliation?.doubleEntryBalanced ?? true ? '✓ Cân bằng' : 'Cần kiểm tra'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Tổng thu hộ ký quỹ</span>
                    <strong className="tabular-nums text-base text-[#0F172A]">
                      {formatVnd(reconciliation?.totalEscrowCredits ?? 48_650_000)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-teal-50/70 p-4 border border-[#0F766E]/20 flex justify-between items-center">
                    <span className="text-xs text-[#0F766E] font-semibold">Hoa hồng sàn thu về</span>
                    <strong className="tabular-nums text-base text-[#0F766E]">
                      {formatVnd(reconciliation?.totalPlatformCommission ?? 4_865_000)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F4F8FB] p-4 border border-[#0E4F7E]/20 flex justify-between items-center">
                    <span className="text-xs text-[#0E4F7E] font-semibold">Công nợ trả chủ sân</span>
                    <strong className="tabular-nums text-base text-[#0E4F7E]">
                      {formatVnd(reconciliation?.totalVenuePayable ?? 40_935_000)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Đã hoàn trả khách hủy</span>
                    <strong className="tabular-nums text-sm text-[#0F766E]">
                      {formatVnd(reconciliation?.totalCustomerRefunds ?? 2_850_000)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Cọc khấu trừ bỏ lịch</span>
                    <strong className="tabular-nums text-sm text-neutral-800">
                      {formatVnd(reconciliation?.totalForfeitedDeposits ?? 3_420_000)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/80 flex justify-between items-center">
                    <span className="text-xs text-amber-900 font-semibold">Tiền còn phải hoàn</span>
                    <strong className="tabular-nums text-sm text-amber-900">
                      {formatVnd(reconciliation?.totalCustomerRefundsPending ?? 0)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
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
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs hover:bg-[#F8FAFC]"
                    >
                      <div>
                        <div className="font-bold text-[#0F172A]">{prov.providerName}</div>
                        <div className="text-[11px] text-neutral-500">
                          {prov.district}, {prov.city} • {prov.legalEntityType}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-[#E6F1F8] px-3 py-1 tabular-nums font-bold text-[#0E4F7E]">
                          Hoa hồng: {prov.commissionRatePct}% / đơn
                        </span>
                        {onOpenPublicShop && (
                          <button
                            type="button"
                            onClick={() => onOpenPublicShop(prov.providerId)}
                            className="font-semibold text-[#0E4F7E] hover:underline cursor-pointer"
                          >
                            Hồ sơ ↗
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT') && (
                <div className="lg:col-span-12">
                  <VietQrReviewPanel />
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 5: FULL-WIDTH RBAC MATRIX & AUDIT FEED */}
          {activeTab === 'RBAC_MATRIX' && (
            <motion.div
              key="admin-rbac"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    {
                      role: 'ADMIN' as RoleCode,
                      title: 'Super Admin',
                      scope: 'PLATFORM',
                      tone: 'border-[#0E4F7E]/25 bg-[#F4F8FB] text-[#0E4F7E]',
                    },
                    {
                      role: 'MANAGER' as RoleCode,
                      title: 'Chủ sân Đối tác',
                      scope: 'TENANT',
                      tone: 'border-[#0F766E]/25 bg-[#F0FDFA] text-[#0F766E]',
                    },
                    {
                      role: 'ACCOUNTANT' as RoleCode,
                      title: 'Kế toán Đối soát',
                      scope: 'PLATFORM / TENANT',
                      tone: 'border-indigo-200 bg-indigo-50/60 text-indigo-800',
                    },
                    {
                      role: 'STAFF' as RoleCode,
                      title: 'Nhân viên Quầy',
                      scope: 'TENANT',
                      tone: 'border-amber-200 bg-amber-50/70 text-amber-800',
                    },
                    {
                      role: 'USER' as RoleCode,
                      title: 'Khách thuê sân',
                      scope: 'PUBLIC',
                      tone: 'border-neutral-200 bg-white text-[#0F172A]',
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.role}
                    className={`rounded-[22px] border p-4 shadow-xs ${item.tone}`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <span>{item.role}</span>
                      <span>{item.scope}</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {accountStats.byRole[item.role]} TK
                    </div>
                    <div className="mt-0.5 text-xs font-semibold">{item.title}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                <div className="flex flex-col gap-3 border-b border-neutral-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Role-Based Access Control (RBAC)
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-[#0F172A]">
                      Ma trận Phân quyền Hệ thống Nội bộ &amp; Khách thuê sân
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      Kiểm tra phân quyền đồng bộ trên toàn bộ cổng vận hành và hệ thống quản trị.
                    </p>
                  </div>

                  {isAdmin && (
                    <ActionButton
                      variant="ink"
                      size="sm"
                      arrow="right"
                      onClick={() => setActiveTab('USER_ACCOUNTS')}
                    >
                      Quản lý Danh sách Tài khoản
                    </ActionButton>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-neutral-600">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Chức năng &amp; Phân hệ Nghiệp vụ</th>
                        <th className="px-4 py-3.5 text-center font-bold text-[#0E4F7E]">ADMIN</th>
                        <th className="px-4 py-3.5 text-center font-bold text-[#0F766E]">
                          MANAGER (Chủ sân)
                        </th>
                        <th className="px-4 py-3.5 text-center font-semibold">ACCOUNTANT</th>
                        <th className="px-4 py-3.5 text-center font-semibold">STAFF</th>
                        <th className="px-4 py-3.5 text-center font-semibold text-neutral-400">USER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {RBAC_MATRIX_ROWS.map((row) => (
                        <tr key={row.capability} className="hover:bg-[#F8FAFC]">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[#0F172A]">{row.capability}</div>
                            <span className="text-[11px] text-neutral-500">{row.scope}</span>
                          </td>
                          {[row.admin, row.manager, row.accountant, row.staff, row.user].map(
                            (allowed, i) => (
                              <td key={i} className="px-4 py-4 text-center">
                                {allowed ? (
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E6F1F8] text-[11px] font-bold text-[#0E4F7E]">
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
              </div>

              {recentAuditLogs.length > 0 && (
                <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                      <Activity className="h-3.5 w-3.5" />
                      Nhật ký Kiểm toán RBAC &amp; Bảo mật Gần nhất (PostgreSQL Audit Logs)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {recentAuditLogs.length} sự kiện
                    </span>
                  </div>
                  <div className="divide-y divide-neutral-100 text-xs">
                    {recentAuditLogs.map((log) => (
                      <div
                        key={log.auditId}
                        className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <span className="font-bold text-[#0E4F7E]">{log.action}</span>{' '}
                          <span className="text-neutral-600">
                            • {log.entityType} ({log.entityId})
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          @{log.actorUsername || 'system'} • {log.createdAt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
