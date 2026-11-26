import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
  RoleCode,
} from '../types/marketplace';
import { ArenaPulseLogo } from './ArenaPulseLogo';
import { ActionButton } from './FairwayControls';

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

interface FairwayHeaderProps {
  currentPage: AppPageId;
  onNavigate: (page: AppPageId) => void;
  activeRole: RoleCode;
  onSelectRole: (role: RoleCode) => void;
  session: AuthSession | null;
  onOpenAuthModal: () => void;
}

export const FairwayHeader: React.FC<FairwayHeaderProps> = ({
  currentPage,
  onNavigate,
  activeRole,
  session,
  onOpenAuthModal,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isInternalSession = Boolean(session && activeRole !== 'USER');
  const canAccessPricing = Boolean(
    session && (activeRole === 'MANAGER' || activeRole === 'ADMIN')
  );
  const visibleNavItems = PAGE_NAV_ITEMS.filter(
    (item) => item.id !== 'pricing' || canAccessPricing
  );
  const getNavLabel = (item: PageNavItem) => {
    if (item.id === 'pricing') {
      return activeRole === 'ADMIN' ? 'Định giá Sàn' : 'Định giá Chủ sân';
    }
    if (item.id === 'governance' && isInternalSession) {
      return activeRole === 'ADMIN' ? 'Quản trị Admin' : 'Nội bộ Chủ sân';
    }
    return item.label;
  };

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 sm:px-6">
      <div className="mx-auto max-w-[1440px] rounded-full border border-neutral-200/90 bg-white/95 px-4 py-2 sm:px-6 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center text-left text-[#0F172A] shrink-0 rounded-lg focus:outline-none"
          >
            <ArenaPulseLogo variant="dark" size="sm" />
          </button>

          {/* Center Navigation */}
          <nav
            aria-label="Điều hướng các phân khu"
            className="hidden xl:flex flex-1 max-w-[820px] mx-auto items-center justify-center gap-0.5 rounded-full bg-[#F3F4F6] p-1 border border-neutral-200/70"
          >
            {visibleNavItems.map((item) => {
              const isActive =
                currentPage === item.id ||
                (currentPage === 'lessors' && item.id === 'courts');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative whitespace-nowrap rounded-full px-3 py-1.5 text-center text-[12px] font-medium transition-colors ${
                    isActive ? 'text-white font-semibold' : 'text-neutral-600 hover:text-[#0F172A]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="global-page-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-[#16422C]"
                    />
                  )}
                  <span className="relative z-10">{getNavLabel(item)}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Auth + Primary CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <ActionButton
              variant="outline"
              size="sm"
              onClick={onOpenAuthModal}
              className="hidden sm:inline-flex"
            >
              {session ? `${session.fullName} (${activeRole})` : 'Đăng nhập'}
            </ActionButton>

            <ActionButton
              variant="ink"
              size="sm"
              arrow="up-right"
              arrowBadge
              onClick={() => onNavigate(currentPage === 'courts' ? 'checkout' : 'courts')}
            >
              {currentPage === 'courts' ? 'Thanh toán' : 'Thuê sân'}
            </ActionButton>

            <button
              type="button"
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex xl:hidden rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800"
            >
              {mobileOpen ? 'Đóng' : 'Menu'}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl xl:hidden"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {visibleNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold ${
                      currentPage === item.id
                        ? 'bg-[#16422C] text-white'
                        : 'bg-[#F8F9FA] text-neutral-800'
                    }`}
                  >
                    <span>{getNavLabel(item)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};
