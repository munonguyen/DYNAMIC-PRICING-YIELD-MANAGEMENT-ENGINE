import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Award,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Coffee,
  Compass,
  Home,
  Settings,
  Wallet,
  Zap,
} from 'lucide-react';
import type {
  AppPageId,
  AuthSession,
  CancelBookingResult,
  CourtServiceOption,
  HoldSlotResult,
  NewsArticleItem,
  PriceQuote,
  PublishedListing,
  RoleCode,
  SlotListingQuote,
  SportTypeItem,
  VenueAnnouncement,
  VenueProviderInfo,
} from './types/marketplace';
import {
  applyGalleryMediaToListing,
  marketplaceApi,
  readSavedAuthSession,
  saveAuthSessionToStorage,
} from './api/marketplaceApi';
import { INITIAL_ANNOUNCEMENTS, VENUE_LOCATIONS } from './data/announcementsData';
import { INITIAL_NEWS_ARTICLES } from './data/newsAndRankingsData';
import {
  hydrateListingsWithLessorServices,
  savePersistedLessorServicesForGroup,
} from './data/courtServicesData';
import {
  FairwayHeader,
  PAGE_NAV_ITEMS,
  type AdminHeaderTabId,
} from './components/FairwayHeader';
import type { LessorPortalTabId } from './components/LessorPartnerPortal';
import { FloatingChatWidget } from './components/FloatingChatWidget';
import { HomePage } from './pages/HomePage';
import { EXPO_EASE, ScrollReveal } from './components/motionPrimitives';
import { ArenaPulseLogo } from './components/ArenaPulseLogo';

