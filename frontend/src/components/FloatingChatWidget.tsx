import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AuthSession,
  ChatAttachedCourtCard,
  ChatMessageItem,
  PublishedListing,
  RoleCode,
  VenueProviderInfo,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';

interface FloatingChatWidgetProps {
  open: boolean;
  onToggleOpen: (next: boolean) => void;
  activeProviderId: string | null;
  onSelectProviderId: (providerId: string | null) => void;
  contextListing: PublishedListing | null;
  listings: PublishedListing[];
  activeRole: RoleCode;
  staffChatEnabled: boolean;
  session: AuthSession | null;
  onOpenLessorShop: (providerId: string) => void;
  onSelectCourtFromChat: (listing: PublishedListing) => void;
  onOpenSafetyPolicy: () => void;
}

interface ProviderThreadState {
  messages: ChatMessageItem[];
  unreadCount: number;
  lastActivityLabel: string;
}

const QUICK_PROMPTS = [
  'Tối nay cụm sân mình còn ca trống không ạ?',
  'Mưa bão hoặc hỏng đèn có hoàn cọc 100% không?',
  'Tại sân có cho thuê vợt và bóng thi đấu không?',
];

const QUICK_EMOJIS = ['👋', '👍', '🙏', '⚽', '🏸', '🎾', '💬', '✅'];

