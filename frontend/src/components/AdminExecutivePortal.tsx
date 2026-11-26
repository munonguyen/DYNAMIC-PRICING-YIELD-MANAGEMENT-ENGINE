import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
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
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton } from './FairwayControls';
import { AdminPlatformDashboard } from './AdminPlatformDashboard';
import { AdminAccountManager } from './AdminAccountManager';
import { AdminPartnerGovernance } from './AdminPartnerGovernance';
import { AdminKycReviewPanel } from './AdminKycReviewPanel';
import { VietQrReviewPanel } from './VietQrReviewPanel';
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
  onReviewApplication: (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    customNote?: string
  ) => void;
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
  controlledTab,
  onSelectTab,
  onToggleListingPublished,
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [platformDays, setPlatformDays] = useState<number>(7);
  const [platformAnalytics, setPlatformAnalytics] = useState<AnalyticsDashboardData | null>(null);
  const [reindexingEs, setReindexingEs] = useState<boolean>(false);
  const [tenants, setTenants] = useState<import('../types/marketplace').AdminTenantOverview[]>([]);
  const [accounts, setAccounts] = useState<AdminUserAccount[]>([]);
  const [accountsLive, setAccountsLive] = useState<boolean>(false);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLogEntry[]>([]);

  const loadPlatformAnalytics = async () => {
    setReindexingEs(true);
    try {
      const data = await marketplaceApi.fetchPlatformAnalytics(platformDays, listings);
      setPlatformAnalytics(data);
    } catch {
      setPlatformAnalytics(null);
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
    } catch {
      setAccounts([]);
      setAccountsLive(false);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'OPERATIONS') return;
    let active = true;
    let loading = false;
    const poll = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const data = await marketplaceApi.fetchPlatformAnalytics(platformDays, listings);
        if (active) setPlatformAnalytics(data);
      } catch {
        if (active) setPlatformAnalytics(null);
      } finally {
        loading = false;
      }
    };
    void poll();
    const timer = window.setInterval(poll, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeTab, platformDays, listings]);

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

  useEffect(() => {
    let active = true;
    marketplaceApi.fetchAdminTenantsStrict().then((rows) => {
      if (active) setTenants(rows);
    }).catch(() => {
      if (active) setTenants([]);
    });
    return () => { active = false; };
  }, [activeRole]);

  const platformStats = useMemo(() => ({
    totalProviders: tenants.length,
    publishedCount: tenants.reduce((total, tenant) => total + tenant.publishedGroupCount, 0),
    totalGroups: tenants.reduce((total, tenant) => total + tenant.groupCount, 0),
    pendingKycCount: kycQueue.filter((application) => application.status === 'PENDING_REVIEW').length,
    totalPhysicalCourts: tenants.reduce((total, tenant) => total + tenant.unitCount, 0),
  }), [tenants, kycQueue]);

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
      label: 'Quản lý & Kiểm duyệt Đối tác',
      subtitle: 'Hợp đồng phí, trạng thái Tenant & kiểm duyệt',
      badge: `${platformStats.totalProviders} ĐT`,
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
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

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
                  {platformAnalytics ? 'Có dữ liệu' : 'Đang tải'}
                </span>
              </div>

              <div className="space-y-2">
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
                <ScrollReveal>
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
                          Quản lý Tuân thủ &amp; Kiểm duyệt Đối tác →
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-600">
                          Đình chỉ/kích hoạt Tenant &amp; kiểm duyệt hiển thị cụm sân công khai.
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
                </ScrollReveal>
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

          {/* TAB 2: PRIVACY-PRESERVING PARTNER GOVERNANCE */}
          {activeTab === 'LESSOR_INSPECTOR' && isAdmin && (
            <motion.div
              key="admin-inspector"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
            >
              <AdminPartnerGovernance
                listings={listings}
                onToggleListingPublished={onToggleListingPublished}
                onOpenPublicShop={onOpenPublicShop}
                onOpenChatDrawer={onOpenChatDrawer}
                onJumpToKyc={() => setActiveTab('ADMIN_KYC')}
                onJumpToAccounts={() => setActiveTab('USER_ACCOUNTS')}
                pendingKycCount={platformStats.pendingKycCount}
                managerAccountsCount={accountStats.byRole.MANAGER}
                onFlashToast={flashToast}
              />
            </motion.div>
          )}

          {/* TAB 3: FULL PARTNER KYC AUDIT & APPROVAL QUEUE */}
          {activeTab === 'ADMIN_KYC' && (
            <motion.div
              key="admin-kyc"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
            >
              <AdminKycReviewPanel
                kycQueue={kycQueue}
                isAdmin={isAdmin}
                reviewingId={reviewingId}
                onReviewApplication={onReviewApplication}
              />
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
                    {reconciliation ? (reconciliation.doubleEntryBalanced ? '✓ Cân bằng' : 'Cần kiểm tra') : 'Chưa tải được sổ cái'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Tổng thu hộ ký quỹ</span>
                    <strong className="tabular-nums text-base text-[#0F172A]">
                      {reconciliation ? formatVnd(reconciliation.totalEscrowCredits) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-teal-50/70 p-4 border border-[#0F766E]/20 flex justify-between items-center">
                    <span className="text-xs text-[#0F766E] font-semibold">Hoa hồng sàn thu về</span>
                    <strong className="tabular-nums text-base text-[#0F766E]">
                      {reconciliation ? formatVnd(reconciliation.totalPlatformCommission) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F4F8FB] p-4 border border-[#0E4F7E]/20 flex justify-between items-center">
                    <span className="text-xs text-[#0E4F7E] font-semibold">Công nợ trả chủ sân</span>
                    <strong className="tabular-nums text-base text-[#0E4F7E]">
                      {reconciliation ? formatVnd(reconciliation.totalVenuePayable) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Đã hoàn trả khách hủy</span>
                    <strong className="tabular-nums text-sm text-[#0F766E]">
                      {reconciliation ? formatVnd(reconciliation.totalCustomerRefunds) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60 flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Cọc khấu trừ bỏ lịch</span>
                    <strong className="tabular-nums text-sm text-neutral-800">
                      {reconciliation ? formatVnd(reconciliation.totalForfeitedDeposits) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/80 flex justify-between items-center">
                    <span className="text-xs text-amber-900 font-semibold">Tiền còn phải hoàn</span>
                    <strong className="tabular-nums text-sm text-amber-900">
                      {reconciliation ? formatVnd(reconciliation.totalCustomerRefundsPending) : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                <div className="border-b border-neutral-100 p-6">
                  <h4 className="text-base font-bold text-[#0F172A]">
                    Biểu phí Hoa hồng Hợp đồng theo Đối tác Chủ sân ({tenants.length})
                  </h4>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Khớp quy tắc không chồng chéo thời gian hiệu lực (`commission_rules`) trên cơ sở dữ liệu.
                  </p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {tenants.map((prov) => (
                    <div
                      key={prov.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs hover:bg-[#F8FAFC]"
                    >
                      <div>
                        <div className="font-bold text-[#0F172A]">{prov.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          {prov.address}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-[#E6F1F8] px-3 py-1 tabular-nums font-bold text-[#0E4F7E]">
                          Hoa hồng: {prov.commissionRatePercent}% / đơn
                        </span>
                        {onOpenPublicShop && (
                          <button
                            type="button"
                            onClick={() => onOpenPublicShop(prov.id)}
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
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
