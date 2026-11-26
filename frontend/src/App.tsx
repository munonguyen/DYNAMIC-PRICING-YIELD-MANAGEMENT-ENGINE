import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Award,
  BarChart3,
  Bell,
  Building2,
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
  CURATED_SPORTS,
  applyGalleryMediaToListing,
  createCuratedListings,
  marketplaceApi,
  mergeOfflineMediaIntoListings,
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

function resolvePageFromPath(pathname: string): AppPageId {
  if (pathname === '/login') return 'login';
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

const LESSOR_CUSTOM_LISTINGS_KEY = 'arenapulse_lessor_custom_listings_v1';
const LESSOR_LISTING_OVERRIDES_KEY = 'arenapulse_lessor_listing_overrides_v1';
const LESSOR_PROVIDER_OVERRIDES_KEY = 'arenapulse_lessor_provider_overrides_v1';

interface PersistedListingOverride {
  published?: boolean;
  basePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  depositPercent?: number;
  checkinMode?: PublishedListing['checkinMode'];
  upcomingSlots?: SlotListingQuote[];
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function hydrateAllLessorCustomizations(baseListings: PublishedListing[]): PublishedListing[] {
  const customListings = readJsonStorage<PublishedListing[]>(LESSOR_CUSTOM_LISTINGS_KEY, []);
  const listingOverrides = readJsonStorage<Record<string, PersistedListingOverride>>(
    LESSOR_LISTING_OVERRIDES_KEY,
    {}
  );
  const providerOverrides = readJsonStorage<
    Record<string, Partial<VenueProviderInfo>>
  >(LESSOR_PROVIDER_OVERRIDES_KEY, {});

  const combined = [
    ...customListings.filter((c) => !baseListings.some((b) => b.groupId === c.groupId)),
    ...baseListings,
  ];

  return hydrateListingsWithLessorServices(combined).map((item) => {
    const ov = listingOverrides[item.groupId];
    const pOv = item.provider ? providerOverrides[item.provider.providerId] : undefined;
    return {
      ...item,
      ...(ov ?? {}),
      provider: item.provider && pOv ? { ...item.provider, ...pOv } : item.provider,
    };
  });
}

export function App() {
  const [currentPage, setCurrentPage] = useState<AppPageId>(() =>
    resolvePageFromPath(window.location.pathname)
  );

  const [sports, setSports] = useState<SportTypeItem[]>(CURATED_SPORTS);
  const [listings, setListings] = useState<PublishedListing[]>(() =>
    hydrateAllLessorCustomizations(mergeOfflineMediaIntoListings(createCuratedListings()))
  );

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
  const [staffChatEnabled, setStaffChatEnabled] = useState<boolean>(true);
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
    (page: AppPageId) => {
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
            : (PAGE_NAV_ITEMS.find((p) => p.id === page) ?? PAGE_NAV_ITEMS[0]).path;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      setCurrentPage(page);
    },
    [currentPage, selectedProviderId]
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

  const selectSlotAndQuote = useCallback(async (listing: PublishedListing, slotStart: string) => {
    setActiveListing((prev) => {
      if (prev && prev.groupId !== listing.groupId) {
        setSelectedServiceQuantities({});
      }
      return listing;
    });
    setActiveSlotStart(slotStart);
    setQuoteLoading(true);
    setHoldResult(null);
    setCancelResult(null);

    const { quote } = await marketplaceApi.getPriceQuote(listing, slotStart);
    setActiveQuote(quote);
    setRemainingSeconds(600);
    setQuoteLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    marketplaceApi.checkBackendAndLoadCatalogue().then(({ sports: sp, listings: ls }) => {
      if (!mounted) return;
      const hydrated = hydrateAllLessorCustomizations(ls);
      setSports(sp);
      setListings(hydrated);
      const firstOpen = hydrated.find((l) => l.published !== false) ?? hydrated[0];
      if (firstOpen && firstOpen.upcomingSlots.length > 0) {
        selectSlotAndQuote(firstOpen, firstOpen.upcomingSlots[0].slotStart);
      }
    });
    return () => {
      mounted = false;
    };
  }, [selectSlotAndQuote]);

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

  const handleUpdateListingServices = (
    groupId: string,
    nextServices: CourtServiceOption[]
  ) => {
    savePersistedLessorServicesForGroup(groupId, nextServices);
    setListings((prev) =>
      prev.map((item) =>
        item.groupId === groupId ? { ...item, addOnServices: nextServices } : item
      )
    );
    setActiveListing((prev) =>
      prev && prev.groupId === groupId ? { ...prev, addOnServices: nextServices } : prev
    );
    if (activeListing?.groupId === groupId) {
      const validIds = new Set(
        nextServices.filter((s) => s.enabled !== false).map((s) => s.id)
      );
      setSelectedServiceQuantities((prev) => {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (validIds.has(k)) cleaned[k] = v;
        }
        return cleaned;
      });
    }
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

  const persistListingOverride = (groupId: string, patch: PersistedListingOverride) => {
    const existing = readJsonStorage<Record<string, PersistedListingOverride>>(
      LESSOR_LISTING_OVERRIDES_KEY,
      {}
    );
    writeJsonStorage(LESSOR_LISTING_OVERRIDES_KEY, {
      ...existing,
      [groupId]: { ...(existing[groupId] ?? {}), ...patch },
    });
  };

  const handleUpdateListingPricing = (
    groupId: string,
    patch: {
      basePrice: number;
      minPrice: number;
      maxPrice: number;
      depositPercent: number;
      checkinMode?: 'QR_STAFF' | 'PIN_COUNTER' | 'MANUAL';
    }
  ) => {
    const applyPatch = (listing: PublishedListing): PublishedListing => {
      if (listing.groupId !== groupId) return listing;
      const clamp = (raw: number) =>
        Math.min(patch.maxPrice, Math.max(patch.minPrice, Math.round(raw / 1000) * 1000));
      const updatedUpcoming = listing.upcomingSlots.map((slot) => ({
        ...slot,
        currentDynamicPrice:
          slot.timePeriod === 'MORNING'
            ? clamp(patch.basePrice * 0.85)
            : slot.timePeriod === 'EVENING'
              ? clamp(patch.basePrice * 1.28)
              : clamp(patch.basePrice),
      }));
      const nextCheckinMode = patch.checkinMode ?? listing.checkinMode;
      persistListingOverride(groupId, {
        basePrice: patch.basePrice,
        minPrice: patch.minPrice,
        maxPrice: patch.maxPrice,
        depositPercent: patch.depositPercent,
        checkinMode: nextCheckinMode,
        upcomingSlots: updatedUpcoming,
      });
      return {
        ...listing,
        basePrice: patch.basePrice,
        minPrice: patch.minPrice,
        maxPrice: patch.maxPrice,
        depositPercent: patch.depositPercent,
        checkinMode: nextCheckinMode,
        upcomingSlots: updatedUpcoming,
      };
    };

    setListings((prev) => prev.map(applyPatch));
    setActiveListing((prev) => {
      if (!prev) return prev;
      const next = applyPatch(prev);
      if (next.groupId === groupId && activeSlotStart) {
        selectSlotAndQuote(next, activeSlotStart);
      }
      return next;
    });
  };

  const handleToggleListingPublished = (groupId: string) => {
    setListings((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        const nextPublished = item.published === false ? true : false;
        persistListingOverride(groupId, { published: nextPublished });
        return { ...item, published: nextPublished };
      })
    );
  };

  const handleUpdateListingSlots = (groupId: string, nextSlots: SlotListingQuote[]) => {
    persistListingOverride(groupId, { upcomingSlots: nextSlots });
    setListings((prev) =>
      prev.map((item) =>
        item.groupId === groupId ? { ...item, upcomingSlots: nextSlots } : item
      )
    );
    setActiveListing((prev) =>
      prev && prev.groupId === groupId ? { ...prev, upcomingSlots: nextSlots } : prev
    );
  };

  const handleCreateNewListing = (newListing: PublishedListing) => {
    const savedCustom = readJsonStorage<PublishedListing[]>(LESSOR_CUSTOM_LISTINGS_KEY, []);
    writeJsonStorage(LESSOR_CUSTOM_LISTINGS_KEY, [newListing, ...savedCustom]);
    setListings((prev) => [newListing, ...prev]);
  };

  const handleUpdateProviderProfile = (
    providerId: string,
    patch: Partial<Pick<VenueProviderInfo, 'shopSlogan' | 'voucherLabel' | 'responseTimeLabel'>>
  ) => {
    const savedProv = readJsonStorage<Record<string, Partial<VenueProviderInfo>>>(
      LESSOR_PROVIDER_OVERRIDES_KEY,
      {}
    );
    writeJsonStorage(LESSOR_PROVIDER_OVERRIDES_KEY, {
      ...savedProv,
      [providerId]: { ...(savedProv[providerId] ?? {}), ...patch },
    });
    setListings((prev) =>
      prev.map((item) =>
        item.provider?.providerId === providerId
          ? { ...item, provider: { ...item.provider, ...patch } }
          : item
      )
    );
    setActiveListing((prev) =>
      prev && prev.provider?.providerId === providerId
        ? { ...prev, provider: { ...prev.provider, ...patch } }
        : prev
    );
  };

  const handleLogoutSession = () => {
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
                  staffChatEnabled={staffChatEnabled}
                  onToggleStaffChat={() => setStaffChatEnabled((v) => !v)}
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
                  onUpdateListingSlots={handleUpdateListingSlots}
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
                      navigateTo('governance');
                    } else {
                      navigateTo(returnPageAfterLogin);
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
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-neutral-200/90 bg-white/95 px-1 py-1.5 backdrop-blur-lg md:hidden"
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
          staffChatEnabled={staffChatEnabled}
          session={session}
          onOpenLessorShop={handleOpenLessorShop}
          onSelectCourtFromChat={(listing) => handleSelectCourtFromExternal(listing)}
          onOpenSafetyPolicy={() => navigateTo('announcements')}
        />
      )}
    </div>
    </MotionConfig>
  );
}
export default App;
