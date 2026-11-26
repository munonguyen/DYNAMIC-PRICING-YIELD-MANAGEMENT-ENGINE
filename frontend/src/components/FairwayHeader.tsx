import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
  RoleCode,
} from '../types/marketplace';
import type { LessorPortalTabId } from './LessorPartnerPortal';
import { ArenaPulseLogo } from './ArenaPulseLogo';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

export interface PageNavItem {
  id: AppPageId;
  path: string;
  sectionId: string;
  label: string;
}

export const PAGE_NAV_ITEMS: PageNavItem[] = [
  { id: 'home', path: '/', sectionId: 'hero', label: 'Trang chủ' },
  { id: 'courts', path: '/courts', sectionId: 'marketplace', label: 'Thuê sân' },
  { id: 'news', path: '/news', sectionId: 'news', label: 'Bài viết' },
  { id: 'announcements', path: '/announcements', sectionId: 'announcements', label: 'Thông báo' },
  { id: 'rankings', path: '/rankings', sectionId: 'rankings', label: 'Xếp hạng' },
  { id: 'checkout', path: '/checkout', sectionId: 'booking-flow', label: 'Thanh toán & Vé' },
  { id: 'pricing', path: '/pricing', sectionId: 'yield-matrix', label: 'Định giá động' },
  { id: 'governance', path: '/governance', sectionId: 'command-center', label: 'Đăng ký chủ sân' },
];

export type AdminHeaderTabId =
  | 'OPERATIONS'
  | 'LESSOR_INSPECTOR'
  | 'RBAC_MATRIX'
  | 'FINANCE_LEDGER'
  | 'ADMIN_KYC';

interface InternalNavOption {
  key: string;
  label: string;
  targetPage: AppPageId;
  lessorTab?: LessorPortalTabId;
  adminTab?: AdminHeaderTabId;
}

interface FairwayHeaderProps {
  currentPage: AppPageId;
  onNavigate: (page: AppPageId) => void;
  activeRole: RoleCode;
  onSelectRole: (role: RoleCode) => void;
  session: AuthSession | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  lessorTab: LessorPortalTabId;
  onSelectLessorTab: (tab: LessorPortalTabId) => void;
  adminTab: AdminHeaderTabId;
  onSelectAdminTab: (tab: AdminHeaderTabId) => void;
  onOpenPublicShop?: (providerId: string) => void;
  onOpenChatDrawer?: () => void;
}

const ROLE_DISPLAY_NAMES: Record<RoleCode, string> = {
  USER: 'Khách đặt sân',
  MANAGER: 'Người cho thuê',
  STAFF: 'Nhân viên Sân',
  ACCOUNTANT: 'Kế toán Sàn',
  ADMIN: 'Super Admin',
};

