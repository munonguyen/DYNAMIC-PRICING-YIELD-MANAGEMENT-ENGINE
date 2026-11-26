import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
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
  buildFreshListingSlots,
  formatSlotWindow,
  formatVnd,
  getStoredTicketsForLessor,
} from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';
import { LessorAddOnServicesManager } from './LessorAddOnServicesManager';
import { LessorAnalyticsDashboard } from './LessorAnalyticsDashboard';

export type LessorPortalTabId =
  | 'OVERVIEW'
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
    patch: { basePrice: number; minPrice: number; maxPrice: number; depositPercent: number }
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

const PRESET_COURT_COVERS: { label: string; url: string }[] = [
  { label: 'Sân Pickleball Mái Vòm Chuẩn Giải', url: '/images/court-pickleball-dome.jpg' },
  { label: 'Sân Pickleball Ngoài Trời', url: '/images/real-pickleball-outdoor.jpg' },
  { label: 'Sân Bóng Đá Cỏ Nhân Tạo Đèn Đêm', url: '/images/court-football-night.jpg' },
  { label: 'Sân Cầu Lông Thảm BWF Trong Nhà', url: '/images/court-badminton-arena.jpg' },
  { label: 'Sân Tennis Acrylic Tiêu Chuẩn', url: '/images/court-tennis-pro.jpg' },
  { label: 'Sân Bóng Rổ Sàn Gỗ FIBA', url: '/images/court-basketball-fiba.jpg' },
];

