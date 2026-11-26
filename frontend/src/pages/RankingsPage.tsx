import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppPageId, AuthSession } from '../types/marketplace';
import { TOP_LESSORS_RANKING, TOP_USERS_RANKING } from '../data/newsAndRankingsData';
import { EXPO_EASE, ScrollReveal } from '../components/motionPrimitives';
import { ActionButton } from '../components/FairwayControls';

interface RankingsPageProps {
  session: AuthSession | null;
  onNavigate?: (page: AppPageId) => void;
  onBrowseVenueCourts: (venueName: string) => void;
}

type LeaderboardTab = 'USERS' | 'LESSORS';
type PeriodFilter = 'WEEK' | 'MONTH' | 'ALL_TIME';

const PERIOD_MULTIPLIER: Record<PeriodFilter, number> = {
  WEEK: 0.28,
  MONTH: 1,
  ALL_TIME: 6.4,
};

const TIER_PILL: Record<'Diamond' | 'Platinum' | 'Gold', string> = {
  Diamond: 'bg-[#16422C] text-[#E7F7D4]',
  Platinum: 'bg-[#E6F1F8] text-[#0E4F7E] border border-[#0E4F7E]/20',
  Gold: 'bg-amber-50 text-amber-800 border border-amber-300/70',
};

interface PodiumCardDatum {
  id: string;
  rank: 1 | 2 | 3;
  badgeText: string;
  title: string;
  subtitleLeft: string;
  subtitleRight: string;
  initials: string;
  imageUrl?: string;
  metricLeftLabel: string;
  metricLeftValue: string;
  metricRightLabel: string;
  metricRightValue: string;
  progressLabel: string;
  progressPct: number;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

const RANK_STYLE: Record<
  1 | 2 | 3,
  {
    gradStart: string;
    gradMid: string;
    gradEnd: string;
    topAccentBar: string;
    badgeCls: string;
    plinthLabel: string;
    plinthCls: string;
    minHeightCls: string;
  }
> = {
  1: {
    gradStart: '#FDE68A',
    gradMid: '#F59E0B',
    gradEnd: '#92400E',
    topAccentBar: 'from-amber-300 via-[#E7F7D4] to-amber-300',
    badgeCls: 'bg-[#E7F7D4] text-[#0B2217]',
    plinthLabel: 'Quán quân #01 • Champion Tier',
    plinthCls: 'bg-black/25 text-[#E7F7D4] border-t border-white/10',
    minHeightCls: 'md:min-h-[378px]',
  },
  2: {
    gradStart: '#F8FAFC',
    gradMid: '#94A3B8',
    gradEnd: '#475569',
    topAccentBar: 'from-slate-300 via-slate-400 to-slate-200',
    badgeCls: 'bg-slate-100 text-slate-700 border border-slate-200',
    plinthLabel: 'Á quân #02 • Silver Tier',
    plinthCls: 'bg-slate-50 text-slate-600 border-t border-slate-200/80',
    minHeightCls: 'md:min-h-[338px]',
  },
  3: {
    gradStart: '#FED7AA',
    gradMid: '#EA580C',
    gradEnd: '#7C2D12',
    topAccentBar: 'from-orange-300 via-amber-500 to-orange-200',
    badgeCls: 'bg-orange-50 text-orange-800 border border-orange-200/80',
    plinthLabel: 'Hạng ba #03 • Bronze Tier',
    plinthCls: 'bg-orange-50/50 text-orange-800 border-t border-orange-200/60',
    minHeightCls: 'md:min-h-[316px]',
  },
};

const ChampionshipCrest: React.FC<{
  rank: 1 | 2 | 3;
  initials: string;
  imageUrl?: string;
}> = ({ rank, initials, imageUrl }) => {
  const palette = RANK_STYLE[rank];
  const gradId = `crest-metal-${rank}`;
  const isFirst = rank === 1;

  return (
    <motion.div
      animate={{ y: isFirst ? [0, -3, 0] : [0, -1.5, 0] }}
      transition={{ duration: isFirst ? 3.4 : 4.2, repeat: Infinity, ease: 'easeInOut' }}
      className="relative flex flex-col items-center select-none"
    >
      {/* Ambient Radial Halo for #1 */}
      {isFirst && (
        <div
          className="pointer-events-none absolute -inset-4 rounded-full bg-amber-300/15 blur-xl"
          aria-hidden="true"
        />
      )}

      <div className={`relative flex items-center justify-center ${isFirst ? 'h-22 w-22' : 'h-18 w-18'}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_10px_18px_rgba(15,23,42,0.18)]" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.gradStart} />
              <stop offset="52%" stopColor={palette.gradMid} />
              <stop offset="100%" stopColor={palette.gradEnd} />
            </linearGradient>
          </defs>
          {/* Outer Metallic Bezel Ring */}
          <circle cx="50" cy="48" r="40" fill="none" stroke={`url(#${gradId})`} strokeWidth="4.5" />
          {/* Precision Watch-Dial Ticks */}
          <circle
            cx="50"
            cy="48"
            r="34"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="1.2"
            strokeDasharray="2 4.5"
            opacity="0.85"
          />
          {/* Symmetrical Laurel Arcs */}
          <path
            d="M14 58 C10 42, 16 24, 30 14"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M86 58 C90 42, 84 24, 70 14"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>

        {/* Center Medallion Avatar / Venue Cover */}
        <div
          className={`absolute top-[16%] overflow-hidden rounded-full flex items-center justify-center font-bold tracking-tight shadow-inner ${
            isFirst
              ? 'h-13 w-13 bg-[#091911] text-[#E7F7D4] ring-2 ring-amber-300/70 text-sm'
              : 'h-11 w-11 bg-[#F8FAFC] text-[#0F172A] ring-2 ring-neutral-200 text-xs'
          }`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={initials} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Bottom Rank Ribbon */}
        <span
          className={`absolute -bottom-0.5 rounded-full px-2.5 py-0.5 tabular-nums text-[9.5px] font-extrabold tracking-wider shadow-xs ${
            isFirst
              ? 'bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 text-[#0B2217]'
              : rank === 2
                ? 'bg-slate-700 text-white'
                : 'bg-[#9A3412] text-white'
          }`}
        >
          #0{rank}
        </span>
      </div>
    </motion.div>
  );
};

const ChampionshipPodiumStage: React.FC<{
  eyebrow: string;
  heading: string;
  criterionLabel: string;
  items: PodiumCardDatum[];
}> = ({ eyebrow, heading, criterionLabel, items }) => (
  <div className="relative overflow-hidden rounded-[28px] border border-[#16422C]/15 bg-gradient-to-b from-[#EDF4EF] via-[#F7FAF8] to-white px-4 pt-7 pb-6 sm:px-7 shadow-xs">
    {/* Subtle Architectural Court Arc Watermark */}
    <svg
      viewBox="0 0 800 320"
      className="pointer-events-none absolute inset-x-0 top-0 h-full w-full opacity-[0.045]"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <circle cx="400" cy="360" r="240" fill="none" stroke="#16422C" strokeWidth="2" />
      <circle cx="400" cy="360" r="145" fill="none" stroke="#16422C" strokeWidth="1.5" strokeDasharray="6 6" />
      <line x1="0" y1="290" x2="800" y2="290" stroke="#16422C" strokeWidth="1.5" />
    </svg>

    {/* Stage Header */}
    <div className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#16422C]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{eyebrow}</span>
        </div>
        <h2 className="mt-0.5 text-lg sm:text-xl font-bold tracking-[-0.02em] text-[#0F172A]">
          {heading}
        </h2>
      </div>
      <span className="rounded-full border border-neutral-200/90 bg-white/90 px-3.5 py-1 text-[11px] font-medium text-neutral-600 shadow-2xs">
        {criterionLabel}
      </span>
    </div>

    {/* 3-Column Stepped Championship Stage (#2 - #1 - #3) */}
    <div className="relative z-10 mx-auto grid max-w-[780px] grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
      {items.map((item) => {
        const isFirst = item.rank === 1;
        const cfg = RANK_STYLE[item.rank];

        return (
          <motion.div
            key={item.id}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.22, ease: EXPO_EASE }}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-[22px] border transition-shadow ${
              cfg.minHeightCls
            } ${
              isFirst
                ? 'order-first md:order-none border-[#1E563B] bg-gradient-to-b from-[#0A1F15] via-[#113322] to-[#16422C] text-white shadow-[0_22px_50px_rgba(11,34,23,0.32)]'
                : 'border-neutral-200/95 bg-white text-[#0F172A] shadow-[0_10px_28px_rgba(15,23,42,0.05)]'
            }`}
          >
            {/* Top Metallic Edge Bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${cfg.topAccentBar}`} />

            <div className="flex flex-1 flex-col items-center px-4 pt-5 pb-4 text-center">
              <ChampionshipCrest
                rank={item.rank}
                initials={item.initials}
                imageUrl={item.imageUrl}
              />

              <span
                className={`mt-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badgeCls}`}
              >
                {item.badgeText}
              </span>

              <h3 className="mt-2.5 w-full truncate text-[15px] font-bold tracking-[-0.01em]">
                {item.title}
              </h3>

              {/* Clean Single-Line Subtitle — Never wraps awkwardly */}
              <div
                className={`mt-1 flex max-w-full items-center justify-center gap-1.5 text-[11px] ${
                  isFirst ? 'text-white/75' : 'text-neutral-500'
                }`}
              >
                <span className="truncate font-medium">{item.subtitleLeft}</span>
                <span aria-hidden="true">•</span>
                <span className="shrink-0">{item.subtitleRight}</span>
              </div>

              {/* Telemetry Segmented Metric Box */}
              <div
                className={`mt-4 grid w-full grid-cols-2 divide-x rounded-xl text-xs ${
                  isFirst
                    ? 'divide-white/10 bg-white/10 border border-white/10'
                    : 'divide-neutral-200/80 bg-[#F8FAFC] border border-neutral-200/70'
                }`}
              >
                <div className="py-2.5 px-2">
                  <div className={`text-[10px] ${isFirst ? 'text-white/65' : 'text-neutral-400'}`}>
                    {item.metricLeftLabel}
                  </div>
                  <div
                    className={`mt-0.5 tabular-nums text-[13.5px] font-extrabold ${
                      isFirst ? 'text-[#E7F7D4]' : 'text-[#16422C]'
                    }`}
                  >
                    {item.metricLeftValue}
                  </div>
                </div>
                <div className="py-2.5 px-2">
                  <div className={`text-[10px] ${isFirst ? 'text-white/65' : 'text-neutral-400'}`}>
                    {item.metricRightLabel}
                  </div>
                  <div className="mt-0.5 tabular-nums text-[13.5px] font-extrabold">
                    {item.metricRightValue}
                  </div>
                </div>
              </div>

              {/* Reliability / Discipline Progress Strip */}
              <div className="mt-3 w-full">
                <div
                  className={`flex items-center justify-between text-[10px] ${
                    isFirst ? 'text-white/70' : 'text-neutral-500'
                  }`}
                >
                  <span>{item.progressLabel}</span>
                  <span className="tabular-nums font-bold">{item.progressPct}%</span>
                </div>
                <div
                  className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${
                    isFirst ? 'bg-white/15' : 'bg-neutral-100'
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      isFirst
                        ? 'bg-gradient-to-r from-[#E7F7D4] to-amber-300'
                        : 'bg-gradient-to-r from-[#16422C] to-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, item.progressPct))}%` }}
                  />
                </div>
              </div>

              {item.ctaLabel && item.onCtaClick && (
                <button
                  type="button"
                  onClick={item.onCtaClick}
                  className={`mt-3.5 w-full rounded-full py-2 text-[11.5px] font-semibold transition-colors ${
                    isFirst
                      ? 'bg-[#E7F7D4] text-[#0B2217] hover:bg-white'
                      : 'bg-[#0F172A] text-white hover:bg-[#16422C]'
                  }`}
                >
                  {item.ctaLabel}
                </button>
              )}
            </div>

            {/* Stepped Pedestal Base Footer */}
            <div
              className={`px-3 py-2 text-center text-[9.5px] font-bold uppercase tracking-[0.14em] ${cfg.plinthCls}`}
            >
              {cfg.plinthLabel}
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);

export const RankingsPage: React.FC<RankingsPageProps> = ({
  session,
  onNavigate,
  onBrowseVenueCourts,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('USERS');
  const [period, setPeriod] = useState<PeriodFilter>('MONTH');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const scaledUsers = useMemo(() => {
    const mult = PERIOD_MULTIPLIER[period];
    const q = searchQuery.trim().toLowerCase();
    return TOP_USERS_RANKING.map((u) => ({
      ...u,
      totalHoursPlayed: Math.max(4, Math.round(u.totalHoursPlayed * mult)),
      confirmedBookings: Math.max(2, Math.round(u.confirmedBookings * mult)),
      points: Math.round(u.points * mult),
    })).filter((u) => {
      const matchCity = cityFilter === 'ALL' || u.city === cityFilter;
      const matchQ =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.favoriteSport.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q);
      return matchCity && matchQ;
    });
  }, [period, cityFilter, searchQuery]);

  const scaledLessors = useMemo(() => {
    const mult = PERIOD_MULTIPLIER[period];
    const q = searchQuery.trim().toLowerCase();
    return TOP_LESSORS_RANKING.map((l) => ({
      ...l,
      completedSessions: Math.max(45, Math.round(l.completedSessions * mult)),
    })).filter((l) => {
      const matchCity = cityFilter === 'ALL' || l.city === cityFilter;
      const matchQ =
        !q ||
        l.venueName.toLowerCase().includes(q) ||
        l.ownerEntity.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q);
      return matchCity && matchQ;
    });
  }, [period, cityFilter, searchQuery]);

  // Always anchor Podium to unfiltered top 3 for that period so podium stays visually balanced
  const podiumUsers = useMemo(() => {
    const mult = PERIOD_MULTIPLIER[period];
    const list = TOP_USERS_RANKING.map((u) => ({
      ...u,
      totalHoursPlayed: Math.max(4, Math.round(u.totalHoursPlayed * mult)),
      confirmedBookings: Math.max(2, Math.round(u.confirmedBookings * mult)),
      points: Math.round(u.points * mult),
    }));
    return [list[1], list[0], list[2]];
  }, [period]);

  const podiumLessors = useMemo(() => {
    const mult = PERIOD_MULTIPLIER[period];
    const list = TOP_LESSORS_RANKING.map((l) => ({
      ...l,
      completedSessions: Math.max(45, Math.round(l.completedSessions * mult)),
    }));
    return [list[1], list[0], list[2]];
  }, [period]);

  const guideItems =
    activeTab === 'USERS'
      ? [
          {
            title: 'Đặt lịch & Check-in QR đúng giờ',
            metric: '+150 pts / ca',
            desc: 'Hoàn tất quét QR một lần tại quầy để cộng điểm Arena và nâng tỷ lệ kỷ luật 100%.',
            tone: 'bg-[#F4F8F4] text-[#16422C] border-[#16422C]/20',
          },
          {
            title: 'Săn khung giờ thấp điểm tiết kiệm',
            metric: 'Ưu đãi 15–25%',
            desc: 'Tập luyện khung 09:00 – 15:30 các ngày trong tuần giúp tối ưu chi phí và tích điểm đều.',
            tone: 'bg-[#E6F1F8] text-[#0E4F7E] border-[#0E4F7E]/20',
          },
          {
            title: 'Đặc quyền Top 3 mỗi tháng',
            metric: 'Giải Masters',
            desc: 'Người chơi dẫn đầu bảng tháng nhận ưu đãi phí đặt cọc thấp và vé mời giải giao hữu.',
            tone: 'bg-amber-50 text-amber-800 border-amber-200',
          },
          {
            title: 'Bảo vệ hoàn cọc Ký quỹ hai chiều',
            metric: 'Hoàn 100%',
            desc: 'Thanh toán qua VNPAY, MoMo hoặc VietQR được bảo vệ hoàn tiền minh bạch khi sân mưa/bảo trì.',
            tone: 'bg-slate-50 text-slate-700 border-slate-200',
          },
        ]
      : [
          {
            title: 'Tối ưu lấp đầy bằng Yield Engine',
            metric: '85% – 91% lấp đầy',
            desc: 'Các cụm sân Top đầu tự động điều chỉnh giá giờ vắng để thu hút CLB và người chơi ban ngày.',
            tone: 'bg-[#F4F8F4] text-[#16422C] border-[#16422C]/20',
          },
          {
            title: 'Chuẩn hóa hồ sơ KYC 7 lớp pháp lý',
            metric: 'Huy hiệu Xác thực',
            desc: 'Hoàn tất CCCD, Mã số thuế Modulo-11, GPĐKKD và PCCC để nâng độ tin cậy và thứ hạng hiển thị.',
            tone: 'bg-[#E6F1F8] text-[#0E4F7E] border-[#0E4F7E]/20',
          },
          {
            title: 'Check-in QR & Sổ cái kế toán kép',
            metric: '< 2 giây / lượt',
            desc: 'Giảm 100% sai sót đối soát tại sân và đồng bộ doanh thu tự động theo từng phiên đặt.',
            tone: 'bg-amber-50 text-amber-800 border-amber-200',
          },
          {
            title: 'Chính sách hoàn cọc minh bạch',
            metric: '★ 4.90+ Rating',
            desc: 'Chủ động hoàn cọc 100% khi thời tiết bất khả kháng giúp giữ đánh giá cao từ cộng đồng.',
            tone: 'bg-slate-50 text-slate-700 border-slate-200',
          },
        ];

  return (
    <section id="rankings" className="relative overflow-hidden bg-[#F7F9F8] pt-24 pb-20 sm:pt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#16422C]/8 via-[#86EFAC]/12 to-[#0E4F7E]/8 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* UNIFIED ARENAPULSE HEADER CARD */}
        <ScrollReveal className="rounded-[30px] border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F8F4] border border-[#16422C]/20 px-3.5 py-1 text-xs font-semibold text-[#16422C]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Bảng Vàng Thành Tích &amp; Đối Tác ArenaPulse.vn
              </span>
              <h1 className="mt-3.5 text-3xl sm:text-[42px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0F172A]">
                Bảng Xếp Hạng Top User &amp; Chủ Sân
              </h1>
              <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-neutral-500">
                Vinh danh những người chơi có tỷ lệ check-in đúng giờ cao nhất cùng các đối tác cụm
                sân vận hành xuất sắc, minh bạch ký quỹ và độ lấp đầy vượt trội trên toàn hệ thống.
              </p>
            </div>

            {/* Period Filter */}
            <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1 text-xs self-start lg:self-auto">
              {[
                { id: 'WEEK' as PeriodFilter, label: 'Tuần này' },
                { id: 'MONTH' as PeriodFilter, label: 'Tháng 11/2026' },
                { id: 'ALL_TIME' as PeriodFilter, label: 'Toàn thời gian' },
              ].map((p) => {
                const active = period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className="relative rounded-lg px-3.5 py-1.5 font-semibold transition-colors"
                  >
                    {active && (
                      <motion.span
                        layoutId="rank-period-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-[#0F172A] shadow-2xs"
                      />
                    )}
                    <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience Switcher + City Pills */}
          <div className="mt-6 flex flex-col gap-4 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex flex-wrap gap-1.5 rounded-2xl bg-[#F1F5F9] p-1.5 self-start">
              {[
                { id: 'USERS' as LeaderboardTab, label: 'Top Người Chơi (User)' },
                { id: 'LESSORS' as LeaderboardTab, label: 'Top Người Cho Thuê (Chủ sân)' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="relative rounded-xl px-4 py-2 text-xs sm:text-[13px] font-semibold transition-colors"
                  >
                    {active && (
                      <motion.span
                        layoutId="rank-main-tab"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-[#16422C] shadow-xs"
                      />
                    )}
                    <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {['ALL', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng'].map((c) => {
                const active = cityFilter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCityFilter(c)}
                    className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                      active
                        ? 'bg-[#0F172A] text-white'
                        : 'border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {c === 'ALL' ? 'Toàn quốc' : c}
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* MAIN 2-COLUMN WORKSPACE MATCHING SYSTEM RHYTHM */}
        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* LEFT 8 COLS: ARCHITECTURAL DAYLIGHT PODIUM + RANKED LEADERBOARD */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'USERS' ? (
                <motion.div
                  key="panel-users"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  {/* STEPPED CHAMPIONSHIP PODIUM STAGE (#2 - #1 - #3) */}
                  <ChampionshipPodiumStage
                    eyebrow="Top 3 Dẫn Đầu Bảng Xếp Hạng"
                    heading="Vinh danh Người chơi Tích cực"
                    criterionLabel="Tính theo Điểm Arena & Đúng giờ QR"
                    items={podiumUsers.map((user) => {
                      const r = user.rank as 1 | 2 | 3;
                      const parts = user.fullName.trim().split(' ');
                      const initials =
                        parts.length >= 2
                          ? `${parts[parts.length - 2].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
                          : user.fullName.slice(0, 2).toUpperCase();
                      return {
                        id: user.userId,
                        rank: r,
                        badgeText: r === 1 ? 'Quán quân #1' : `Hạng #${r} • ${user.tierLabel}`,
                        title: user.fullName,
                        subtitleLeft: user.favoriteSport,
                        subtitleRight: user.city === 'TP. Hồ Chí Minh' ? 'TP.HCM' : user.city,
                        initials,
                        metricLeftLabel: 'Điểm Arena',
                        metricLeftValue: user.points.toLocaleString('vi-VN'),
                        metricRightLabel: 'Giờ sân',
                        metricRightValue: `${user.totalHoursPlayed}h`,
                        progressLabel: 'Đúng giờ Check-in QR',
                        progressPct: user.onTimeCheckInRate,
                      };
                    })}
                  />

                  {/* DETAILED LEADERBOARD LIST */}
                  <ScrollReveal className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">
                          Thứ hạng &amp; Thành viên nổi bật
                        </h3>
                        <p className="text-[11px] text-neutral-500">
                          Hiển thị tỷ lệ Check-in QR đúng giờ và tổng thời lượng ra sân
                        </p>
                      </div>
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm tên người chơi, bộ môn..."
                        className="w-full sm:w-56 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {scaledUsers.map((u, idx) => {
                        const initial = u.fullName.split(' ').slice(-1)[0].charAt(0);
                        const isTop3 = u.rank <= 3;
                        return (
                          <motion.div
                            key={u.userId}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.1 }}
                            transition={{ duration: 0.34, delay: Math.min(idx * 0.04, 0.2), ease: EXPO_EASE }}
                            className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#F8FAFC] ${
                              u.rank === 1 ? 'bg-[#F4F8F4]/70' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-[220px] flex-1">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg tabular-nums text-xs font-bold ${
                                  u.rank === 1
                                    ? 'bg-[#16422C] text-[#E7F7D4]'
                                    : isTop3
                                      ? 'bg-[#E7F7D4] text-[#16422C]'
                                      : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {u.rank}
                              </span>

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-xs font-bold text-white">
                                {initial}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[#0F172A] truncate">
                                    {u.fullName}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_PILL[u.tierLabel]}`}>
                                    {u.tierLabel}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-500">
                                  {u.favoriteSport} • {u.city} ({u.totalHoursPlayed}h / {u.confirmedBookings} ca)
                                </div>
                              </div>
                            </div>

                            {/* Visual On-Time Check-In Progress Bar */}
                            <div className="hidden sm:block w-40">
                              <div className="flex items-center justify-between text-[10.5px] text-neutral-500">
                                <span>Đúng giờ QR</span>
                                <span className="tabular-nums font-semibold text-[#16422C]">
                                  {u.onTimeCheckInRate}%
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                                <motion.div
                                  initial={{ width: 0 }}
                                  whileInView={{ width: `${u.onTimeCheckInRate}%` }}
                                  viewport={{ once: true, amount: 0.2 }}
                                  transition={{ duration: 0.7, ease: EXPO_EASE }}
                                  className="h-full rounded-full bg-gradient-to-r from-[#16422C] to-emerald-500"
                                />
                              </div>
                            </div>

                            <div className="rounded-xl bg-[#F4F8F4] border border-[#16422C]/15 px-3.5 py-1.5 text-right">
                              <div className="tabular-nums text-xs sm:text-sm font-bold text-[#16422C]">
                                {u.points.toLocaleString('vi-VN')} pts
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}

                      {scaledUsers.length === 0 && (
                        <div className="p-10 text-center text-xs text-neutral-500">
                          Không tìm thấy thành viên phù hợp với bộ lọc khu vực hiện tại.
                        </div>
                      )}
                    </div>
                  </ScrollReveal>
                </motion.div>
              ) : (
                <motion.div
                  key="panel-lessors"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: EXPO_EASE }}
                  className="space-y-6"
                >
                  {/* STEPPED CHAMPIONSHIP PODIUM FOR TOP LESSORS */}
                  <ChampionshipPodiumStage
                    eyebrow="Top 3 Đối Tác Vận Hành Xuất Sắc"
                    heading="Vinh danh Người cho thuê & Cụm sân Tiêu chuẩn"
                    criterionLabel="Xếp theo Đánh giá ★ & Độ lấp đầy"
                    items={podiumLessors.map((lessor) => ({
                      id: lessor.locationId,
                      rank: lessor.rank as 1 | 2 | 3,
                      badgeText: lessor.rank === 1 ? 'Cụm sân Số #1' : `Hạng #${lessor.rank}`,
                      title: lessor.venueName,
                      subtitleLeft: `${lessor.completedSessions.toLocaleString('vi-VN')} ca`,
                      subtitleRight: lessor.city === 'TP. Hồ Chí Minh' ? 'TP.HCM' : lessor.city,
                      initials: lessor.venueName.slice(0, 2).toUpperCase(),
                      imageUrl: lessor.coverImageUrl,
                      metricLeftLabel: 'Đánh giá',
                      metricLeftValue: `★ ${lessor.rating.toFixed(2)}`,
                      metricRightLabel: 'Lấp đầy',
                      metricRightValue: `${lessor.occupancyPct}%`,
                      progressLabel: 'Tỷ lệ lấp đầy vận hành',
                      progressPct: lessor.occupancyPct,
                      ctaLabel: 'Xem Gian hàng & Đặt sân →',
                      onCtaClick: () => onBrowseVenueCourts(lessor.venueName),
                    }))}
                  />

                  {/* DETAILED LESSORS LIST */}
                  <ScrollReveal className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">
                          Bảng xếp hạng Đối tác Cho thuê sân
                        </h3>
                        <p className="text-[11px] text-neutral-500">
                          Đã kiểm định KYC Pháp lý 7 tiêu chuẩn &amp; vận hành Check-in QR
                        </p>
                      </div>
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm cụm sân, pháp nhân chủ sân..."
                        className="w-full sm:w-56 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {scaledLessors.map((l, idx) => (
                        <motion.div
                          key={l.locationId}
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.1 }}
                          transition={{ duration: 0.34, delay: Math.min(idx * 0.04, 0.2), ease: EXPO_EASE }}
                          className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#F8FAFC] ${
                            l.rank === 1 ? 'bg-[#F4F8F4]/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg tabular-nums text-xs font-bold ${
                                l.rank === 1
                                  ? 'bg-[#16422C] text-[#E7F7D4]'
                                  : l.rank <= 3
                                    ? 'bg-[#E7F7D4] text-[#16422C]'
                                    : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {l.rank}
                            </span>

                            <img
                              src={l.coverImageUrl}
                              alt={l.venueName}
                              className="h-11 w-14 shrink-0 rounded-xl object-cover border border-neutral-200"
                            />

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[#0F172A] truncate">
                                  {l.venueName}
                                </span>
                                <span className="tabular-nums text-xs font-bold text-amber-700">
                                  ★ {l.rating.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-500 truncate">
                                {l.ownerEntity} • {l.city}
                              </div>
                            </div>
                          </div>

                          <div className="hidden sm:block w-36">
                            <div className="flex items-center justify-between text-[10.5px] text-neutral-500">
                              <span>Độ lấp đầy</span>
                              <span className="tabular-nums font-semibold text-[#16422C]">
                                {l.occupancyPct}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${l.occupancyPct}%` }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.7, ease: EXPO_EASE }}
                                className="h-full rounded-full bg-gradient-to-r from-[#16422C] to-emerald-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onBrowseVenueCourts(l.venueName)}
                            className="rounded-xl border border-[#16422C]/25 bg-[#F4F8F4] px-3.5 py-2 text-xs font-semibold text-[#16422C] hover:bg-[#16422C] hover:text-white transition-colors"
                          >
                            {l.completedSessions.toLocaleString('vi-VN')} ca • Đặt sân →
                          </button>
                        </motion.div>
                      ))}

                      {scaledLessors.length === 0 && (
                        <div className="p-10 text-center text-xs text-neutral-500">
                          Không tìm thấy cụm sân đối tác phù hợp với bộ lọc khu vực hiện tại.
                        </div>
                      )}
                    </div>
                  </ScrollReveal>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT 4 COLS (VERTICAL STICKY PANEL): PERSONAL STANDING & SYSTEM CRITERIA */}
          <ScrollReveal direction="right" delay={0.08} className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
            {/* Top Profile & Standing Card (Matches ArenaPulse Card Rhythm) */}
            <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
              <div className="bg-[#0F172A] p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E7F7D4] text-sm font-bold text-[#0B2217]">
                      {session ? session.fullName.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {session ? session.fullName : 'Tài khoản ArenaPulse'}
                      </div>
                      <div className="text-[11px] text-white/70 truncate">
                        {session ? session.email : 'Đăng nhập để theo dõi thứ hạng của bạn'}
                      </div>
                    </div>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(session ? 'checkout' : 'login')}
                      className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#E7F7D4] hover:bg-white/20"
                    >
                      {session ? 'Vé QR' : 'Đăng nhập'}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F172A]">
                    {activeTab === 'USERS' ? 'Tiêu chí Cộng điểm User' : 'Tiêu chí Vinh danh Chủ sân'}
                  </span>
                  <span className="text-[11px] text-[#16422C] font-semibold">Cập nhật Realtime</span>
                </div>

                <div className="space-y-2.5">
                  {guideItems.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-3.5 transition-colors hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-[#0F172A]">{item.title}</h3>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.tone}`}>
                          {item.metric}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {onNavigate && (
                  <ActionButton
                    variant="forest"
                    size="md"
                    fullWidth
                    onClick={() => onNavigate(activeTab === 'USERS' ? 'courts' : 'governance')}
                  >
                    {activeTab === 'USERS'
                      ? 'Đặt sân ngay để tích điểm Arena →'
                      : 'Đăng ký Đối tác Cho thuê sân →'}
                  </ActionButton>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