function toCourtAttachment(listing: PublishedListing): ChatAttachedCourtCard {
  const maxAvailable = Math.max(
    0,
    ...listing.upcomingSlots.map((s) => s.availableCourts)
  );
  return {
    groupId: listing.groupId,
    groupName: listing.groupName,
    venueName: listing.venueName,
    sportName: listing.sportName,
    minPrice: listing.minPrice,
    maxPrice: listing.maxPrice,
    depositPercent: listing.depositPercent,
    availableCourts: maxAvailable,
    imageUrl: listing.imageUrl,
  };
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  open,
  onToggleOpen,
  activeProviderId,
  onSelectProviderId,
  contextListing,
  listings,
  activeRole,
  staffChatEnabled,
  session,
  onOpenLessorShop,
  onSelectCourtFromChat,
  onOpenSafetyPolicy,
}) => {
  const [threadSearch, setThreadSearch] = useState<string>('');
  const [threadFilter, setThreadFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [chatInput, setChatInput] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [showCourtPicker, setShowCourtPicker] = useState<boolean>(false);
  const [mobileShowThreadList, setMobileShowThreadList] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const providers = useMemo<VenueProviderInfo[]>(() => {
    const map = new Map<string, VenueProviderInfo>();
    for (const item of listings) {
      if (item.provider && !map.has(item.provider.providerId)) {
        map.set(item.provider.providerId, item.provider);
      }
    }
    return Array.from(map.values());
  }, [listings]);

  const currentProviderId = useMemo(() => {
    if (activeProviderId && providers.some((p) => p.providerId === activeProviderId)) {
      return activeProviderId;
    }
    if (contextListing?.provider?.providerId) {
      return contextListing.provider.providerId;
    }
    return providers[0]?.providerId ?? 'PROV_HN_01';
  }, [activeProviderId, contextListing, providers]);

  const activeProvider = useMemo(
    () => providers.find((p) => p.providerId === currentProviderId) ?? providers[0] ?? null,
    [providers, currentProviderId]
  );

  // Per-lessor conversation threads initialized cleanly once listings arrive
  const [threadsByProvider, setThreadsByProvider] = useState<
    Record<string, ProviderThreadState>
  >({});

  useEffect(() => {
    if (providers.length === 0) return;
    setThreadsByProvider((prev) => {
      let changed = false;
      const next = { ...prev };
      providers.forEach((prov, index) => {
        if (!next[prov.providerId]) {
          changed = true;
          const firstCourt = listings.find((l) => l.provider?.providerId === prov.providerId);
          next[prov.providerId] = {
            unreadCount: index === 0 ? 1 : index === 1 ? 2 : 0,
            lastActivityLabel: index === 0 ? 'Hôm nay' : index === 1 ? '10:15' : 'T5',
            messages: [
              {
                id: `welcome-${prov.providerId}`,
                senderRole: 'MANAGER',
                senderName: prov.providerName,
                body: `Kính chào quý khách! Ban quản lý ${prov.providerName} (${prov.district}, ${prov.city}) luôn sẵn sàng hỗ trợ kiểm tra ca trống, dụng cụ thi đấu & xuất hóa đơn VAT.`,
                createdAt: index === 0 ? '09:30' : '10:15',
                courtCard: firstCourt ? toCourtAttachment(firstCourt) : undefined,
              },
            ],
          };
        }
      });
      return changed ? next : prev;
    });
  }, [providers, listings]);

  // Clear unread when viewing a thread while open
  useEffect(() => {
    if (!open || !currentProviderId) return;
    setThreadsByProvider((prev) => {
      const target = prev[currentProviderId];
      if (!target || target.unreadCount === 0) return prev;
      return {
        ...prev,
        [currentProviderId]: { ...target, unreadCount: 0 },
      };
    });
  }, [open, currentProviderId]);

  const activeThread = threadsByProvider[currentProviderId] ?? {
    messages: [],
    unreadCount: 0,
    lastActivityLabel: 'Hôm nay',
  };

  useEffect(() => {
    if (open) {
      window.setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 60);
    }
  }, [open, currentProviderId, activeThread.messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onToggleOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggleOpen]);

  const totalUnread = Object.values(threadsByProvider).reduce(
    (sum, t) => sum + t.unreadCount,
    0
  );

  const activeProviderCourts = useMemo(
    () => listings.filter((l) => l.provider?.providerId === currentProviderId),
    [listings, currentProviderId]
  );

  const visibleThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    return providers.filter((prov) => {
      const state = threadsByProvider[prov.providerId];
      const matchesUnread = threadFilter === 'ALL' || (state?.unreadCount ?? 0) > 0;
      const matchesQuery =
        !q ||
        prov.providerName.toLowerCase().includes(q) ||
        prov.city.toLowerCase().includes(q) ||
        prov.district.toLowerCase().includes(q);
      return matchesUnread && matchesQuery;
    });
  }, [providers, threadsByProvider, threadSearch, threadFilter]);

  const sendMessage = (text: string, attachedListing?: PublishedListing) => {
    const trimmed = text.trim();
    if (!trimmed && !attachedListing) return;
    if (activeRole === 'STAFF' && !staffChatEnabled) return;

    const nowLabel = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const outgoing: ChatMessageItem = {
      id: crypto.randomUUID(),
      senderRole: activeRole,
      senderName:
        activeRole === 'STAFF'
          ? 'Nhân viên Trực Sân'
          : activeRole === 'MANAGER'
            ? activeProvider?.providerName || 'Quản lý Cụm Sân'
            : session?.fullName || 'Người thuê sân',
      body:
        trimmed ||
        `Mình muốn hỏi thông tin đặt lịch sân "${attachedListing?.groupName}".`,
      createdAt: nowLabel,
      courtCard: attachedListing ? toCourtAttachment(attachedListing) : undefined,
    };

    const targetId = currentProviderId;
    setThreadsByProvider((prev) => {
      const existing = prev[targetId] ?? {
        messages: [],
        unreadCount: 0,
        lastActivityLabel: nowLabel,
      };
      return {
        ...prev,
        [targetId]: {
          ...existing,
          unreadCount: 0,
          lastActivityLabel: nowLabel,
          messages: [...existing.messages, outgoing],
        },
      };
    });

    setChatInput('');
    setShowEmojiPicker(false);
    setShowCourtPicker(false);

    if (activeRole === 'USER' && activeProvider) {
      window.setTimeout(() => {
        const lower = trimmed.toLowerCase();
        const replyBody = attachedListing
          ? `${activeProvider.providerName} đã nhận thông tin hỏi về "${attachedListing.groupName}". Lịch trống hiển thị trên sàn là real-time 100%, bạn bấm đặt ca để khóa giá trong 10 phút nhé!`
          : lower.includes('mưa') || lower.includes('hoàn cọc')
            ? 'Khi thời tiết mưa bão hoặc cụm sân gặp sự cố kỹ thuật, ArenaPulse tự động hoàn 100% tiền cọc về ví thanh toán của bạn ngay lập tức ạ.'
            : lower.includes('vợt') || lower.includes('bóng')
              ? 'Quầy lễ tân tại cụm sân luôn có sẵn vợt, bóng thi đấu mới và nước uống ướp lạnh phục vụ theo từng ca đặt.'
              : `${activeProvider.providerName} đã tiếp nhận tin nhắn (${activeProvider.responseTimeLabel}). Bạn có thể chọn khung giờ sáng đèn trên lịch hoặc ghé Gian hàng để xem tất cả mặt sân nhé!`;

        const replyTime = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });

        setThreadsByProvider((prev) => {
          const cur = prev[targetId];
          if (!cur) return prev;
          return {
            ...prev,
            [targetId]: {
              ...cur,
              lastActivityLabel: replyTime,
              messages: [
                ...cur.messages,
                {
                  id: crypto.randomUUID(),
                  senderRole: 'MANAGER',
                  senderName: activeProvider.providerName,
                  body: replyBody,
                  createdAt: replyTime,
                },
              ],
            },
          };
        });
      }, 550);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(chatInput);
  };

  const showContextPrompt =
    contextListing &&
    contextListing.provider?.providerId === currentProviderId &&
    !activeThread.messages.some((m) => m.courtCard?.groupId === contextListing.groupId);

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end">
      {/* EXPANDED SHOPEE-STYLE 2-PANE CHAT WINDOW (Image 3 layout) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ duration: 0.25, ease: EXPO_EASE }}
            style={{ transformOrigin: '100% 100%' }}
            role="dialog"
            aria-label="Hộp thoại Chat với các Chủ sân ArenaPulse"
            className="mb-3 flex h-[540px] max-h-[calc(100vh-112px)] w-[calc(100vw-24px)] sm:w-[680px] lg:w-[740px] flex-col overflow-hidden rounded-[22px] border border-neutral-200/95 bg-white shadow-[0_28px_72px_rgba(15,23,42,0.24)] overscroll-contain"
          >
            {/* Top Window Title Bar (Matches Image 3: Chat (N) + quick controls) */}
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileShowThreadList((v) => !v)}
                  className="sm:hidden rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-[#0F172A]"
                >
                  {mobileShowThreadList ? '← Cuộc trò chuyện' : '☰ Danh sách chủ sân'}
                </button>
                <span className="text-[15px] font-bold text-[#D9532F]">Chat</span>
                {totalUnread > 0 && (
                  <span className="tabular-nums text-xs font-semibold text-[#D9532F]">
                    ({totalUnread})
                  </span>
                )}
                <span className="hidden sm:inline-block rounded-full bg-[#F4F8F4] px-2.5 py-0.5 text-[10.5px] font-medium text-[#16422C]">
                  Kênh trao đổi chính thức ArenaPulse
                </span>
              </div>

              <div className="flex items-center gap-2">
                {activeProvider && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLessorShop(activeProvider.providerId);
                      onToggleOpen(false);
                    }}
                    className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-semibold text-[#16422C] hover:border-[#16422C] transition-colors"
                  >
                    Xem Gian Hàng →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleOpen(false)}
                  aria-label="Thu gọn cửa sổ chat"
                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Thu gọn ✕
                </button>
              </div>
            </div>

            {/* Dual-Pane Body */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* LEFT PANE: Multi-Lessor Thread List */}
              <aside
                className={`${
                  mobileShowThreadList ? 'flex w-full' : 'hidden sm:flex sm:w-[250px]'
                } shrink-0 flex-col border-r border-neutral-200 bg-white`}
              >
                {/* Search + Filter Dropdown (Matches Image 3 top left) */}
                <div className="flex items-center gap-1.5 border-b border-neutral-100 p-2.5">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="search"
                      value={threadSearch}
                      onChange={(e) => setThreadSearch(e.target.value)}
                      placeholder="Tìm theo tên"
                      aria-label="Tìm theo tên chủ sân"
                      className="w-full rounded-lg border border-neutral-200 bg-[#F8F9FA] py-1.5 pl-2.5 pr-2 text-xs text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:outline-none"
                    />
                  </div>
                  <select
                    aria-label="Lọc tin nhắn"
                    value={threadFilter}
                    onChange={(e) => setThreadFilter(e.target.value as 'ALL' | 'UNREAD')}
                    className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[11px] font-medium text-neutral-700 focus:border-[#16422C] focus:outline-none"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="UNREAD">Chưa đọc</option>
                  </select>
                </div>

                {/* Conversation Rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
                  {visibleThreads.length === 0 ? (
                    <div className="px-4 py-10 text-center text-xs text-neutral-400">
                      Không tìm thấy chủ sân phù hợp.
                    </div>
                  ) : (
                    visibleThreads.map((prov) => {
                      const state = threadsByProvider[prov.providerId];
                      const lastMsg = state?.messages[state.messages.length - 1];
                      const isSelected = prov.providerId === currentProviderId;
                      const unread = state?.unreadCount ?? 0;

                      return (
                        <button
                          key={prov.providerId}
                          type="button"
                          onClick={() => {
                            onSelectProviderId(prov.providerId);
                            setMobileShowThreadList(false);
                          }}
                          className={`flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors ${
                            isSelected ? 'bg-[#F4F8F4]' : 'hover:bg-neutral-50'
                          }`}
                        >
                          {/* Avatar + Online dot */}
                          <div className="relative shrink-0 mt-0.5">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${
                                isSelected
                                  ? 'bg-[#16422C] text-[#E7F7D4]'
                                  : 'bg-neutral-100 text-[#0F172A]'
                              }`}
                            >
                              {prov.providerName
                                .split(' ')
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join('')
                                .toUpperCase()}
                            </div>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                          </div>

                          {/* Thread Meta */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="truncate text-xs font-semibold text-[#0F172A]">
                                {prov.providerName}
                              </span>
                              <span className="shrink-0 tabular-nums text-[10px] text-neutral-400">
                                {state?.lastActivityLabel ?? 'Hôm nay'}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-1.5">
                              <span className="truncate text-[11px] text-neutral-500">
                                {lastMsg?.body ?? 'Bắt đầu trò chuyện với chủ sân...'}
                              </span>
                              {unread > 0 && (
                                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#D9532F] px-1 tabular-nums text-[10px] font-bold text-white">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* RIGHT PANE: Active Conversation Area */}
              <div
                className={`${
                  mobileShowThreadList ? 'hidden sm:flex' : 'flex'
                } min-w-0 flex-1 flex-col bg-[#F5F6F7]`}
              >
                {/* Active Lessor Sub-Header */}
                {activeProvider && (
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenLessorShop(activeProvider.providerId);
                          onToggleOpen(false);
                        }}
                        className="flex items-center gap-1 truncate text-xs sm:text-[13px] font-semibold text-[#0F172A] hover:text-[#16422C]"
                      >
                        <span className="truncate">{activeProvider.providerName}</span>
                        <span className="text-neutral-400">▾</span>
                      </button>
                      <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-neutral-500">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {activeProvider.onlineStatusLabel ?? 'Đang hoạt động'}
                        </span>
                        <span>• Phản hồi {activeProvider.responseRatePct}%</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenLessorShop(activeProvider.providerId);
                        onToggleOpen(false);
                      }}
                      className="sm:hidden shrink-0 rounded-md border border-[#16422C] px-2 py-1 text-[10.5px] font-semibold text-[#16422C]"
                    >
                      Gian hàng
                    </button>
                  </div>
                )}

                {/* Scrollable Feed */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 overscroll-contain"
                >
                  {/* Date Separator */}
                  <div className="flex justify-center">
                    <span className="rounded-full bg-neutral-200/80 px-3 py-0.5 text-[10.5px] font-medium text-neutral-600">
                      Ngày hôm nay
                    </span>
                  </div>

                  {/* Shopee-style Yellow Escrow Safety Warning Box (Image 3) */}
                  <div className="rounded-xl border border-[#F5D67B] bg-[#FFFBEB] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#6B4F08] shadow-2xs">
                    <div>
                      <span className="mr-1 font-bold text-[#B45309]">ⓘ LƯU Ý:</span>
                      ArenaPulse <strong>KHÔNG</strong> cho phép các hành vi: Đặt cọc / Chuyển khoản
                      riêng cho bên cho thuê ngoài hệ thống / Giao dịch ngoài sàn / Hứa hẹn giữ sân
                      không qua cổng ký quỹ. Vui lòng chỉ thanh toán giữ sân trực tiếp trên{' '}
                      <strong>ArenaPulse (VNPAY / MoMo)</strong> để được bảo lãnh hoàn tiền 100%!{' '}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSafetyPolicy();
                          onToggleOpen(false);
                        }}
                        className="font-semibold text-[#0E4F7E] underline hover:text-[#16422C]"
                      >
                        Tìm hiểu thêm
                      </button>
                    </div>
                  </div>

                  {/* Context Court Quick Prompt Strip */}
                  {showContextPrompt && contextListing && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#16422C]/25 bg-white p-2.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={contextListing.imageUrl || '/images/real-pickleball-outdoor.jpg'}
                          alt={contextListing.groupName}
                          className="h-10 w-12 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold text-[#0F172A]">
                            Đang xem: {contextListing.groupName}
                          </div>
                          <div className="tabular-nums text-[10.5px] font-bold text-[#D9532F]">
                            Từ {formatVnd(contextListing.minPrice)} • Cọc{' '}
                            {contextListing.depositPercent}%
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          sendMessage(
                            `Mình muốn hỏi lịch trống & điều kiện mặt sân của "${contextListing.groupName}" nhé!`,
                            contextListing
                          )
                        }
                        className="shrink-0 rounded-lg bg-[#16422C] px-2.5 py-1.5 text-[10.5px] font-semibold text-[#E7F7D4] hover:bg-[#0F172A]"
                      >
                        Gửi hỏi sân này
                      </button>
                    </div>
                  )}

                  {/* Chat Message Bubbles */}
                  {activeThread.messages.map((m) => {
                    const isSelf = m.senderRole === 'USER';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] text-neutral-400">
                          <span className="font-medium text-neutral-500">{m.senderName}</span>
                          <span className="tabular-nums">{m.createdAt}</span>
                        </div>

                        <div
                          className={`max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                            isSelf
                              ? 'rounded-br-xs bg-[#16422C] text-white'
                              : 'rounded-bl-xs bg-white border border-neutral-200/80 text-[#0F172A]'
                          }`}
                        >
                          {m.courtCard && (
                            <div
                              onClick={() => {
                                const found = listings.find(
                                  (l) => l.groupId === m.courtCard?.groupId
                                );
                                if (found) {
                                  onSelectCourtFromChat(found);
                                  onToggleOpen(false);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  const found = listings.find(
                                    (l) => l.groupId === m.courtCard?.groupId
                                  );
                                  if (found) {
                                    onSelectCourtFromChat(found);
                                    onToggleOpen(false);
                                  }
                                }
                              }}
                              className={`flex items-center gap-2.5 rounded-xl p-2 cursor-pointer transition-colors ${
                                isSelf
                                  ? 'bg-white/10 hover:bg-white/15'
                                  : 'bg-[#F8F9FA] border border-neutral-200/80 hover:border-[#16422C]/40'
                              }`}
                            >
                              <img
                                src={
                                  m.courtCard.imageUrl || '/images/real-pickleball-outdoor.jpg'
                                }
                                alt={m.courtCard.groupName}
                                className="h-12 w-14 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-semibold">
                                  {m.courtCard.groupName}
                                </div>
                                <div
                                  className={`mt-0.5 text-[10px] ${
                                    isSelf ? 'text-[#E7F7D4]' : 'text-[#D9532F] font-bold'
                                  }`}
                                >
                                  {formatVnd(m.courtCard.minPrice)} –{' '}
                                  {formatVnd(m.courtCard.maxPrice)}
                                </div>
                                <div
                                  className={`text-[9.5px] ${
                                    isSelf ? 'text-white/75' : 'text-neutral-500'
                                  }`}
                                >
                                  {m.courtCard.sportName} • Còn {m.courtCard.availableCourts} sân •
                                  Nhấn để xem
                                </div>
                              </div>
                            </div>
                          )}

                          <div>{m.body}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Popovers (Emoji / Court Attachment Picker) */}
                {(showEmojiPicker || showCourtPicker) && (
                  <div className="border-t border-neutral-200 bg-white px-3.5 py-2.5">
                    {showEmojiPicker && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10.5px] font-medium text-neutral-400 mr-1">
                          Nhãn nhanh:
                        </span>
                        {QUICK_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setChatInput((prev) => `${prev}${em}`)}
                            className="rounded-lg border border-neutral-200 px-2 py-1 text-sm hover:bg-neutral-50"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}

                    {showCourtPicker && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        <div className="text-[10.5px] font-semibold text-neutral-500">
                          Chọn cụm sân thuộc {activeProvider?.providerName} để đính kèm vào chat:
                        </div>
                        {activeProviderCourts.map((court) => (
                          <button
                            key={court.groupId}
                            type="button"
                            onClick={() =>
                              sendMessage(`Gửi thông tin tham khảo cụm sân "${court.groupName}".`, court)
                            }
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-left text-[11px] hover:border-[#16422C] hover:bg-[#F4F8F4]"
                          >
                            <span className="truncate font-medium text-[#0F172A]">
                              {court.groupName}
                            </span>
                            <span className="shrink-0 tabular-nums font-semibold text-[#16422C]">
                              Từ {formatVnd(court.minPrice)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Chips Bar */}
                <div className="flex gap-1.5 overflow-x-auto border-t border-neutral-200/70 bg-white px-3 py-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="shrink-0 rounded-full border border-neutral-200 bg-[#F8F9FA] px-2.5 py-1 text-[10.5px] font-medium text-neutral-700 hover:border-[#16422C] hover:text-[#16422C]"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Shopee-style Bottom Input & Action Icons Toolbar */}
                <form
                  onSubmit={handleSubmit}
                  className="border-t border-neutral-200 bg-white px-3.5 py-2.5"
                >
                  <label htmlFor="floating-chat-input" className="sr-only">
                    Nhập nội dung tin nhắn gửi chủ sân
                  </label>
                  <input
                    id="floating-chat-input"
                    name="chatMessage"
                    type="text"
                    disabled={activeRole === 'STAFF' && !staffChatEnabled}
                    placeholder={
                      activeRole === 'STAFF' && !staffChatEnabled
                        ? 'Chủ sân đang khóa quyền chat của nhân viên…'
                        : 'Nhập nội dung tin nhắn'
                    }
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="w-full text-xs text-[#0F172A] placeholder:text-neutral-400 focus:outline-none disabled:opacity-50"
                  />

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker((v) => !v);
                          setShowCourtPicker(false);
                        }}
                        title="Chèn biểu tượng cảm xúc"
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          showEmojiPicker
                            ? 'bg-[#E7F7D4] text-[#16422C]'
                            : 'text-neutral-500 hover:bg-neutral-100'
                        }`}
                      >
                        😊 Emoji
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCourtPicker((v) => !v);
                          setShowEmojiPicker(false);
                        }}
                        title="Đính kèm thẻ cụm sân"
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          showCourtPicker
                            ? 'bg-[#E7F7D4] text-[#16422C]'
                            : 'text-neutral-500 hover:bg-neutral-100'
                        }`}
                      >
                        🏟️ Gửi thẻ sân
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={activeRole === 'STAFF' && !staffChatEnabled}
                      className="rounded-lg bg-[#16422C] px-4 py-1.5 text-xs font-semibold text-[#E7F7D4] hover:bg-[#0F172A] disabled:opacity-45 transition-colors"
                    >
                      Gửi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-Right Floating Chat Launcher Button */}
      <button
        type="button"
        onClick={() => onToggleOpen(!open)}
        aria-label={open ? 'Đóng cửa sổ chat' : 'Mở cửa sổ chat trực tiếp với chủ sân'}
        aria-expanded={open}
        className="fairway-interactive group relative flex h-14 sm:h-15 px-4 sm:px-5 items-center justify-center gap-2 rounded-2xl bg-[#16422C] text-white shadow-[0_14px_34px_rgba(22,66,44,0.36)] ring-2 ring-white hover:bg-[#0F172A] transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 fill-none stroke-[#E7F7D4]"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h8M8 14h5m8-2a9 9 0 11-16.24 5.36L3 20l1.64-3.76A9 9 0 0121 12z"
          />
        </svg>
        <div className="text-left leading-tight">
          <div className="text-xs font-bold tracking-tight">Chat</div>
          <div className="text-[9.5px] font-medium text-[#E7F7D4]">
            {providers.length} chủ sân
          </div>
        </div>

        {!open && totalUnread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D9532F] px-1 tabular-nums text-[10px] font-bold text-white ring-2 ring-white">
            {totalUnread}
          </span>
        )}
      </button>
    </div>
  );
};
