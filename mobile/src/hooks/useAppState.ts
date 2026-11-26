import { useCallback, useMemo, useState } from 'react';
import type {
  AuthSession,
  ChatMessageItem,
  HoldSlotResult,
  MobileModalScreenId,
  MobileTabId,
  PriceQuote,
  PublishedListing,
  RoleCode,
  VenueAnnouncement,
} from '@/types/domain';
import {
  SEED_ANNOUNCEMENTS,
  SEED_PROVIDERS,
  createSeedListings,
} from '@/data/seedData';
import { mobileApiClient } from '@/services/apiClient';
import { useCountdown } from './useCountdown';

export interface ProviderThread {
  messages: ChatMessageItem[];
  unreadCount: number;
  lastTimeLabel: string;
}

export function useAppState() {
  const [activeTab, setActiveTab] = useState<MobileTabId>('home');
  const [activeModal, setActiveModal] = useState<MobileModalScreenId | null>(null);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeRole, setActiveRole] = useState<RoleCode>('USER');

  const [listings, setListings] = useState<PublishedListing[]>(() => createSeedListings());
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>(SEED_ANNOUNCEMENTS);

  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [activeListing, setActiveListing] = useState<PublishedListing>(listings[0]);
  const [activeSlotStart, setActiveSlotStart] = useState<string>(
    listings[0].upcomingSlots[0].slotStart
  );
  const [activeQuote, setActiveQuote] = useState<PriceQuote | null>({
    groupId: listings[0].groupId,
    slotStart: listings[0].upcomingSlots[0].slotStart,
    slotEnd: listings[0].upcomingSlots[0].slotEnd,
    currentPrice: listings[0].upcomingSlots[0].currentDynamicPrice,
    priceLockToken: 'LOCK_RN_INIT',
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  const [holdResult, setHoldResult] = useState<HoldSlotResult | null>(null);

  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    SEED_PROVIDERS.MYDINH_PARK.providerId
  );
  const [followedProviderIds, setFollowedProviderIds] = useState<string[]>([]);
  const [activeChatProviderId, setActiveChatProviderId] = useState<string>(
    SEED_PROVIDERS.MYDINH_PARK.providerId
  );

  const countdown = useCountdown(600);

  const [threadsByProvider, setThreadsByProvider] = useState<Record<string, ProviderThread>>(() => {
    const initial: Record<string, ProviderThread> = {};
    Object.values(SEED_PROVIDERS).forEach((prov, index) => {
      initial[prov.providerId] = {
        unreadCount: index === 0 ? 1 : index === 1 ? 2 : 0,
        lastTimeLabel: index === 0 ? '09:30' : '10:15',
        messages: [
          {
            id: `welcome-${prov.providerId}`,
            senderRole: 'MANAGER',
            senderName: prov.providerName,
            body: `Chào mừng bạn đến với ${prov.providerName}! Bạn cần kiểm tra ca trống hoặc hỗ trợ đặt cọc cứ nhắn ngay tại đây.`,
            createdAt: index === 0 ? '09:30' : '10:15',
          },
        ],
      };
    });
    return initial;
  });

  const totalUnreadChat = useMemo(
    () => Object.values(threadsByProvider).reduce((sum, t) => sum + t.unreadCount, 0),
    [threadsByProvider]
  );

  const selectCourtSlot = useCallback(
    async (listing: PublishedListing, slotStart: string) => {
      setActiveListing(listing);
      setActiveSlotStart(slotStart);
      setHoldResult(null);
      const quote = await mobileApiClient.getDynamicPriceQuote(listing, slotStart);
      setActiveQuote(quote);
      countdown.reset(600);
    },
    [countdown]
  );

  const openCourtDetail = useCallback(
    (listing: PublishedListing, preferredSlot?: string) => {
      const targetSlot =
        preferredSlot ||
        listing.upcomingSlots.find((s) => s.availableCourts > 0)?.slotStart ||
        listing.upcomingSlots[0].slotStart;
      void selectCourtSlot(listing, targetSlot);
      setActiveModal('courtDetail');
    },
    [selectCourtSlot]
  );

  const openLessorShop = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setActiveModal(null);
    setActiveTab('lessors');
  }, []);

  const toggleFollowProvider = useCallback((providerId: string) => {
    setFollowedProviderIds((prev) =>
      prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId]
    );
  }, []);

  const openChatWithProvider = useCallback(
    (providerId: string, contextCourt?: PublishedListing) => {
      setActiveChatProviderId(providerId);
      setThreadsByProvider((prev) => {
        const cur = prev[providerId];
        if (!cur) return prev;
        return {
          ...prev,
          [providerId]: { ...cur, unreadCount: 0 },
        };
      });
      if (contextCourt) {
        setActiveListing(contextCourt);
      }
      setActiveModal('chat');
    },
    []
  );

  const sendChatMessage = useCallback(
    (providerId: string, text: string, attachedCourt?: PublishedListing) => {
      const trimmed = text.trim();
      if (!trimmed && !attachedCourt) return;
      const nowLabel = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const outgoing: ChatMessageItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderRole: activeRole,
        senderName: session?.fullName ?? 'Người thuê sân',
        body: trimmed || `Mình muốn hỏi về cụm sân "${attachedCourt?.groupName}".`,
        createdAt: nowLabel,
        courtCard: attachedCourt
          ? {
              groupId: attachedCourt.groupId,
              groupName: attachedCourt.groupName,
              venueName: attachedCourt.venueName,
              sportName: attachedCourt.sportName,
              minPrice: attachedCourt.minPrice,
              maxPrice: attachedCourt.maxPrice,
              depositPercent: attachedCourt.depositPercent,
              availableCourts: Math.max(
                0,
                ...attachedCourt.upcomingSlots.map((s) => s.availableCourts)
              ),
            }
          : undefined,
      };

      setThreadsByProvider((prev) => {
        const cur = prev[providerId] ?? { messages: [], unreadCount: 0, lastTimeLabel: nowLabel };
        return {
          ...prev,
          [providerId]: {
            unreadCount: 0,
            lastTimeLabel: nowLabel,
            messages: [...cur.messages, outgoing],
          },
        };
      });

      const providerObj = Object.values(SEED_PROVIDERS).find((p) => p.providerId === providerId);
      if (activeRole === 'USER' && providerObj) {
        setTimeout(() => {
          const replyText = trimmed.toLowerCase().includes('mưa')
            ? 'Khi trời mưa bão không thể thi đấu, ArenaPulse hoàn lại 100% tiền cọc ngay lập tức ạ.'
            : `${providerObj.providerName} đã tiếp nhận tin nhắn! Bạn có thể chọn khung giờ sáng đèn để khóa giá 10 phút ngay trên app.`;
          const replyTime = new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          setThreadsByProvider((prev) => {
            const cur = prev[providerId];
            if (!cur) return prev;
            return {
              ...prev,
              [providerId]: {
                ...cur,
                lastTimeLabel: replyTime,
                messages: [
                  ...cur.messages,
                  {
                    id: `${Date.now()}-reply`,
                    senderRole: 'MANAGER',
                    senderName: providerObj.providerName,
                    body: replyText,
                    createdAt: replyTime,
                  },
                ],
              },
            };
          });
        }, 500);
      }
    },
    [activeRole, session]
  );

  const updateListingPricing = useCallback(
    (
      groupId: string,
      patch: { basePrice: number; minPrice: number; maxPrice: number; depositPercent: number }
    ) => {
      setListings((prev) =>
        prev.map((item) => {
          if (item.groupId !== groupId) return item;
          return {
            ...item,
            basePrice: patch.basePrice,
            minPrice: patch.minPrice,
            maxPrice: patch.maxPrice,
            depositPercent: patch.depositPercent,
          };
        })
      );
    },
    []
  );

  const publishAnnouncement = useCallback(
    (draft: Omit<VenueAnnouncement, 'id' | 'publishedAt'>) => {
      setAnnouncements((prev) => [
        { ...draft, id: `ann-${Date.now()}`, publishedAt: 'Vừa xong' },
        ...prev,
      ]);
    },
    []
  );

  const signInWithRole = useCallback((role: RoleCode, fullName: string) => {
    setSession({
      userId: `USR_${role}`,
      username: role.toLowerCase(),
      fullName,
      activeRole: role,
    });
    setActiveRole(role);
    setActiveModal(null);
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    setActiveRole('USER');
  }, []);

  return {
    activeTab,
    setActiveTab,
    activeModal,
    setActiveModal,
    session,
    activeRole,
    setActiveRole,
    listings,
    announcements,
    selectedSport,
    setSelectedSport,
    activeListing,
    activeSlotStart,
    activeQuote,
    holdResult,
    setHoldResult,
    selectedProviderId,
    setSelectedProviderId,
    followedProviderIds,
    activeChatProviderId,
    setActiveChatProviderId,
    threadsByProvider,
    totalUnreadChat,
    countdown,
    selectCourtSlot,
    openCourtDetail,
    openLessorShop,
    toggleFollowProvider,
    openChatWithProvider,
    sendChatMessage,
    updateListingPricing,
    publishAnnouncement,
    signInWithRole,
    signOut,
  };
}

