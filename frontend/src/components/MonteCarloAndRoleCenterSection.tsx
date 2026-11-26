import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
  LessorApplicationRecord,
  ReconciliationSummary,
  RoleCode,
  SportTypeItem,
} from '../types/marketplace';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ArenaPulseLogo } from './ArenaPulseLogo';
import { ActionButton } from './FairwayControls';
import { LessorOnboardingSection } from './LessorOnboardingSection';

interface MonteCarloAndRoleCenterSectionProps {
  activeRole: RoleCode;
  onSelectRole: (role: RoleCode) => void;
  sports: SportTypeItem[];
  onAddSportDemo: (code: string, name: string) => void;
  staffChatEnabled: boolean;
  onToggleStaffChat: () => void;
  onOpenChatDrawer: () => void;
  session: AuthSession | null;
  authModalOpen: boolean;
  modalOnly?: boolean;
  onCloseAuthModal: () => void;
  onAuthenticated: (s: AuthSession) => void;
  onOpenInternalLogin?: () => void;
  onNavigate?: (page: AppPageId) => void;
}

type InternalTab = 'OPERATIONS' | 'RBAC_MATRIX' | 'FINANCE_LEDGER' | 'ADMIN_KYC';

const INTERNAL_ROLES: RoleCode[] = ['MANAGER', 'STAFF', 'ACCOUNTANT', 'ADMIN'];

const ROLE_META: Record<
  Exclude<RoleCode, 'USER'>,
  { title: string; scope: 'PLATFORM' | 'TENANT'; image: string; desc: string; perms: string[] }
> = {
  MANAGER: {
    title: 'Chủ Cụm Sân (Lessor / Venue Manager)',
    scope: 'TENANT',
    image: '/images/real-pickleball-outdoor.jpg',
    desc: 'Quản trị toàn diện cụm sân thuộc sở hữu: cấu hình Định giá Động & tỷ lệ cọc (/pricing), mở/ẩn lịch thuê, đăng ảnh sân thực tế và bật/tắt kênh chat nhân viên.',
    perms: ['PRICING_MANAGE', 'VENUE_MANAGE', 'GROUP_PUBLISH', 'POLICY_MANAGE', 'QR_SCAN'],
  },
  STAFF: {
    title: 'Nhân Viên Trực Sân (Venue Staff)',
    scope: 'TENANT',
    image: '/images/real-badminton-indoor.jpg',
    desc: 'Soát mã QR một lần khi khách nhận sân thuộc đúng cơ sở được phân công, đánh dấu bỏ lịch sau 15 phút ân hạn và phản hồi khách qua hộp chat.',
    perms: ['QR_SCAN', 'NO_SHOW_MARK', 'CHAT_PARTICIPATE'],
  },
  ACCOUNTANT: {
    title: 'Kế Toán Sàn (Platform Accountant)',
    scope: 'PLATFORM',
    image: '/images/real-basketball-indoor.jpg',
    desc: 'Cấu hình tỷ lệ hoa hồng không chồng chéo thời gian, giám sát sổ cái kế toán kép bất biến (Tổng Nợ = Tổng Có) và kiểm tra đối soát VNPAY / MoMo.',
    perms: ['COMMISSION_MANAGE', 'LEDGER_READ', 'AUDIT_READ', 'VNPAY_REFUND'],
  },
  ADMIN: {
    title: 'Quản Trị Hệ Thống (Super Admin)',
    scope: 'PLATFORM',
    image: '/images/real-futsal-park.jpg',
    desc: 'Kiểm soát toàn sàn ArenaPulse.vn: phê duyệt hồ sơ KYC Chủ sân mới, phân quyền đa phạm vi, giám sát Định giá Động, phát Thông báo / Bài báo và kiểm tra AuditLog.',
    perms: ['LESSOR_KYC_REVIEW', 'PRICING_ADMIN', 'ANNOUNCEMENT_PUBLISH', 'ROLE_MANAGE', 'SPORT_MANAGE'],
  },
};

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

