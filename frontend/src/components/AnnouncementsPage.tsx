import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AnnouncementCategory,
  AnnouncementSeverity,
  AppPageId,
  AuthSession,
  PersonalUserNotification,
  RoleCode,
  VenueAnnouncement,
  VenueLocationInfo,
} from '../types/marketplace';
import { INITIAL_PERSONAL_NOTIFICATIONS } from '../data/announcementsData';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';

interface AnnouncementsPageProps {
  locations: VenueLocationInfo[];
  announcements: VenueAnnouncement[];
  selectedLocationId: string;
  onSelectLocationId: (id: string) => void;
  readIds: string[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  activeRole: RoleCode;
  session?: AuthSession | null;
  onNavigate?: (page: AppPageId) => void;
  onPublishAnnouncement: (ann: Omit<VenueAnnouncement, 'id' | 'publishedAt'>) => void;
  onBrowseVenueCourts: (venueName: string, sportCode?: string) => void;
}

const CATEGORY_LABELS: Record<AnnouncementCategory | 'ALL', string> = {
  ALL: 'Tất cả thông báo',
  ACCOUNT_PAYMENT: 'Thanh toán & Vé QR',
  WEATHER_OPS: 'Thời tiết & Hoàn cọc',
  MAINTENANCE: 'Bảo trì sân bãi',
  PROMOTION: 'Ưu đãi giờ chơi',
  SYSTEM_UPDATE: 'Cập nhật hệ thống',
  TOURNAMENT: 'Đối tác & Sự kiện',
  ARTICLE: 'Tin tức',
  VIP_PERK: 'Thông báo mở rộng',
};

const PERSONAL_READ_STORAGE_KEY = 'arenapulse_personal_notif_read_v1';

function loadPersonalReadIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PERSONAL_READ_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const STATUS_DOT: Record<
  VenueLocationInfo['operationalStatus'],
  { label: string; dotClass: string; badgeClass: string }
> = {
  NORMAL: {
    label: 'Hoạt động tốt',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-[#E7F7D4] text-[#204E18]',
  },
  WEATHER_WATCH: {
    label: 'Theo dõi thời tiết',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-900',
  },
  PARTIAL_MAINTENANCE: {
    label: 'Bảo trì 1 phần',
    dotClass: 'bg-sky-500',
    badgeClass: 'bg-[#E6F1F8] text-[#0E4F7E]',
  },
};

const PersonalNoticeIcon: React.FC<{ kind: PersonalUserNotification['kind'] }> = ({ kind }) => {
  const tone =
    kind === 'TICKET_QR'
      ? 'bg-[#F4F8F4] text-[#16422C] border-[#16422C]/20'
      : kind === 'PAYMENT'
        ? 'bg-[#E6F1F8] text-[#0E4F7E] border-[#0E4F7E]/20'
        : kind === 'SECURITY'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone}`}
      aria-hidden="true"
    >
      {kind === 'TICKET_QR' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h3m3-3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : kind === 'PAYMENT' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18M7 15h4" strokeLinecap="round" />
        </svg>
      ) : kind === 'SECURITY' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M12 3 4 7v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4Z" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};

export const AnnouncementsPage: React.FC<AnnouncementsPageProps> = ({
  locations,
  announcements,
  selectedLocationId,
  onSelectLocationId,
  readIds,
  onMarkRead,
  onMarkAllRead,
  activeRole,
  session,
  onNavigate,
  onPublishAnnouncement,
  onBrowseVenueCourts,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<AnnouncementCategory | 'ALL'>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBulletinId, setActiveBulletinId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  // Personal User Vertical Card State (Right Rail)
  const [personalNotifications, setPersonalNotifications] = useState<PersonalUserNotification[]>(
    INITIAL_PERSONAL_NOTIFICATIONS
  );
  const [personalReadIds, setPersonalReadIds] = useState<string[]>(() => loadPersonalReadIds());
  const [personalUnreadOnly, setPersonalUnreadOnly] = useState<boolean>(false);

  // Admin-only Broadcast Composer State
  const [publishTarget, setPublishTarget] = useState<'ALL_USERS' | 'PERSONAL_USER'>('ALL_USERS');
  const [newLocId, setNewLocId] = useState<string>('ALL');
  const [newCat, setNewCat] = useState<AnnouncementCategory>('SYSTEM_UPDATE');
  const [newSev, setNewSev] = useState<AnnouncementSeverity>('INFO');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newWindow, setNewWindow] = useState<string>('Hôm nay • Toàn hệ thống');
  const [publishToast, setPublishToast] = useState<string | null>(null);

  // Strict authorization: ONLY authenticated ADMIN can create announcements
  const isAdmin = Boolean(session && activeRole === 'ADMIN');

  useEffect(() => {
    if (!isAdmin && showCreateForm) {
      setShowCreateForm(false);
    }
  }, [isAdmin, showCreateForm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveBulletinId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cities = useMemo(
    () => ['ALL', ...Array.from(new Set(locations.map((l) => l.city)))],
    [locations]
  );

  const personalUnreadCount = useMemo(
    () => personalNotifications.filter((n) => !personalReadIds.includes(n.id)).length,
    [personalNotifications, personalReadIds]
  );

  const visiblePersonalNotifications = useMemo(
    () =>
      personalUnreadOnly
        ? personalNotifications.filter((n) => !personalReadIds.includes(n.id))
        : personalNotifications,
    [personalNotifications, personalReadIds, personalUnreadOnly]
  );

  const systemUnreadCount = useMemo(
    () => announcements.filter((a) => !readIds.includes(a.id)).length,
    [announcements, readIds]
  );

  const systemFeedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements.filter((item) => {
      const matchLocation =
        selectedLocationId === 'ALL' ||
        item.locationId === 'ALL' ||
        item.locationId === selectedLocationId;
      const matchCity =
        cityFilter === 'ALL' || item.city === 'Toàn quốc' || item.city === cityFilter;
      const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q);
      return matchLocation && matchCity && matchCat && matchQuery;
    });
  }, [announcements, selectedLocationId, cityFilter, categoryFilter, searchQuery]);

  const selectedLocObj = locations.find((l) => l.locationId === selectedLocationId) ?? null;

  const activeBulletin = useMemo(
    () => (activeBulletinId ? announcements.find((a) => a.id === activeBulletinId) ?? null : null),
    [announcements, activeBulletinId]
  );

  const openBulletinArticle = (ann: VenueAnnouncement) => {
    onMarkRead(ann.id);
    setActiveBulletinId(ann.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyBulletinLink = (id: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/announcements#${id}`).catch(() => {});
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 1800);
  };

  const markPersonalRead = (id: string) => {
    setPersonalReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        window.localStorage.setItem(PERSONAL_READ_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const markAllPersonalRead = () => {
    const allIds = personalNotifications.map((n) => n.id);
    setPersonalReadIds(allIds);
    try {
      window.localStorage.setItem(PERSONAL_READ_STORAGE_KEY, JSON.stringify(allIds));
    } catch {
      // Ignore storage error
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newTitle.trim() || !newSummary.trim()) {
      return;
    }

    if (publishTarget === 'PERSONAL_USER') {
      const createdPersonal: PersonalUserNotification = {
        id: `pn-${Date.now()}`,
        kind: newCat === 'ACCOUNT_PAYMENT' ? 'PAYMENT' : 'SCHEDULE_REMINDER',
        title: newTitle.trim(),
        body: newSummary.trim(),
        timestampLabel: 'Vừa xong',
        isNew: true,
        actionLabel: 'Kiểm tra ngay →',
        actionTargetPage: newCat === 'ACCOUNT_PAYMENT' ? 'checkout' : 'courts',
      };
      setPersonalNotifications((prev) => [createdPersonal, ...prev]);
      setPublishToast('Đã gửi thông báo cá nhân mới tới hộp tin User.');
    } else {
      const foundLoc = locations.find((l) => l.locationId === newLocId);
      onPublishAnnouncement({
        locationId: newLocId,
        venueName: foundLoc ? foundLoc.venueName : 'Thông báo toàn hệ thống ArenaPulse.vn',
        city: foundLoc ? foundLoc.city : 'Toàn quốc',
        audience: 'ALL_USERS',
        category: newCat,
        severity: newSev,
        pinned: newSev === 'IMPORTANT',
        title: newTitle.trim(),
        summary: newSummary.trim(),
        authorName: session?.fullName ?? 'Ban Quản Trị ArenaPulse',
        readMinutes: 2,
        coverImageUrl: foundLoc?.imageUrl ?? '/images/sport-complex-aerial.jpg',
        imageCaption: `Bản tin cập nhật chính thức từ ${foundLoc ? foundLoc.venueName : 'Hệ thống ArenaPulse.vn'}.`,
        keyTakeaways: [
          `Phạm vi áp dụng: ${foundLoc ? foundLoc.venueName : 'Toàn hệ thống ArenaPulse.vn'}.`,
          `Thời gian hiệu lực: ${newWindow.trim() || 'Đang áp dụng'}.`,
        ],
        articleSections: [
          {
            heading: 'Tình hình cập nhật chi tiết',
            paragraphs: newSummary
              .split(/\n+/)
              .map((p) => p.trim())
              .filter(Boolean),
          },
        ],
        effectiveWindow: newWindow.trim() || 'Đang áp dụng',
      });
      setPublishToast('Đã xuất bản thông báo toàn hệ thống thành công.');
    }

    setNewTitle('');
    setNewSummary('');
    setShowCreateForm(false);
    window.setTimeout(() => setPublishToast(null), 3500);
  };

  const triggerFeedAction = (ann: VenueAnnouncement) => {
    onMarkRead(ann.id);
    if (ann.actionTargetPage && onNavigate) {
      if (ann.locationId !== 'ALL' && ann.actionTargetPage === 'courts') {
        onBrowseVenueCourts(ann.venueName, ann.relatedSportCode);
        return;
      }
      onNavigate(ann.actionTargetPage);
      return;
    }
    if (ann.locationId !== 'ALL') {
      onBrowseVenueCourts(ann.venueName, ann.relatedSportCode);
    }
  };

  if (activeBulletin) {
    const matchedLoc = locations.find((l) => l.locationId === activeBulletin.locationId);
    const heroImage =
      activeBulletin.coverImageUrl ?? matchedLoc?.imageUrl ?? '/images/sport-complex-aerial.jpg';
    const relatedBulletins = announcements.filter((a) => a.id !== activeBulletin.id).slice(0, 4);
    const sections =
      activeBulletin.articleSections && activeBulletin.articleSections.length > 0
        ? activeBulletin.articleSections
        : [
            {
              heading: 'Chi tiết tình hình thông báo',
              paragraphs: activeBulletin.articleContent ?? [activeBulletin.summary],
            },
          ];

    return (
      <article className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          {/* Newspaper Breadcrumb & Back */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-neutral-500">
              <button
                type="button"
                onClick={() => setActiveBulletinId(null)}
                className="hover:text-[#0F172A]"
              >
                Thông báo hệ thống
              </button>
              <span>/</span>
              <span className="font-semibold text-[#0E4F7E]">
                {CATEGORY_LABELS[activeBulletin.category]}
              </span>
              <span>/</span>
              <span className="text-[#0F172A] truncate max-w-[260px]">{activeBulletin.venueName}</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveBulletinId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-[#F8FAFC] px-4 py-1.5 font-semibold text-[#0F172A] hover:border-neutral-400"
            >
              <span>←</span>
              <span>Quay lại Trung tâm Thông báo</span>
            </button>
          </div>

          {/* Article Headline & Sapo */}
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EXPO_EASE }}
            className="mx-auto mt-8 max-w-4xl"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  activeBulletin.severity === 'IMPORTANT'
                    ? 'bg-amber-100 text-amber-900'
                    : activeBulletin.severity === 'POSITIVE'
                      ? 'bg-[#E7F7D4] text-[#16422C]'
                      : 'bg-[#E6F1F8] text-[#0E4F7E]'
                }`}
              >
                {CATEGORY_LABELS[activeBulletin.category]}
              </span>
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-semibold text-[#0F172A]">
                Hiệu lực: {activeBulletin.effectiveWindow}
              </span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-[40px] font-semibold leading-[1.16] tracking-[-0.025em] text-[#0F172A]">
              {activeBulletin.title}
            </h1>

            <p className="mt-4 text-base sm:text-lg font-medium leading-relaxed text-neutral-600">
              {activeBulletin.summary}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-neutral-200/80 py-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16422C] text-sm font-bold text-[#E7F7D4]">
                  {(activeBulletin.authorName ?? 'A').charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-[#0F172A]">
                    {activeBulletin.authorName ?? 'Trung tâm Điều hành ArenaPulse.vn'}
                  </div>
                  <div className="text-neutral-500">
                    {activeBulletin.venueName} • Cập nhật {activeBulletin.publishedAt} •{' '}
                    {activeBulletin.readMinutes ?? 2} phút đọc
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopyBulletinLink(activeBulletin.id)}
                className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 font-semibold text-[#0F172A] hover:border-neutral-400"
              >
                {copiedShare ? 'Đã sao chép liên kết ✓' : 'Chia sẻ thông báo'}
              </button>
            </div>
          </motion.header>

          {/* Hero Photo & Caption */}
          <motion.figure
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.06, ease: EXPO_EASE }}
            className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-[26px] border border-neutral-200/70 bg-neutral-50"
          >
            <img
              src={heroImage}
              alt={activeBulletin.title}
              className="max-h-[440px] w-full object-cover"
            />
            <figcaption className="px-5 py-3 text-xs italic text-neutral-500">
              {activeBulletin.imageCaption ?? `${activeBulletin.venueName} — Cập nhật vận hành chính thức.`}
            </figcaption>
          </motion.figure>

          {/* 2-Column Editorial Content & Related Bulletins */}
          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-8">
              {/* Current Situation Summary Takeaways */}
              {activeBulletin.keyTakeaways && activeBulletin.keyTakeaways.length > 0 && (
                <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-5 sm:p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.1em] text-[#16422C]">
                    Tóm tắt tình hình hiện tại
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-[#0F172A]">
                    {activeBulletin.keyTakeaways.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16422C]" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Structured Newspaper Body */}
              {sections.map((sec, sIdx) => (
                <section key={sIdx} className="space-y-3.5">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0F172A]">
                    {sec.heading}
                  </h2>
                  {sec.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-[15.5px] leading-[1.85] text-neutral-700">
                      {p}
                    </p>
                  ))}

                  {sIdx === 0 && activeBulletin.pullQuote && (
                    <blockquote className="my-6 rounded-r-2xl border-l-4 border-[#16422C] bg-[#F8FAFC] p-5 text-base font-medium italic leading-relaxed text-[#0F172A]">
                      “{activeBulletin.pullQuote}”
                    </blockquote>
                  )}
                </section>
              ))}

              {/* Action Banner */}
              {(activeBulletin.actionLabel || activeBulletin.locationId !== 'ALL') && (
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#0F172A] p-6 text-white sm:flex-row sm:items-center">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#E7F7D4]">
                      Thao tác nhanh cho tình hình hiện tại
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {activeBulletin.venueName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerFeedAction(activeBulletin)}
                    className="shrink-0 rounded-full bg-[#E7F7D4] px-5 py-2.5 text-xs font-semibold text-[#0B2217] hover:bg-white transition-colors"
                  >
                    {activeBulletin.actionLabel ?? 'Xem lịch sân ngay →'}
                  </button>
                </div>
              )}
            </div>

            {/* Right Sidebar: Related Announcements */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24 self-start">
              <div className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Thông báo khác từ hệ thống</h3>
                  <button
                    type="button"
                    onClick={() => setActiveBulletinId(null)}
                    className="text-[11px] font-semibold text-[#16422C] hover:underline"
                  >
                    Tất cả
                  </button>
                </div>

                <div className="space-y-4">
                  {relatedBulletins.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => openBulletinArticle(rel)}
                      className="group block w-full text-left border-b border-neutral-200/60 pb-3 last:border-none last:pb-0"
                    >
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#0E4F7E]">
                        {CATEGORY_LABELS[rel.category]}
                      </div>
                      <div className="mt-1 text-xs sm:text-[13px] font-semibold leading-snug text-[#0F172A] group-hover:text-[#16422C] group-hover:underline">
                        {rel.title}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        {rel.venueName} • {rel.publishedAt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section id="announcements" className="relative overflow-hidden bg-[#F7F9F8] py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#16422C]/8 via-[#86EFAC]/12 to-[#0E4F7E]/8 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* TOP HEADER */}
        <ScrollReveal className="rounded-[30px] border border-neutral-200/80 bg-white/95 p-6 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F8F4] border border-[#16422C]/20 px-3.5 py-1 text-xs font-semibold text-[#16422C]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  ArenaPulse.vn Notification Center
                </span>

                {systemUnreadCount > 0 && (
                  <span className="rounded-full bg-[#0F172A] px-3 py-1 tabular-nums text-[11px] font-semibold text-white">
                    {systemUnreadCount} thông báo chung chưa đọc
                  </span>
                )}
              </div>

              <h1 className="mt-3.5 text-3xl sm:text-[42px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0F172A]">
                Trung tâm Thông báo Hệ thống
              </h1>
              <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-neutral-500">
                Theo dõi các thông báo vận hành, lịch bảo trì và cảnh báo thời tiết gửi tới toàn bộ
                người dùng ở cột chính; quản lý hộp tin thông báo riêng gửi tới tài khoản của bạn ở card dọc bên phải.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onNavigate && (
                <ActionButton variant="outline" size="sm" onClick={() => onNavigate('news')}>
                  Đọc chuyên trang Bài viết →
                </ActionButton>
              )}

              <ActionButton
                variant="outline"
                size="sm"
                onClick={onMarkAllRead}
                disabled={systemUnreadCount === 0}
              >
                Đã đọc hết thông báo chung
              </ActionButton>

              {isAdmin && (
                <ActionButton
                  variant="forest"
                  size="sm"
                  onClick={() => setShowCreateForm((v) => !v)}
                >
                  {showCreateForm ? 'Đóng trình tạo' : '+ Tạo thông báo mới (Admin)'}
                </ActionButton>
              )}
            </div>
          </div>

          <AnimatePresence>
            {publishToast && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EXPO_EASE }}
                className="mt-4 rounded-2xl border border-[#16422C]/25 bg-[#F4F8F4] px-4 py-2.5 text-xs font-semibold text-[#16422C]"
              >
                {publishToast}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollReveal>

        {/* ADMIN-ONLY COMPOSER */}
        <AnimatePresence>
          {isAdmin && showCreateForm && (
            <motion.form
              initial={{ opacity: 0, height: 0, y: -12 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -12 }}
              transition={{ duration: 0.34, ease: EXPO_EASE }}
              onSubmit={handleCreate}
              className="mt-6 overflow-hidden rounded-[26px] border border-[#16422C]/30 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#16422C] px-2.5 py-0.5 text-[10px] font-bold text-[#E7F7D4]">
                    QUYỀN ADMIN
                  </span>
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    Phát hành Thông báo Hệ thống
                  </h2>
                </div>
                <span className="text-xs text-neutral-500">
                  Quản trị viên: <strong>{session?.fullName}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4 text-xs">
                <div>
                  <label htmlFor="ann-target" className="mb-1 block font-medium text-neutral-700">
                    Kênh gửi thông báo
                  </label>
                  <PillSelect
                    id="ann-target"
                    variant="field"
                    ariaLabel="Kênh gửi thông báo"
                    value={publishTarget}
                    onChange={(val) => setPublishTarget(val as 'ALL_USERS' | 'PERSONAL_USER')}
                    options={[
                      { value: 'ALL_USERS', label: 'Thông báo chung (Toàn User)' },
                      { value: 'PERSONAL_USER', label: 'Thông báo riêng User (Card dọc)' },
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="ann-cat" className="mb-1 block font-medium text-neutral-700">
                    Nhóm thông báo
                  </label>
                  <PillSelect
                    id="ann-cat"
                    variant="field"
                    ariaLabel="Nhóm thông báo"
                    value={newCat}
                    onChange={(val) => setNewCat(val as AnnouncementCategory)}
                    options={[
                      { value: 'SYSTEM_UPDATE', label: 'Cập nhật hệ thống' },
                      { value: 'ACCOUNT_PAYMENT', label: 'Thanh toán & Vé QR' },
                      { value: 'WEATHER_OPS', label: 'Thời tiết & Hoàn cọc' },
                      { value: 'MAINTENANCE', label: 'Bảo trì sân bãi' },
                      { value: 'PROMOTION', label: 'Ưu đãi giờ chơi' },
                      { value: 'TOURNAMENT', label: 'Đối tác & Sự kiện' },
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="ann-loc" className="mb-1 block font-medium text-neutral-700">
                    Phạm vi cụm sân
                  </label>
                  <PillSelect
                    id="ann-loc"
                    variant="field"
                    ariaLabel="Phạm vi cụm sân"
                    value={newLocId}
                    onChange={setNewLocId}
                    options={[
                      { value: 'ALL', label: 'Toàn hệ thống ArenaPulse.vn' },
                      ...locations.map((l) => ({
                        value: l.locationId,
                        label: `${l.city} — ${l.venueName}`,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="ann-sev" className="mb-1 block font-medium text-neutral-700">
                    Mức độ ưu tiên
                  </label>
                  <PillSelect
                    id="ann-sev"
                    variant="field"
                    ariaLabel="Mức độ ưu tiên"
                    value={newSev}
                    onChange={(val) => setNewSev(val as AnnouncementSeverity)}
                    options={[
                      { value: 'IMPORTANT', label: 'Quan trọng (Ghim đầu)' },
                      { value: 'POSITIVE', label: 'Tin mới / Tích cực' },
                      { value: 'INFO', label: 'Thông tin chung' },
                    ]}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="ann-title" className="mb-1 block font-medium text-neutral-700">
                    Tiêu đề thông báo *
                  </label>
                  <input
                    id="ann-title"
                    type="text"
                    required
                    placeholder="Nhập tiêu đề thông báo rõ ràng…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="ann-win" className="mb-1 block font-medium text-neutral-700">
                    Thời gian hiệu lực
                  </label>
                  <input
                    id="ann-win"
                    type="text"
                    value={newWindow}
                    onChange={(e) => setNewWindow(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label htmlFor="ann-body" className="mb-1 block font-medium text-neutral-700">
                    Nội dung thông báo *
                  </label>
                  <textarea
                    id="ann-body"
                    rows={2}
                    required
                    placeholder="Nhập nội dung thông báo chi tiết từ Admin…"
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <ActionButton type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                  Hủy
                </ActionButton>
                <ActionButton type="submit" variant="forest" size="md">
                  Phát hành thông báo
                </ActionButton>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* MAIN 2-COLUMN WORKSPACE */}
        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* LEFT 8 COLS: SYSTEM-WIDE NOTIFICATIONS TO ALL USERS */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EXPO_EASE }}
              className="rounded-[24px] border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm thông báo hệ thống, lịch bảo trì, thời tiết hoặc cụm sân..."
                    aria-label="Tìm kiếm thông báo"
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] py-2.5 pl-10 pr-3.5 text-xs text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl bg-[#F1F5F9] p-1">
                  {cities.map((c) => {
                    const active = cityFilter === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCityFilter(c);
                          onSelectLocationId('ALL');
                        }}
                        className="relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        {active && (
                          <motion.span
                            layoutId="ann-city-pill"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-lg bg-[#0F172A] shadow-2xs"
                          />
                        )}
                        <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                          {c === 'ALL' ? 'Toàn quốc' : c}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-3">
                {(
                  [
                    'ALL',
                    'ACCOUNT_PAYMENT',
                    'WEATHER_OPS',
                    'MAINTENANCE',
                    'PROMOTION',
                    'SYSTEM_UPDATE',
                  ] as (AnnouncementCategory | 'ALL')[]
                ).map((cat) => {
                  const active = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className="relative rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors"
                    >
                      {active ? (
                        <motion.span
                          layoutId="ann-category-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-[#16422C] shadow-2xs"
                        />
                      ) : (
                        <span className="absolute inset-0 rounded-full border border-neutral-200 bg-white" />
                      )}
                      <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Selected Location Active Banner */}
            <AnimatePresence>
              {selectedLocObj && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: EXPO_EASE }}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[#0E4F7E]/25 bg-[#F4F8FB] p-4 sm:p-5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-[#0E4F7E]">
                      Đang lọc theo cơ sở: {selectedLocObj.venueName}
                    </div>
                    <div className="text-[#0F172A]">
                      <strong>Địa chỉ:</strong> {selectedLocObj.address} • <strong>Mở cửa:</strong>{' '}
                      {selectedLocObj.openHours}
                    </div>
                    <div className="text-neutral-600">
                      <strong>Gửi xe &amp; Check-in:</strong> {selectedLocObj.parkingNote}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectLocationId('ALL')}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600"
                    >
                      Bỏ lọc
                    </button>
                    <ActionButton
                      variant="ink"
                      size="sm"
                      arrow="right"
                      onClick={() => onBrowseVenueCourts(selectedLocObj.venueName)}
                    >
                      Đặt sân ngay
                    </ActionButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* System-Wide Announcements Feed */}
            <motion.div layout className="space-y-4">
              <AnimatePresence mode="popLayout">
                {systemFeedItems.map((ann, idx) => {
                  const isUnread = !readIds.includes(ann.id);
                  const matchedLoc = locations.find((l) => l.locationId === ann.locationId);
                  const thumbUrl = matchedLoc?.imageUrl ?? '/images/sport-complex-aerial.jpg';
                  const accentBar =
                    ann.severity === 'IMPORTANT'
                      ? 'bg-amber-500'
                      : ann.severity === 'POSITIVE'
                        ? 'bg-[#16422C]'
                        : 'bg-[#0E4F7E]';

                  return (
                    <motion.article
                      key={ann.id}
                      layout
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.06 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{
                        duration: 0.42,
                        delay: Math.min(idx * 0.04, 0.16),
                        ease: EXPO_EASE,
                      }}
                      whileHover={{ y: -2 }}
                      onClick={() => openBulletinArticle(ann)}
                      className="group relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 pl-6 shadow-2xs transition-shadow cursor-pointer hover:border-neutral-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                    >
                      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${accentBar}`} />

                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="h-32 sm:h-24 w-full sm:w-36 shrink-0 overflow-hidden rounded-xl border border-neutral-200/70">
                          <img
                            src={thumbUrl}
                            alt={ann.venueName}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isUnread && (
                                <span className="rounded-full bg-[#16422C] px-2 py-0.5 text-[10px] font-bold text-[#E7F7D4]">
                                  MỚI
                                </span>
                              )}
                              {ann.pinned && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                  Ghim quan trọng
                                </span>
                              )}
                              <span className="rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10px] font-semibold text-[#0E4F7E]">
                                {CATEGORY_LABELS[ann.category]}
                              </span>
                              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[10.5px] font-medium text-neutral-700">
                                {ann.venueName}
                              </span>
                            </div>

                            <span className="tabular-nums text-[11px] text-neutral-400">
                              {ann.publishedAt}
                            </span>
                          </div>

                          <h3 className="mt-2.5 text-base sm:text-[17px] font-semibold leading-snug text-[#0F172A] group-hover:text-[#16422C] transition-colors">
                            {ann.title}
                          </h3>
                          <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-neutral-600">
                            {ann.summary}
                          </p>

                          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-2.5 text-xs">
                            <span className="text-neutral-500">
                              Hiệu lực: <strong className="text-[#0F172A]">{ann.effectiveWindow}</strong>
                            </span>

                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-semibold text-[#0F172A] group-hover:text-[#16422C]">
                                Đọc bài chi tiết →
                              </span>

                              {(ann.actionLabel || ann.locationId !== 'ALL') && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerFeedAction(ann);
                                  }}
                                  className="font-semibold text-[#16422C] hover:underline"
                                >
                                  {ann.actionLabel ?? 'Xem lịch sân →'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>

              {systemFeedItems.length === 0 && (
                <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
                  Không tìm thấy thông báo nào phù hợp với bộ lọc.
                </div>
              )}
            </motion.div>

            {/* Facility Quick Status Strip */}
            <ScrollReveal className="rounded-[24px] border border-neutral-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Tình trạng hoạt động các cụm sân (bấm để lọc thông báo cơ sở)
                </h2>
                {selectedLocationId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => onSelectLocationId('ALL')}
                    className="text-xs font-semibold text-[#0E4F7E] hover:underline"
                  >
                    Xem tất cả
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((loc) => {
                  const selected = selectedLocationId === loc.locationId;
                  const status = STATUS_DOT[loc.operationalStatus];
                  return (
                    <motion.button
                      key={loc.locationId}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectLocationId(selected ? 'ALL' : loc.locationId)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[#16422C] bg-[#F4F8F4] ring-1 ring-[#16422C]/30'
                          : 'border-neutral-200/80 bg-[#F8FAFC] hover:bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0F172A] truncate">
                          {loc.venueName}
                        </span>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${status.dotClass}`} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>{loc.city}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </ScrollReveal>
          </div>

          {/* RIGHT 4 COLS (VERTICAL STICKY CARD): PERSONAL SYSTEM NOTIFICATIONS TO USER */}
          <motion.aside
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.52, delay: 0.08, ease: EXPO_EASE }}
            className="lg:col-span-4 lg:sticky lg:top-24"
          >
            <div className="overflow-hidden rounded-[28px] border border-neutral-200/90 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#0B2217] via-[#123524] to-[#0F172A] p-5 sm:p-6 text-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E7F7D4]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#86EFAC] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#86EFAC]" />
                    </span>
                    Gửi riêng tài khoản User
                  </span>

                  <AnimatePresence>
                    {personalUnreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="rounded-full bg-[#E7F7D4] px-2.5 py-0.5 tabular-nums text-[10px] font-bold text-[#0B2217]"
                      >
                        {personalUnreadCount} chưa đọc
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <h2 className="mt-2.5 text-lg font-semibold tracking-tight text-white">
                  Hộp tin Hệ thống Cá nhân
                </h2>
                <p className="mt-1 text-xs text-white/75 truncate">
                  {session
                    ? `${session.fullName} • ${session.email}`
                    : 'Thông báo cơ bản về vé QR, thanh toán & nhắc lịch của bạn'}
                </p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl bg-white/10 p-1 text-[11px] backdrop-blur-xs">
                    {[
                      { unread: false, label: `Tất cả (${personalNotifications.length})` },
                      { unread: true, label: `Chưa đọc (${personalUnreadCount})` },
                    ].map((tab) => {
                      const active = personalUnreadOnly === tab.unread;
                      return (
                        <button
                          key={tab.label}
                          type="button"
                          onClick={() => setPersonalUnreadOnly(tab.unread)}
                          className="relative rounded-lg px-3 py-1 font-semibold transition-colors"
                        >
                          {active && (
                            <motion.span
                              layoutId="personal-filter-pill"
                              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                              className="absolute inset-0 rounded-lg bg-white shadow-2xs"
                            />
                          )}
                          <span className={`relative z-10 ${active ? 'text-[#0F172A]' : 'text-white/80 hover:text-white'}`}>
                            {tab.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {personalUnreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllPersonalRead}
                      className="text-[11px] font-semibold text-[#E7F7D4] hover:underline"
                    >
                      Đọc hết
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                <AnimatePresence initial={false} mode="popLayout">
                  {visiblePersonalNotifications.map((notif, idx) => {
                    const isUnread = !personalReadIds.includes(notif.id);
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{
                          duration: 0.28,
                          delay: Math.min(idx * 0.03, 0.15),
                          ease: EXPO_EASE,
                        }}
                        onClick={() => markPersonalRead(notif.id)}
                        className={`p-4 sm:p-5 transition-colors cursor-pointer hover:bg-[#F8FAFC] ${
                          isUnread ? 'bg-[#F4F8F4]/60' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <PersonalNoticeIcon kind={notif.kind} />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-xs sm:text-[13px] font-semibold leading-snug text-[#0F172A]">
                                {notif.title}
                              </h3>
                              {isUnread && (
                                <span
                                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#16422C]"
                                  title="Chưa đọc"
                                />
                              )}
                            </div>

                            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                              {notif.body}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                              <span className="tabular-nums text-neutral-400">
                                {notif.timestampLabel}
                              </span>
                              {notif.actionLabel && onNavigate && notif.actionTargetPage && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markPersonalRead(notif.id);
                                    onNavigate(notif.actionTargetPage!);
                                  }}
                                  className="font-semibold text-[#16422C] hover:underline"
                                >
                                  {notif.actionLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {visiblePersonalNotifications.length === 0 && (
                  <div className="p-10 text-center text-xs text-neutral-500">
                    Bạn đã đọc hết mọi thông báo cá nhân từ hệ thống.
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-100 bg-[#F8FAFC] p-4 flex items-center justify-between gap-2 text-xs">
                {session ? (
                  <>
                    <span className="text-[11px] text-neutral-500 truncate">
                      Đồng bộ hóa đơn &amp; Vé QR tự động
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('checkout')}
                        className="shrink-0 font-semibold text-[#16422C] hover:underline"
                      >
                        Mở Vé của tôi →
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-neutral-500">
                      Đăng nhập để nhận thông báo cá nhân
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('login')}
                        className="shrink-0 rounded-lg bg-[#0F172A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1E293B]"
                      >
                        Đăng nhập
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
};