const CourtsPage = lazy(() =>
  import('./pages/CourtsPage').then((m) => ({ default: m.CourtsPage }))
);
const LessorShopPage = lazy(() =>
  import('./pages/LessorShopPage').then((m) => ({ default: m.LessorShopPage }))
);
const AnnouncementsRoutePage = lazy(() =>
  import('./pages/AnnouncementsRoutePage').then((m) => ({ default: m.AnnouncementsRoutePage }))
);
const NewsPage = lazy(() =>
  import('./pages/NewsPage').then((m) => ({ default: m.NewsPage }))
);
const RankingsPage = lazy(() =>
  import('./pages/RankingsPage').then((m) => ({ default: m.RankingsPage }))
);
const CustomerSchedulePage = lazy(() =>
  import('./pages/CustomerSchedulePage').then((m) => ({ default: m.CustomerSchedulePage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const PricingPage = lazy(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage }))
);
const GovernancePage = lazy(() =>
  import('./pages/GovernancePage').then((m) => ({ default: m.GovernancePage }))
);
const LoginPage = lazy(() =>
  import('./components/LoginPage').then((m) => ({ default: m.LoginPage }))
);

const ROLE_PORTAL_PATH: Partial<Record<RoleCode, string>> = {
  MANAGER: '/portal/lessor',
  STAFF: '/portal/staff',
  ACCOUNTANT: '/portal/accountant',
  ADMIN: '/portal/admin',
};

function resolvePageFromPath(pathname: string): AppPageId {
  if (pathname === '/login') return 'login';
  if (Object.values(ROLE_PORTAL_PATH).includes(pathname)) return 'governance';
  if (pathname === '/lessors' || pathname.startsWith('/lessor/')) return 'lessors';
  const found = PAGE_NAV_ITEMS.find((p) => p.path === pathname);
  return found ? found.id : 'home';
}

function resolveProviderIdFromPath(pathname: string): string | null {
  if (pathname.startsWith('/lessor/')) {
    const id = decodeURIComponent(pathname.slice('/lessor/'.length)).trim();
    return id || null;
  }
  return null;
}

export function App() {
  const [currentPage, setCurrentPage] = useState<AppPageId>(() =>
    resolvePageFromPath(window.location.pathname)
  );

  const [sports, setSports] = useState<SportTypeItem[]>([]);
  const [listings, setListings] = useState<PublishedListing[]>([]);
  const [operationNotice, setOperationNotice] = useState<string | null>(null);

  const publicListings = useMemo(
    () => listings.filter((l) => l.published !== false),
    [listings]
  );

  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [articles, setArticles] = useState<NewsArticleItem[]>(INITIAL_NEWS_ARTICLES);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);

  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [checkinFilter, setCheckinFilter] = useState<'ALL' | 'QR_STAFF' | 'PIN_COUNTER' | 'MANUAL'>('ALL');
  const [activeRole, setActiveRole] = useState<RoleCode>(
    () => readSavedAuthSession()?.activeRole ?? 'USER'
  );

  const [activeListing, setActiveListing] = useState<PublishedListing | null>(null);
  const [activeSlotStart, setActiveSlotStart] = useState<string | null>(null);
  const [activeQuote, setActiveQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);

  const [holdResult, setHoldResult] = useState<HoldSlotResult | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelBookingResult | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600);

  const [session, setSession] = useState<AuthSession | null>(() => {
    const saved = readSavedAuthSession();
    if (saved?.session?.accessToken) {
      marketplaceApi.setAccessToken(saved.session.accessToken);
      return saved.session;
    }
    return null;
  });
  const [returnPageAfterLogin, setReturnPageAfterLogin] = useState<AppPageId>('home');
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(() =>
    resolveProviderIdFromPath(window.location.pathname)
  );
  const [followedProviderIds, setFollowedProviderIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem('arenapulse_followed_providers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeChatProviderId, setActiveChatProviderId] = useState<string | null>(null);
  const [chatContextListing, setChatContextListing] = useState<PublishedListing | null>(null);
  const [requestedCourtDetailId, setRequestedCourtDetailId] = useState<string | null>(null);
  const [selectedServiceQuantities, setSelectedServiceQuantities] = useState<
    Record<string, number>
  >({});
  const [lessorTab, setLessorTab] = useState<LessorPortalTabId>('OVERVIEW');
  const [adminTab, setAdminTab] = useState<AdminHeaderTabId>('OPERATIONS');

  const navigateTo = useCallback(
    (page: AppPageId, portalRole: RoleCode = activeRole) => {
      if (page === 'login' && currentPage !== 'login') {
        setReturnPageAfterLogin(currentPage);
      }
      const targetPath =
        page === 'login'
          ? '/login'
          : page === 'lessors'
            ? selectedProviderId
              ? `/lessor/${encodeURIComponent(selectedProviderId)}`
              : '/lessors'
            : page === 'governance' && ROLE_PORTAL_PATH[portalRole]
              ? ROLE_PORTAL_PATH[portalRole]!
              : (PAGE_NAV_ITEMS.find((p) => p.id === page) ?? PAGE_NAV_ITEMS[0]).path;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      setCurrentPage(page);
    },
    [activeRole, currentPage, selectedProviderId]
  );

  useEffect(() => {
    const onPopState = () => {
      setCurrentPage(resolvePageFromPath(window.location.pathname));
      const pid = resolveProviderIdFromPath(window.location.pathname);
      if (pid) setSelectedProviderId(pid);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    if (!path.startsWith('/portal/')) return;
    if (!session || !session.roles.some((grant) => grant.roleCode === activeRole)) {
      navigateTo('login');
    } else if (ROLE_PORTAL_PATH[activeRole] !== path) {
      navigateTo(activeRole === 'USER' ? 'courts' : 'governance');
    }
  }, [activeRole, currentPage, navigateTo, session]);

  const tenantId = session?.roles.find(grant => grant.roleCode === activeRole && grant.scope === 'TENANT')?.tenantId;
  const currentQuoteRequest = useRef(0);
  const quoteOwner = useRef<string | undefined>(undefined);

  const selectSlotAndQuote = useCallback(async (listing: PublishedListing, slotStart: string) => {
    const requestId = ++currentQuoteRequest.current;
    setActiveListing(listing);
    setSelectedServiceQuantities({});
    setActiveSlotStart(slotStart);
    setActiveQuote(null);
    setQuoteLoading(true);
    setHoldResult(null);
    setCancelResult(null);
    try {
      const { quote } = await marketplaceApi.getPriceQuote(listing, slotStart);
      if (currentQuoteRequest.current !== requestId) return;
      quoteOwner.current = session?.userId;
      setActiveQuote(quote);
      setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000)));
      setOperationNotice(null);
    } catch (error) {
      if (currentQuoteRequest.current === requestId) {
        setOperationNotice(error instanceof Error ? error.message : 'Chưa tải được giá sân.');
      }
    } finally {
      if (currentQuoteRequest.current === requestId) setQuoteLoading(false);
    }
  }, [session?.userId]);

  const refreshListings = useCallback(async () => {
    const catalogue = await marketplaceApi.checkBackendAndLoadCatalogue();
    if (!catalogue.live) throw new Error('Chưa tải được danh mục sân từ hệ thống.');
    const managed = tenantId ? await marketplaceApi.getManagedListings(tenantId) : [];
    const byId = new Map(catalogue.listings.map(item => [item.groupId, item]));
    for (const item of managed) byId.set(item.groupId, item);
    const current = [...byId.values()];
    setSports(catalogue.sports);
    setListings(current);
    setActiveListing(listing => listing ? (byId.get(listing.groupId) ?? null) : null);
    return current;
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    refreshListings().then(current => {
      const suggested = current.find(item => item.published !== false && item.upcomingSlots.length > 0);
      if (active && suggested && !activeListing) void selectSlotAndQuote(suggested, suggested.upcomingSlots[0].slotStart);
    }).catch(error => {
      if (active) setOperationNotice(error.message);
    });
    return () => { active = false; };
  }, [refreshListings, selectSlotAndQuote]);

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;
    marketplaceApi.getCurrentProfile().then(profile => {
      if (!active) return;
      setSession(current => current?.userId === profile.id ? { ...current, roles: profile.roles } : null);
      setActiveRole(current => current === 'USER' || profile.roles.some(grant => grant.roleCode === current)
        ? current : profile.roles[0]?.roleCode ?? 'USER');
    }).catch(() => {
      if (!active) return;
      marketplaceApi.setAccessToken(null);
      saveAuthSessionToStorage(null, 'USER');
      setSession(null);
      setActiveRole('USER');
    });
    return () => { active = false; };
  }, [session?.accessToken]);

  const shouldTickCountdown =
    (currentPage === 'checkout' || Boolean(holdResult)) &&
    !cancelResult &&
    remainingSeconds > 0;

  useEffect(() => {
    if (!shouldTickCountdown) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [shouldTickCountdown]);

  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');
  const countdownLabel = remainingSeconds === 0 ? 'HẾT HẠN' : `${mm}:${ss}`;
  const isHoldExpired = remainingSeconds === 0 && !cancelResult;

  const handleProceedToBooking = () => {
    if (!session) {
      setReturnPageAfterLogin('checkout');
      if (window.location.pathname !== '/login') {
        window.history.pushState({}, '', '/login');
      }
      setCurrentPage('login');
      return;
    }
    navigateTo('checkout');
  };

  const handleHoldSlot = async () => {
    if (!session) {
      handleProceedToBooking();
      return;
    }
    if (!activeListing || !activeQuote || remainingSeconds === 0) return;
    if (quoteOwner.current !== session.userId && activeSlotStart) {
      await selectSlotAndQuote(activeListing, activeSlotStart);
      throw new Error('Giá đã được cập nhật theo phiên của bạn. Vui lòng kiểm tra lại rồi giữ sân.');
    }
    setBusyStep('HOLD');
    try {
      const { hold } = await marketplaceApi.holdCourtSlot(activeListing, activeQuote, session.userId);
      setHoldResult(hold);
      if (hold.holdExpiresAt) {
        setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(hold.holdExpiresAt) - Date.now()) / 1000)));
      }
    } finally {
      setBusyStep(null);
    }
  };

  const handleCancelBooking = async (venueInitiated: boolean) => {
    if (!holdResult) return;
    const res = await marketplaceApi.cancelReservation(holdResult, venueInitiated);
    setCancelResult(res);
  };

  const handleResetFlow = () => {
    if (activeListing && activeSlotStart) {
      selectSlotAndQuote(activeListing, activeSlotStart);
    }
  };

  const handleAddSportDemo = (code: string, name: string) => {
    setSports((prev) =>
      prev.some((s) => s.code === code)
        ? prev
        : [...prev, { id: prev.length + 10, code, name, status: 'ACTIVE' }]
    );
  };

  const handleOpenVenueChat = (listing: PublishedListing) => {
    setActiveListing(listing);
    setActiveChatProviderId(listing.provider?.providerId ?? null);
    setChatContextListing(listing);
    setChatOpen(true);
  };

  const handleOpenLessorChat = (providerId: string, contextListing?: PublishedListing) => {
    if (contextListing) {
      setActiveListing(contextListing);
      setChatContextListing(contextListing);
    } else {
      setChatContextListing(null);
    }
    setActiveChatProviderId(providerId);
    setChatOpen(true);
  };

  const handleOpenLessorShop = (providerId: string) => {
    setSelectedProviderId(providerId);
    const targetPath = `/lessor/${encodeURIComponent(providerId)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setCurrentPage('lessors');
  };

  const handleToggleFollowProvider = (providerId: string) => {
    setFollowedProviderIds((prev) => {
      const next = prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId];
      try {
        window.localStorage.setItem('arenapulse_followed_providers', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const runVenueWrite = async (write: () => Promise<unknown>, success: string) => {
    try {
      await write();
      setOperationNotice(success);
    } catch (error) {
      setOperationNotice(error instanceof Error ? error.message : 'Chưa ghi được dữ liệu.');
      throw error;
    }
  };

  const handleUpdateListingServices = (groupId: string, services: CourtServiceOption[]) => {
    void runVenueWrite(async () => {
      await marketplaceApi.updateGroupSettings(groupId, { addOnServices: services });
      await refreshListings();
    }, 'Đã lưu dịch vụ vào hệ thống.').catch(() => {});
  };

  const handleClearServices = () => {
    setSelectedServiceQuantities({});
  };

  const handleChangeServiceQuantity = (serviceId: string, nextQty: number) => {
    const safeQty = Math.max(0, nextQty);
    setSelectedServiceQuantities((prev) => {
      const next = { ...prev };
      if (safeQty === 0) {
        delete next[serviceId];
      } else {
        next[serviceId] = safeQty;
      }
      return next;
    });
  };

  const handleSelectCourtFromExternal = (
    listing: PublishedListing,
    preferredSlotStart?: string
  ) => {
    const slot =
      preferredSlotStart ||
      listing.upcomingSlots.find((s) => s.availableCourts > 0)?.slotStart ||
      listing.upcomingSlots[0]?.slotStart;
    if (slot) {
      selectSlotAndQuote(listing, slot);
    } else {
      setActiveListing(listing);
    }
    setRequestedCourtDetailId(listing.groupId);
    navigateTo('courts');
  };

  const handlePublishAnnouncement = (
    draft: Omit<VenueAnnouncement, 'id' | 'publishedAt'>
  ) => {
    const created: VenueAnnouncement = {
      ...draft,
      id: `ann-${Date.now()}`,
      publishedAt: 'Vừa xong',
    };
    setAnnouncements((prev) => [created, ...prev]);
  };

  const handlePublishArticle = (
    draft: Omit<NewsArticleItem, 'id' | 'slug' | 'publishedDate'>
  ) => {
    const id = `news-${Date.now()}`;
    const created: NewsArticleItem = {
      ...draft,
      id,
      slug: id,
      publishedDate: new Date().toLocaleDateString('vi-VN'),
    };
    setArticles((prev) => [created, ...prev]);
  };

  const handleBrowseVenueCourts = (venueName: string, sportCode?: string) => {
    const loc = VENUE_LOCATIONS.find((l) => l.venueName === venueName);
    setSelectedLocationId(loc ? loc.locationId : 'ALL');
    setSelectedSport(sportCode ?? 'ALL');
    navigateTo('courts');
  };

  const handleUpdateListingPricing = (groupId: string, patch: {
    basePrice: number; minPrice: number; maxPrice: number; depositPercent: number;
    checkinMode?: 'QR_STAFF' | 'PIN_COUNTER' | 'MANUAL';
  }) => {
    void runVenueWrite(async () => {
      await marketplaceApi.updateGroupSettings(groupId, patch);
      const fresh = await refreshListings();
      const listing = fresh.find(item => item.groupId === groupId);
      if (listing && activeListing?.groupId === groupId && activeSlotStart) void selectSlotAndQuote(listing, activeSlotStart);
    }, 'Đã lưu cấu hình sân.').catch(() => {});
  };

  const handleToggleListingPublished = (groupId: string) => {
    const listing = listings.find(item => item.groupId === groupId);
    if (!listing) return;
    void runVenueWrite(async () => {
      await marketplaceApi.publishGroup(groupId, listing.published === false);
      await refreshListings();
    }, 'Đã cập nhật trạng thái công bố.').catch(() => {});
  };

  const handleCreateListingSlot = (groupId: string, start: string, end: string) =>
    runVenueWrite(async () => {
      await marketplaceApi.createBusinessSlot(groupId, start, end);
      await refreshListings();
    }, 'Đã tạo ca sân.');

  const handleCreateNewListing = async (listing: PublishedListing) => {
    if (!listing.tenantId) throw new Error('Tài khoản cần quyền quản lý cơ sở.');
    await runVenueWrite(async () => {
      await marketplaceApi.createManagedCourt(listing, listing.tenantId);
      await refreshListings();
    }, 'Đã tạo cụm sân nháp. Hãy tạo ca trước khi công bố.');
  };

  const handleUpdateProviderProfile = (
    _providerId: string, _patch: Partial<Pick<VenueProviderInfo, 'shopSlogan' | 'voucherLabel' | 'responseTimeLabel'>>
  ) => {
    setOperationNotice('Hệ thống chưa hỗ trợ lưu nội dung quảng bá gian hàng.');
  };

  const handleLogoutSession = () => {
    void marketplaceApi.logout().catch(() => {});
    marketplaceApi.setAccessToken(null);
    saveAuthSessionToStorage(null, 'USER');
    setSession(null);
    setActiveRole('USER');
  };

  const handleUploadCourtPhoto = async (
    groupId: string,
    file: File,
    caption: string,
    isCover: boolean
  ) => {
    const { item, persistedToBackend } = await marketplaceApi.uploadCourtPhoto(
      groupId,
      file,
      caption,
      isCover
    );

    const updateOne = (listing: PublishedListing): PublishedListing => {
      if (listing.groupId !== groupId) return listing;
      const existingMedia = listing.galleryMedia ?? [];
      const nextMedia = item.isCover
        ? [item, ...existingMedia.map((m) => ({ ...m, isCover: false }))]
        : [...existingMedia, item];
      return applyGalleryMediaToListing(listing, nextMedia);
    };

    setListings((prev) => prev.map(updateOne));
    setActiveListing((prev) => (prev ? updateOne(prev) : prev));
    return { persistedToBackend };
  };

  const handleSetCoverCourtPhoto = async (groupId: string, mediaId: string) => {
    await marketplaceApi.setCoverCourtPhoto(groupId, mediaId);
    const updateOne = (listing: PublishedListing): PublishedListing => {
      if (listing.groupId !== groupId) return listing;
      const existingMedia = listing.galleryMedia ?? [];
      const nextMedia = existingMedia.map((m) => ({
        ...m,
        isCover: m.mediaId === mediaId,
      }));
      return applyGalleryMediaToListing(listing, nextMedia);
    };
    setListings((prev) => prev.map(updateOne));
    setActiveListing((prev) => (prev ? updateOne(prev) : prev));
  };

  const handleDeleteCourtPhoto = async (groupId: string, mediaId: string) => {
    await marketplaceApi.deleteCourtPhoto(groupId, mediaId);
    const updateOne = (listing: PublishedListing): PublishedListing => {
      if (listing.groupId !== groupId) return listing;
      const remaining = (listing.galleryMedia ?? []).filter((m) => m.mediaId !== mediaId);
      if (remaining.length > 0 && !remaining.some((m) => m.isCover)) {
        remaining[0] = { ...remaining[0], isCover: true };
      }
      return applyGalleryMediaToListing(listing, remaining);
    };
    setListings((prev) => prev.map(updateOne));
    setActiveListing((prev) => (prev ? updateOne(prev) : prev));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-white text-[#0F172A]">
      {currentPage !== 'login' && (
        <FairwayHeader
          currentPage={currentPage}
          onNavigate={navigateTo}
          activeRole={activeRole}
          onSelectRole={(role) => {
            setActiveRole(role);
            saveAuthSessionToStorage(session, role);
          }}
          session={session}
          onOpenAuthModal={() => navigateTo('login')}
          onLogout={handleLogoutSession}
          lessorTab={lessorTab}
          onSelectLessorTab={setLessorTab}
          adminTab={adminTab}
          onSelectAdminTab={setAdminTab}
          onOpenPublicShop={handleOpenLessorShop}
          onOpenChatDrawer={() => setChatOpen(true)}
        />
      )}

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[1400px] px-8 py-32 text-center text-sm text-neutral-400">
              Đang tải trang…
            </div>
          }
        >
          {operationNotice && (
            <div className="fixed bottom-5 left-5 right-5 z-[80] flex items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white p-3 text-sm shadow-lg sm:right-auto" role="status">
              {operationNotice}
              <button type="button" onClick={() => setOperationNotice(null)} aria-label="Đóng thông báo">×</button>
            </div>
          )}
          <AnimatePresence
            mode="wait"
            onExitComplete={() => {
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }}
          >
            {currentPage === 'home' && (
              <motion.div
                key="page-home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <HomePage
                  sports={sports}
                  listings={publicListings}
                  locations={VENUE_LOCATIONS}
                  activeQuote={activeQuote}
                  onNavigate={navigateTo}
                  onBrowseSportPage={(sp) => {
                    setSelectedSport(sp);
                    navigateTo('courts');
                  }}
                  onQuickSearch={(sportCode, city) => {
                    setSelectedSport(sportCode);
                    if (city === 'ALL') {
                      setSelectedLocationId('ALL');
                    } else {
                      const loc = VENUE_LOCATIONS.find((l) => l.city === city);
                      setSelectedLocationId(loc ? loc.locationId : 'ALL');
                    }
                    navigateTo('courts');
                  }}
                  onBrowseVenueCourts={(venueName) => handleBrowseVenueCourts(venueName)}
                  onSelectCourt={handleSelectCourtFromExternal}
                  onOpenLessorShop={handleOpenLessorShop}
                />
              </motion.div>
            )}

            {currentPage === 'courts' && (
              <motion.div
                key="page-courts"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <CourtsPage
                  sports={sports}
                  listings={publicListings}
                  locations={VENUE_LOCATIONS}
                  announcements={announcements}
                  activeRole={activeRole}
                  isAuthenticated={Boolean(session)}
                  selectedLocationId={selectedLocationId}
                  onSelectLocationId={setSelectedLocationId}
                  onOpenAnnouncementsPage={() => navigateTo('announcements')}
                  selectedSport={selectedSport}
                  onSelectSport={setSelectedSport}
                  checkinFilter={checkinFilter}
                  onChangeCheckinFilter={setCheckinFilter}
                  activeListing={activeListing}
                  activeSlotStart={activeSlotStart}
                  activeQuote={activeQuote}
                  quoteLoading={quoteLoading}
                  countdownLabel={countdownLabel}
                  onSelectSlot={selectSlotAndQuote}
                  onProceedToHold={handleProceedToBooking}
                  onOpenVenueChat={handleOpenVenueChat}
                  onOpenLessorShop={handleOpenLessorShop}
                  requestedDetailGroupId={requestedCourtDetailId}
                  onClearRequestedDetail={() => setRequestedCourtDetailId(null)}
                  selectedServiceQuantities={selectedServiceQuantities}
                  onChangeServiceQuantity={handleChangeServiceQuantity}
                  onClearServices={handleClearServices}
                  onOpenManageServicesInternal={() => navigateTo('governance')}
                  onUploadCourtPhoto={handleUploadCourtPhoto}
                  onSetCoverCourtPhoto={handleSetCoverCourtPhoto}
                  onDeleteCourtPhoto={handleDeleteCourtPhoto}
                />
              </motion.div>
            )}

            {currentPage === 'lessors' && (
              <motion.div
                key="page-lessors"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <LessorShopPage
                  listings={publicListings}
                  selectedProviderId={selectedProviderId}
                  followedProviderIds={followedProviderIds}
                  onSelectProviderId={setSelectedProviderId}
                  onToggleFollowProvider={handleToggleFollowProvider}
                  onOpenLessorChat={handleOpenLessorChat}
                  onSelectCourtFromShop={handleSelectCourtFromExternal}
                  onBackToCourts={() => navigateTo('courts')}
                />
              </motion.div>
            )}

            {currentPage === 'announcements' && (
              <motion.div
                key="page-announcements"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <AnnouncementsRoutePage
                  locations={VENUE_LOCATIONS}
                  announcements={announcements}
                  selectedLocationId={selectedLocationId}
                  onSelectLocationId={setSelectedLocationId}
                  readIds={readAnnouncementIds}
                  onMarkRead={(id) =>
                    setReadAnnouncementIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                  }
                  onMarkAllRead={() => setReadAnnouncementIds(announcements.map((a) => a.id))}
                  activeRole={activeRole}
                  session={session}
                  onNavigate={navigateTo}
                  onPublishAnnouncement={handlePublishAnnouncement}
                  onBrowseVenueCourts={handleBrowseVenueCourts}
                />
              </motion.div>
            )}

            {currentPage === 'news' && (
              <motion.div
                key="page-news"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <NewsPage
                  articles={articles}
                  activeRole={activeRole}
                  session={session}
                  onNavigate={navigateTo}
                  onPublishArticle={handlePublishArticle}
                />
              </motion.div>
            )}

            {currentPage === 'rankings' && (
              <motion.div
                key="page-rankings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <RankingsPage
                  session={session}
                  onNavigate={navigateTo}
                  onBrowseVenueCourts={(venueName) => {
                    const matched = listings.find((l) => l.venueName === venueName);
                    if (matched?.provider) {
                      handleOpenLessorShop(matched.provider.providerId);
                    } else {
                      handleBrowseVenueCourts(venueName);
                    }
                  }}
                />
              </motion.div>
            )}

            {currentPage === 'schedule' && (
              <motion.div key="page-schedule" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: EXPO_EASE }}>
                <CustomerSchedulePage userId={session?.userId} onLogin={() => navigateTo('login')}
                  onBrowse={() => navigateTo('courts')} />
              </motion.div>
            )}

            {currentPage === 'checkout' && (
              <motion.div
                key="page-checkout"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <CheckoutPage
                  activeListing={activeListing}
                  activeQuote={activeQuote}
                  activeRole={activeRole}
                  session={session}
                  isHoldExpired={isHoldExpired}
                  venueAnnouncements={announcements}
                  onBackToCourts={() => navigateTo('courts')}
                  onRequireLogin={handleProceedToBooking}
                  onOpenAnnouncementsPage={() => navigateTo('announcements')}
                  holdResult={holdResult}
                  cancelResult={cancelResult}
                  busyStep={busyStep}
                  countdownLabel={countdownLabel}
                  onHoldSlot={handleHoldSlot}
                  onCancelBooking={handleCancelBooking}
                  onResetFlow={handleResetFlow}
                  selectedServiceQuantities={selectedServiceQuantities}
                  onChangeServiceQuantity={handleChangeServiceQuantity}
                />
              </motion.div>
            )}

            {currentPage === 'pricing' && (
              <motion.div
                key="page-pricing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <PricingPage
                  activeListing={activeListing}
                  activeQuote={activeQuote}
                  listings={listings}
                  session={session}
                  activeRole={activeRole}
                  onSelectListing={(listing) => {
                    const slot = listing.upcomingSlots[0]?.slotStart ?? activeSlotStart;
                    if (slot) selectSlotAndQuote(listing, slot);
                  }}
                  onUpdateListingPricing={handleUpdateListingPricing}
                  onNavigate={navigateTo}
                />
              </motion.div>
            )}

            {currentPage === 'governance' && (
              <motion.div
                key="page-governance"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: EXPO_EASE }}
              >
                <GovernancePage
                  activeRole={activeRole}
                  onSelectRole={(r) => {
                    setActiveRole(r);
                    saveAuthSessionToStorage(session, r);
                  }}
                  sports={sports}
                  onAddSportDemo={handleAddSportDemo}
                  staffChatEnabled={listings.find((listing) => listing.tenantId === tenantId)?.staffChatEnabled ?? false}
                  onToggleStaffChat={() => {
                    if (!tenantId) return;
                    const enabled = listings.find((listing) => listing.tenantId === tenantId)?.staffChatEnabled ?? false;
                    void runVenueWrite(async () => {
                      await marketplaceApi.updateVenue(tenantId, { isStaffChatEnabled: !enabled });
                      await refreshListings();
                    }, 'Đã lưu cài đặt chat cho cơ sở.').catch(() => {});
                  }}
                  onOpenChatDrawer={() => setChatOpen(true)}
                  session={session}
                  authModalOpen={false}
                  onCloseAuthModal={() => {}}
                  onAuthenticated={(auth) => {
                    const role = auth.roles?.[0]?.roleCode ?? 'USER';
                    setSession(auth);
                    setActiveRole(role);
                    saveAuthSessionToStorage(auth, role);
                  }}
                  onLogout={handleLogoutSession}
                  onOpenInternalLogin={() => navigateTo('login')}
                  onNavigate={navigateTo}
                  onOpenPublicShop={handleOpenLessorShop}
                  lessorTab={lessorTab}
                  onSelectLessorTab={setLessorTab}
                  controlledAdminTab={adminTab}
                  onSelectAdminTab={setAdminTab}
                  listings={listings}
                  onUpdateListingServices={handleUpdateListingServices}
                  onUpdateListingPricing={handleUpdateListingPricing}
                  onToggleListingPublished={handleToggleListingPublished}
                  onCreateListingSlot={handleCreateListingSlot}
                  onCreateNewListing={handleCreateNewListing}
                  onUpdateProviderProfile={handleUpdateProviderProfile}
                  onUploadCourtPhoto={handleUploadCourtPhoto}
                  onPreviewCourt={(listing) => handleSelectCourtFromExternal(listing)}
                />
              </motion.div>
            )}

            {currentPage === 'login' && (
              <motion.div
                key="page-login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: EXPO_EASE }}
              >
                <LoginPage
                  session={session}
                  bookingPendingCourtName={
                    returnPageAfterLogin === 'checkout' && activeListing
                      ? activeListing.groupName
                      : null
                  }
                  onAuthenticated={(auth, preferredRole) => {
                    const resolvedRole = preferredRole ?? auth.roles?.[0]?.roleCode ?? 'USER';
                    setSession(auth);
                    setActiveRole(resolvedRole);
                    saveAuthSessionToStorage(auth, resolvedRole);
                    // Automatically direct Lessor / Staff / Admin into Partner & Governance Portal
                    if (
                      resolvedRole !== 'USER' &&
                      (returnPageAfterLogin === 'home' || returnPageAfterLogin === 'login')
                    ) {
                      navigateTo('governance', resolvedRole);
                    } else {
                      navigateTo(returnPageAfterLogin, resolvedRole);
                    }
                  }}
                  onLogout={handleLogoutSession}
                  onBack={() => navigateTo(returnPageAfterLogin)}
                  onOpenPartnerPortal={() => navigateTo('governance')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </main>

      {currentPage !== 'login' && (
        <footer className="border-t border-neutral-200/80 bg-white pt-9 pb-24 md:pb-9">
          <ScrollReveal
            yOffset={14}
            className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 sm:px-8 md:flex-row md:items-center md:pr-24"
          >
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="flex flex-wrap items-center gap-3 text-left text-[#0F172A] rounded-lg focus:outline-none"
            >
              <ArenaPulseLogo variant="dark" size="sm" />
              <span className="text-xs text-neutral-400">
                • Nền tảng Cho Thuê Sân Thể Thao Đa Môn &amp; Định Giá Động
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-neutral-500">
              {PAGE_NAV_ITEMS.filter(
                (p) =>
                  p.id !== 'pricing' ||
                  Boolean(session && (activeRole === 'MANAGER' || activeRole === 'ADMIN'))
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigateTo(p.id)}
                  className={`hover:text-[#0F172A] ${
                    currentPage === p.id ? 'font-semibold text-[#16422C]' : ''
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </ScrollReveal>
        </footer>
      )}

      {/* Responsive Native-Style Mobile Bottom Tab Bar (< md viewports) */}
      {currentPage !== 'login' && (
        <nav
          aria-label="Thanh điều hướng nhanh trên di động"
          className={`fixed inset-x-0 bottom-0 z-40 grid border-t border-neutral-200/90 bg-white/95 px-1 py-1.5 backdrop-blur-lg md:hidden
            ${session && activeRole !== 'USER' ? 'grid-cols-5' : 'grid-cols-6'}`}
        >
          {Boolean(session && activeRole !== 'USER')
            ? [
                {
                  key: 'm-overview',
                  label: 'Biểu đồ',
                  icon: <BarChart3 className="h-3.5 w-3.5" />,
                  active: currentPage === 'governance' && (activeRole === 'MANAGER' ? lessorTab === 'OVERVIEW' : adminTab === 'OPERATIONS'),
                  onClick: () => {
                    if (activeRole === 'MANAGER' || activeRole === 'STAFF') setLessorTab('OVERVIEW');
                    else setAdminTab('OPERATIONS');
                    navigateTo('governance');
                  },
                },
                {
                  key: 'm-courts',
                  label: activeRole === 'ADMIN' ? 'Cho thuê' : 'Cụm sân',
                  icon: <Building2 className="h-3.5 w-3.5" />,
                  active: currentPage === 'governance' && (activeRole === 'MANAGER' ? lessorTab === 'COURTS_INVENTORY' : adminTab === 'LESSOR_INSPECTOR'),
                  onClick: () => {
                    if (activeRole === 'MANAGER' || activeRole === 'STAFF') setLessorTab('COURTS_INVENTORY');
                    else setAdminTab('LESSOR_INSPECTOR');
                    navigateTo('governance');
                  },
                },
                {
                  key: 'm-addons',
                  label: activeRole === 'ADMIN' ? 'Duyệt KYC' : 'Dịch vụ',
                  icon: <Coffee className="h-3.5 w-3.5" />,
                  active: currentPage === 'governance' && (activeRole === 'MANAGER' ? lessorTab === 'ADDON_PRODUCTS' : adminTab === 'ADMIN_KYC'),
                  onClick: () => {
                    if (activeRole === 'MANAGER') setLessorTab('ADDON_PRODUCTS');
                    else setAdminTab('ADMIN_KYC');
                    navigateTo('governance');
                  },
                },
                {
                  key: 'm-pricing',
                  label: 'Định giá',
                  icon: <Zap className="h-3.5 w-3.5" />,
                  active: currentPage === 'pricing',
                  onClick: () => navigateTo('pricing'),
                },
                {
                  key: 'm-wallet',
                  label: 'Ví tiền',
                  icon: <Wallet className="h-3.5 w-3.5" />,
                  active: currentPage === 'governance' && (activeRole === 'MANAGER' ? lessorTab === 'ESCROW_WALLET' : adminTab === 'FINANCE_LEDGER'),
                  onClick: () => {
                    if (activeRole === 'MANAGER') setLessorTab('ESCROW_WALLET');
                    else setAdminTab('FINANCE_LEDGER');
                    navigateTo('governance');
                  },
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={tab.onClick}
                  className="flex flex-col items-center justify-center gap-0.5 py-1 text-center"
                >
                  <span
                    className={`flex h-6 w-10 items-center justify-center rounded-full text-xs transition-colors ${
                      tab.active ? 'bg-[#16422C] text-[#E7F7D4]' : 'text-neutral-500'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span
                    className={`text-[10px] font-semibold leading-none ${
                      tab.active ? 'text-[#16422C]' : 'text-neutral-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              ))
            : [
                { id: 'home' as AppPageId, label: 'Trang chủ', icon: <Home className="h-3.5 w-3.5" /> },
                { id: 'courts' as AppPageId, label: 'Thuê sân', icon: <Compass className="h-3.5 w-3.5" /> },
                { id: 'schedule' as AppPageId, label: 'Lịch của tôi', icon: <CalendarDays className="h-3.5 w-3.5" /> },
                { id: 'announcements' as AppPageId, label: 'Thông báo', icon: <Bell className="h-3.5 w-3.5" /> },
                { id: 'rankings' as AppPageId, label: 'Xếp hạng', icon: <Award className="h-3.5 w-3.5" /> },
                { id: 'governance' as AppPageId, label: 'Chủ sân', icon: <Settings className="h-3.5 w-3.5" /> },
              ].map((tab) => {
                const active = currentPage === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigateTo(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className="flex flex-col items-center justify-center gap-0.5 py-1 text-center"
                  >
                    <span
                      className={`flex h-6 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                        active ? 'bg-[#16422C] text-[#E7F7D4]' : 'text-neutral-500'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span
                      className={`text-[10px] font-semibold leading-none ${
                        active ? 'text-[#16422C]' : 'text-neutral-500'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
        </nav>
      )}

      {currentPage !== 'login' && (
        <FloatingChatWidget
          open={chatOpen}
          onToggleOpen={setChatOpen}
          activeProviderId={activeChatProviderId}
          onSelectProviderId={setActiveChatProviderId}
          contextListing={chatContextListing ?? activeListing}
          listings={listings}
          activeRole={activeRole}
          session={session}
        />
      )}
    </div>
    </MotionConfig>
  );
}
export default App;