export const MonteCarloAndRoleCenterSection: React.FC<MonteCarloAndRoleCenterSectionProps> = ({
  activeRole,
  sports,
  onAddSportDemo,
  staffChatEnabled,
  onToggleStaffChat,
  onOpenChatDrawer,
  session,
  authModalOpen,
  modalOnly = false,
  onCloseAuthModal,
  onAuthenticated,
  onOpenInternalLogin,
  onNavigate,
}) => {
  const [internalTab, setInternalTab] = useState<InternalTab>('OPERATIONS');
  const [venueCheckinMode, setVenueCheckinMode] = useState<'QR_STAFF' | 'MANUAL'>('QR_STAFF');
  const [venuePublished, setVenuePublished] = useState<boolean>(true);
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [kycQueue, setKycQueue] = useState<LessorApplicationRecord[]>([]);
  const [newSportCode, setNewSportCode] = useState('');
  const [newSportName, setNewSportName] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const isInternalAuthorized = Boolean(session && INTERNAL_ROLES.includes(activeRole));
  const internalRole: Exclude<RoleCode, 'USER'> =
    activeRole !== 'USER' ? activeRole : 'MANAGER';
  const canAccessPricing = activeRole === 'MANAGER' || activeRole === 'ADMIN';
  const canReviewKyc = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT';

  useEffect(() => {
    if (!isInternalAuthorized) return;
    marketplaceApi.getReconciliation().then(setReconciliation);
    if (canReviewKyc) {
      marketplaceApi.listLessorApplicationsInternal().then(setKycQueue);
    }
  }, [isInternalAuthorized, canReviewKyc]);

  const handleReviewApplication = async (
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    setReviewingId(applicationId);
    try {
      const note =
        decision === 'APPROVED'
          ? 'Hồ sơ CCCD, MST Modulo-11, Mặt bằng & PCCC hợp lệ — Đã phê duyệt cấp Tenant.'
          : 'Tài liệu đính kèm hoặc thông tin pháp lý cần bổ sung lại bản rõ nét.';
      const updated = await marketplaceApi.reviewLessorApplicationInternal(
        applicationId,
        decision,
        note
      );
      setKycQueue((prev) => prev.map((item) => (item.id === applicationId ? updated : item)));
    } finally {
      setReviewingId(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = await marketplaceApi.loginOrRegisterDemo(loginUsername, loginPassword, 'LOGIN');
    onAuthenticated(auth);
    onCloseAuthModal();
  };

  const availableTabs: { id: InternalTab; label: string }[] = [
    { id: 'OPERATIONS', label: activeRole === 'ADMIN' ? 'Điều hành Hệ thống' : 'Vận hành Cụm sân' },
    { id: 'RBAC_MATRIX', label: 'Phân quyền RBAC' },
    { id: 'FINANCE_LEDGER', label: 'Sổ cái & Đối soát' },
    ...(canReviewKyc ? [{ id: 'ADMIN_KYC' as InternalTab, label: `Duyệt Hồ sơ KYC (${kycQueue.length})` }] : []),
  ];

  return (
    <div className={modalOnly ? '' : 'bg-[#F7F9F8]'}>
      {!modalOnly &&
        (!session ? (
          <section id="command-center" className="py-16 sm:py-24">
            <div className="mx-auto max-w-[920px] px-4 sm:px-8">
              <ScrollReveal className="rounded-[30px] border border-neutral-200/90 bg-white p-7 sm:p-11 shadow-[0_24px_60px_rgba(15,23,42,0.06)] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
                    Yêu cầu Xác thực Tài khoản • ArenaPulse
                  </span>
                  <span className="rounded-full bg-[#F4F8F4] border border-[#16422C]/20 px-3 py-1 text-[11px] font-semibold text-[#16422C]">
                    Bảo mật 2 lớp (Account + KYC)
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-[34px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0F172A]">
                    Đăng nhập tài khoản để đăng ký Chủ sân hoặc truy cập Hệ thống Nội bộ
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    Người chơi đã đăng nhập có thể nộp hồ sơ KYC trở thành Đối tác Cho thuê sân. Các
                    tài khoản <strong>Chủ sân (MANAGER)</strong> và <strong>Quản trị viên (ADMIN)</strong> sau
                    khi đăng nhập sẽ mở khóa toàn bộ bảng điều khiển nội bộ &amp; công cụ Định giá Động.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                  {[
                    {
                      title: '1. Đăng nhập Tài khoản',
                      desc: 'Xác thực phiên làm việc cá nhân hoặc tài khoản nội bộ MANAGER / ADMIN.',
                    },
                    {
                      title: '2. Nộp KYC 7 tiêu chuẩn',
                      desc: 'Dành cho User muốn đăng ký làm Chủ cụm sân cho thuê trên ArenaPulse.vn.',
                    },
                    {
                      title: '3. Quản trị Định giá & Sổ cái',
                      desc: 'Chủ sân cấu hình giá sàn/trần (/pricing), Admin kiểm soát phân quyền & duyệt KYC.',
                    },
                  ].map((stepCard) => (
                    <div
                      key={stepCard.title}
                      className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] p-4"
                    >
                      <div className="font-semibold text-[#0F172A]">{stepCard.title}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                        {stepCard.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-5">
                  <span className="text-xs text-neutral-500">
                    Mẹo thử nhanh quyền nội bộ: đăng nhập tên chứa <code>manager</code> (Chủ sân) hoặc <code>admin</code> (Quản trị).
                  </span>
                  <ActionButton
                    variant="forest"
                    size="lg"
                    arrow="right"
                    onClick={() => onOpenInternalLogin?.()}
                  >
                    Đăng nhập ngay để tiếp tục
                  </ActionButton>
                </div>
              </ScrollReveal>
            </div>
          </section>
        ) : !isInternalAuthorized ? (
          <LessorOnboardingSection
            sports={sports}
            onNavigateInternalLogin={() => onOpenInternalLogin?.()}
          />
        ) : (
          <section id="command-center" className="py-12 sm:py-16">
            <div className="mx-auto max-w-[1400px] px-4 sm:px-8 space-y-6">
              {/* TOP INTERNAL WORKSPACE HEADER */}
              <ScrollReveal className="rounded-[28px] border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#16422C] px-3.5 py-1 text-[11px] font-bold text-[#E7F7D4]">
                        {activeRole} • {ROLE_META[internalRole].scope}
                      </span>
                      <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-medium text-neutral-600">
                        Phiên: {session?.fullName} ({session?.email})
                      </span>
                    </div>
                    <h2 className="mt-3 text-3xl sm:text-[38px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
                      {activeRole === 'ADMIN'
                        ? 'Hệ thống Quản trị Sàn & Phân quyền (Admin Portal)'
                        : activeRole === 'MANAGER'
                          ? 'Hệ thống Nội bộ Chủ Cụm Sân (Lessor Workspace)'
                          : 'Cổng Vận hành Nội bộ ArenaPulse.vn'}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {canAccessPricing && onNavigate && (
                      <ActionButton
                        variant="forest"
                        size="sm"
                        arrow="right"
                        onClick={() => onNavigate('pricing')}
                      >
                        Mở Công cụ Định giá Động (/pricing)
                      </ActionButton>
                    )}
                    {activeRole === 'ADMIN' && onNavigate && (
                      <ActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('announcements')}
                      >
                        Phát Thông báo Admin →
                      </ActionButton>
                    )}
                  </div>
                </div>

                {/* Internal Workspace Tabs */}
                <div className="mt-6 flex flex-wrap gap-1.5 rounded-2xl bg-[#F1F5F9] p-1.5 border-t border-neutral-100">
                  {availableTabs.map((tab) => {
                    const active = internalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInternalTab(tab.id)}
                        className="relative rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
                      >
                        {active && (
                          <motion.span
                            layoutId="internal-portal-tab"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-xl bg-[#0F172A] shadow-2xs"
                          />
                        )}
                        <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollReveal>

              {/* TAB CONTENT */}
              <AnimatePresence mode="wait">
                {internalTab === 'OPERATIONS' && (
                  <motion.div
                    key="tab-ops"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EXPO_EASE }}
                    className="grid grid-cols-1 gap-6 lg:grid-cols-12"
                  >
                    {/* Left 5 Cols: Role Identity & Venue Settings */}
                    <div className="overflow-hidden rounded-[26px] bg-white p-5 border border-neutral-200/90 lg:col-span-5 flex flex-col justify-between shadow-xs">
                      <div>
                        <div className="relative h-40 w-full overflow-hidden rounded-[20px]">
                          <img
                            src={ROLE_META[internalRole].image}
                            alt={ROLE_META[internalRole].title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <span className="absolute left-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#0E4F7E]">
                            Phạm vi: {ROLE_META[internalRole].scope}
                          </span>
                          <h3 className="absolute bottom-3.5 left-4 right-4 text-lg font-semibold text-white">
                            {ROLE_META[internalRole].title}
                          </h3>
                        </div>

                        <div className="px-1 pt-4">
                          <p className="text-xs sm:text-sm leading-relaxed text-neutral-600">
                            {ROLE_META[internalRole].desc}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {ROLE_META[internalRole].perms.map((perm) => (
                              <span
                                key={perm}
                                className="rounded-full bg-[#F8FAFC] border border-neutral-200 px-3 py-1 text-[11px] font-medium text-neutral-700"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 space-y-2.5 border-t border-neutral-100 px-1 pt-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Trạng thái gian hàng cụm sân</span>
                          <button
                            type="button"
                            onClick={() => setVenuePublished((v) => !v)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              venuePublished
                                ? 'bg-[#E7F7D4] text-[#204E18]'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            {venuePublished ? 'ĐANG MỞ THUÊ' : 'TẠM ẨN'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Quyền trả lời chat của nhân viên</span>
                          <button
                            type="button"
                            onClick={onToggleStaffChat}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              staffChatEnabled
                                ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {staffChatEnabled ? 'CHO PHÉP' : 'TẠM KHÓA'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Phương thức kiểm tra nhận sân</span>
                          <button
                            type="button"
                            onClick={() =>
                              setVenueCheckinMode((m) => (m === 'QR_STAFF' ? 'MANUAL' : 'QR_STAFF'))
                            }
                            className="rounded-full bg-[#F8FAFC] border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-[#0F172A]"
                          >
                            {venueCheckinMode === 'QR_STAFF' ? 'Nhân viên quét QR' : 'Tự xác nhận'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right 7 Cols: Quick Modules for Lessor & Admin */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-[#16422C]">
                              Phân hệ Nghiệp vụ Theo Vai trò
                            </span>
                            <h3 className="text-lg font-semibold text-[#0F172A]">
                              Truy cập nhanh các công cụ Nội bộ
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 text-xs">
                          {canAccessPricing && onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate('pricing')}
                              className="rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4] p-4 text-left transition-colors hover:bg-[#E7F7D4]/50"
                            >
                              <div className="font-semibold text-[#16422C]">
                                01 • Định giá Động &amp; Giá sàn/trần →
                              </div>
                              <p className="mt-1 text-neutral-600 leading-relaxed">
                                Điều chỉnh giá cơ sở, tỷ lệ đặt cọc, xem ma trận hệ số và chạy mô phỏng Monte Carlo.
                              </p>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setInternalTab('FINANCE_LEDGER')}
                            className="rounded-2xl border border-[#0E4F7E]/25 bg-[#F4F8FB] p-4 text-left transition-colors hover:bg-[#E6F1F8]/60"
                          >
                            <div className="font-semibold text-[#0E4F7E]">
                              02 • Đối soát Sổ cái Kép &amp; Ký quỹ →
                            </div>
                            <p className="mt-1 text-neutral-600 leading-relaxed">
                              Kiểm tra cân bằng Tổng Nợ = Tổng Có, tiền cọc thu hộ và công nợ hoàn trả chủ sân.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={onOpenChatDrawer}
                            className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-4 text-left transition-colors hover:bg-white"
                          >
                            <div className="font-semibold text-[#0F172A]">
                              03 • Kênh Chat Hỗ trợ Khách thuê →
                            </div>
                            <p className="mt-1 text-neutral-600 leading-relaxed">
                              Phản hồi trực tiếp yêu cầu giữ chỗ, hướng dẫn lối vào sân và xử lý check-in QR.
                            </p>
                          </button>

                          {activeRole === 'ADMIN' ? (
                            <button
                              type="button"
                              onClick={() => setInternalTab('ADMIN_KYC')}
                              className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-4 text-left transition-colors hover:bg-amber-50"
                            >
                              <div className="font-semibold text-amber-900">
                                04 • Duyệt Hồ sơ Chủ sân (KYC) →
                              </div>
                              <p className="mt-1 text-amber-900/80 leading-relaxed">
                                Rà soát Risk Score, CCCD, MST Modulo-11 &amp; cấp quyền Tenant cho đối tác mới.
                              </p>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInternalTab('RBAC_MATRIX')}
                              className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-4 text-left transition-colors hover:bg-white"
                            >
                              <div className="font-semibold text-[#0F172A]">
                                04 • Xem Ma trận Phân quyền Nội bộ →
                              </div>
                              <p className="mt-1 text-neutral-600 leading-relaxed">
                                Kiểm tra phạm vi quyền hạn của MANAGER, STAFF, ACCOUNTANT và ADMIN trên hệ thống.
                              </p>
                            </button>
                          )}
                        </div>
                      </div>

                      {activeRole === 'ADMIN' && (
                        <div className="rounded-[26px] bg-white p-6 border border-neutral-200/90 shadow-xs">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!newSportCode.trim() || !newSportName.trim()) return;
                              onAddSportDemo(newSportCode.trim().toUpperCase(), newSportName.trim());
                              setNewSportCode('');
                              setNewSportName('');
                            }}
                          >
                            <div className="mb-2.5 text-xs font-semibold text-[#0F172A]">
                              Mở thêm lĩnh vực thể thao mới trên sàn ({sports.length} lĩnh vực đang hoạt động)
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="text"
                                name="sportCode"
                                placeholder="Mã lĩnh vực (VD: FUTSAL)…"
                                value={newSportCode}
                                onChange={(e) => setNewSportCode(e.target.value)}
                                className="rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A]"
                              />
                              <input
                                type="text"
                                name="sportName"
                                placeholder="Tên hiển thị (VD: Bóng đá Futsal trong nhà)…"
                                value={newSportName}
                                onChange={(e) => setNewSportName(e.target.value)}
                                className="flex-1 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A]"
                              />
                              <ActionButton type="submit" variant="ink" size="sm">
                                Thêm lĩnh vực
                              </ActionButton>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {internalTab === 'RBAC_MATRIX' && (
                  <motion.div
                    key="tab-rbac"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EXPO_EASE }}
                    className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs"
                  >
                    <div className="border-b border-neutral-100 p-6">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#16422C]">
                        Role-Based Access Control (RBAC)
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
                        Ma trận Phân quyền Hệ thống Nội bộ &amp; Người dùng
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Quyền hạn được kiểm tra đồng bộ tại lớp giao diện React và tại các API Controller Spring Boot (RbacGuard).
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFC] text-neutral-600">
                          <tr>
                            <th className="px-6 py-3.5 font-semibold">Chức năng &amp; API Backend</th>
                            <th className="px-4 py-3.5 text-center font-bold text-[#0F172A]">ADMIN</th>
                            <th className="px-4 py-3.5 text-center font-bold text-[#16422C]">MANAGER (Chủ sân)</th>
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
                                <code className="text-[10.5px] text-neutral-400">{row.endpoint}</code>
                              </td>
                              {[row.admin, row.manager, row.accountant, row.staff, row.user].map((allowed, i) => (
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
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {internalTab === 'FINANCE_LEDGER' && (
                  <motion.div
                    key="tab-ledger"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EXPO_EASE }}
                    className="rounded-[26px] bg-white p-6 sm:p-7 border border-neutral-200/90 shadow-xs space-y-6"
                  >
                    {reconciliation && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-medium text-[#0E4F7E]">
                              Sổ Cái Kế Toán Kép Nội Bộ &amp; Đối Soát Định Kỳ
                            </span>
                            <h3 className="mt-0.5 text-lg sm:text-xl font-semibold text-[#0F172A]">
                              Báo cáo dòng tiền Ký quỹ, Hoàn cọc &amp; Hoa hồng sàn
                            </h3>
                          </div>
                          <span className="rounded-full bg-[#E7F7D4] px-3.5 py-1 text-xs font-semibold text-[#204E18]">
                            {reconciliation.doubleEntryBalanced ? 'Cân bằng Tổng Nợ = Tổng Có' : 'Cần kiểm tra'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Tổng thu hộ ký quỹ</div>
                            <div className="mt-1 tabular-nums text-base font-semibold text-[#0F172A]">
                              {formatVnd(reconciliation.totalEscrowCredits)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Hoa hồng sàn (10%)</div>
                            <div className="mt-1 tabular-nums text-base font-semibold text-[#16422C]">
                              {formatVnd(reconciliation.totalPlatformCommission)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Công nợ trả chủ sân</div>
                            <div className="mt-1 tabular-nums text-base font-semibold text-[#0E4F7E]">
                              {formatVnd(reconciliation.totalVenuePayable)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Đã hoàn trả khách</div>
                            <div className="mt-1 tabular-nums text-sm font-semibold text-[#16422C]">
                              {formatVnd(reconciliation.totalCustomerRefunds)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Tiền phạt bỏ lịch</div>
                            <div className="mt-1 tabular-nums text-sm font-semibold text-neutral-800">
                              {formatVnd(reconciliation.totalForfeitedDeposits)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/60">
                            <div className="text-[11px] text-neutral-500">Bảo toàn lịch sử</div>
                            <div className="mt-1 text-xs font-semibold text-[#0F172A]">
                              Append-Only Trigger
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {internalTab === 'ADMIN_KYC' && canReviewKyc && (
                  <motion.div
                    key="tab-kyc"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EXPO_EASE }}
                    className="rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#16422C]">
                          Hàng Đợi Thẩm Định Pháp Lý Nội Bộ
                        </span>
                        <h3 className="mt-0.5 text-lg font-semibold text-[#0F172A]">
                          Hồ sơ Đăng ký Chủ Cụm Sân ({kycQueue.length} hồ sơ)
                        </h3>
                      </div>
                    </div>

                    {kycQueue.length === 0 ? (
                      <div className="rounded-2xl bg-[#F8F9FA] p-5 text-xs text-neutral-500 border border-neutral-200/60">
                        Chưa có hồ sơ đối tác mới chờ duyệt. Người dùng sau khi qua bước kiểm định 7 tiêu chí pháp lý sẽ xuất hiện tại đây để Quản trị viên (ADMIN) rà soát kích hoạt.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {kycQueue.map((item) => (
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

                            {activeRole === 'ADMIN' && item.status === 'PENDING_REVIEW' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <ActionButton
                                  variant="forest"
                                  size="sm"
                                  disabled={reviewingId === item.id}
                                  onClick={() => handleReviewApplication(item.id, 'APPROVED')}
                                >
                                  Phê duyệt (Mở Tenant)
                                </ActionButton>
                                <ActionButton
                                  variant="outline"
                                  size="sm"
                                  disabled={reviewingId === item.id}
                                  onClick={() => handleReviewApplication(item.id, 'REJECTED')}
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
              </AnimatePresence>
            </div>
          </section>
        ))}

      {/* Optional Modal Fallback */}
      <AnimatePresence>
        {authModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overscroll-contain"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-modal-heading"
              className="w-full max-w-md rounded-[28px] bg-white p-7 text-[#0F172A] shadow-2xl border border-neutral-200"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <ArenaPulseLogo variant="dark" size="sm" />
                  <h3 id="auth-modal-heading" className="text-lg font-semibold">
                    Đăng nhập Hệ thống Nội bộ
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Đóng hộp thoại"
                  onClick={onCloseAuthModal}
                  className="self-start rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  Đóng
                </button>
              </div>
              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="fairway-user" className="mb-1 block text-xs font-medium text-neutral-700">
                    Tên đăng nhập
                  </label>
                  <input
                    id="fairway-user"
                    name="username"
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 bg-[#F8F9FA] px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="fairway-pass" className="mb-1 block text-xs font-medium text-neutral-700">
                    Mật khẩu
                  </label>
                  <input
                    id="fairway-pass"
                    name="password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 bg-[#F8F9FA] px-4 py-2.5 text-sm"
                  />
                </div>
                <ActionButton type="submit" variant="forest" size="md" className="w-full">
                  Đăng nhập
                </ActionButton>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
