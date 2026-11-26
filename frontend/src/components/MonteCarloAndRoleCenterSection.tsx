import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
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
import { marketplaceApi } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ArenaPulseLogo } from './ArenaPulseLogo';
import { ActionButton } from './FairwayControls';
import { LessorOnboardingSection } from './LessorOnboardingSection';
import { LessorPartnerPortal, type LessorPortalTabId } from './LessorPartnerPortal';
import { AdminExecutivePortal } from './AdminExecutivePortal';
import type { AdminHeaderTabId } from './FairwayHeader';

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
  onLogout?: () => void;
  onOpenInternalLogin?: () => void;
  onNavigate?: (page: AppPageId) => void;
  onOpenPublicShop?: (providerId: string) => void;
  lessorTab?: LessorPortalTabId;
  onSelectLessorTab?: (tab: LessorPortalTabId) => void;
  controlledAdminTab?: AdminHeaderTabId;
  onSelectAdminTab?: (tab: AdminHeaderTabId) => void;
  listings?: PublishedListing[];
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
  onPreviewCourt?: (listing: PublishedListing) => void;
}

type InternalTab =
  | 'OPERATIONS'
  | 'USER_ACCOUNTS'
  | 'LESSOR_INSPECTOR'
  | 'RBAC_MATRIX'
  | 'FINANCE_LEDGER'
  | 'ADMIN_KYC';

const INTERNAL_ROLES: RoleCode[] = ['MANAGER', 'STAFF', 'ACCOUNTANT', 'ADMIN'];

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
  onLogout,
  onOpenInternalLogin,
  onNavigate,
  onOpenPublicShop,
  lessorTab,
  onSelectLessorTab,
  controlledAdminTab,
  onSelectAdminTab,
  listings = [],
  onUpdateListingServices,
  onUpdateListingPricing,
  onToggleListingPublished,
  onUpdateListingSlots,
  onCreateNewListing,
  onUpdateProviderProfile,
  onUploadCourtPhoto,
  onPreviewCourt,
}) => {
  const [internalAdminTab, setInternalAdminTab] = useState<InternalTab>('OPERATIONS');
  const internalTab = controlledAdminTab ?? internalAdminTab;
  const setInternalTab = (tab: InternalTab) => {
    setInternalAdminTab(tab);
    onSelectAdminTab?.(tab);
  };
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [kycQueue, setKycQueue] = useState<LessorApplicationRecord[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const isInternalAuthorized = Boolean(session && INTERNAL_ROLES.includes(activeRole));
  const canReviewKyc = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT';

  useEffect(() => {
    if (!isInternalAuthorized) {
      setReconciliation(null);
      return;
    }
    const request = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const data = await marketplaceApi.getReconciliation(request.signal);
        if (!request.signal.aborted) setReconciliation(data);
      } catch {
        if (!request.signal.aborted) setReconciliation(null);
      } finally {
        loading = false;
      }
    };
    setReconciliation(null);
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15_000);
    return () => {
      request.abort();
      window.clearInterval(timer);
    };
  }, [isInternalAuthorized, session?.userId]);

  useEffect(() => {
    if (!isInternalAuthorized) return;
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

  return (
    <div className={modalOnly ? '' : 'bg-[#F7F9F8]'}>
      {!modalOnly &&
        (!session ? (
          <section id="command-center" className="py-16 sm:py-24">
            <div className="mx-auto max-w-[960px] px-4 sm:px-8">
              <ScrollReveal className="rounded-[30px] border border-neutral-200/90 bg-white p-7 sm:p-11 shadow-[0_24px_60px_rgba(15,23,42,0.06)] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
                    Cổng Đối tác Cho thuê Sân &amp; Quản trị • ArenaPulse
                  </span>
                  <span className="rounded-full bg-[#F4F8F4] border border-[#16422C]/20 px-3 py-1 text-[11px] font-semibold text-[#16422C]">
                    Bảo mật Phiên &amp; Phân quyền Theo Cơ sở
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-[34px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0F172A]">
                    Hệ thống Quản trị Người Cho Thuê Sân Thể Thao Chuyên Nghiệp
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    Đăng nhập bằng tài khoản <strong>Chủ cụm sân (MANAGER)</strong> được cấp để mở trung tâm điều hành riêng của cơ sở: đăng sân mới, đóng/mở ca trống, thiết lập Nước uống &amp; Dịch vụ riêng từng sân, quét vé QR 1 lần và rút tiền ký quỹ. Người chơi thông thường sau khi đăng nhập có thể nộp hồ sơ KYC trở thành Đối tác Cho thuê mới.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                  {[
                    {
                      title: '1. Điều phối Lịch & Soát QR',
                      desc: 'Theo dõi đơn đặt sân trực tuyến theo thời gian thực, xác thực vé QR 1 lần tại quầy.',
                    },
                    {
                      title: '2. Đăng Sân & Dịch vụ Đi kèm',
                      desc: 'Chủ động mở/ẩn cụm sân, chỉnh số sân trống và tạo menu nước uống/dụng cụ riêng.',
                    },
                    {
                      title: '3. Định giá Giờ Vàng & Ví Ký quỹ',
                      desc: 'Tối ưu giá sàn/trần tự động và rút tiền đối soát minh bạch về ngân hàng đã KYC.',
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
                    Tài khoản Chủ sân &amp; nhân sự nội bộ được cấp riêng và bảo mật theo từng cơ sở sau khi thẩm định KYC.
                  </span>
                  <ActionButton
                    variant="forest"
                    size="lg"
                    arrow="right"
                    onClick={() => onOpenInternalLogin?.()}
                  >
                    Đăng nhập Hệ thống Cho thuê
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
        ) : activeRole === 'MANAGER' || activeRole === 'STAFF' ? (
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
            controlledTab={lessorTab}
            onSelectTab={onSelectLessorTab}
            onUpdateListingPricing={(gid, patch) => onUpdateListingPricing?.(gid, patch)}
            onUpdateListingServices={(gid, srv) => onUpdateListingServices?.(gid, srv)}
            onToggleListingPublished={(gid) => onToggleListingPublished?.(gid)}
            onUpdateListingSlots={(gid, slots) => onUpdateListingSlots?.(gid, slots)}
            onCreateNewListing={(item) => onCreateNewListing?.(item)}
            onUpdateProviderProfile={(pid, patch) => onUpdateProviderProfile?.(pid, patch)}
            onUploadCourtPhoto={onUploadCourtPhoto}
            onLogout={onLogout}
          />
        ) : (
          <AdminExecutivePortal
            session={session}
            activeRole={activeRole}
            sports={sports}
            onAddSportDemo={onAddSportDemo}
            listings={listings}
            reconciliation={reconciliation}
            kycQueue={kycQueue}
            reviewingId={reviewingId}
            onReviewApplication={handleReviewApplication}
            staffChatEnabled={staffChatEnabled}
            onToggleStaffChat={onToggleStaffChat}
            onOpenChatDrawer={onOpenChatDrawer}
            onNavigate={onNavigate}
            onOpenPublicShop={onOpenPublicShop}
            onPreviewCourt={onPreviewCourt}
            controlledTab={internalTab}
            onSelectTab={setInternalTab}
            onUpdateListingServices={onUpdateListingServices}
            onUpdateListingPricing={onUpdateListingPricing}
            onToggleListingPublished={onToggleListingPublished}
            onUpdateListingSlots={onUpdateListingSlots}
            onCreateNewListing={onCreateNewListing}
            onUpdateProviderProfile={onUpdateProviderProfile}
            onUploadCourtPhoto={onUploadCourtPhoto}
            onLogout={onLogout}
          />
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