export const FairwayHeader: React.FC<FairwayHeaderProps> = ({
  currentPage,
  onNavigate,
  activeRole,
  onSelectRole,
  session,
  onOpenAuthModal,
  onLogout,
  lessorTab,
  onSelectLessorTab,
  adminTab,
  onSelectAdminTab,
  onOpenPublicShop,
  onOpenChatDrawer,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isRetracted, setIsRetracted] = useState(false);
  const lastScrollYRef = useRef(0);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const { scrollY, scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const prev = lastScrollYRef.current;
    const delta = latest - prev;
    lastScrollYRef.current = latest;

    const nextCompact = latest > 44;
    if (nextCompact !== isCompact) {
      setIsCompact(nextCompact);
    }

    if (mobileOpen || accountMenuOpen || latest < 140) {
      if (isRetracted) setIsRetracted(false);
      return;
    }

    if (delta > 8 && latest > 300) {
      if (!isRetracted) setIsRetracted(true);
    } else if (delta < -6) {
      if (isRetracted) setIsRetracted(false);
    }
  });

  useEffect(() => {
    setMobileOpen(false);
    setAccountMenuOpen(false);
    setIsRetracted(false);
    setIsCompact(window.scrollY > 44);
  }, [currentPage, activeRole]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setAccountMenuOpen(false);
      }
    };
    const onOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onOutsideClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onOutsideClick);
    };
  }, []);

  const nativeRole: RoleCode = session?.roles?.[0]?.roleCode ?? 'USER';
  const isInternalWorkspaceMode = Boolean(session && activeRole !== 'USER');
  const canSwitchToInternal = Boolean(session && nativeRole !== 'USER');

  // --- PORTAL-SEPARATED INTERNAL NAVIGATION ITEMS ---
  const internalNavOptions: InternalNavOption[] =
    activeRole === 'MANAGER'
      ? [
          {
            key: 'lessor-overview',
            label: 'Tổng quan & Biểu đồ',
            targetPage: 'governance',
            lessorTab: 'OVERVIEW',
          },
          {
            key: 'lessor-courts',
            label: 'Quản lý Cụm Sân',
            targetPage: 'governance',
            lessorTab: 'COURTS_INVENTORY',
          },
          {
            key: 'lessor-addons',
            label: 'Nước & Dịch vụ',
            targetPage: 'governance',
            lessorTab: 'ADDON_PRODUCTS',
          },
          {
            key: 'lessor-pricing',
            label: 'Định giá Động',
            targetPage: 'pricing',
          },
          {
            key: 'lessor-shop',
            label: 'Gian hàng & Nhân sự',
            targetPage: 'governance',
            lessorTab: 'SHOP_AND_STAFF',
          },
          {
            key: 'lessor-wallet',
            label: 'Ví & Đối soát',
            targetPage: 'governance',
            lessorTab: 'ESCROW_WALLET',
          },
        ]
      : activeRole === 'STAFF'
        ? [
            {
              key: 'staff-qr',
              label: 'Quầy Soát Vé QR',
              targetPage: 'governance',
              lessorTab: 'OVERVIEW',
            },
            {
              key: 'staff-courts',
              label: 'Tình trạng Cụm Sân',
              targetPage: 'governance',
              lessorTab: 'COURTS_INVENTORY',
            },
            {
              key: 'staff-notices',
              label: 'Thông báo Cơ sở',
              targetPage: 'announcements',
            },
          ]
        : activeRole === 'ADMIN'
          ? [
              {
                key: 'admin-ops',
                label: 'Tổng quan & Biểu đồ',
                targetPage: 'governance',
                adminTab: 'OPERATIONS',
              },
              {
                key: 'admin-lessors',
                label: 'Giám sát Cho thuê',
                targetPage: 'governance',
                adminTab: 'LESSOR_INSPECTOR',
              },
              {
                key: 'admin-kyc',
                label: 'Duyệt KYC',
                targetPage: 'governance',
                adminTab: 'ADMIN_KYC',
              },
              {
                key: 'admin-ledger',
                label: 'Sổ cái & RBAC',
                targetPage: 'governance',
                adminTab: 'FINANCE_LEDGER',
              },
              {
                key: 'admin-pricing',
                label: 'Định giá Sàn',
                targetPage: 'pricing',
              },
              {
                key: 'admin-news',
                label: 'Thông báo & Tin',
                targetPage: 'announcements',
              },
            ]
          : [
              {
                key: 'acc-ops',
                label: 'Điều hành Đối soát',
                targetPage: 'governance',
                adminTab: 'OPERATIONS',
              },
              {
                key: 'acc-ledger',
                label: 'Sổ cái Kế toán Kép',
                targetPage: 'governance',
                adminTab: 'FINANCE_LEDGER',
              },
              {
                key: 'acc-kyc',
                label: 'Rà soát Hồ sơ KYC',
                targetPage: 'governance',
                adminTab: 'ADMIN_KYC',
              },
            ];

  const handleInternalNavClick = (opt: InternalNavOption) => {
    if (opt.lessorTab) onSelectLessorTab(opt.lessorTab);
    if (opt.adminTab) onSelectAdminTab(opt.adminTab);
    onNavigate(opt.targetPage);
    setMobileOpen(false);
  };

  const isInternalOptionActive = (opt: InternalNavOption): boolean => {
    if (opt.targetPage !== currentPage) return false;
    if (opt.targetPage !== 'governance') return true;
    if (opt.lessorTab) return lessorTab === opt.lessorTab;
    if (opt.adminTab) return adminTab === opt.adminTab;
    return false;
  };

  // --- CUSTOMER PORTAL ITEMS (ONLY WHEN !session OR activeRole === 'USER') ---
  const customerNavItems = PAGE_NAV_ITEMS.filter(
    (item) =>
      item.id !== 'pricing' &&
      (item.id !== 'checkout' || Boolean(session)) &&
      (item.id !== 'governance' || !session || nativeRole === 'USER')
  );

  const handleSwitchToCustomerMode = () => {
    setAccountMenuOpen(false);
    onSelectRole('USER');
    onNavigate('home');
  };

  const handleSwitchBackToInternalMode = () => {
    setAccountMenuOpen(false);
    if (nativeRole !== 'USER') {
      onSelectRole(nativeRole);
      onNavigate('governance');
    }
  };

  return (
    <>
      {isRetracted && (
        <div
          onMouseEnter={() => setIsRetracted(false)}
          className="fixed inset-x-0 top-0 z-50 h-5"
          aria-hidden="true"
        />
      )}

      <motion.header
        initial={false}
        animate={{
          y: isRetracted ? -104 : 0,
          opacity: isRetracted ? 0 : 1,
        }}
        transition={{ duration: 0.36, ease: EXPO_EASE }}
        className={`fixed inset-x-0 z-50 px-3 sm:px-6 transition-[top] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCompact ? 'top-2' : 'top-3'
        } ${isRetracted ? 'pointer-events-none' : 'pointer-events-auto'}`}
      >
        {/* NOTE: overflow-visible so the Account Name Card dropdown can float cleanly below header */}
        <div
          className={`relative mx-auto overflow-visible rounded-full border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isCompact
              ? 'max-w-[1180px] border-[#16422C]/14 bg-white/88 px-3.5 py-1.5 sm:px-4 shadow-[0_18px_46px_rgba(15,23,42,0.13)] backdrop-blur-2xl'
              : 'max-w-[1440px] border-neutral-200/90 bg-white/95 px-4 py-2.5 sm:px-6 shadow-[0_12px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl'
          }`}
        >
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            {/* Brand: Click routes to Governance in Internal mode, Home in Customer mode */}
            <button
              type="button"
              onClick={() => onNavigate(isInternalWorkspaceMode ? 'governance' : 'home')}
              className={`flex items-center gap-2 text-left text-[#0F172A] shrink-0 rounded-lg focus:outline-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isCompact ? 'scale-[0.94] origin-left' : 'scale-100 origin-left'
              }`}
            >
              <ArenaPulseLogo
                variant="dark"
                size="sm"
                showDomain={!isCompact && !isInternalWorkspaceMode}
              />
              {isInternalWorkspaceMode && (
                <span className="hidden md:inline-flex rounded-full bg-[#16422C]/10 border border-[#16422C]/20 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#16422C]">
                  {activeRole === 'ADMIN'
                    ? 'Admin Sàn'
                    : activeRole === 'ACCOUNTANT'
                      ? 'Kế toán Nội bộ'
                      : 'Hệ thống Nội bộ'}
                </span>
              )}
            </button>

            {/* Center Navigation Pill Rail — Completely Separated by Portal */}
            <nav
              aria-label={
                isInternalWorkspaceMode
                  ? 'Điều hướng Hệ thống Nội bộ'
                  : 'Điều hướng Sàn Đặt Sân'
              }
              className={`hidden xl:flex flex-1 mx-auto items-center justify-center gap-0.5 rounded-full border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isCompact
                  ? 'max-w-[780px] bg-[#F3F4F6]/80 border-neutral-200/60 p-0.5'
                  : 'max-w-[860px] bg-[#F3F4F6] border-neutral-200/70 p-1'
              }`}
            >
              {isInternalWorkspaceMode
                ? internalNavOptions.map((opt) => {
                    const isActive = isInternalOptionActive(opt);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleInternalNavClick(opt)}
                        className={`relative whitespace-nowrap rounded-full text-center font-medium transition-all duration-300 ${
                          isCompact ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12px]'
                        } ${
                          isActive
                            ? 'text-white font-semibold'
                            : 'text-neutral-600 hover:text-[#0F172A]'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="internal-header-pill"
                            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            className="absolute inset-0 rounded-full bg-[#16422C]"
                          />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                      </button>
                    );
                  })
                : customerNavItems.map((item) => {
                    const isActive =
                      currentPage === item.id ||
                      (currentPage === 'lessors' && item.id === 'courts');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={`relative whitespace-nowrap rounded-full text-center font-medium transition-all duration-300 ${
                          isCompact ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12px]'
                        } ${
                          isActive
                            ? 'text-white font-semibold'
                            : 'text-neutral-600 hover:text-[#0F172A]'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="customer-header-pill"
                            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            className="absolute inset-0 rounded-full bg-[#16422C]"
                          />
                        )}
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
            </nav>

            {/* Right Account Card Dropdown + (Customer-only Thuê sân CTA) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" ref={accountMenuRef}>
              {session ? (
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={accountMenuOpen}
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left transition ${
                      isInternalWorkspaceMode
                        ? 'border-[#16422C]/25 bg-[#F4F8F4] text-[#0F172A] hover:border-[#16422C]'
                        : 'border-neutral-200 bg-white text-[#0F172A] hover:border-[#16422C]'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16422C] text-[11px] font-bold text-[#E7F7D4]">
                      {session.fullName.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden sm:inline max-w-[200px] truncate text-xs font-semibold text-[#0F172A]">
                      {session.fullName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        activeRole === 'MANAGER'
                          ? 'bg-[#E7F7D4] text-[#16422C]'
                          : activeRole === 'ADMIN'
                            ? 'bg-amber-100 text-amber-900'
                            : activeRole === 'USER'
                              ? 'bg-neutral-100 text-neutral-700'
                              : 'bg-[#E6F1F8] text-[#0E4F7E]'
                      }`}
                    >
                      {activeRole}
                    </span>
                    <span className="text-[10px] text-neutral-400" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {/* ACCOUNT NAME CARD DROPDOWN MENU */}
                  <AnimatePresence>
                    {accountMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: EXPO_EASE }}
                        className="absolute right-0 mt-2.5 w-[310px] rounded-[24px] border border-neutral-200/95 bg-white p-4 text-xs text-[#0F172A] shadow-[0_24px_60px_rgba(15,23,42,0.18)] z-50"
                      >
                        {/* Identity Summary */}
                        <div className="border-b border-neutral-100 pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#16422C]">
                              {ROLE_DISPLAY_NAMES[activeRole]}
                            </span>
                            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                              @{session.username}
                            </span>
                          </div>
                          <div className="mt-1 text-sm font-bold text-[#0F172A]">
                            {session.fullName}
                          </div>
                          <div className="text-[11px] text-neutral-500">{session.email}</div>
                        </div>

                        {/* Role Switcher (MANAGER/ADMIN <-> USER Customer Marketplace) */}
                        {canSwitchToInternal && (
                          <div className="my-3 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-2.5 space-y-2">
                            <div className="text-[10.5px] font-semibold text-neutral-600">
                              Chuyển đổi Không gian Làm việc:
                            </div>
                            {isInternalWorkspaceMode ? (
                              <button
                                type="button"
                                onClick={handleSwitchToCustomerMode}
                                className="flex w-full items-center justify-between rounded-xl bg-white border border-neutral-200 px-3 py-2 font-semibold text-[#0F172A] hover:border-[#16422C] transition"
                              >
                                <span>⇄ Switch sang Cổng Khách (USER)</span>
                                <span className="text-[10px] text-neutral-400">Xem &amp; Đặt</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSwitchBackToInternalMode}
                                className="flex w-full items-center justify-between rounded-xl bg-[#16422C] px-3 py-2 font-bold text-white hover:bg-[#0F172A] transition"
                              >
                                <span>⚡ Vào Hệ thống Nội bộ ({nativeRole})</span>
                                <span className="text-[10px] text-[#E7F7D4]">Quản lý</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Essential Shortcuts inside Name Card */}
                        <div className="space-y-1 py-1">
                          {isInternalWorkspaceMode ? (
                            <>
                              {activeRole === 'MANAGER' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountMenuOpen(false);
                                      onSelectLessorTab('OVERVIEW');
                                      onNavigate('governance');
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                  >
                                    <span>📊 Dashboard Doanh thu &amp; Soát QR</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountMenuOpen(false);
                                      onSelectLessorTab('COURTS_INVENTORY');
                                      onNavigate('governance');
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                  >
                                    <span>🏟 Quản lý Cụm Sân &amp; Đăng Sân</span>
                                  </button>
                                  {session.managedProviderId && onOpenPublicShop && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAccountMenuOpen(false);
                                        onOpenPublicShop(session.managedProviderId!);
                                      }}
                                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                    >
                                      <span>🏪 Xem Hồ sơ Gian hàng Công khai</span>
                                      <span className="text-neutral-400">↗</span>
                                    </button>
                                  )}
                                </>
                              )}
                              {(activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountMenuOpen(false);
                                      onSelectAdminTab('OPERATIONS');
                                      onNavigate('governance');
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                  >
                                    <span>📊 Tổng quan &amp; Biểu đồ Toàn Sàn</span>
                                  </button>
                                  {activeRole === 'ADMIN' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAccountMenuOpen(false);
                                        onSelectAdminTab('LESSOR_INSPECTOR');
                                        onNavigate('governance');
                                      }}
                                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                    >
                                      <span>🏢 Giám sát Đối tác Cho thuê</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountMenuOpen(false);
                                      onSelectAdminTab('ADMIN_KYC');
                                      onNavigate('governance');
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                  >
                                    <span>✅ Hàng đợi Duyệt Hồ sơ KYC</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountMenuOpen(false);
                                      onSelectAdminTab('FINANCE_LEDGER');
                                      onNavigate('governance');
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                  >
                                    <span>⚖ Sổ cái Kép &amp; Đối soát</span>
                                  </button>
                                </>
                              )}
                              {onOpenChatDrawer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAccountMenuOpen(false);
                                    onOpenChatDrawer();
                                  }}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                >
                                  <span>💬 Hộp Chat Hỗ trợ Khách hàng</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAccountMenuOpen(false);
                                  onNavigate('checkout');
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                              >
                                <span>🎟 Vé QR &amp; Thanh toán của tôi</span>
                              </button>
                              {nativeRole === 'USER' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAccountMenuOpen(false);
                                    onNavigate('governance');
                                  }}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium hover:bg-[#F8FAFC]"
                                >
                                  <span>🏟 Đăng ký làm Chủ cụm sân (KYC)</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Logout Footer */}
                        <div className="mt-2 border-t border-neutral-100 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              onLogout();
                            }}
                            className="flex w-full items-center justify-center rounded-xl bg-rose-50 py-2 font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Đăng xuất tài khoản
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <ActionButton
                  variant="outline"
                  size="sm"
                  onClick={onOpenAuthModal}
                  className={`hidden sm:inline-flex transition-all duration-300 ${
                    isCompact ? 'py-1.5 text-[11.5px]' : ''
                  }`}
                >
                  Đăng nhập
                </ActionButton>
              )}

              {/* Primary Customer CTA — HIDDEN when logged into Internal Lessor/Staff/Admin Workspace */}
              {!isInternalWorkspaceMode && (
                <ActionButton
                  variant="ink"
                  size="sm"
                  arrow="up-right"
                  arrowBadge={!isCompact}
                  onClick={() => {
                    if (currentPage === 'courts') {
                      if (!session) {
                        onOpenAuthModal();
                      } else {
                        onNavigate('checkout');
                      }
                    } else {
                      onNavigate('courts');
                    }
                  }}
                  className={`transition-all duration-300 ${
                    isCompact ? 'py-1.5 text-[11.5px]' : ''
                  }`}
                >
                  {currentPage === 'courts'
                    ? session
                      ? 'Thanh toán'
                      : 'Đăng nhập đặt sân'
                    : 'Thuê sân'}
                </ActionButton>
              )}

              <button
                type="button"
                aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex xl:hidden rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:border-[#16422C]"
              >
                {mobileOpen ? 'Đóng' : 'Menu'}
              </button>
            </div>
          </div>

          <motion.div
            style={{ scaleX: smoothProgress }}
            className={`pointer-events-none absolute bottom-0 left-6 right-6 h-[2px] origin-left rounded-full bg-gradient-to-r from-[#16422C] via-emerald-500 to-[#84CC16] transition-opacity duration-300 ${
              isCompact ? 'opacity-85' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Mobile / Tablet Dropdown Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EXPO_EASE }}
              className="mx-auto mt-2.5 max-w-[1140px] rounded-2xl border border-neutral-200/90 bg-white/98 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl xl:hidden space-y-3"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {isInternalWorkspaceMode
                  ? internalNavOptions.map((opt) => {
                      const active = isInternalOptionActive(opt);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleInternalNavClick(opt)}
                          className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-[#16422C] text-white'
                              : 'bg-[#F8F9FA] text-neutral-800 hover:bg-neutral-100'
                          }`}
                        >
                          <span>{opt.label}</span>
                        </button>
                      );
                    })
                  : customerNavItems.map((item) => {
                      const isActive =
                        currentPage === item.id ||
                        (currentPage === 'lessors' && item.id === 'courts');
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-[#16422C] text-white'
                              : 'bg-[#F8F9FA] text-neutral-800 hover:bg-neutral-100'
                          }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
              </div>

              {!session && (
                <ActionButton variant="forest" size="sm" fullWidth onClick={onOpenAuthModal}>
                  Đăng nhập / Tạo tài khoản
                </ActionButton>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
};