function createSeedOrdersForProvider(
  provider: VenueProviderInfo,
  providerListings: PublishedListing[]
): LessorBookingOrder[] {
  const first = providerListings[0];
  const second = providerListings[1] ?? first;
  if (!first) return [];

  const activeAddons = (first.addOnServices ?? []).filter((s) => s.enabled !== false);
  const sampleAddon = activeAddons[0];
  const addonSummary = sampleAddon ? `2x ${sampleAddon.name}` : undefined;
  const addonTotal = sampleAddon ? sampleAddon.unitPrice * 2 : 0;
  const firstGross = first.basePrice + addonTotal;
  const firstDeposit = Math.round((first.basePrice * first.depositPercent) / 100) + addonTotal;

  const secondPrice = second.maxPrice;
  const secondDeposit = Math.round((secondPrice * second.depositPercent) / 100);

  return [
    {
      orderId: `ORD-${provider.providerId.slice(-4)}-901`,
      reservationId: `RES-${provider.providerId}-01`,
      providerId: provider.providerId,
      groupId: first.groupId,
      groupName: first.groupName,
      venueName: first.venueName,
      sportName: first.sportName,
      unitNumber: 'Sân 02',
      slotLabel: 'Hôm nay • 18:00 – 19:00',
      customerName: 'Nguyễn Minh Quân',
      customerPhone: '0988 776 655',
      courtPrice: first.basePrice,
      addOnSummary: addonSummary,
      addOnTotal: addonTotal,
      paidEscrow: firstDeposit,
      remainingAtVenue: Math.max(0, firstGross - firstDeposit),
      paymentGateway: 'VNPAY Ký quỹ',
      qrCode: `QR-${provider.providerId.replace(/_/g, '')}-8821`,
      status: 'CONFIRMED',
      createdAtLabel: '14 phút trước',
    },
    {
      orderId: `ORD-${provider.providerId.slice(-4)}-902`,
      reservationId: `RES-${provider.providerId}-02`,
      providerId: provider.providerId,
      groupId: second.groupId,
      groupName: second.groupName,
      venueName: second.venueName,
      sportName: second.sportName,
      unitNumber: 'Sân 05',
      slotLabel: 'Hôm nay • 19:30 – 21:00',
      customerName: 'Trần Hoàng Bách',
      customerPhone: '0904 512 889',
      courtPrice: secondPrice,
      addOnSummary: undefined,
      addOnTotal: 0,
      paidEscrow: secondPrice,
      remainingAtVenue: 0,
      paymentGateway: 'VietQR Napas 247',
      qrCode: `QR-${provider.providerId.replace(/_/g, '')}-9940`,
      status: 'CONFIRMED',
      createdAtLabel: '38 phút trước',
    },
    {
      orderId: `ORD-${provider.providerId.slice(-4)}-899`,
      reservationId: `RES-${provider.providerId}-03`,
      providerId: provider.providerId,
      groupId: first.groupId,
      groupName: first.groupName,
      venueName: first.venueName,
      sportName: first.sportName,
      unitNumber: 'Sân 01',
      slotLabel: 'Hôm nay • 07:30 – 08:30',
      customerName: 'Lê Thảo Vy',
      customerPhone: '0912 339 401',
      courtPrice: first.minPrice,
      addOnSummary: sampleAddon ? `1x ${sampleAddon.name}` : undefined,
      addOnTotal: sampleAddon ? sampleAddon.unitPrice : 0,
      paidEscrow: first.minPrice + (sampleAddon ? sampleAddon.unitPrice : 0),
      remainingAtVenue: 0,
      paymentGateway: 'Ví MoMo',
      qrCode: `QR-${provider.providerId.replace(/_/g, '')}-7715`,
      status: 'COMPLETED',
      createdAtLabel: 'Sáng nay • Đã quét QR',
    },
  ];
}

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

  const [internalActiveTab, setInternalActiveTab] = useState<LessorPortalTabId>('OVERVIEW');
  const activeTab = controlledTab ?? internalActiveTab;
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

  // --- BOOKING ORDERS & QR CHECK-IN STATE ---
  const [ordersByProvider, setOrdersByProvider] = useState<Record<string, LessorBookingOrder[]>>(
    () => readPersistedOrders()
  );
  const [orderFilter, setOrderFilter] = useState<
    'ALL' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW'
  >('ALL');
  const [qrScanInput, setQrScanInput] = useState<string>('');

  const providerOrders = useMemo<LessorBookingOrder[]>(() => {
    const baseOrders =
      ordersByProvider[activeProvider.providerId] ??
      createSeedOrdersForProvider(activeProvider, myListings);

    // Merge real player checkout tickets belonging to any venue of this provider
    const myVenueNames = new Set(myListings.map((l) => l.venueName));
    const storedTickets = getStoredTicketsForLessor().filter((t) =>
      myVenueNames.has(t.venueName)
    );
    const convertedLiveTickets: LessorBookingOrder[] = storedTickets
      .filter((t) => !baseOrders.some((o) => o.reservationId === t.reservationId))
      .map((t) => ({
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
        createdAtLabel: 'Đặt trực tiếp từ Web',
      }));

    return [...convertedLiveTickets, ...baseOrders];
  }, [ordersByProvider, activeProvider, myListings]);

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
    writePersistedOrders(nextMap);
  };

  const handleManualQrVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const query = qrScanInput.trim().toLowerCase();
    if (!query) return;
    const matched = providerOrders.find(
      (o) =>
        o.qrCode.toLowerCase().includes(query) ||
        o.orderId.toLowerCase() === query ||
        o.reservationId.toLowerCase().includes(query)
    );
    if (!matched) {
      flashToast('Không tìm thấy mã vé QR hoặc mã đơn thuộc cơ sở của bạn.');
      return;
    }
    if (matched.status === 'COMPLETED') {
      flashToast(`Vé ${matched.orderId} đã được sử dụng nhận sân trước đó (Chống quét lại 1 lần).`);
      return;
    }
    updateOrderStatus(matched.orderId, 'COMPLETED');
    setQrScanInput('');
    flashToast(
      `✓ Check-in QR hợp lệ! Đã mở nhận ${matched.unitNumber} cho khách ${matched.customerName}.`
    );
  };

  // --- CREATE NEW COURT GROUP STATE ---
  const [showCreateCourtForm, setShowCreateCourtForm] = useState<boolean>(false);
  const [newCourtName, setNewCourtName] = useState<string>('');
  const [newCourtSport, setNewCourtSport] = useState<string>(sports[0]?.code ?? 'PICKLEBALL');
  const [newCourtVenueName, setNewCourtVenueName] = useState<string>(
    myListings[0]?.venueName ?? activeProvider.providerName
  );
  const [newCourtAddress, setNewCourtAddress] = useState<string>(
    myListings[0]?.venueAddress ?? `${activeProvider.district}, ${activeProvider.city}`
  );
  const [newCourtCapacity, setNewCourtCapacity] = useState<number>(6);
  const [newCourtDuration, setNewCourtDuration] = useState<number>(60);
  const [newCourtBasePrice, setNewCourtBasePrice] = useState<number>(220000);
  const [newCourtMinPrice, setNewCourtMinPrice] = useState<number>(140000);
  const [newCourtMaxPrice, setNewCourtMaxPrice] = useState<number>(360000);
  const [newCourtDepositPct, setNewCourtDepositPct] = useState<number>(35);
  const [newCourtCheckinMode, setNewCourtCheckinMode] = useState<'QR_STAFF' | 'MANUAL'>('QR_STAFF');
  const [newCourtSurface, setNewCourtSurface] = useState<string>(
    'Mặt sân tiêu chuẩn thi đấu chống trượt, thoát nước nhanh'
  );
  const [newCourtLighting, setNewCourtLighting] = useState<string>(
    'Hệ thống đèn LED chống chói 500 Lux'
  );
  const [newCourtCoverUrl, setNewCourtCoverUrl] = useState<string>(PRESET_COURT_COVERS[0].url);

  // Per-listing inline price editor
  const [editingPriceGroupId, setEditingPriceGroupId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState<number>(200000);
  const [editMin, setEditMin] = useState<number>(120000);
  const [editMax, setEditMax] = useState<number>(350000);
  const [editDeposit, setEditDeposit] = useState<number>(35);

  const handleUploadNewCourtCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewCourtCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCourtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourtName.trim()) return;
    const sportObj = sports.find((s) => s.code === newCourtSport) ?? sports[0];
    const safeMin = Math.max(50_000, newCourtMinPrice);
    const safeMax = Math.max(safeMin + 20_000, newCourtMaxPrice);
    const safeBase = Math.min(safeMax, Math.max(safeMin, newCourtBasePrice));

    const created: PublishedListing = {
      groupId: `custom-group-${Date.now()}`,
      groupCode: `${newCourtSport}_${Date.now().toString(36).toUpperCase()}`,
      groupName: newCourtName.trim(),
      tenantId: '00000000-0000-0000-0000-000000000001',
      venueName: newCourtVenueName.trim() || activeProvider.providerName,
      venueAddress: newCourtAddress.trim(),
      city: activeProvider.city,
      district: activeProvider.district,
      sportCode: sportObj.code,
      sportName: sportObj.name,
      basePrice: safeBase,
      minPrice: safeMin,
      maxPrice: safeMax,
      depositPercent: Math.min(100, Math.max(10, newCourtDepositPct)),
      slotMinutes: newCourtDuration,
      checkinMode: newCourtCheckinMode,
      imageUrl: newCourtCoverUrl,
      galleryImages: [newCourtCoverUrl],
      galleryCaptions: [`Ảnh thực tế cụm sân ${newCourtName.trim()} do Chủ sân đăng tải`],
      architecturalBadge: 'Cụm sân mới mở • Đã xác thực',
      rating: 5.0,
      reviewCount: 1,
      provider: activeProvider,
      specs: {
        surface: newCourtSurface.trim(),
        lighting: newCourtLighting.trim(),
        dimensions: `Tiêu chuẩn ${sportObj.name} (${newCourtCapacity} sân vật lý)`,
        amenities: ['Bãi đỗ xe rộng', 'Phòng thay đồ', 'Check-in mã QR nhanh'],
      },
      addOnServices: [],
      published: true,
      upcomingSlots: buildFreshListingSlots(
        safeBase,
        safeMin,
        safeMax,
        newCourtDuration,
        newCourtCapacity
      ),
    };

    onCreateNewListing(created);
    setNewCourtName('');
    setShowCreateCourtForm(false);
    flashToast(`✓ Đã đăng cụm sân "${created.groupName}" lên sàn ArenaPulse thành công!`);
  };

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

  // --- COMPUTED METRICS FOR THIS LESSOR ---
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
    const activeOrders = providerOrders.filter((o) => o.status !== 'CANCELLED');
    const grossRevenue = activeOrders.reduce((s, o) => s + o.courtPrice + o.addOnTotal, 0);
    const escrowHeld = providerOrders
      .filter((o) => o.status === 'CONFIRMED' || o.status === 'HELD')
      .reduce((s, o) => s + o.paidEscrow, 0);
    const completedGross = providerOrders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((s, o) => s + o.courtPrice + o.addOnTotal, 0);

    // Add baseline weekly historical volume so wallet feels realistic
    const weeklyGross = completedGross + 34_800_000;
    const commissionAmt = Math.round((weeklyGross * activeProvider.commissionRatePct) / 100);
    const withdrawnNet = myPayouts.reduce((s, p) => s + p.netReceived, 0);
    const withdrawableBalance = Math.max(0, weeklyGross - commissionAmt - withdrawnNet);

    return {
      publishedCount: publishedGroups.length,
      totalGroups: myListings.length,
      totalPhysicalCourts,
      totalActiveAddons,
      pendingCheckins: providerOrders.filter((o) => o.status === 'CONFIRMED').length,
      grossRevenue: weeklyGross + escrowHeld,
      escrowHeld,
      weeklyGross,
      commissionAmt,
      withdrawableBalance,
    };
  }, [myListings, providerOrders, activeProvider.commissionRatePct, myPayouts]);

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
      label: isStaffOnly ? 'Quầy Soát Vé QR & Lịch Ca' : 'Tổng quan & Điều phối Ca',
      sub: 'Lịch đặt sân & Quét mã QR 1 lần',
      badge: `${metrics.pendingCheckins} chờ`,
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
  const filteredOrders = providerOrders.filter(
    (o) => orderFilter === 'ALL' || o.status === orderFilter
  );

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
                  {/* 4 Executive KPI Cards */}
                  <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
                    <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Doanh thu gộp 7 ngày
                      </span>
                      <div className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-[#0F172A]">
                        {formatVnd(metrics.grossRevenue)}
                      </div>
                      <span className="mt-1 inline-block text-[11px] font-semibold text-[#16422C]">
                        ↑ Tiền sân + Nước &amp; Dịch vụ
                      </span>
                    </div>

                    <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Tiền cọc giữ tại Ký quỹ
                      </span>
                      <div className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-[#0E4F7E]">
                        {formatVnd(metrics.escrowHeld)}
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Giải ngân ngay khi quét QR
                      </span>
                    </div>

                    <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Đơn chờ khách nhận sân
                      </span>
                      <div className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-[#16422C]">
                        {metrics.pendingCheckins} ca
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        Ân hạn trễ tối đa 15 phút
                      </span>
                    </div>

                    <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
                      <span className="text-[11px] font-semibold text-neutral-500">
                        Quy mô mở thuê hiện tại
                      </span>
                      <div className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-[#0F172A]">
                        {metrics.publishedCount}/{metrics.totalGroups} cụm
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-neutral-500">
                        {metrics.totalPhysicalCourts} sân con • {metrics.totalActiveAddons} dịch vụ
                      </span>
                    </div>
                  </div>

                  {/* Interactive Revenue, Occupancy & Channel Charts Dashboard */}
                  {!isStaffOnly && (
                    <LessorAnalyticsDashboard
                      mode="LESSOR"
                      provider={activeProvider}
                      listings={myListings}
                      orders={providerOrders}
                    />
                  )}

                  {/* Instant One-Time QR Ticket Check-In Bar */}
                  <div className="rounded-[26px] border border-[#16422C]/25 bg-[#F4F8F4] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                          Quầy Soát Vé QR 1 Lần Tại Sân (Anti-Replay JTI)
                        </span>
                        <h3 className="mt-0.5 text-base sm:text-lg font-bold text-[#0F172A]">
                          Nhập hoặc quét mã vé QR khách xuất trình để mở sân &amp; giải ngân tiền cọc
                        </h3>
                      </div>

                      <form
                        onSubmit={handleManualQrVerify}
                        className="flex w-full max-w-md items-center gap-2"
                      >
                        <input
                          type="text"
                          value={qrScanInput}
                          onChange={(e) => setQrScanInput(e.target.value)}
                          placeholder="Nhập mã vé QR hoặc mã đơn (VD: 8821)…"
                          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                        />
                        <ActionButton type="submit" variant="forest" size="sm">
                          Xác thực QR
                        </ActionButton>
                      </form>
                    </div>
                  </div>

                  {/* Live Booking Dispatch Table */}
                  <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                          Danh sách Đơn Đặt Sân &amp; Điều phối Ca ({filteredOrders.length})
                        </h3>
                        <p className="text-xs text-neutral-500">
                          Tự động đồng bộ các vé khách vừa thanh toán trên sàn cùng lịch vận hành tại cơ sở.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'ALL', label: 'Tất cả' },
                          { id: 'CONFIRMED', label: 'Chờ nhận sân' },
                          { id: 'COMPLETED', label: 'Đã nhận sân' },
                          { id: 'NO_SHOW', label: 'Bỏ lịch' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setOrderFilter(f.id as typeof orderFilter)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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

                    <div className="divide-y divide-neutral-100">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.orderId}
                          className="flex flex-col gap-4 p-5 transition hover:bg-[#F8FAFC] xl:flex-row xl:items-center xl:justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="tabular-nums rounded-lg bg-[#0F172A] px-2.5 py-0.5 text-[11px] font-bold text-white">
                                {order.orderId}
                              </span>
                              <span className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[11px] font-bold text-[#16422C]">
                                {order.unitNumber} • {order.sportName}
                              </span>
                              <span className="text-xs font-semibold text-[#0F172A]">
                                {order.slotLabel}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                                  order.status === 'CONFIRMED'
                                    ? 'bg-amber-100 text-amber-900'
                                    : order.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {order.status === 'CONFIRMED'
                                  ? 'CHỜ QUÉT QR'
                                  : order.status === 'COMPLETED'
                                    ? 'ĐÃ NHẬN SÂN'
                                    : 'KHÁCH BỎ LỊCH'}
                              </span>
                            </div>

                            <div className="text-sm font-semibold text-[#0F172A]">
                              {order.groupName}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                              <span>
                                Khách: <strong className="text-neutral-800">{order.customerName}</strong> ({order.customerPhone})
                              </span>
                              <span>Mã QR: <code className="text-[#0E4F7E]">{order.qrCode}</code></span>
                              {order.addOnSummary && (
                                <span className="font-medium text-[#16422C]">
                                  + Dịch vụ kèm: {order.addOnSummary} ({formatVnd(order.addOnTotal)})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4 xl:justify-end">
                            <div className="text-left xl:text-right text-xs">
                              <div className="text-neutral-500">
                                Đã thu ký quỹ:{' '}
                                <strong className="tabular-nums text-[#16422C]">
                                  {formatVnd(order.paidEscrow)}
                                </strong>
                              </div>
                              <div className="mt-0.5 font-semibold text-[#0F172A] tabular-nums">
                                Cần thu thêm tại sân: {formatVnd(order.remainingAtVenue)}
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {order.paymentGateway} • {order.createdAtLabel}
                              </div>
                            </div>

                            {order.status === 'CONFIRMED' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateOrderStatus(order.orderId, 'COMPLETED');
                                    flashToast(
                                      `✓ Đã xác nhận khách ${order.customerName} nhận ${order.unitNumber}!`
                                    );
                                  }}
                                  className="rounded-full bg-[#16422C] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0F172A]"
                                >
                                  ✓ Nhận sân QR
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateOrderStatus(order.orderId, 'NO_SHOW');
                                    flashToast(
                                      `Đã đánh dấu đơn ${order.orderId} bỏ lịch quá 15 phút ân hạn.`
                                    );
                                  }}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  Bỏ lịch
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                  className="space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#16422C]">
                        Danh mục Sân Thuộc Sở Hữu
                      </span>
                      <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
                        Quản lý Cụm Sân, Số sân trống &amp; Đăng Sân Mới ({myListings.length} cụm sân)
                      </h3>
                    </div>

                    {!isStaffOnly && (
                      <ActionButton
                        variant={showCreateCourtForm ? 'outline' : 'forest'}
                        size="sm"
                        onClick={() => setShowCreateCourtForm((v) => !v)}
                      >
                        {showCreateCourtForm ? 'Đóng biểu mẫu đăng sân' : '+ Đăng Cụm Sân Mới lên Sàn'}
                      </ActionButton>
                    )}
                  </div>

                  {/* CREATE NEW COURT GROUP STUDIO FORM */}
                  <AnimatePresence>
                    {showCreateCourtForm && !isStaffOnly && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleCreateCourtSubmit}
                        className="overflow-hidden rounded-[26px] border-2 border-[#16422C]/30 bg-white p-6 sm:p-7 shadow-md space-y-5"
                      >
                        <div className="border-b border-neutral-100 pb-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E4F7E]">
                            Khởi tạo Cụm sân mới trực tiếp lên Sàn Thuê Sân
                          </span>
                          <h4 className="text-lg font-bold text-[#0F172A]">
                            Thông tin Cụm Sân Cho Thuê Mới — {activeProvider.providerName}
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Tên hiển thị cụm sân *
                            </label>
                            <input
                              type="text"
                              required
                              value={newCourtName}
                              onChange={(e) => setNewCourtName(e.target.value)}
                              placeholder="VD: Cụm 6 Sân Pickleball Mái Che Chuẩn Quốc Tế Khu B..."
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Bộ môn thể thao *
                            </label>
                            <select
                              value={newCourtSport}
                              onChange={(e) => setNewCourtSport(e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                            >
                              {sports.map((sp) => (
                                <option key={sp.code} value={sp.code}>
                                  {sp.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Tên cơ sở thể thao
                            </label>
                            <input
                              type="text"
                              value={newCourtVenueName}
                              onChange={(e) => setNewCourtVenueName(e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Địa chỉ chi tiết cơ sở *
                            </label>
                            <input
                              type="text"
                              required
                              value={newCourtAddress}
                              onChange={(e) => setNewCourtAddress(e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Tổng số sân vật lý (sân con)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={40}
                              value={newCourtCapacity}
                              onChange={(e) => setNewCourtCapacity(Number(e.target.value) || 4)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Thời lượng 1 ca (phút)
                            </label>
                            <select
                              value={newCourtDuration}
                              onChange={(e) => setNewCourtDuration(Number(e.target.value))}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                            >
                              <option value={60}>60 phút / ca</option>
                              <option value={90}>90 phút / ca</option>
                              <option value={120}>120 phút / ca</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Tỷ lệ đặt cọc giữ sân (%)
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={100}
                              value={newCourtDepositPct}
                              onChange={(e) => setNewCourtDepositPct(Number(e.target.value) || 35)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Giá sàn thấp điểm (VND)
                            </label>
                            <input
                              type="number"
                              step={10000}
                              value={newCourtMinPrice}
                              onChange={(e) => setNewCourtMinPrice(Number(e.target.value) || 100000)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Giá cơ sở tiêu chuẩn (VND)
                            </label>
                            <input
                              type="number"
                              step={10000}
                              value={newCourtBasePrice}
                              onChange={(e) => setNewCourtBasePrice(Number(e.target.value) || 200000)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#16422C]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Giá trần giờ vàng (VND)
                            </label>
                            <input
                              type="number"
                              step={10000}
                              value={newCourtMaxPrice}
                              onChange={(e) => setNewCourtMaxPrice(Number(e.target.value) || 350000)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Mặt sân &amp; Kết cấu
                            </label>
                            <input
                              type="text"
                              value={newCourtSurface}
                              onChange={(e) => setNewCourtSurface(e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Hệ thống Chiếu sáng
                            </label>
                            <input
                              type="text"
                              value={newCourtLighting}
                              onChange={(e) => setNewCourtLighting(e.target.value)}
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold text-neutral-700">
                              Phương thức Check-in
                            </label>
                            <select
                              value={newCourtCheckinMode}
                              onChange={(e) =>
                                setNewCourtCheckinMode(e.target.value as 'QR_STAFF' | 'MANUAL')
                              }
                              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                            >
                              <option value="QR_STAFF">Nhân viên quét vé QR 1 lần</option>
                              <option value="MANUAL">Tự động / Đọc mã tại quầy</option>
                            </select>
                          </div>
                        </div>

                        {/* Cover Photo Picker */}
                        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 sm:flex-row sm:items-center">
                          <img
                            src={newCourtCoverUrl}
                            alt="Ảnh đại diện cụm sân mới"
                            className="h-20 w-32 rounded-xl object-cover border border-neutral-200 bg-white shrink-0"
                          />
                          <div className="flex-1 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-[#0F172A]">
                                Ảnh đại diện cụm sân hiển thị trên Sàn Thuê Sân
                              </span>
                              <label className="cursor-pointer rounded-full border border-[#16422C]/30 bg-white px-3 py-1 text-[11px] font-bold text-[#16422C] hover:bg-[#E7F7D4]/40">
                                Tải ảnh thực tế từ máy…
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleUploadNewCourtCover}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            <select
                              value={
                                PRESET_COURT_COVERS.some((c) => c.url === newCourtCoverUrl)
                                  ? newCourtCoverUrl
                                  : 'CUSTOM'
                              }
                              onChange={(e) => {
                                if (e.target.value !== 'CUSTOM') setNewCourtCoverUrl(e.target.value);
                              }}
                              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-[#0F172A]"
                            >
                              {!PRESET_COURT_COVERS.some((c) => c.url === newCourtCoverUrl) && (
                                <option value="CUSTOM">Ảnh riêng đã tải lên từ máy</option>
                              )}
                              {PRESET_COURT_COVERS.map((c) => (
                                <option key={c.url} value={c.url}>
                                  Ảnh mẫu: {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-1">
                          <ActionButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateCourtForm(false)}
                          >
                            Hủy bỏ
                          </ActionButton>
                          <ActionButton type="submit" variant="forest" size="md">
                            ✓ Xuất bản Cụm sân lên ArenaPulse
                          </ActionButton>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* OWNED COURT GROUPS LIST */}
                  <div className="space-y-4">
                    {myListings.map((court) => {
                      const isPublished = court.published !== false;
                      const activeAddonCount = (court.addOnServices ?? []).filter(
                        (s) => s.enabled !== false
                      ).length;
                      const isEditingPrice = editingPriceGroupId === court.groupId;

                      return (
                        <div
                          key={court.groupId}
                          className={`overflow-hidden rounded-[26px] border bg-white p-5 sm:p-6 shadow-xs transition ${
                            isPublished
                              ? 'border-neutral-200/90'
                              : 'border-amber-300/80 bg-amber-50/20'
                          }`}
                        >
                          <div className="flex flex-col gap-5 lg:flex-row">
                            <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-2xl lg:w-64 bg-neutral-100">
                              <img
                                src={court.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                                alt={court.groupName}
                                className={`h-full w-full object-cover ${
                                  isPublished ? '' : 'grayscale opacity-75'
                                }`}
                              />
                              <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                                {court.sportName} • {court.slotMinutes}p/ca
                              </span>
                              {!isStaffOnly && onUploadCourtPhoto && (
                                <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#0F172A] shadow-sm hover:bg-[#E7F7D4]">
                                  + Đổi ảnh bìa
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
                                      flashToast(`✓ Đã cập nhật ảnh bìa mới cho "${court.groupName}"!`);
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            <div className="flex-1 space-y-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                                        isPublished
                                          ? 'bg-[#E7F7D4] text-[#16422C]'
                                          : 'bg-amber-200 text-amber-950'
                                      }`}
                                    >
                                      {isPublished ? '● ĐANG MỞ CHO THUÊ' : '⏸ TẠM NGƯNG NHẬN KHÁCH'}
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                      {court.venueName} • Cọc {court.depositPercent}%
                                    </span>
                                  </div>
                                  <h4 className="mt-1 text-lg font-bold text-[#0F172A]">
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
                                            ? `Đã tạm ẩn cụm sân "${court.groupName}" khỏi trang đặt lịch công khai.`
                                            : `✓ Đã mở nhận lịch trở lại cho "${court.groupName}"!`
                                        );
                                      }}
                                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                                        isPublished
                                          ? 'border border-neutral-300 bg-white text-neutral-700 hover:border-amber-500 hover:text-amber-800'
                                          : 'bg-[#16422C] text-white hover:bg-[#0F172A]'
                                      }`}
                                    >
                                      {isPublished ? 'Tạm ngưng nhận lịch' : 'Mở nhận lịch lại'}
                                    </button>

                                    {onPreviewCourt && isPublished && (
                                      <button
                                        type="button"
                                        onClick={() => onPreviewCourt(court)}
                                        className="rounded-full border border-neutral-200 bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-neutral-100"
                                      >
                                        Xem trên Sàn ↗
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Live Slot Availability Controller */}
                              <div className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] p-3.5">
                                <div className="mb-2 flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-[#0F172A]">
                                    Điều chỉnh Số sân trống trực tiếp theo Khung giờ
                                  </span>
                                  <span className="text-neutral-500">
                                    Khóa/mở nhanh khi có khách đặt trực tiếp tại quầy
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                  {court.upcomingSlots.slice(0, 3).map((slot, idx) => (
                                    <div
                                      key={slot.slotStart}
                                      className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs"
                                    >
                                      <div>
                                        <div className="font-semibold text-[#0F172A]">
                                          {slot.timePeriod === 'MORNING'
                                            ? 'Ca Sáng'
                                            : slot.timePeriod === 'AFTERNOON'
                                              ? 'Ca Chiều'
                                              : 'Ca Tối'}
                                        </div>
                                        <div className="tabular-nums text-[11px] font-medium text-[#16422C]">
                                          {formatVnd(slot.currentDynamicPrice)}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
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
                                          className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-[#F8FAFC] font-bold hover:bg-neutral-200"
                                        >
                                          −
                                        </button>
                                        <span className="min-w-[44px] text-center tabular-nums text-xs font-bold text-[#0F172A]">
                                          {slot.availableCourts}/{slot.totalCapacity}
                                        </span>
                                        <button
                                          type="button"
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
                                          className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-[#F8FAFC] font-bold hover:bg-neutral-200"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Bottom Bar: Price Summary & Add-on Services Shortcut */}
                              {!isStaffOnly && (
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="rounded-xl bg-[#F4F8F4] px-3 py-1.5 font-semibold text-[#16422C] tabular-nums">
                                      Khung giá: {formatVnd(court.minPrice)} – {formatVnd(court.maxPrice)} (Cơ sở:{' '}
                                      {formatVnd(court.basePrice)})
                                    </span>

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
                                      className="font-semibold text-[#0E4F7E] hover:underline"
                                    >
                                      {isEditingPrice ? 'Đóng sửa giá' : '✎ Sửa giá & % cọc'}
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFocusedServiceGroupId(court.groupId);
                                      setActiveTab('ADDON_PRODUCTS');
                                    }}
                                    className="rounded-full border border-[#16422C]/30 bg-white px-3.5 py-1.5 font-semibold text-[#16422C] hover:bg-[#F4F8F4]"
                                  >
                                    🥤 Nước &amp; Dịch vụ sân này ({activeAddonCount} món) →
                                  </button>
                                </div>
                              )}

                              {/* Inline Price Editor */}
                              {isEditingPrice && !isStaffOnly && (
                                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4]/70 p-4 sm:grid-cols-5 items-end text-xs">
                                  <div>
                                    <label className="mb-1 block font-semibold text-neutral-700">
                                      Giá sàn (₫)
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
                                      Giá cơ sở (₫)
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
                                      Giá trần (₫)
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
                                      flashToast(`✓ Đã cập nhật biểu giá mới cho "${court.groupName}"!`);
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
                    })}
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
                        Mở Mô phỏng Monte Carlo Sâu (/pricing)
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
                        Hiển thị trực tiếp khi khách bấm xem hồ sơ chủ sân tại <code>/lessor/{activeProvider.providerId}</code>.
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
    </section>
  );
};

