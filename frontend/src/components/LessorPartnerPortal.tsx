import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  AnalyticsDashboardData,
  AppPageId,
  AuthSession,
  CheckinVerificationMode,
  CourtServiceOption,
  LessorBookingOrder,
  LessorPayoutRecord,
  LessorStaffMember,
  PublishedListing,
  RoleCode,
  SlotListingQuote,
  SportTypeItem,
  VenueProviderInfo,
} from '../types/marketplace';
import {
  ALL_LESSOR_PROVIDERS,
  CUSTOM_STAFF_STORAGE_KEY,
  ensureSeededOperationalOrdersMap,
  formatSlotWindow,
  formatVnd,
  getStoredTicketsForLessor,
  marketplaceApi,
  writePersistedOperationalOrdersMap,
} from '../api/marketplaceApi';
import {
  AnimatedCounter,
  DASHBOARD_STAGGER_CONTAINER,
  DASHBOARD_STAGGER_ITEM,
  EXPO_EASE,
} from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';
import { LessorAddOnServicesManager } from './LessorAddOnServicesManager';
import { LessorAnalyticsDashboard } from './LessorAnalyticsDashboard';
import { QrCheckInScannerModal, type QrModalTabId } from './QrCheckInScannerModal';
import { CreateCourtGroupModal } from './CreateCourtGroupModal';
import { BookingOrderDetailModal } from './BookingOrderDetailModal';
import { LiveCourtsInUseSection } from './LiveCourtsInUseSection';
import { WeeklyScheduleGrid, type WeeklyFixedBlock } from './WeeklyScheduleGrid';
import { getActiveLessorServices, resolveCourtThumbnail } from '../data/courtServicesData';

export type LessorPortalTabId =
  | 'OVERVIEW'
  | 'ORDERS_CHECKIN'
  | 'LIVE_COURTS'
  | 'WEEKLY_SCHEDULE'
  | 'COURTS_INVENTORY'
  | 'ADDON_PRODUCTS'
  | 'YIELD_PRICING'
  | 'SHOP_AND_STAFF'
  | 'ESCROW_WALLET';

interface LessorPartnerPortalProps {
  session: AuthSession;
  activeRole: RoleCode;
  sports: SportTypeItem[];
  listings: PublishedListing[];
  staffChatEnabled: boolean;
  onToggleStaffChat: () => void;
  onOpenChatDrawer: () => void;
  onNavigate?: (page: AppPageId) => void;
  onOpenPublicShop?: (providerId: string) => void;
  onPreviewCourt?: (listing: PublishedListing) => void;
  controlledTab?: LessorPortalTabId;
  onSelectTab?: (tab: LessorPortalTabId) => void;
  onUpdateListingPricing: (
    groupId: string,
    patch: {
      basePrice: number;
      minPrice: number;
      maxPrice: number;
      depositPercent: number;
      checkinMode?: CheckinVerificationMode;
    }
  ) => void;
  onUpdateListingServices: (groupId: string, nextServices: CourtServiceOption[]) => void;
  onToggleListingPublished: (groupId: string) => void;
  onUpdateListingSlots: (groupId: string, nextSlots: SlotListingQuote[]) => void;
  onCreateNewListing: (newListing: PublishedListing) => void;
  onUpdateProviderProfile: (
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
  embeddedForAdmin?: boolean;
}

const LESSOR_ORDERS_STORAGE_KEY = 'arenapulse_lessor_orders_v1';
const LESSOR_PAYOUTS_STORAGE_KEY = 'arenapulse_lessor_payouts_v1';
const WALKIN_LOCKS_STORAGE_KEY = 'arenapulse_walkin_court_locks_v1';
const WEEKLY_FIXED_BLOCKS_KEY = 'arenapulse_weekly_fixed_blocks_v1';

const PRESET_COURT_COVERS: { label: string; url: string }[] = [
  { label: 'Sân Pickleball Mái Vòm Chuẩn Giải', url: '/images/court-pickleball-dome.jpg' },
  { label: 'Sân Pickleball Ngoài Trời', url: '/images/real-pickleball-outdoor.jpg' },
  { label: 'Sân Bóng Đá Cỏ Nhân Tạo Đèn Đêm', url: '/images/court-football-night.jpg' },
  { label: 'Sân Cầu Lông Thảm BWF Trong Nhà', url: '/images/court-badminton-arena.jpg' },
  { label: 'Sân Tennis Acrylic Tiêu Chuẩn', url: '/images/court-tennis-pro.jpg' },
  { label: 'Sân Bóng Rổ Sàn Gỗ FIBA', url: '/images/court-basketball-fiba.jpg' },
];

function readPersistedOrders(): Record<string, LessorBookingOrder[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LESSOR_ORDERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LessorBookingOrder[]>) : {};
  } catch {
    return {};
  }
}

function writePersistedOrders(map: Record<string, LessorBookingOrder[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LESSOR_ORDERS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function readCustomStaffList(): LessorStaffMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_STAFF_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LessorStaffMember[]) : [];
  } catch {
    return [];
  }
}

function writeCustomStaffList(list: LessorStaffMember[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_STAFF_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function readPayoutRecords(): LessorPayoutRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LESSOR_PAYOUTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LessorPayoutRecord[]) : [];
  } catch {
    return [];
  }
}

function writePayoutRecords(list: LessorPayoutRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LESSOR_PAYOUTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export const LessorPartnerPortal: React.FC<LessorPartnerPortalProps> = ({
  session,
  activeRole,
  sports,
  listings,
  staffChatEnabled,
  onToggleStaffChat,
  onOpenChatDrawer,
  onNavigate,
  onOpenPublicShop,
  onPreviewCourt,
  controlledTab,
  onSelectTab,
  onUpdateListingPricing,
  onUpdateListingServices,
  onToggleListingPublished,
  onUpdateListingSlots,
  onCreateNewListing,
  onUpdateProviderProfile,
  onUploadCourtPhoto,
  onLogout,
  embeddedForAdmin = false,
}) => {
  const isStaffOnly = activeRole === 'STAFF';
  const isAdminInspector = activeRole === 'ADMIN';

  // Resolve all distinct providers from current listings + curated providers
  const allProviders = useMemo<VenueProviderInfo[]>(() => {
    const map = new Map<string, VenueProviderInfo>();
    for (const p of ALL_LESSOR_PROVIDERS) {
      map.set(p.providerId, p);
    }
    for (const item of listings) {
      if (item.provider) {
        map.set(item.provider.providerId, item.provider);
      }
    }
    return Array.from(map.values());
  }, [listings]);

  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    session.managedProviderId || allProviders[0]?.providerId || 'PROV_HN_01'
  );

  useEffect(() => {
    if (session.managedProviderId) {
      setSelectedProviderId(session.managedProviderId);
    }
  }, [session.managedProviderId]);

  const activeProvider = useMemo<VenueProviderInfo>(() => {
    return (
      allProviders.find((p) => p.providerId === selectedProviderId) ??
      allProviders[0]
    );
  }, [allProviders, selectedProviderId]);

  const myListings = useMemo<PublishedListing[]>(
    () => listings.filter((l) => l.provider?.providerId === activeProvider.providerId),
    [listings, activeProvider.providerId]
  );

  const [internalActiveTab, setInternalActiveTab] = useState<LessorPortalTabId>(
    isStaffOnly ? 'ORDERS_CHECKIN' : 'OVERVIEW'
  );
  const rawActiveTab = controlledTab ?? internalActiveTab;
  const activeTab: LessorPortalTabId =
    isStaffOnly && rawActiveTab === 'OVERVIEW' ? 'ORDERS_CHECKIN' : rawActiveTab;
  const setActiveTab = (next: LessorPortalTabId) => {
    setInternalActiveTab(next);
    onSelectTab?.(next);
  };
  const [focusedServiceGroupId, setFocusedServiceGroupId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  // --- BOOKING ORDERS & QR CHECK-IN STATE (REAL STORED TICKETS + DB/ES ORDERS) ---
  const [ordersByProvider, setOrdersByProvider] = useState<Record<string, LessorBookingOrder[]>>(
    () => ensureSeededOperationalOrdersMap(listings)
  );
  const [orderFilter, setOrderFilter] = useState<
    'ALL' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW'
  >('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderCourtFilter, setOrderCourtFilter] = useState<string>('ALL');
  const [orderDateScope, setOrderDateScope] = useState<'ALL' | 'TODAY' | 'WEEK'>('ALL');
  const [orderPage, setOrderPage] = useState<number>(1);
  const ORDERS_PAGE_SIZE = 10;
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboardData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [reindexingEs, setReindexingEs] = useState<boolean>(false);

  const localProviderOrders = useMemo<LessorBookingOrder[]>(() => {
    const savedOrders = ordersByProvider[activeProvider.providerId] ?? [];
    const myVenueNames = new Set(myListings.map((l) => l.venueName));
    const storedTickets = getStoredTicketsForLessor().filter((t) =>
      myVenueNames.has(t.venueName)
    );
    const convertedLiveTickets: LessorBookingOrder[] = storedTickets
      .filter((t) => !savedOrders.some((o) => o.reservationId === t.reservationId))
      .map((t) => {
        const slotDate = new Date(t.slotStart);
        const dateIso = !Number.isNaN(slotDate.getTime())
          ? `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`
          : undefined;
        const slotHour = !Number.isNaN(slotDate.getTime()) ? slotDate.getHours() : undefined;
        return {
        orderId: `WEB-${t.reservationId.slice(0, 6).toUpperCase()}`,
        reservationId: t.reservationId,
        providerId: activeProvider.providerId,
        groupId: myListings[0]?.groupId ?? '',
        groupName: t.groupName,
        venueName: t.venueName,
        sportName: myListings[0]?.sportName ?? 'Thể thao',
        unitNumber: t.unitNumber,
        slotLabel: formatSlotWindow(t.slotStart, t.slotEnd),
        customerName: t.contactEmail || 'Khách đặt trực tuyến',
        customerPhone: 'Đã xác thực Email QR',
        courtPrice: t.lockedPrice,
        addOnTotal: Math.max(0, t.paidOnlineAmount + t.remainingAtVenue - t.lockedPrice),
        paidEscrow: t.paidOnlineAmount,
        remainingAtVenue: t.remainingAtVenue,
        paymentGateway: 'Thanh toán Trực tuyến',
        qrCode: t.qrToken || t.qrJti || `QR-${t.reservationId.slice(0, 8)}`,
        status:
          t.status === 'COMPLETED'
            ? 'COMPLETED'
            : t.status === 'NO_SHOW'
              ? 'NO_SHOW'
              : t.status === 'CANCELLED'
                ? 'CANCELLED'
                : 'CONFIRMED',
        createdAtLabel: 'Đơn đặt thực tế',
        dateIso,
        slotHour,
      };
      });

    return [...convertedLiveTickets, ...savedOrders];
  }, [ordersByProvider, activeProvider.providerId, myListings]);

  const loadAnalyticsFromDbOrEs = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await marketplaceApi.fetchLessorAnalytics(
        analyticsDays,
        myListings,
        localProviderOrders,
        activeProvider
      );
      setAnalyticsData(data);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setAnalyticsLoading(true);
    marketplaceApi
      .fetchLessorAnalytics(analyticsDays, myListings, localProviderOrders, activeProvider)
      .then((data) => {
        if (active) setAnalyticsData(data);
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analyticsDays, activeProvider.providerId, myListings, localProviderOrders]);

  const providerOrders = useMemo<LessorBookingOrder[]>(() => {
    const dbOrders = analyticsData?.recentOrders ?? [];
    const seen = new Set(localProviderOrders.map((o) => o.reservationId));
    return [
      ...localProviderOrders,
      ...dbOrders.filter((d) => d.reservationId && !seen.has(d.reservationId)),
    ];
  }, [localProviderOrders, analyticsData?.recentOrders]);

  const updateOrderStatus = (
    orderId: string,
    nextStatus: LessorBookingOrder['status']
  ) => {
    const updatedList = providerOrders.map((o) =>
      o.orderId === orderId
        ? {
            ...o,
            status: nextStatus,
            createdAtLabel:
              nextStatus === 'COMPLETED'
                ? `Đã nhận sân lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : nextStatus === 'NO_SHOW'
                  ? 'Đánh dấu bỏ lịch (>15p)'
                  : o.createdAtLabel,
          }
        : o
    );
    const nextMap = { ...ordersByProvider, [activeProvider.providerId]: updatedList };
    setOrdersByProvider(nextMap);
    writePersistedOperationalOrdersMap(nextMap);
  };

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalTab, setQrModalTab] = useState<QrModalTabId>('SCANNER');
  const [qrModalAllowedModes, setQrModalAllowedModes] = useState<QrModalTabId[]>([
    'SCANNER',
    'PIN_VERIFY',
  ]);
  const [qrModalOrder, setQrModalOrder] = useState<LessorBookingOrder | null>(null);
  const [qrModalQuery, setQrModalQuery] = useState('');
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [walkInLocksByUnit, setWalkInLocksByUnit] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(WALKIN_LOCKS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [weeklyFixedBlocks, setWeeklyFixedBlocks] = useState<WeeklyFixedBlock[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(WEEKLY_FIXED_BLOCKS_KEY);
      return raw ? (JSON.parse(raw) as WeeklyFixedBlock[]) : [];
    } catch {
      return [];
    }
  });

  const handleAddWeeklyFixedBlock = (block: WeeklyFixedBlock) => {
    setWeeklyFixedBlocks((prev) => {
      const next = [block, ...prev];
      try {
        window.localStorage.setItem(WEEKLY_FIXED_BLOCKS_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
    flashToast(`✓ Đã thêm "${block.title}" (${block.unitNumber}) lên lịch tuần.`);
  };

  const handleRemoveWeeklyFixedBlock = (blockId: string) => {
    setWeeklyFixedBlocks((prev) => {
      const next = prev.filter((b) => b.id !== blockId);
      try {
        window.localStorage.setItem(WEEKLY_FIXED_BLOCKS_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
    flashToast('Đã gỡ lịch cố định khỏi thời khóa biểu tuần.');
  };

  const handleToggleWalkInLock = (groupId: string, unitNumber: string, groupName: string) => {
    const key = `${groupId}__${unitNumber}`;
    setWalkInLocksByUnit((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
        flashToast(`Đã mở trống lại ${unitNumber} (${groupName}).`);
      } else {
        next[key] = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        flashToast(`Đã đánh dấu ${unitNumber} (${groupName}) đang có khách chơi tại quầy.`);
      }
      try {
        window.localStorage.setItem(WALKIN_LOCKS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const selectedDetailOrder = useMemo<LessorBookingOrder | null>(
    () => (detailOrderId ? providerOrders.find((o) => o.orderId === detailOrderId) ?? null : null),
    [detailOrderId, providerOrders]
  );

  const selectedDetailCourt = useMemo<PublishedListing | null>(
    () =>
      selectedDetailOrder
        ? myListings.find((l) => l.groupId === selectedDetailOrder.groupId) ??
          listings.find((l) => l.groupId === selectedDetailOrder.groupId) ??
          null
        : null,
    [selectedDetailOrder, myListings, listings]
  );

  const handleUpdateOrderAddOns = (
    orderId: string,
    nextSummary: string | undefined,
    nextAddOnTotal: number,
    nextQuantities: Record<string, number>
  ) => {
    const updatedList = providerOrders.map((o) => {
      if (o.orderId !== orderId) return o;
      const nextRemaining = Math.max(0, o.courtPrice + nextAddOnTotal - o.paidEscrow);
      return {
        ...o,
        addOnSummary: nextSummary,
        addOnTotal: nextAddOnTotal,
        addOnQuantities: nextQuantities,
        remainingAtVenue: nextRemaining,
      };
    });
    const nextMap = { ...ordersByProvider, [activeProvider.providerId]: updatedList };
    setOrdersByProvider(nextMap);
    writePersistedOperationalOrdersMap(nextMap);
    flashToast(`✓ Đã cập nhật dịch vụ đi kèm cho đơn ${orderId}!`);
  };

  const venueSupportsQr = myListings.some((l) => l.checkinMode === 'QR_STAFF');
  const venueSupportsPin = myListings.some(
    (l) => l.checkinMode === 'PIN_COUNTER' || l.checkinMode === 'MANUAL'
  );

  const handlePinFailedAttempt = (orderId: string) => {
    const updatedList = providerOrders.map((o) =>
      o.orderId === orderId
        ? { ...o, pinFailedAttempts: (o.pinFailedAttempts ?? 0) + 1 }
        : o
    );
    const nextMap = { ...ordersByProvider, [activeProvider.providerId]: updatedList };
    setOrdersByProvider(nextMap);
    writePersistedOperationalOrdersMap(nextMap);
  };

  const handleManualQrVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qrScanInput.trim();
    const matchedPinOrder = !venueSupportsQr
      ? providerOrders.find(
          (o) =>
            o.orderId.toLowerCase() === q.toLowerCase() ||
            o.orderId.replace('#', '').toLowerCase() === q.replace('#', '').toLowerCase()
        ) ?? null
      : null;

    setQrModalOrder(matchedPinOrder);
    if (venueSupportsQr) {
      setQrModalTab('SCANNER');
      setQrModalAllowedModes(['SCANNER']);
      setQrModalQuery(q);
    } else {
      setQrModalTab('PIN_VERIFY');
      setQrModalAllowedModes(['PIN_VERIFY']);
      setQrModalQuery('');
    }
    setQrModalOpen(true);
  };

  // --- CREATE NEW COURT GROUP MODAL & INVENTORY FILTER STATE ---
  const [showCreateCourtForm, setShowCreateCourtForm] = useState<boolean>(false);
  const [courtStatusFilter, setCourtStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'PAUSED'>('ALL');
  const [courtSearchQuery, setCourtSearchQuery] = useState<string>('');

  // Per-listing inline price editor
  const [editingPriceGroupId, setEditingPriceGroupId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState<number>(200000);
  const [editMin, setEditMin] = useState<number>(120000);
  const [editMax, setEditMax] = useState<number>(350000);
  const [editDeposit, setEditDeposit] = useState<number>(35);

  const filteredMyListings = useMemo(() => {
    const q = courtSearchQuery.trim().toLowerCase();
    return myListings.filter((c) => {
      const isPub = c.published !== false;
      if (courtStatusFilter === 'PUBLISHED' && !isPub) return false;
      if (courtStatusFilter === 'PAUSED' && isPub) return false;
      if (q) {
        return (
          c.groupName.toLowerCase().includes(q) ||
          c.sportName.toLowerCase().includes(q) ||
          c.venueAddress.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [myListings, courtStatusFilter, courtSearchQuery]);

  // --- SHOP PROFILE & STAFF ACCOUNTS STATE ---
  const [sloganDraft, setSloganDraft] = useState<string>(activeProvider.shopSlogan ?? '');
  const [voucherDraft, setVoucherDraft] = useState<string>(activeProvider.voucherLabel ?? '');
  const [responseDraft, setResponseDraft] = useState<string>(
    activeProvider.responseTimeLabel ?? 'Trong vài phút'
  );

  useEffect(() => {
    setSloganDraft(activeProvider.shopSlogan ?? '');
    setVoucherDraft(activeProvider.voucherLabel ?? '');
    setResponseDraft(activeProvider.responseTimeLabel ?? 'Trong vài phút');
  }, [activeProvider]);

  const [staffList, setStaffList] = useState<LessorStaffMember[]>(() => readCustomStaffList());
  const [staffName, setStaffName] = useState<string>('');
  const [staffUsername, setStaffUsername] = useState<string>('');
  const [staffPassword, setStaffPassword] = useState<string>('123456');
  const [staffPhone, setStaffPhone] = useState<string>('');
  const [staffShift, setStaffShift] = useState<string>('Ca Tối (16:00 – 22:30)');

  const myStaffMembers = useMemo(
    () => staffList.filter((s) => s.providerId === activeProvider.providerId),
    [staffList, activeProvider.providerId]
  );

  const handleCreateStaffAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanU = staffUsername.trim().toLowerCase();
    if (!cleanU || !staffName.trim() || !staffPassword.trim()) return;
    if (
      cleanU === 'nhanvien.san01' ||
      staffList.some((s) => s.username.toLowerCase() === cleanU)
    ) {
      flashToast('Tên đăng nhập nhân viên đã tồn tại. Vui lòng chọn tên khác.');
      return;
    }
    const created: LessorStaffMember = {
      id: `staff-${Date.now()}`,
      providerId: activeProvider.providerId,
      username: cleanU,
      passwordPlain: staffPassword.trim(),
      fullName: staffName.trim(),
      phone: staffPhone.trim() || '0900 000 000',
      shiftLabel: staffShift,
      active: true,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    const next = [created, ...staffList];
    setStaffList(next);
    writeCustomStaffList(next);
    setStaffName('');
    setStaffUsername('');
    setStaffPhone('');
    flashToast(
      `✓ Đã cấp tài khoản nhân viên "${created.username}" (Mật khẩu: ${created.passwordPlain}) — có thể đăng nhập ngay!`
    );
  };

  // --- ESCROW WALLET & PAYOUTS STATE ---
  const [payouts, setPayouts] = useState<LessorPayoutRecord[]>(() => readPayoutRecords());
  const myPayouts = useMemo(
    () => payouts.filter((p) => p.providerId === activeProvider.providerId),
    [payouts, activeProvider.providerId]
  );

  // --- COMPUTED METRICS FOR THIS LESSOR (100% REAL DATA FROM DB/ES + STORED ORDERS) ---
  const metrics = useMemo(() => {
    const publishedGroups = myListings.filter((l) => l.published !== false);
    const totalPhysicalCourts = myListings.reduce(
      (sum, l) => sum + (l.upcomingSlots[0]?.totalCapacity ?? 4),
      0
    );
    const totalActiveAddons = myListings.reduce(
      (sum, l) => sum + (l.addOnServices ?? []).filter((s) => s.enabled !== false).length,
      0
    );
    const useRemoteAnalytics =
      analyticsData && analyticsData.dataSource !== 'LOCAL_SESSION_DB';

    const activeOrders = providerOrders.filter((o) => o.status !== 'CANCELLED');
    const localGross = activeOrders.reduce((s, o) => s + o.courtPrice + o.addOnTotal, 0);
    const localEscrow = providerOrders
      .filter((o) => o.status === 'CONFIRMED' || o.status === 'HELD')
      .reduce((s, o) => s + o.paidEscrow, 0);
    const localCompletedGross = providerOrders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((s, o) => s + o.courtPrice + o.addOnTotal, 0);

    const grossRevenue = useRemoteAnalytics ? analyticsData.grossRevenue : localGross;
    const escrowHeld = useRemoteAnalytics ? analyticsData.escrowHeld : localEscrow;
    const weeklyGross = useRemoteAnalytics ? analyticsData.grossRevenue : localCompletedGross;
    const commissionAmt = useRemoteAnalytics
      ? analyticsData.commissionAmount
      : Math.round((localCompletedGross * activeProvider.commissionRatePct) / 100);
    const withdrawnNet = myPayouts.reduce((s, p) => s + p.netReceived, 0);
    const rawWithdrawable = useRemoteAnalytics
      ? analyticsData.withdrawableBalance
      : Math.max(0, localCompletedGross - commissionAmt);
    const withdrawableBalance = Math.max(0, rawWithdrawable - withdrawnNet);

    return {
      publishedCount: publishedGroups.length,
      totalGroups: myListings.length,
      totalPhysicalCourts,
      totalActiveAddons,
      pendingCheckins: useRemoteAnalytics
        ? analyticsData.pendingCheckins
        : providerOrders.filter((o) => o.status === 'CONFIRMED').length,
      grossRevenue,
      escrowHeld,
      weeklyGross,
      commissionAmt,
      withdrawableBalance,
    };
  }, [myListings, providerOrders, activeProvider.commissionRatePct, myPayouts, analyticsData]);

  const handleRequestPayout = () => {
    if (metrics.withdrawableBalance < 100_000) {
      flashToast('Số dư khả dụng hiện dưới mức rút tối thiểu (100.000₫).');
      return;
    }
    const gross = Math.round(
      metrics.withdrawableBalance / (1 - activeProvider.commissionRatePct / 100)
    );
    const comm = gross - metrics.withdrawableBalance;
    const record: LessorPayoutRecord = {
      payoutId: `PAYOUT-${Date.now().toString().slice(-6)}`,
      providerId: activeProvider.providerId,
      requestedAt: new Date().toLocaleString('vi-VN'),
      grossAmount: gross,
      commissionAmount: comm,
      netReceived: metrics.withdrawableBalance,
      bankLabel: `Vietcombank •••• 8842 (${activeProvider.providerName})`,
      status: 'SETTLED',
    };
    const next = [record, ...payouts];
    setPayouts(next);
    writePayoutRecords(next);
    flashToast(
      `✓ Đã tất toán ${formatVnd(record.netReceived)} về tài khoản ngân hàng đối soát!`
    );
  };

  const navItems: {
    id: LessorPortalTabId;
    label: string;
    sub: string;
    badge?: string;
    staffAllowed?: boolean;
  }[] = [
    {
      id: 'OVERVIEW',
      label: 'Tổng quan & Biểu đồ',
      sub: 'Doanh thu, lấp đầy & kênh thanh toán',
      staffAllowed: false,
    },
    {
      id: 'ORDERS_CHECKIN',
      label: 'Đơn Đặt Sân & Soát QR',
      sub: 'Quét vé chống giả, lọc ca & xử lý đơn',
      badge: `${metrics.pendingCheckins} chờ`,
      staffAllowed: true,
    },
    {
      id: 'LIVE_COURTS',
      label: 'Sân Đang Dùng & Vị Trí',
      sub: 'Sơ đồ ô sân & vị trí khách đang chơi',
      badge: `${providerOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'CONFIRMED').length + Object.keys(walkInLocksByUnit).length} ô`,
      staffAllowed: true,
    },
    {
      id: 'WEEKLY_SCHEDULE',
      label: 'Lịch Thuê Theo Tuần',
      sub: 'Thời khóa biểu T2 → CN theo ca giờ',
      badge: `${weeklyFixedBlocks.length > 0 ? `${weeklyFixedBlocks.length} cố định` : 'T2–CN'}`,
      staffAllowed: true,
    },
    {
      id: 'COURTS_INVENTORY',
      label: 'Quản lý Cụm Sân & Đăng Sân',
      sub: 'Mở/ẩn sân, số sân trống & ảnh thực tế',
      badge: `${metrics.publishedCount}/${metrics.totalGroups}`,
      staffAllowed: true,
    },
    {
      id: 'ADDON_PRODUCTS',
      label: 'Nước uống & Dịch vụ Đi kèm',
      sub: 'Menu riêng từng sân, giá & tồn kho',
      badge: `${metrics.totalActiveAddons} món`,
      staffAllowed: false,
    },
    {
      id: 'YIELD_PRICING',
      label: 'Định giá Động & Giờ Vàng',
      sub: 'Biên độ giá sàn/trần & chiến lược ca',
      staffAllowed: false,
    },
    {
      id: 'SHOP_AND_STAFF',
      label: 'Hồ sơ Gian hàng & Nhân sự',
      sub: 'Ưu đãi shop công khai & cấp TK Staff',
      staffAllowed: false,
    },
    {
      id: 'ESCROW_WALLET',
      label: 'Ví Chủ Sân & Rút tiền Ký quỹ',
      sub: `Hoa hồng ${activeProvider.commissionRatePct}% • Đối soát tự động`,
      staffAllowed: false,
    },
  ];

  const visibleNavItems = navItems.filter((item) => !isStaffOnly || item.staffAllowed);

  const todayIsoLocal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const sevenDaysAgoIsoLocal = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const orderStatusCounts = useMemo(() => {
    return {
      ALL: providerOrders.length,
      CONFIRMED: providerOrders.filter((o) => o.status === 'CONFIRMED').length,
      COMPLETED: providerOrders.filter((o) => o.status === 'COMPLETED').length,
      NO_SHOW: providerOrders.filter((o) => o.status === 'NO_SHOW').length,
    };
  }, [providerOrders]);

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.trim().toLowerCase();
    return providerOrders.filter((o) => {
      if (orderFilter !== 'ALL' && o.status !== orderFilter) return false;
      if (orderCourtFilter !== 'ALL' && o.groupId !== orderCourtFilter) return false;
      if (orderDateScope === 'TODAY') {
        const isToday = o.dateIso ? o.dateIso === todayIsoLocal : o.slotLabel.includes('Hôm nay');
        if (!isToday) return false;
      } else if (orderDateScope === 'WEEK') {
        if (o.dateIso && o.dateIso < sevenDaysAgoIsoLocal) return false;
      }
      if (q) {
        const matchText =
          o.orderId.toLowerCase().includes(q) ||
          o.qrCode.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q) ||
          (o.customerEmail ?? '').toLowerCase().includes(q) ||
          o.unitNumber.toLowerCase().includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [
    providerOrders,
    orderFilter,
    orderCourtFilter,
    orderDateScope,
    orderSearchQuery,
    todayIsoLocal,
    sevenDaysAgoIsoLocal,
  ]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const safeOrderPage = Math.min(orderPage, totalOrderPages);
  const paginatedOrders = useMemo(
    () =>
      filteredOrders.slice(
        (safeOrderPage - 1) * ORDERS_PAGE_SIZE,
        safeOrderPage * ORDERS_PAGE_SIZE
      ),
    [filteredOrders, safeOrderPage, ORDERS_PAGE_SIZE]
  );

  useEffect(() => {
    setOrderPage(1);
  }, [orderFilter, orderSearchQuery, orderCourtFilter, orderDateScope, activeProvider.providerId]);

  return (
    <section id="command-center" className={embeddedForAdmin ? 'py-2' : 'py-10 sm:py-14'}>
      <div className={embeddedForAdmin ? 'space-y-6' : 'mx-auto max-w-[1420px] px-4 sm:px-8 space-y-6'}>
        {/* TOP EXECUTIVE PARTNER COMMAND HEADER */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#16422C]/20 bg-gradient-to-br from-[#0B2218] via-[#123524] to-[#0F172A] p-6 sm:p-8 text-white shadow-[0_24px_60px_rgba(6,23,16,0.22)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#84CC16]/12 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E7F7D4] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                  {isStaffOnly
                    ? 'Quầy Trực Sân • STAFF'
                    : isAdminInspector
                      ? 'Chế độ Giám sát Đối tác • ADMIN'
                      : 'Hệ thống Quản trị Người Cho Thuê • LESSOR PORTAL'}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-100">
                  ✓ {activeProvider.legalEntityType || 'Đã xác thực KYC Pháp lý'}
                </span>
                <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] text-white/80">
                  Tài khoản: @{session.username}
                </span>
              </div>

              <h1 className="text-2xl sm:text-[32px] font-bold tracking-[-0.025em] leading-tight text-white">
                {activeProvider.providerName}
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-emerald-100/80">
                {activeProvider.district}, {activeProvider.city} • Quản lý{' '}
                <strong>{metrics.totalGroups} cụm sân</strong> ({metrics.totalPhysicalCourts} sân vật lý) •
                Chiết khấu hoa hồng sàn: <strong>{activeProvider.commissionRatePct}%/đơn</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isAdminInspector && (
                <div className="rounded-full bg-white px-1 py-0.5 text-[#0F172A]">
                  <PillSelect
                    prefix="Đối tác:"
                    ariaLabel="Chọn đối tác cho thuê cần kiểm tra"
                    value={activeProvider.providerId}
                    onChange={setSelectedProviderId}
                    options={allProviders.map((p) => ({
                      value: p.providerId,
                      label: `${p.providerName} (${p.city})`,
                    }))}
                  />
                </div>
              )}

              {onOpenPublicShop && (
                <ActionButton
                  variant="glass"
                  size="sm"
                  arrow="up-right"
                  onClick={() => onOpenPublicShop(activeProvider.providerId)}
                >
                  Xem Hồ sơ Gian hàng Công khai
                </ActionButton>
              )}

              {!isStaffOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('COURTS_INVENTORY');
                    setShowCreateCourtForm(true);
                  }}
                  className="rounded-full bg-[#E7F7D4] px-4 py-2 text-xs font-bold text-[#16422C] transition hover:bg-white"
                >
                  + Đăng Cụm Sân Mới
                </button>
              )}

              {onLogout && !embeddedForAdmin && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-white/25 bg-white/8 px-3.5 py-2 text-xs font-semibold text-white/90 hover:bg-white/18"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>
        </div>

        {/* GLOBAL LIVE FEEDBACK BANNER */}
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

        {/* MAIN 12-COL SAAS WORKSPACE */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT 3 COLS: STICKY LESSOR MODULE SIDEBAR */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
            <nav
              aria-label="Phân hệ quản lý cho thuê"
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
                        ? 'bg-[#16422C] text-white shadow-sm'
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
                        active ? 'text-emerald-100/85' : 'text-neutral-500'
                      }`}
                    >
                      {item.sub}
                    </p>
                  </button>
                );
              })}
            </nav>

            {/* Quick Support & Live Chat Status Card */}
            <div className="rounded-[24px] border border-neutral-200/90 bg-white p-4 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F172A]">Trạng thái Kênh Chat Khách</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                    staffChatEnabled
                      ? 'bg-[#E7F7D4] text-[#16422C]'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {staffChatEnabled ? 'ĐANG BẬT' : 'TẠM KHÓA'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Tỷ lệ phản hồi hiện tại: <strong>{activeProvider.responseRatePct}%</strong> ({activeProvider.responseTimeLabel}).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenChatDrawer}
                  className="rounded-xl bg-[#0F172A] py-2 text-[11px] font-semibold text-white hover:bg-[#16422C]"
                >
                  💬 Mở Hộp Chat
                </button>
                {!isStaffOnly && (
                  <button
                    type="button"
                    onClick={onToggleStaffChat}
                    className="rounded-xl border border-neutral-200 bg-[#F8FAFC] py-2 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    {staffChatEnabled ? 'Tạm khóa Staff' : 'Mở lại Staff'}
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT 9 COLS: ACTIVE MODULE WORKSPACE */}
          <div className="lg:col-span-9 min-w-0">
            <AnimatePresence mode="wait">
              {/* ===================================================================== */}
              {/* TAB 1: OVERVIEW & LIVE QR CHECK-IN / BOOKING DESK                     */}
              {/* ===================================================================== */}
              {activeTab === 'OVERVIEW' && (
                <motion.div
                  key="lessor-overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  {/* 4 Executive KPI Cards with Staggered Reveal + Animated Count-up */}
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
                        Doanh thu thực tế ({analyticsDays} ngày)
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#0F172A]">
                        <AnimatedCounter value={metrics.grossRevenue} formatAsVnd />
                      </div>
                      <span className="mt-1 inline-block text-[11px] font-semibold text-[#16422C]">
                        ↑ Tiền sân + Nước &amp; Dịch vụ
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Tiền cọc giữ tại Ký quỹ
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#0E4F7E]">
                        <AnimatedCounter value={metrics.escrowHeld} formatAsVnd />
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Giải ngân ngay khi quét QR
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Đơn chờ khách nhận sân
                      </span>
                      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#16422C]">
                        <AnimatedCounter value={metrics.pendingCheckins} suffix=" ca" />
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Ân hạn trễ tối đa 15 phút
                      </span>
                    </motion.div>

                    <motion.div
                      variants={DASHBOARD_STAGGER_ITEM}
                      className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
                    >
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Quy mô mở thuê hiện tại
                      </span>
                      <div className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-[#0F172A]">
                        {metrics.publishedCount}/{metrics.totalGroups} cụm
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        {metrics.totalPhysicalCourts} sân con • {metrics.totalActiveAddons} dịch vụ
                      </span>
                    </motion.div>
                  </motion.div>

                  {/* Interactive Revenue, Occupancy & Channel Charts Dashboard */}
                  {!isStaffOnly && analyticsData && (
                    <LessorAnalyticsDashboard
                      mode="LESSOR"
                      analytics={analyticsData}
                      days={analyticsDays}
                      onChangeDays={setAnalyticsDays}
                      loading={analyticsLoading}
                      reindexing={reindexingEs}
                      onReindexEs={async () => {
                        setReindexingEs(true);
                        try {
                          const res = await marketplaceApi.triggerElasticsearchReindex();
                          flashToast(res.message);
                          await loadAnalyticsFromDbOrEs();
                        } finally {
                          setReindexingEs(false);
                        }
                      }}
                    />
                  )}

                  {/* Compact Quick Link to Dedicated Order & Check-in Workspace */}
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[#16422C]/20 bg-[#F4F8F4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                        Điều phối Đơn &amp; Quầy Nhận Sân (Khu vực làm việc riêng)
                      </span>
                      <p className="text-xs text-neutral-600">
                        Hiện có <strong className="text-[#0F172A]">{metrics.pendingCheckins} đơn chờ nhận sân</strong> trong tổng số{' '}
                        <strong className="text-[#0F172A]">{providerOrders.length} đơn</strong>. Mở khu làm việc riêng để lọc tìm và xác thực khách đến sân.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <ActionButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQrModalOrder(null);
                          setQrModalQuery('');
                          const defaultTab: QrModalTabId = venueSupportsQr ? 'SCANNER' : 'PIN_VERIFY';
                          const allowed: QrModalTabId[] = [
                            ...(venueSupportsQr ? (['SCANNER'] as QrModalTabId[]) : []),
                            ...(venueSupportsPin ? (['PIN_VERIFY'] as QrModalTabId[]) : []),
                          ];
                          setQrModalTab(defaultTab);
                          setQrModalAllowedModes(allowed.length > 0 ? allowed : ['SCANNER']);
                          setQrModalOpen(true);
                        }}
                      >
                        {venueSupportsQr && !venueSupportsPin
                          ? 'Mở Quầy Quét QR'
                          : !venueSupportsQr && venueSupportsPin
                            ? 'Nhập Mã PIN Nhận Sân'
                            : 'Mở Quầy Nhận Sân'}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        variant="forest"
                        size="sm"
                        onClick={() => setActiveTab('ORDERS_CHECKIN')}
                      >
                        Mở Danh sách Đơn ({providerOrders.length}) →
                      </ActionButton>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 1B: DEDICATED BOOKING DISPATCH & ANTI-COUNTERFEIT QR WORKSPACE   */}
              {/* ===================================================================== */}
              {activeTab === 'ORDERS_CHECKIN' && (
                <motion.div
                  key="lessor-orders-checkin"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-5"
                >
                  {/* Summary Strip for Fast Control */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: 'Tổng đơn cụm sân',
                        value: orderStatusCounts.ALL,
                        tone: 'bg-white border-neutral-200 text-[#0F172A]',
                        target: 'ALL' as const,
                      },
                      {
                        label: 'Chờ quét QR nhận sân',
                        value: orderStatusCounts.CONFIRMED,
                        tone: 'bg-[#F4F8F4] border-[#16422C]/30 text-[#16422C]',
                        target: 'CONFIRMED' as const,
                      },
                      {
                        label: 'Đã nhận sân (Hoàn tất)',
                        value: orderStatusCounts.COMPLETED,
                        tone: 'bg-white border-emerald-200 text-emerald-800',
                        target: 'COMPLETED' as const,
                      },
                      {
                        label: 'Khách bỏ lịch (>15p)',
                        value: orderStatusCounts.NO_SHOW,
                        tone: 'bg-white border-rose-200 text-rose-700',
                        target: 'NO_SHOW' as const,
                      },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={() => setOrderFilter(stat.target)}
                        className={`rounded-[20px] border p-4 text-left transition hover:shadow-xs cursor-pointer ${stat.tone} ${
                          orderFilter === stat.target ? 'ring-2 ring-[#16422C]/35' : ''
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-neutral-500">
                          {stat.label}
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</div>
                      </button>
                    ))}
                  </div>

                  {/* Adaptive Venue Verification Bar: renders ONLY capabilities enabled by this venue's court listings */}
                  {(() => {
                    const scopedListings =
                      orderCourtFilter === 'ALL'
                        ? myListings
                        : myListings.filter((l) => l.groupId === orderCourtFilter);
                    const deskQr = scopedListings.some((l) => l.checkinMode === 'QR_STAFF');
                    const deskPin = scopedListings.some(
                      (l) => l.checkinMode === 'PIN_COUNTER' || l.checkinMode === 'MANUAL'
                    );
                    const pinOnlyDesk = deskPin && !deskQr;
                    const qrOnlyDesk = deskQr && !deskPin;

                    return (
                      <div className="rounded-[26px] border border-[#16422C]/20 bg-gradient-to-r from-[#F4F8F4] to-white p-5 sm:p-6 shadow-2xs">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#16422C] border border-[#16422C]/15">
                              {pinOnlyDesk ? (
                                <>
                                  <KeyRound className="h-3.5 w-3.5" /> Quầy Xác Thực Mã PIN (Không Máy Quét)
                                </>
                              ) : qrOnlyDesk ? (
                                <>
                                  <QrCode className="h-3.5 w-3.5" /> Quầy Quét Mã QR Tại Sân
                                </>
                              ) : (
                                <>
                                  <QrCode className="h-3.5 w-3.5" /> Quầy Nhận Sân Đa Chế Độ (Theo Cấu Hình Cụm)
                                </>
                              )}
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                              {pinOnlyDesk
                                ? 'Nhập Mã PIN 6 chữ số từ Email khách & 4 số cuối SĐT để mở sân'
                                : qrOnlyDesk
                                  ? 'Quét mã QR khách xuất trình trên Email để đối chiếu & mở sân'
                                  : 'Chọn đúng phương thức của từng cụm sân (Quét QR hoặc Nhập Mã PIN 6 số)'}
                            </h3>
                            <p className="text-xs text-neutral-600">
                              {pinOnlyDesk
                                ? 'Cụm sân này không sử dụng máy quét QR — toàn bộ đơn chỉ dùng Mã PIN 6 số dùng 1 lần và hỏi 4 số cuối SĐT.'
                                : qrOnlyDesk
                                  ? 'Hệ thống kiểm tra hiệu lực vé QR dùng 1 lần, đúng cơ sở quản lý và yêu cầu xác nhận 4 số cuối SĐT.'
                                  : 'Cụm dùng máy quét chỉ xử lý bằng QR; cụm không máy quét chỉ xử lý bằng Mã PIN 6 số.'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                            {deskQr && (
                              <ActionButton
                                type="button"
                                variant="forest"
                                size="sm"
                                onClick={() => {
                                  setQrModalOrder(null);
                                  setQrModalQuery('');
                                  setQrModalTab('SCANNER');
                                  setQrModalAllowedModes(['SCANNER']);
                                  setQrModalOpen(true);
                                }}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <QrCode className="h-3.5 w-3.5" /> Mở Máy Quét QR
                                </span>
                              </ActionButton>
                            )}

                            {deskPin && (
                              <ActionButton
                                type="button"
                                variant={pinOnlyDesk ? 'forest' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setQrModalOrder(null);
                                  setQrModalQuery('');
                                  setQrModalTab('PIN_VERIFY');
                                  setQrModalAllowedModes(['PIN_VERIFY']);
                                  setQrModalOpen(true);
                                }}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <KeyRound className="h-3.5 w-3.5" /> Nhập Mã PIN 6 số
                                </span>
                              </ActionButton>
                            )}

                            {deskQr && (
                              <form
                                onSubmit={handleManualQrVerify}
                                className="flex w-full sm:w-auto items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={qrScanInput}
                                  onChange={(e) => setQrScanInput(e.target.value)}
                                  placeholder="Nhập mã vé hoặc mã đơn…"
                                  className="w-48 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                                />
                                <ActionButton type="submit" variant="outline" size="sm">
                                  Kiểm tra
                                </ActionButton>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Live Booking Dispatch Table with Search + Court + Date + Pagination */}
                  <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                    <div className="space-y-4 border-b border-neutral-100 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                            Danh sách Đơn Đặt Sân &amp; Điều phối Ca ({filteredOrders.length}/{providerOrders.length})
                          </h3>
                          <p className="text-xs text-neutral-500">
                            Tìm nhanh theo tên khách, SĐT, email, mã đơn hoặc lọc theo cụm sân và ngày chơi.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'ALL', label: `Tất cả (${orderStatusCounts.ALL})` },
                            { id: 'CONFIRMED', label: `Chờ nhận sân (${orderStatusCounts.CONFIRMED})` },
                            { id: 'COMPLETED', label: `Đã nhận sân (${orderStatusCounts.COMPLETED})` },
                            { id: 'NO_SHOW', label: `Bỏ lịch (${orderStatusCounts.NO_SHOW})` },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setOrderFilter(f.id as typeof orderFilter)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                orderFilter === f.id
                                  ? 'bg-[#0F172A] text-white'
                                  : 'bg-[#F1F5F9] text-neutral-600 hover:text-[#0F172A]'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filter Toolbar: Search + Court Group + Date Scope */}
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
                        <div className="md:col-span-5">
                          <input
                            type="search"
                            value={orderSearchQuery}
                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                            placeholder="Tìm tên khách, 4 số SĐT, mã đơn (#AP-...) hoặc mã vé..."
                            className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <PillSelect
                            variant="soft"
                            ariaLabel="Lọc đơn theo cụm sân"
                            value={orderCourtFilter}
                            onChange={setOrderCourtFilter}
                            options={[
                              { value: 'ALL', label: `Tất cả cụm sân (${myListings.length})` },
                              ...myListings.map((l) => ({ value: l.groupId, label: l.groupName })),
                            ]}
                          />
                        </div>

                        <div className="md:col-span-3 flex items-center gap-1 rounded-xl border border-neutral-200 bg-[#F8FAFC] p-1">
                          {[
                            { id: 'ALL', label: 'Tất cả' },
                            { id: 'TODAY', label: 'Hôm nay' },
                            { id: 'WEEK', label: '7 ngày' },
                          ].map((dScope) => (
                            <button
                              key={dScope.id}
                              type="button"
                              onClick={() => setOrderDateScope(dScope.id as typeof orderDateScope)}
                              className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                                orderDateScope === dScope.id
                                  ? 'bg-[#16422C] text-white'
                                  : 'text-neutral-600 hover:text-[#0F172A]'
                              }`}
                            >
                              {dScope.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {paginatedOrders.map((order) => {
                        const matchedListing =
                          myListings.find((l) => l.groupId === order.groupId) ??
                          listings.find((l) => l.groupId === order.groupId) ??
                          null;
                        const orderListingMode =
                          matchedListing?.checkinMode ?? order.checkinMode ?? 'QR_STAFF';
                        const usesPinCounter =
                          orderListingMode === 'PIN_COUNTER' || orderListingMode === 'MANUAL';
                        const courtServiceCount = getActiveLessorServices(matchedListing).length;
                        const courtThumbUrl = resolveCourtThumbnail(
                          matchedListing?.imageUrl,
                          order.sportName
                        );
                        const maskedPhone =
                          order.customerPhone.replace(/\s+/g, '').length >= 4
                            ? `${order.customerPhone.replace(/\s+/g, '').slice(0, 4)} ••• •••`
                            : 'Đã bảo mật';

                        return (
                          <div
                            key={order.orderId}
                            onClick={() => setDetailOrderId(order.orderId)}
                            className="group cursor-pointer p-4 sm:px-6 sm:py-4 transition hover:bg-[#F8FAFC]"
                          >
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                              {/* COL 1 (5/12): COURT IMAGE + ORDER ID + STATUS + COURT & SLOT */}
                              <div className="lg:col-span-5 flex items-start gap-3.5 min-w-0">
                                <div className="relative h-16 w-20 sm:h-[72px] sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-100">
                                  <img
                                    src={courtThumbUrl}
                                    alt={order.groupName}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  <span className="absolute bottom-1 left-1 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur-xs">
                                    {order.unitNumber}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="tabular-nums rounded-lg bg-[#0F172A] px-2 py-0.5 text-[11px] font-bold text-white">
                                      {order.orderId}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                                        order.status === 'CONFIRMED'
                                          ? 'bg-amber-100 text-amber-900'
                                          : order.status === 'COMPLETED'
                                            ? 'bg-emerald-100 text-emerald-900'
                                            : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {order.status === 'CONFIRMED'
                                        ? usesPinCounter
                                          ? 'Chờ đối chiếu PIN'
                                          : 'Chờ quét QR'
                                        : order.status === 'COMPLETED'
                                          ? 'Đã nhận sân'
                                          : 'Bỏ lịch'}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                                        usesPinCounter
                                          ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                                          : 'bg-[#F4F8F4] text-[#16422C]'
                                      }`}
                                    >
                                      {usesPinCounter ? (
                                        <>
                                          <KeyRound className="h-3 w-3" /> PIN 6 số
                                        </>
                                      ) : (
                                        <>
                                          <QrCode className="h-3 w-3" /> Quét QR
                                        </>
                                      )}
                                    </span>
                                  </div>

                                  <div className="truncate text-sm font-bold text-[#0F172A] group-hover:text-[#16422C]">
                                    {order.groupName}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                                    <span className="font-semibold text-[#16422C]">
                                      {order.sportName}
                                    </span>
                                    <span>·</span>
                                    <span className="font-medium text-neutral-700">
                                      {order.slotLabel}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* COL 2 (3/12): CUSTOMER + ADD-ON SERVICES */}
                              <div className="lg:col-span-3 min-w-0 space-y-1.5 text-xs">
                                <div>
                                  <div className="truncate font-semibold text-[#0F172A]">
                                    {order.customerName}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 tabular-nums">
                                    {maskedPhone}
                                  </div>
                                </div>

                                {order.addOnSummary ? (
                                  <div className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#E7F7D4]/75 px-2.5 py-1 text-[11px] font-semibold text-[#16422C]">
                                    <Package className="h-3 w-3 shrink-0" />
                                    <span className="truncate">
                                      {order.addOnSummary} ({formatVnd(order.addOnTotal)})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                                    <Package className="h-3 w-3 shrink-0 text-neutral-400" />
                                    <span>
                                      {courtServiceCount > 0
                                        ? `${courtServiceCount} dịch vụ sân sẵn có`
                                        : 'Không kèm dịch vụ'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* COL 3 (4/12): PAYMENT SUMMARY + CLEAN ACTIONS */}
                              <div
                                className="lg:col-span-4 flex flex-wrap items-center justify-between gap-3 lg:justify-end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-left lg:text-right text-xs whitespace-nowrap">
                                  <div className="font-bold text-[#0F172A] tabular-nums">
                                    Thu tại sân:{' '}
                                    <span
                                      className={
                                        order.remainingAtVenue > 0
                                          ? 'text-[#B45309]'
                                          : 'text-[#16422C]'
                                      }
                                    >
                                      {formatVnd(order.remainingAtVenue)}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-neutral-500 tabular-nums">
                                    Đã cọc{' '}
                                    <strong className="text-[#16422C]">
                                      {formatVnd(order.paidEscrow)}
                                    </strong>{' '}
                                    • {order.paymentGateway}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDetailOrderId(order.orderId)}
                                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#16422C] hover:text-[#16422C] cursor-pointer"
                                  >
                                    Chi tiết
                                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                                  </button>

                                  {order.status === 'CONFIRMED' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQrModalOrder(order);
                                        if (usesPinCounter) {
                                          setQrModalTab('PIN_VERIFY');
                                          setQrModalAllowedModes(['PIN_VERIFY']);
                                          setQrModalQuery('');
                                        } else {
                                          setQrModalTab('SCANNER');
                                          setQrModalAllowedModes(['SCANNER']);
                                          setQrModalQuery(order.qrToken || order.qrCode);
                                        }
                                        setQrModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full bg-[#16422C] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0F172A] cursor-pointer"
                                    >
                                      {usesPinCounter ? (
                                        <>
                                          <KeyRound className="h-3.5 w-3.5" /> Nhập PIN
                                        </>
                                      ) : (
                                        <>
                                          <QrCode className="h-3.5 w-3.5" /> Quét QR
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {filteredOrders.length === 0 && (
                        <div className="p-8 text-center text-xs text-neutral-500">
                          Không tìm thấy đơn đặt sân nào khớp với từ khóa hoặc bộ lọc hiện tại. Hãy xóa bộ lọc để xem lại toàn bộ danh sách.
                        </div>
                      )}
                    </div>

                    {totalOrderPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-[#F8FAFC] px-5 py-3.5 text-xs">
                        <span className="text-neutral-500 tabular-nums">
                          Hiển thị{' '}
                          <strong className="text-[#0F172A]">
                            {(safeOrderPage - 1) * ORDERS_PAGE_SIZE + 1}–
                            {Math.min(safeOrderPage * ORDERS_PAGE_SIZE, filteredOrders.length)}
                          </strong>{' '}
                          trong <strong className="text-[#0F172A]">{filteredOrders.length}</strong> đơn
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safeOrderPage <= 1}
                            onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                            className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-semibold text-[#0F172A] disabled:opacity-40 hover:bg-neutral-50 cursor-pointer"
                          >
                            ← Trước
                          </button>
                          <span className="px-2 font-bold text-[#16422C] tabular-nums">
                            Trang {safeOrderPage} / {totalOrderPages}
                          </span>
                          <button
                            type="button"
                            disabled={safeOrderPage >= totalOrderPages}
                            onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                            className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-semibold text-[#0F172A] disabled:opacity-40 hover:bg-neutral-50 cursor-pointer"
                          >
                            Sau →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 1C: LIVE COURTS IN USE & EXACT UNIT FLOOR MAP                     */}
              {/* ===================================================================== */}
              {activeTab === 'LIVE_COURTS' && (
                <motion.div
                  key="lessor-live-courts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                >
                  <LiveCourtsInUseSection
                    listings={myListings}
                    providerOrders={providerOrders}
                    walkInLocksByUnit={walkInLocksByUnit}
                    onToggleWalkInLock={handleToggleWalkInLock}
                    onOpenOrderDetail={(orderId) => setDetailOrderId(orderId)}
                    onStartCheckIn={(order, mode) => {
                      setQrModalOrder(order);
                      if (mode === 'PIN_COUNTER' || mode === 'MANUAL') {
                        setQrModalTab('PIN_VERIFY');
                        setQrModalAllowedModes(['PIN_VERIFY']);
                        setQrModalQuery('');
                      } else {
                        setQrModalTab('SCANNER');
                        setQrModalAllowedModes(['SCANNER']);
                        setQrModalQuery(order.qrToken || order.qrCode);
                      }
                      setQrModalOpen(true);
                    }}
                    onCompleteActiveOrder={(orderId) => {
                      flashToast(`✓ Đã mở chi tiết hoàn tất thanh toán tại sân cho đơn ${orderId}.`);
                      setDetailOrderId(orderId);
                    }}
                  />
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 1D: WEEKLY TIMETABLE VIEW (THỜI KHÓA BIỂU THEO TUẦN)               */}
              {/* ===================================================================== */}
              {activeTab === 'WEEKLY_SCHEDULE' && (
                <motion.div
                  key="lessor-weekly-schedule"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                >
                  <WeeklyScheduleGrid
                    listings={myListings}
                    providerOrders={providerOrders}
                    fixedBlocks={weeklyFixedBlocks}
                    onAddFixedBlock={handleAddWeeklyFixedBlock}
                    onRemoveFixedBlock={handleRemoveWeeklyFixedBlock}
                    onOpenOrderDetail={(orderId) => setDetailOrderId(orderId)}
                  />
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 2: COURTS INVENTORY & PUBLISH NEW COURT                           */}
              {/* ===================================================================== */}
              {activeTab === 'COURTS_INVENTORY' && (
                <motion.div
                  key="lessor-courts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-5"
                >
                  {/* CLEAN HEADER + QUICK FILTERS & SEARCH */}
                  <div className="rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                            Quản lý Cụm Sân
                          </span>
                          <span className="rounded-full bg-[#F4F8F4] px-2.5 py-0.5 text-[11px] font-semibold text-[#16422C] tabular-nums">
                            {myListings.filter((l) => l.published !== false).length}/{myListings.length} đang mở
                          </span>
                        </div>
                        <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
                          Danh sách Cụm Sân &amp; Số Sân Trống
                        </h3>
                      </div>

                      {!isStaffOnly && (
                        <ActionButton
                          variant="forest"
                          size="sm"
                          onClick={() => setShowCreateCourtForm(true)}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Thêm cụm sân mới
                        </ActionButton>
                      )}
                    </div>

                    {/* Filter Tabs + Search Input */}
                    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {[
                          {
                            id: 'ALL' as const,
                            label: `Tất cả (${myListings.length})`,
                          },
                          {
                            id: 'PUBLISHED' as const,
                            label: `Đang mở (${myListings.filter((l) => l.published !== false).length})`,
                          },
                          {
                            id: 'PAUSED' as const,
                            label: `Tạm ngưng (${myListings.filter((l) => l.published === false).length})`,
                          },
                        ].map((chip) => {
                          const active = courtStatusFilter === chip.id;
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setCourtStatusFilter(chip.id)}
                              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                                active
                                  ? 'bg-[#16422C] text-white'
                                  : 'border border-neutral-200 bg-[#F8FAFC] text-neutral-600 hover:bg-neutral-100'
                              }`}
                            >
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                        <input
                          type="search"
                          value={courtSearchQuery}
                          onChange={(e) => setCourtSearchQuery(e.target.value)}
                          placeholder="Tìm tên sân, bộ môn..."
                          className="w-full rounded-full border border-neutral-200 bg-[#F8FAFC] py-1.5 pl-8 pr-3.5 text-xs text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OWNED COURT GROUPS LIST */}
                  <div className="space-y-4">
                    {filteredMyListings.length === 0 ? (
                      <div className="rounded-[26px] border border-dashed border-neutral-300 bg-white p-10 text-center space-y-3">
                        <p className="text-sm font-semibold text-[#0F172A]">
                          Không tìm thấy cụm sân nào phù hợp bộ lọc hiện tại.
                        </p>
                        {!isStaffOnly && (
                          <ActionButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCourtStatusFilter('ALL');
                              setCourtSearchQuery('');
                            }}
                          >
                            Hiển thị lại tất cả cụm sân
                          </ActionButton>
                        )}
                      </div>
                    ) : (
                      filteredMyListings.map((court) => {
                        const isPublished = court.published !== false;
                        const activeAddonCount = (court.addOnServices ?? []).filter(
                          (s) => s.enabled !== false
                        ).length;
                        const isEditingPrice = editingPriceGroupId === court.groupId;
                        const isPinMode =
                          court.checkinMode === 'PIN_COUNTER' || court.checkinMode === 'MANUAL';
                        const courtCapacity = court.upcomingSlots[0]?.totalCapacity ?? 4;

                        return (
                          <div
                            key={court.groupId}
                            className={`overflow-hidden rounded-[26px] border bg-white p-5 shadow-xs transition ${
                              isPublished
                                ? 'border-neutral-200/90'
                                : 'border-amber-300/80 bg-amber-50/20'
                            }`}
                          >
                            <div className="flex flex-col gap-5 lg:flex-row">
                              {/* Left Media Card */}
                              <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-2xl bg-neutral-100 lg:h-auto lg:min-h-[210px] lg:w-56">
                                <img
                                  src={court.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                                  alt={court.groupName}
                                  className={`h-full w-full object-cover ${
                                    isPublished ? '' : 'grayscale opacity-75'
                                  }`}
                                />
                                <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
                                  {court.sportName} • {court.slotMinutes}p/ca
                                </span>
                                {!isStaffOnly && onUploadCourtPhoto && (
                                  <label className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#0F172A] shadow-sm hover:bg-[#E7F7D4]">
                                    <Camera className="h-3 w-3" />
                                    Đổi ảnh
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        await onUploadCourtPhoto(
                                          court.groupId,
                                          file,
                                          `Ảnh thực tế ${court.groupName}`,
                                          true
                                        );
                                        flashToast(`✓ Đã cập nhật ảnh mới cho "${court.groupName}"!`);
                                      }}
                                    />
                                  </label>
                                )}
                              </div>

                              {/* Right Clean 3-Layer Management Content */}
                              <div className="flex-1 space-y-4">
                                {/* Layer 1: Title + Status Switch + Preview */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                          isPublished
                                            ? 'bg-[#E7F7D4] text-[#16422C]'
                                            : 'bg-amber-200 text-amber-950'
                                        }`}
                                      >
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${
                                            isPublished ? 'bg-[#16422C]' : 'bg-amber-800'
                                          }`}
                                        />
                                        {isPublished ? 'Đang mở đặt lịch' : 'Đang tạm ngưng'}
                                      </span>
                                      <span className="text-xs text-neutral-400">•</span>
                                      <span className="text-xs font-medium text-neutral-500">
                                        {court.venueName}
                                      </span>
                                    </div>
                                    <h4 className="text-base sm:text-lg font-bold text-[#0F172A]">
                                      {court.groupName}
                                    </h4>
                                    <p className="text-xs text-neutral-500">{court.venueAddress}</p>
                                  </div>

                                  {!isStaffOnly && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onToggleListingPublished(court.groupId);
                                          flashToast(
                                            isPublished
                                              ? `Đã tạm ngưng nhận khách cho "${court.groupName}".`
                                              : `✓ Đã mở nhận lịch trở lại cho "${court.groupName}"!`
                                          );
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                          isPublished
                                            ? 'border border-neutral-200 bg-white text-neutral-700 hover:border-amber-500 hover:text-amber-800'
                                            : 'bg-[#16422C] text-white hover:bg-[#0F172A]'
                                        }`}
                                      >
                                        {isPublished ? (
                                          <>
                                            <PauseCircle className="h-3.5 w-3.5" />
                                            Tạm ngưng
                                          </>
                                        ) : (
                                          <>
                                            <PlayCircle className="h-3.5 w-3.5" />
                                            Mở lại
                                          </>
                                        )}
                                      </button>

                                      {onPreviewCourt && isPublished && (
                                        <button
                                          type="button"
                                          onClick={() => onPreviewCourt(court)}
                                          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-neutral-100"
                                        >
                                          Xem trên sàn
                                          <ExternalLink className="h-3 w-3 text-neutral-400" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Layer 2: Scannable 3-Metric Strip */}
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
                                  <div className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] px-3.5 py-2.5">
                                    <div className="text-[11px] font-medium text-neutral-500">
                                      Giá thuê tiêu chuẩn
                                    </div>
                                    <div className="mt-0.5 font-bold text-[#16422C] tabular-nums text-sm">
                                      {formatVnd(court.basePrice)}/ca
                                    </div>
                                    <div className="text-[10.5px] text-neutral-500 tabular-nums">
                                      Biên độ: {formatVnd(court.minPrice)} – {formatVnd(court.maxPrice)}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] px-3.5 py-2.5">
                                    <div className="text-[11px] font-medium text-neutral-500">
                                      Quy mô &amp; Tiền cọc
                                    </div>
                                    <div className="mt-0.5 font-bold text-[#0F172A] tabular-nums text-sm">
                                      {courtCapacity} sân con • Cọc {court.depositPercent}%
                                    </div>
                                    <div className="text-[10.5px] text-neutral-500">
                                      Thời lượng {court.slotMinutes} phút/ca
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] px-3.5 py-2.5 flex flex-col justify-between">
                                    <div className="text-[11px] font-medium text-neutral-500">
                                      Cách kiểm tra vé tại quầy
                                    </div>
                                    <button
                                      type="button"
                                      disabled={isStaffOnly}
                                      onClick={() => {
                                        const nextMode: CheckinVerificationMode = isPinMode
                                          ? 'QR_STAFF'
                                          : 'PIN_COUNTER';
                                        onUpdateListingPricing(court.groupId, {
                                          basePrice: court.basePrice,
                                          minPrice: court.minPrice,
                                          maxPrice: court.maxPrice,
                                          depositPercent: court.depositPercent,
                                          checkinMode: nextMode,
                                        });
                                        flashToast(
                                          nextMode === 'PIN_COUNTER'
                                            ? `Đã đổi "${court.groupName}" sang kiểm tra bằng Mã PIN 6 số.`
                                            : `Đã đổi "${court.groupName}" sang quét mã QR tại quầy.`
                                        );
                                      }}
                                      title={isStaffOnly ? undefined : 'Bấm để đổi hình thức kiểm tra vé'}
                                      className={`mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                                        isPinMode
                                          ? 'border-[#0E4F7E]/30 bg-[#E6F1F8] text-[#0E4F7E]'
                                          : 'border-[#16422C]/25 bg-[#E7F7D4]/70 text-[#16422C]'
                                      } ${isStaffOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-85'}`}
                                    >
                                      {isPinMode ? (
                                        <>
                                          <KeyRound className="h-3 w-3" />
                                          Mã PIN 6 số
                                        </>
                                      ) : (
                                        <>
                                          <QrCode className="h-3 w-3" />
                                          Quét mã QR
                                        </>
                                      )}
                                      {!isStaffOnly && (
                                        <span className="text-[10px] opacity-65">(Đổi)</span>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Layer 3: Live Slot Availability Stepper */}
                                <div className="rounded-2xl border border-neutral-200/75 bg-white p-3.5">
                                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <span className="font-bold text-[#0F172A]">
                                      Số sân trống hôm nay
                                    </span>
                                    <span className="text-neutral-500">
                                      Bấm − hoặc + để cập nhật nhanh khi có khách đặt trực tiếp
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                    {court.upcomingSlots.slice(0, 3).map((slot, idx) => {
                                      const availTone =
                                        slot.availableCourts === 0
                                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                                          : slot.availableCourts <= 2
                                            ? 'text-amber-800 bg-amber-50 border-amber-200'
                                            : 'text-[#16422C] bg-[#F4F8F4] border-[#16422C]/20';
                                      return (
                                        <div
                                          key={slot.slotStart}
                                          className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-[#F8FAFC] px-3 py-2 text-xs"
                                        >
                                          <div>
                                            <div className="font-semibold text-[#0F172A]">
                                              {slot.timePeriod === 'MORNING'
                                                ? 'Ca Sáng'
                                                : slot.timePeriod === 'AFTERNOON'
                                                  ? 'Ca Chiều'
                                                  : 'Ca Tối'}
                                            </div>
                                            <div className="tabular-nums text-[11px] font-medium text-neutral-600">
                                              {formatVnd(slot.currentDynamicPrice)}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              aria-label="Giảm số sân trống"
                                              onClick={() => {
                                                const nextSlots = court.upcomingSlots.map((s, i) =>
                                                  i === idx
                                                    ? {
                                                        ...s,
                                                        availableCourts: Math.max(
                                                          0,
                                                          s.availableCourts - 1
                                                        ),
                                                      }
                                                    : s
                                                );
                                                onUpdateListingSlots(court.groupId, nextSlots);
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white font-bold text-[#0F172A] hover:bg-neutral-100"
                                            >
                                              −
                                            </button>
                                            <span
                                              className={`min-w-[46px] rounded-lg border px-1.5 py-0.5 text-center tabular-nums text-xs font-bold ${availTone}`}
                                            >
                                              {slot.availableCourts}/{slot.totalCapacity}
                                            </span>
                                            <button
                                              type="button"
                                              aria-label="Tăng số sân trống"
                                              onClick={() => {
                                                const nextSlots = court.upcomingSlots.map((s, i) =>
                                                  i === idx
                                                    ? {
                                                        ...s,
                                                        availableCourts: Math.min(
                                                          s.totalCapacity,
                                                          s.availableCourts + 1
                                                        ),
                                                      }
                                                    : s
                                                );
                                                onUpdateListingSlots(court.groupId, nextSlots);
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white font-bold text-[#0F172A] hover:bg-neutral-100"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Layer 4: Clean Footer Actions */}
                                {!isStaffOnly && (
                                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-neutral-100 pt-3 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditingPrice) {
                                          setEditingPriceGroupId(null);
                                        } else {
                                          setEditingPriceGroupId(court.groupId);
                                          setEditBase(court.basePrice);
                                          setEditMin(court.minPrice);
                                          setEditMax(court.maxPrice);
                                          setEditDeposit(court.depositPercent);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 font-semibold text-[#0F172A] hover:border-[#0E4F7E] hover:text-[#0E4F7E]"
                                    >
                                      <SlidersHorizontal className="h-3.5 w-3.5" />
                                      {isEditingPrice ? 'Đóng chỉnh giá' : 'Chỉnh giá & tiền cọc'}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFocusedServiceGroupId(court.groupId);
                                        setActiveTab('ADDON_PRODUCTS');
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-[#16422C]/25 bg-[#F4F8F4] px-3.5 py-1.5 font-semibold text-[#16422C] hover:bg-[#E7F7D4]"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Nước &amp; Dịch vụ ({activeAddonCount} món) →
                                    </button>
                                  </div>
                                )}

                                {/* Inline Price Editor */}
                                {isEditingPrice && !isStaffOnly && (
                                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4]/70 p-4 sm:grid-cols-5 items-end text-xs">
                                    <div>
                                      <label className="mb-1 block font-semibold text-neutral-700">
                                        Giá thấp nhất (₫)
                                      </label>
                                      <input
                                        type="number"
                                        step={10000}
                                        value={editMin}
                                        onChange={(e) => setEditMin(Number(e.target.value) || 0)}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-2.5 py-2 tabular-nums font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block font-semibold text-neutral-700">
                                        Giá tiêu chuẩn (₫)
                                      </label>
                                      <input
                                        type="number"
                                        step={10000}
                                        value={editBase}
                                        onChange={(e) => setEditBase(Number(e.target.value) || 0)}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-2.5 py-2 tabular-nums font-semibold text-[#16422C]"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block font-semibold text-neutral-700">
                                        Giá giờ vàng (₫)
                                      </label>
                                      <input
                                        type="number"
                                        step={10000}
                                        value={editMax}
                                        onChange={(e) => setEditMax(Number(e.target.value) || 0)}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-2.5 py-2 tabular-nums font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block font-semibold text-neutral-700">
                                        Cọc (%)
                                      </label>
                                      <input
                                        type="number"
                                        min={10}
                                        max={100}
                                        value={editDeposit}
                                        onChange={(e) => setEditDeposit(Number(e.target.value) || 30)}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-2.5 py-2 tabular-nums font-semibold"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const safeMin = Math.max(50_000, editMin);
                                        const safeMax = Math.max(safeMin + 10_000, editMax);
                                        const safeBase = Math.min(safeMax, Math.max(safeMin, editBase));
                                        onUpdateListingPricing(court.groupId, {
                                          basePrice: safeBase,
                                          minPrice: safeMin,
                                          maxPrice: safeMax,
                                          depositPercent: Math.min(100, Math.max(10, editDeposit)),
                                        });
                                        setEditingPriceGroupId(null);
                                        flashToast(`✓ Đã cập nhật giá cho "${court.groupName}"!`);
                                      }}
                                      className="rounded-xl bg-[#16422C] py-2.5 font-bold text-white hover:bg-[#0F172A]"
                                    >
                                      Lưu giá mới
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 3: ADD-ON PRODUCTS & DRINKS SCOPED TO THIS LESSOR                 */}
              {/* ===================================================================== */}
              {activeTab === 'ADDON_PRODUCTS' && !isStaffOnly && (
                <motion.div
                  key="lessor-addons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                >
                  <LessorAddOnServicesManager
                    listings={myListings}
                    initialGroupId={focusedServiceGroupId}
                    onUpdateListingServices={onUpdateListingServices}
                    onPreviewCourt={onPreviewCourt}
                  />
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 4: DYNAMIC YIELD PRICING & PRIME-TIME SURGE                       */}
              {/* ===================================================================== */}
              {activeTab === 'YIELD_PRICING' && !isStaffOnly && (
                <motion.div
                  key="lessor-pricing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  <div className="flex flex-col gap-4 rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                        Chiến lược Doanh thu &amp; Lấp đầy Ca trống
                      </span>
                      <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
                        Cấu hình Định giá Động Tự động theo Khung Giờ &amp; Mật độ Đặt Sân
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Áp dụng nhanh chiến lược giá cho từng cụm sân hoặc mở trình mô phỏng Monte Carlo 1.000 kịch bản.
                      </p>
                    </div>

                    {onNavigate && (
                      <ActionButton
                        variant="forest"
                        size="sm"
                        arrow="right"
                        onClick={() => onNavigate('pricing')}
                      >
                        Mở Mô phỏng Doanh thu Chi tiết
                      </ActionButton>
                    )}
                  </div>

                  <div className="space-y-4">
                    {myListings.map((court) => (
                      <div
                        key={court.groupId}
                        className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-[#16422C]">
                              {court.sportName} • Cọc giữ chỗ {court.depositPercent}%
                            </span>
                            <h4 className="text-base font-bold text-[#0F172A]">{court.groupName}</h4>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const minP = Math.max(80_000, Math.round((court.basePrice * 0.65) / 10000) * 10000);
                                onUpdateListingPricing(court.groupId, {
                                  basePrice: court.basePrice,
                                  minPrice: minP,
                                  maxPrice: court.maxPrice,
                                  depositPercent: court.depositPercent,
                                });
                                flashToast(`✓ Đã kích hoạt gói Kích cầu Ca Sáng (Sàn ${formatVnd(minP)})!`);
                              }}
                              className="rounded-full border border-neutral-200 bg-[#F8FAFC] px-3 py-1.5 font-semibold text-neutral-700 hover:border-[#16422C]"
                            >
                              ☀ Kích cầu Ca Sáng (-35% sàn)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const maxP = Math.round((court.basePrice * 1.45) / 10000) * 10000;
                                onUpdateListingPricing(court.groupId, {
                                  basePrice: court.basePrice,
                                  minPrice: court.minPrice,
                                  maxPrice: maxP,
                                  depositPercent: Math.max(40, court.depositPercent),
                                });
                                flashToast(
                                  `✓ Đã áp dụng tối ưu Giờ Vàng 18h–21h (Trần ${formatVnd(maxP)}, cọc ≥40%)!`
                                );
                              }}
                              className="rounded-full bg-[#F4F8F4] border border-[#16422C]/25 px-3 py-1.5 font-semibold text-[#16422C] hover:bg-[#E7F7D4]"
                            >
                              ⚡ Tối ưu Biên Giờ Vàng (+45% trần)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                          <div className="rounded-2xl bg-[#F8FAFC] p-4 border border-neutral-200/70">
                            <span className="text-neutral-500">Ca Thấp Điểm (06:00 – 11:00)</span>
                            <div className="mt-1 tabular-nums text-lg font-bold text-[#0E4F7E]">
                              {formatVnd(court.minPrice)}
                            </div>
                            <span className="text-[11px] text-neutral-500">
                              Thu hút CLB sinh viên &amp; người tập buổi sáng
                            </span>
                          </div>
                          <div className="rounded-2xl bg-[#F8FAFC] p-4 border border-neutral-200/70">
                            <span className="text-neutral-500">Ca Tiêu Chuẩn (14:00 – 17:00)</span>
                            <div className="mt-1 tabular-nums text-lg font-bold text-[#0F172A]">
                              {formatVnd(court.basePrice)}
                            </div>
                            <span className="text-[11px] text-neutral-500">
                              Hệ số cơ sở 1.00x khi lấp đầy &lt; 60%
                            </span>
                          </div>
                          <div className="rounded-2xl bg-[#F4F8F4] p-4 border border-[#16422C]/25">
                            <span className="text-[#16422C] font-semibold">
                              Ca Giờ Vàng Cao Điểm (18:00 – 21:30)
                            </span>
                            <div className="mt-1 tabular-nums text-lg font-bold text-[#16422C]">
                              {formatVnd(court.maxPrice)}
                            </div>
                            <span className="text-[11px] text-neutral-600">
                              Tự động khóa trần bảo vệ khách đặt sớm
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 5: SHOP PROFILE & VENUE STAFF MANAGEMENT                          */}
              {/* ===================================================================== */}
              {activeTab === 'SHOP_AND_STAFF' && !isStaffOnly && (
                <motion.div
                  key="lessor-shop-staff"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="grid grid-cols-1 gap-6 xl:grid-cols-12"
                >
                  {/* Public Shop Profile Editor */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateProviderProfile(activeProvider.providerId, {
                        shopSlogan: sloganDraft.trim(),
                        voucherLabel: voucherDraft.trim(),
                        responseTimeLabel: responseDraft.trim(),
                      });
                      flashToast('✓ Đã cập nhật Hồ sơ Gian hàng Công khai của Chủ sân!');
                    }}
                    className="xl:col-span-6 rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4 h-fit"
                  >
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                        Thương hiệu Đối tác Cho thuê
                      </span>
                      <h3 className="mt-0.5 text-lg font-bold text-[#0F172A]">
                        Cấu hình Hồ sơ Gian hàng Công khai
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Hiển thị trực tiếp trên trang hồ sơ công khai khi khách bấm xem thông tin cơ sở.
                      </p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Khẩu hiệu giới thiệu cơ sở (Slogan)
                        </label>
                        <textarea
                          rows={3}
                          value={sloganDraft}
                          onChange={(e) => setSloganDraft(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Nhãn Ưu đãi / Voucher hiển thị trên Gian hàng
                        </label>
                        <input
                          type="text"
                          value={voucherDraft}
                          onChange={(e) => setVoucherDraft(e.target.value)}
                          placeholder="VD: Giảm 15% ca sáng < 11h + Tặng trà đá..."
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Cam kết tốc độ phản hồi Chat
                        </label>
                        <input
                          type="text"
                          value={responseDraft}
                          onChange={(e) => setResponseDraft(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      {onOpenPublicShop && (
                        <ActionButton
                          type="button"
                          variant="outline"
                          size="sm"
                          arrow="up-right"
                          onClick={() => onOpenPublicShop(activeProvider.providerId)}
                        >
                          Xem trang Gian hàng
                        </ActionButton>
                      )}
                      <ActionButton type="submit" variant="forest" size="sm">
                        Lưu Hồ sơ Gian hàng
                      </ActionButton>
                    </div>
                  </form>

                  {/* Venue Staff Provisioning */}
                  <div className="xl:col-span-6 rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                        Phân quyền Nhân sự Trực Sân (STAFF)
                      </span>
                      <h3 className="mt-0.5 text-lg font-bold text-[#0F172A]">
                        Cấp Tài khoản Nhân viên Quét QR &amp; Trực Quầy
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Nhân viên chỉ được quét vé QR 1 lần và chat hỗ trợ khách — không được phép sửa giá hay rút tiền.
                      </p>
                    </div>

                    <form onSubmit={handleCreateStaffAccount} className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Họ và tên nhân viên *
                        </label>
                        <input
                          type="text"
                          required
                          value={staffName}
                          onChange={(e) => setStaffName(e.target.value)}
                          placeholder="VD: Phạm Văn Hùng"
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Ca làm việc
                        </label>
                        <input
                          type="text"
                          value={staffShift}
                          onChange={(e) => setStaffShift(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Tên đăng nhập cấp mới *
                        </label>
                        <input
                          type="text"
                          required
                          value={staffUsername}
                          onChange={(e) => setStaffUsername(e.target.value)}
                          placeholder="VD: nhanvien.ca2"
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Mật khẩu đăng nhập *
                        </label>
                        <input
                          type="text"
                          required
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 font-mono text-[#0F172A]"
                        />
                      </div>
                      <div className="col-span-2">
                        <ActionButton type="submit" variant="ink" size="sm" fullWidth>
                          + Cấp tài khoản Nhân viên trực sân
                        </ActionButton>
                      </div>
                    </form>

                    <div className="space-y-2 border-t border-neutral-100 pt-3 text-xs">
                      {activeProvider.providerId === 'PROV_HN_01' && (
                        <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-[#F8FAFC] px-3.5 py-2.5">
                          <div>
                            <div className="font-bold text-[#0F172A]">
                              Vũ Tuấn Kiệt • <code>nhanvien.san01</code>
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              Mật khẩu mặc định: <code>123456</code> • Ca Sáng &amp; Chiều
                            </div>
                          </div>
                          <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[10.5px] font-bold text-[#16422C]">
                            ĐANG HOẠT ĐỘNG
                          </span>
                        </div>
                      )}

                      {myStaffMembers.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-[#F8FAFC] px-3.5 py-2.5"
                        >
                          <div>
                            <div className="font-bold text-[#0F172A]">
                              {st.fullName} • <code>{st.username}</code>
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              MK: <code>{st.passwordPlain}</code> • {st.shiftLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = staffList.map((x) =>
                                x.id === st.id ? { ...x, active: !x.active } : x
                              );
                              setStaffList(next);
                              writeCustomStaffList(next);
                            }}
                            className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                              st.active
                                ? 'bg-[#E7F7D4] text-[#16422C]'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {st.active ? 'Đang mở' : 'Đã khóa'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===================================================================== */}
              {/* TAB 6: ESCROW WALLET & NET PAYOUT SETTLEMENT                          */}
              {/* ===================================================================== */}
              {activeTab === 'ESCROW_WALLET' && !isStaffOnly && (
                <motion.div
                  key="lessor-wallet"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[26px] border border-[#16422C]/25 bg-[#F4F8F4] p-6">
                      <span className="text-xs font-bold text-[#16422C]">
                        Số dư khả dụng có thể rút ngay
                      </span>
                      <div className="mt-2 tabular-nums text-2xl sm:text-3xl font-bold text-[#16422C]">
                        {formatVnd(metrics.withdrawableBalance)}
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        Đã khấu trừ {activeProvider.commissionRatePct}% phí sàn ({formatVnd(metrics.commissionAmt)})
                      </p>
                      <button
                        type="button"
                        onClick={handleRequestPayout}
                        className="mt-4 w-full rounded-full bg-[#16422C] py-2.5 text-xs font-bold text-white hover:bg-[#0F172A]"
                      >
                        Rút tiền đối soát về Ngân hàng →
                      </button>
                    </div>

                    <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs">
                      <span className="text-xs font-semibold text-neutral-500">
                        Tổng doanh thu đã hoàn tất (Kỳ này)
                      </span>
                      <div className="mt-2 tabular-nums text-2xl font-bold text-[#0F172A]">
                        {formatVnd(metrics.weeklyGross)}
                      </div>
                      <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
                        Bao gồm 100% tiền thuê ca sân và doanh thu bán kèm Nước uống / Dụng cụ tại cơ sở.
                      </p>
                    </div>

                    <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs">
                      <span className="text-xs font-semibold text-neutral-500">
                        Tài khoản Ngân hàng Thụ hưởng KYC
                      </span>
                      <div className="mt-2 text-base font-bold text-[#0F172A]">
                        Vietcombank •••• 8842
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        Chủ TK: {activeProvider.providerName.toUpperCase()}
                      </p>
                      <span className="mt-3 inline-block rounded-full bg-[#E6F1F8] px-3 py-1 text-[11px] font-semibold text-[#0E4F7E]">
                        Đối soát Sổ cái Kép T+0
                      </span>
                    </div>
                  </div>

                  {/* Payout History Table */}
                  <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Lịch sử Lệnh Tất toán &amp; Giải ngân Ký quỹ
                    </h3>

                    {myPayouts.length === 0 ? (
                      <div className="rounded-2xl bg-[#F8FAFC] p-5 text-xs text-neutral-500 border border-neutral-200/60">
                        Chưa phát sinh lệnh rút tiền mới trong phiên này. Bấm <strong>“Rút tiền đối soát về Ngân hàng”</strong> để tạo bút toán giải ngân tức thời.
                      </div>
                    ) : (
                      <div className="space-y-2.5 text-xs">
                        {myPayouts.map((p) => (
                          <div
                            key={p.payoutId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] px-4 py-3"
                          >
                            <div>
                              <span className="font-bold text-[#0F172A]">{p.payoutId}</span> •{' '}
                              <span className="text-neutral-500">{p.requestedAt}</span>
                              <div className="mt-0.5 text-[11px] text-neutral-500">{p.bankLabel}</div>
                            </div>
                            <div className="text-right tabular-nums">
                              <div className="font-bold text-[#16422C] text-sm">
                                +{formatVnd(p.netReceived)}
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                Gộp: {formatVnd(p.grossAmount)} • Phí sàn: -{formatVnd(p.commissionAmount)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <BookingOrderDetailModal
        order={selectedDetailOrder}
        courtListing={selectedDetailCourt}
        isStaffOnly={isStaffOnly}
        onClose={() => setDetailOrderId(null)}
        onStartCheckIn={(order, mode) => {
          setQrModalOrder(order);
          if (mode === 'PIN_COUNTER' || mode === 'MANUAL') {
            setQrModalTab('PIN_VERIFY');
            setQrModalAllowedModes(['PIN_VERIFY']);
            setQrModalQuery('');
          } else {
            setQrModalTab('SCANNER');
            setQrModalAllowedModes(['SCANNER']);
            setQrModalQuery(order.qrToken || order.qrCode);
          }
          setQrModalOpen(true);
        }}
        onMarkNoShow={(orderId) => {
          updateOrderStatus(orderId, 'NO_SHOW');
          flashToast(`Đã đánh dấu đơn ${orderId} bỏ lịch quá 15 phút ân hạn.`);
        }}
        onUpdateOrderAddOns={handleUpdateOrderAddOns}
        onOpenManageCourtServices={(groupId) => {
          setFocusedServiceGroupId(groupId);
          setActiveTab('ADDON_PRODUCTS');
        }}
      />
      <CreateCourtGroupModal
        open={showCreateCourtForm && !isStaffOnly}
        onClose={() => setShowCreateCourtForm(false)}
        sports={sports}
        activeProvider={activeProvider}
        defaultVenueName={myListings[0]?.venueName ?? activeProvider.providerName}
        defaultAddress={myListings[0]?.venueAddress ?? `${activeProvider.district}, ${activeProvider.city}`}
        presetCovers={PRESET_COURT_COVERS}
        onCreateListing={onCreateNewListing}
        onCreatedSuccess={(groupName) =>
          flashToast(`✓ Đã tạo & mở bán cụm sân "${groupName}" thành công!`)
        }
      />
      <QrCheckInScannerModal
        open={qrModalOpen}
        initialTab={qrModalTab}
        allowedModes={qrModalAllowedModes}
        initialOrder={qrModalOrder}
        initialQuery={qrModalQuery}
        providerOrders={providerOrders}
        allSystemOrders={Object.values(ordersByProvider).flat()}
        activeProviderId={activeProvider.providerId}
        activeVenueName={activeProvider.providerName}
        onClose={() => setQrModalOpen(false)}
        onPinFailedAttempt={handlePinFailedAttempt}
        onConfirmCheckIn={(orderId, method) => {
          updateOrderStatus(orderId, 'COMPLETED');
          setQrScanInput('');
          flashToast(
            method === 'PIN_COUNTER'
              ? `✓ Xác thực PIN 6 số thành công! Đã mở sân & giải ngân ký quỹ cho đơn ${orderId}.`
              : `✓ Check-in QR hợp lệ! Đã mở sân & giải ngân ký quỹ cho đơn ${orderId}.`
          );
        }}
      />
    </section>
  );
};

