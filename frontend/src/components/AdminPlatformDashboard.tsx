import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Building2,
  Clock,
  CreditCard,
  Layers,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  AnalyticsDashboardData,
  PublishedListing,
  ReconciliationSummary,
} from '../types/marketplace';
import { ALL_LESSOR_PROVIDERS, formatVnd } from '../api/marketplaceApi';
import { AnimatedCounter, EXPO_EASE } from './motionPrimitives';

interface AdminPlatformDashboardProps {
  analytics: AnalyticsDashboardData;
  reconciliation: ReconciliationSummary | null;
  listings: PublishedListing[];
  days: number;
  onChangeDays: (days: number) => void;
  onSyncAll: () => Promise<void> | void;
  syncing?: boolean;
  totalProviders: number;
  publishedGroups: number;
  totalGroups: number;
  totalPhysicalCourts: number;
  totalAccounts?: number;
  activeAccounts?: number;
  pendingKycCount?: number;
  isLiveDb?: boolean;
  onJumpToTab?: (tab: 'USER_ACCOUNTS' | 'ADMIN_KYC' | 'LESSOR_INSPECTOR') => void;
}

const SPORT_PALETTE = ['#0E4F7E', '#0F766E', '#D97706', '#2563EB', '#6366F1', '#475569'];
const CARD_VIEWPORT = { once: true, amount: 0.14 } as const;

export const AdminPlatformDashboard: React.FC<AdminPlatformDashboardProps> = ({
  analytics,
  reconciliation,
  listings,
  days,
  onChangeDays,
  onSyncAll,
  syncing = false,
  totalProviders,
  publishedGroups,
  totalGroups,
  totalPhysicalCourts,
  totalAccounts = 0,
  activeAccounts = 0,
  pendingKycCount = 0,
  isLiveDb = false,
  onJumpToTab,
}) => {
  const dailySeries = analytics.dailyRevenue;
  const hourlySeries = analytics.hourlyOccupancy;
  const sportBreakdown = analytics.channelBreakdown;
  const courtPerf = analytics.courtPerformance;
  const recentOrders = analytics.recentOrders ?? [];

  const [replayEpoch, setReplayEpoch] = useState(0);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(
    Math.max(0, dailySeries.length - 1)
  );
  const [hoveredSparkIdx, setHoveredSparkIdx] = useState<number | null>(null);
  const [hoveredSportIdx, setHoveredSportIdx] = useState<number | null>(null);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const [hoveredCourtId, setHoveredCourtId] = useState<string | null>(null);
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');

  useEffect(() => {
    setSelectedDayIdx(Math.max(0, dailySeries.length - 1));
  }, [dailySeries.length]);

  const animKey = `${days}-${analytics.indexedDocuments}-${replayEpoch}`;

  const activeDayIdx = hoveredDayIdx ?? Math.min(selectedDayIdx, Math.max(0, dailySeries.length - 1));
  const activeDay = dailySeries[activeDayIdx] ?? null;

  const grossGmv = analytics.grossRevenue || reconciliation?.totalEscrowCredits || 0;
  const platformCommission =
    analytics.commissionAmount || reconciliation?.totalPlatformCommission || 0;
  const venuePayable =
    analytics.withdrawableBalance || reconciliation?.totalVenuePayable || 0;
  const customerRefunds = reconciliation?.totalCustomerRefunds ?? 0;

  const takeRatePct =
    grossGmv > 0 ? ((platformCommission / grossGmv) * 100).toFixed(1) : '10.0';

  const courtTotalRev = useMemo(
    () => dailySeries.reduce((s, d) => s + d.courtRevenue, 0),
    [dailySeries]
  );
  const serviceTotalRev = useMemo(
    () => dailySeries.reduce((s, d) => s + d.serviceRevenue, 0),
    [dailySeries]
  );
  const totalSeriesRev = Math.max(1, courtTotalRev + serviceTotalRev);
  const serviceSharePct = Math.round((serviceTotalRev / totalSeriesRev) * 100);
  const aovVnd =
    analytics.totalBookings > 0 ? Math.round(grossGmv / analytics.totalBookings) : 0;

  const avgDailyRev =
    dailySeries.length > 0 ? Math.round(totalSeriesRev / dailySeries.length) : 0;
  const peakDay = useMemo(() => {
    if (dailySeries.length === 0) return null;
    return dailySeries.reduce((best, cur) =>
      cur.courtRevenue + cur.serviceRevenue > best.courtRevenue + best.serviceRevenue
        ? cur
        : best
    );
  }, [dailySeries]);

  const momentumPct = useMemo(() => {
    if (dailySeries.length < 4) return 12.4;
    const mid = Math.floor(dailySeries.length / 2);
    const firstHalf = dailySeries
      .slice(0, mid)
      .reduce((s, d) => s + d.courtRevenue + d.serviceRevenue, 0);
    const secondHalf = dailySeries
      .slice(mid)
      .reduce((s, d) => s + d.courtRevenue + d.serviceRevenue, 0);
    if (firstHalf <= 0) return 0;
    return Number((((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1));
  }, [dailySeries]);

  const sparkDays = dailySeries.slice(-7);
  const hoveredSparkDay =
    hoveredSparkIdx !== null ? sparkDays[hoveredSparkIdx] ?? null : null;

  // Combo Chart Geometry
  const chartW = 680;
  const chartH = 240;
  const padLeft = 56;
  const padRight = 22;
  const padTop = 24;
  const padBottom = 34;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const maxDayRev = Math.max(
    1,
    ...dailySeries.map((d) => d.courtRevenue + d.serviceRevenue)
  );
  const maxBookings = Math.max(1, ...dailySeries.map((d) => d.bookingsCount));

  const dailyBars = useMemo(() => {
    const count = Math.max(1, dailySeries.length);
    const slotW = plotW / count;
    const barW = Math.min(30, Math.max(10, slotW * 0.54));
    return dailySeries.map((d, idx) => {
      const total = d.courtRevenue + d.serviceRevenue;
      const cx = padLeft + slotW * idx + slotW / 2;
      const totalH = (total / maxDayRev) * (plotH * 0.88);
      const courtH = total > 0 ? (d.courtRevenue / total) * totalH : 0;
      const serviceH = Math.max(0, totalH - courtH);
      const baseY = padTop + plotH;
      const bookY = padTop + plotH - (d.bookingsCount / maxBookings) * (plotH * 0.78);
      return {
        idx,
        day: d,
        total,
        cx,
        leftPct: (cx / chartW) * 100,
        topPct: (Math.min(courtYFrom(baseY, courtH, serviceH), bookY) / chartH) * 100,
        barW,
        baseY,
        courtY: baseY - courtH,
        courtH,
        serviceY: baseY - courtH - serviceH,
        serviceH,
        bookY,
      };
    });
  }, [dailySeries, maxDayRev, maxBookings, plotW, plotH]);

  function courtYFrom(baseY: number, courtH: number, serviceH: number): number {
    return baseY - courtH - serviceH;
  }

  const bookingsLinePath = useMemo(() => {
    if (dailyBars.length < 2) return '';
    return dailyBars
      .map((b, i) => `${i === 0 ? 'M' : 'L'} ${b.cx.toFixed(1)} ${b.bookY.toFixed(1)}`)
      .join(' ');
  }, [dailyBars]);

  const hoveredBarData = hoveredDayIdx !== null ? dailyBars[hoveredDayIdx] ?? null : null;

  // SVG Donut Geometry for Sport Breakdown
  const donutR = 54;
  const donutC = 2 * Math.PI * donutR;
  const donutSegments = useMemo(() => {
    const totalPct = Math.max(
      1,
      sportBreakdown.reduce((s, item) => s + item.pct, 0)
    );
    let cumulative = 0;
    return sportBreakdown.map((item, idx) => {
      const ratio = item.pct / totalPct;
      const dashLen = ratio * donutC;
      const offset = -cumulative * donutC;
      cumulative += ratio;
      return {
        ...item,
        idx,
        color: SPORT_PALETTE[idx % SPORT_PALETTE.length],
        dashArray: `${Math.max(0, dashLen - 2).toFixed(2)} ${donutC.toFixed(2)}`,
        dashOffset: offset.toFixed(2),
      };
    });
  }, [sportBreakdown, donutC]);

  const activeDonutItem =
    hoveredSportIdx !== null ? sportBreakdown[hoveredSportIdx] ?? null : null;

  // Radial Occupancy Ring
  const ringR = 24;
  const ringC = 2 * Math.PI * ringR;
  const occPct = Math.max(0, Math.min(100, analytics.avgOccupancyPct));
  const ringDashOffset = ringC - (occPct / 100) * ringC;

  // Hourly Chart helper
  const maxHourPrice = Math.max(1, ...hourlySeries.map((h) => h.avgPrice));
  const activeHour =
    hoveredHourIdx !== null
      ? hourlySeries[hoveredHourIdx] ?? null
      : hourlySeries.reduce(
          (best, cur) => (!best || cur.occupancyPct > best.occupancyPct ? cur : best),
          hourlySeries[0] ?? null
        );

  // Provider Market Share aggregation
  const providerRows = useMemo(() => {
    const revByGroupId = new Map<string, { rev: number; bookings: number }>();
    for (const c of courtPerf) {
      revByGroupId.set(c.groupId, { rev: c.totalRevenue, bookings: c.bookingsCount });
    }
    const map = new Map<
      string,
      {
        providerId: string;
        providerName: string;
        district: string;
        city: string;
        legalEntityType: string;
        commissionRatePct: number;
        groups: number;
        courts: number;
        bookings: number;
        revenue: number;
      }
    >();

    for (const p of ALL_LESSOR_PROVIDERS) {
      map.set(p.providerId, {
        providerId: p.providerId,
        providerName: p.providerName,
        district: p.district,
        city: p.city,
        legalEntityType: p.legalEntityType ?? 'Đối tác Sân',
        commissionRatePct: p.commissionRatePct,
        groups: 0,
        courts: 0,
        bookings: 0,
        revenue: 0,
      });
    }

    for (const l of listings) {
      const pid = l.provider?.providerId || 'unknown';
      const existing = map.get(pid) ?? {
        providerId: pid,
        providerName: l.provider?.providerName || l.venueName,
        district: l.provider?.district || '',
        city: l.provider?.city || '',
        legalEntityType: l.provider?.legalEntityType || 'Hộ / Doanh nghiệp',
        commissionRatePct: l.provider?.commissionRatePct ?? 10,
        groups: 0,
        courts: 0,
        bookings: 0,
        revenue: 0,
      };
      const perf = revByGroupId.get(l.groupId);
      existing.groups += 1;
      existing.courts += l.upcomingSlots[0]?.totalCapacity ?? 4;
      if (perf) {
        existing.bookings += perf.bookings;
        existing.revenue += perf.rev;
      } else {
        existing.revenue += l.basePrice * 12;
      }
      map.set(pid, existing);
    }

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRev = Math.max(
      1,
      list.reduce((s, r) => s + r.revenue, 0)
    );
    return list.map((r) => ({
      ...r,
      sharePct: Math.round((r.revenue / totalRev) * 100),
      estCommission: Math.round((r.revenue * r.commissionRatePct) / 100),
    }));
  }, [listings, courtPerf]);

  const sportFilters = useMemo(() => {
    const names = Array.from(new Set(courtPerf.map((c) => c.sportName)));
    return ['ALL', ...names];
  }, [courtPerf]);

  const filteredCourtPerf = useMemo(
    () =>
      courtPerf.filter(
        (c) => selectedSportFilter === 'ALL' || c.sportName === selectedSportFilter
      ),
    [courtPerf, selectedSportFilter]
  );

  const totalCourtPerfRev = useMemo(
    () => Math.max(1, courtPerf.reduce((s, c) => s + c.totalRevenue, 0)),
    [courtPerf]
  );

  return (
    <div key={animKey} className="space-y-5">
      {/* ================================================================= */}
      {/* TOP TELEMETRY & FILTER RIBBON                                     */}
      {/* ================================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={CARD_VIEWPORT}
        transition={{ duration: 0.45, ease: EXPO_EASE }}
        className="flex flex-col gap-3 rounded-[22px] border border-neutral-200/90 bg-white px-5 py-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1F8] px-3 py-1 font-bold text-[#0E4F7E]">
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveDb ? 'bg-emerald-500 animate-pulse' : 'bg-[#0E4F7E]'
              }`}
            />
            {analytics.dataSource === 'ELASTICSEARCH_CQRS'
              ? `Elasticsearch CQRS • ${analytics.queryLatencyMs}ms (${analytics.indexedDocuments} docs)`
              : isLiveDb
                ? 'PostgreSQL Live Data'
                : 'Dữ liệu Phiên đồng bộ'}
          </span>
          <span className="text-neutral-500">
            Toàn sàn:{' '}
            <strong className="text-[#0F172A]">{totalProviders} Đối tác</strong> •{' '}
            <strong className="text-[#0F172A]">
              {publishedGroups}/{totalGroups} cụm
            </strong>{' '}
            ({totalPhysicalCourts} sân)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReplayEpoch((prev) => prev + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-600 hover:border-[#0E4F7E] hover:text-[#0E4F7E] transition cursor-pointer"
            title="Phát lại hiệu ứng xuất hiện toàn bộ biểu đồ"
          >
            <Sparkles className="h-3 w-3" />
            Hiệu ứng
          </button>

          <div className="inline-flex items-center rounded-full border border-neutral-200 bg-[#F8FAFC] p-0.5 text-[11px]">
            {[7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onChangeDays(d);
                  setReplayEpoch((prev) => prev + 1);
                }}
                className={`rounded-full px-3 py-1 font-bold transition cursor-pointer ${
                  days === d
                    ? 'bg-[#0A192F] text-white shadow-xs'
                    : 'text-neutral-600 hover:text-[#0F172A]'
                }`}
              >
                {d} ngày qua
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={async () => {
              await onSyncAll();
              setReplayEpoch((prev) => prev + 1);
            }}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0E4F7E]/25 bg-[#F4F8FB] px-3.5 py-1.5 text-[11px] font-bold text-[#0E4F7E] hover:bg-[#E6F1F8] disabled:opacity-60 transition cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Đang đồng bộ…' : 'Đồng bộ Chỉ số'}
          </button>
        </div>
      </motion.div>

      {/* ================================================================= */}
      {/* ROW 1: 4 EXECUTIVE KPI CARDS (SCROLL REVEAL + HOVER TELEMETRY)    */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Gross GMV */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.5, delay: 0.04, ease: EXPO_EASE }}
          className="group relative flex flex-col justify-between rounded-[24px] bg-gradient-to-br from-[#0A192F] via-[#0D2E4D] to-[#0E4F7E] p-5 text-white shadow-[0_14px_34px_rgba(10,25,47,0.18)]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-medium text-sky-100/80">
              Tổng GMV ({days} ngày)
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                momentumPct >= 0
                  ? 'bg-emerald-400/20 text-emerald-200'
                  : 'bg-rose-400/20 text-rose-200'
              }`}
            >
              {momentumPct >= 0 ? `+${momentumPct}%` : `${momentumPct}%`}
            </span>
          </div>

          <div className="my-2.5 text-2xl font-bold tracking-tight tabular-nums">
            <AnimatedCounter value={grossGmv} formatAsVnd />
          </div>

          <div className="space-y-1.5 text-[10.5px] text-sky-100/85">
            <div className="flex items-center justify-between">
              <span>{analytics.totalBookings} ca đặt hợp lệ</span>
              <span className="font-semibold text-white">TB {formatVnd(aovVnd)}/đơn</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15 flex">
              <div
                className="h-full bg-sky-300"
                style={{ width: `${100 - serviceSharePct}%` }}
              />
              <div
                className="h-full bg-teal-300"
                style={{ width: `${serviceSharePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-sky-100/75 opacity-80 group-hover:opacity-100 transition">
              <span>Sân: {100 - serviceSharePct}%</span>
              <span>Dịch vụ: {serviceSharePct}%</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Commission & Interactive Sparkline */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.5, delay: 0.1, ease: EXPO_EASE }}
          className="relative flex flex-col justify-between rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-neutral-500">
                Hoa hồng Nền tảng Thu về
              </span>
              <div className="mt-1 text-2xl font-bold text-[#0F766E] tabular-nums">
                <AnimatedCounter value={platformCommission} formatAsVnd />
              </div>
            </div>
            <span className="rounded-lg bg-teal-50 px-2 py-1 text-[10.5px] font-bold text-[#0F766E] tabular-nums">
              {takeRatePct}% take
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-2">
            <div className="text-[11px] text-neutral-500 leading-snug">
              {hoveredSparkDay ? (
                <span className="font-semibold text-[#0F766E] tabular-nums">
                  {hoveredSparkDay.dayLabel}:{' '}
                  {formatVnd(
                    Math.round(
                      ((hoveredSparkDay.courtRevenue + hoveredSparkDay.serviceRevenue) *
                        Number(takeRatePct)) /
                        100
                    )
                  )}
                </span>
              ) : (
                <span>Rê vào từng cột xem ngày</span>
              )}
            </div>
            <div className="flex items-end gap-1 h-8">
              {sparkDays.map((d, i) => {
                const v = d.courtRevenue + d.serviceRevenue;
                const pct = Math.max(18, Math.round((v / maxDayRev) * 100));
                const active = hoveredSparkIdx === i;
                return (
                  <button
                    key={d.dateIso + i}
                    type="button"
                    onMouseEnter={() => setHoveredSparkIdx(i)}
                    onMouseLeave={() => setHoveredSparkIdx(null)}
                    style={{ height: `${pct}%` }}
                    className={`w-2 rounded-full transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0A192F] scale-y-110'
                        : i === sparkDays.length - 1
                          ? 'bg-[#0F766E]'
                          : 'bg-[#0F766E]/35 hover:bg-[#0F766E]/75'
                    }`}
                    aria-label={`${d.dayLabel}: ${formatVnd(v)}`}
                  />
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Card 3: Escrow & Settlement Ledger */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.5, delay: 0.16, ease: EXPO_EASE }}
          className="flex flex-col justify-between rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-neutral-500">
                Công nợ Tất toán Chủ sân
              </span>
              <div className="mt-1 text-2xl font-bold text-[#0E4F7E] tabular-nums">
                <AnimatedCounter value={venuePayable} formatAsVnd />
              </div>
            </div>
            <span className="rounded-lg bg-sky-50 px-2 py-1 text-[10.5px] font-bold text-[#0E4F7E]">
              {reconciliation?.doubleEntryBalanced ? 'Nợ = Có' : 'Sổ cái'}
            </span>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-neutral-500">
              <span>Ký quỹ đang giữ</span>
              <span className="font-bold text-[#0F172A] tabular-nums">
                {formatVnd(analytics.escrowHeld)}
              </span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Hoàn hủy / Điều chỉnh</span>
              <span className="font-semibold text-rose-600 tabular-nums">
                {formatVnd(customerRefunds)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 4: Occupancy Gauge & Active Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.5, delay: 0.22, ease: EXPO_EASE }}
          className="flex items-center justify-between gap-3 rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-neutral-500">
              Lấp đầy Trung bình Sàn
            </span>
            <div className="text-2xl font-bold text-[#0F172A] tabular-nums">
              <AnimatedCounter value={occPct} suffix="%" />
            </div>
            <div className="text-[11px] text-neutral-500">
              <strong className="text-[#0E4F7E]">{analytics.pendingCheckins}</strong> đơn chờ
              check-in
            </div>
            <div className="text-[10.5px] text-amber-700 font-semibold">
              {hourlySeries.filter((h) => h.tier === 'GIỜ VÀNG').length} khung giờ vàng
            </div>
          </div>

          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={ringR}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="6"
              />
              <motion.circle
                cx="32"
                cy="32"
                r={ringR}
                fill="none"
                stroke="#0E4F7E"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ringC}
                initial={{ strokeDashoffset: ringC }}
                whileInView={{ strokeDashoffset: ringDashOffset }}
                viewport={CARD_VIEWPORT}
                transition={{ duration: 0.9, ease: EXPO_EASE }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#0F172A] tabular-nums">
              {occPct}%
            </span>
          </div>
        </motion.div>
      </div>

      {/* ================================================================= */}
      {/* ROW 2: COMBO REVENUE+BOOKINGS CHART (8) + SPORT DONUT CHART (4)   */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Stacked Daily Revenue + Bookings Trend Overlay + Floating Hover Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, ease: EXPO_EASE }}
          className="xl:col-span-8 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#0E4F7E]">
                <BarChart3 className="h-4 w-4" />
                <span>Biểu đồ Kết hợp: Tiền Sân, Dịch vụ Đi kèm &amp; Số ca đặt</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                Rê chuột trực tiếp lên cột để hiện thông tin chi tiết ngay tại điểm đang xem.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {activeDay && (
                <motion.div
                  key={activeDay.dateIso}
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: EXPO_EASE }}
                  className="rounded-2xl border border-[#0E4F7E]/20 bg-[#F4F8FB] px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-4 font-bold text-[#0E4F7E]">
                    <span>{activeDay.fullDateLabel}</span>
                    <span>{activeDay.bookingsCount} ca đặt</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                    <span className="text-[#0F172A]">
                      Sân: <strong>{formatVnd(activeDay.courtRevenue)}</strong>
                    </span>
                    <span className="text-[#0F766E]">
                      Dịch vụ: <strong>{formatVnd(activeDay.serviceRevenue)}</strong>
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#0E4F7E]" />
              Tiền thuê sân
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#0F766E]" />
              Dịch vụ &amp; Vợt/Nước
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#D97706]" />
              Đường số ca đặt
            </span>
          </div>

          <div
            className="relative w-full overflow-x-auto pt-4"
            onMouseLeave={() => setHoveredDayIdx(null)}
          >
            {/* Floating Rich Tooltip Above Hovered Column */}
            <AnimatePresence>
              {hoveredBarData && (
                <motion.div
                  key={`tip-${hoveredBarData.day.dateIso}`}
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: EXPO_EASE }}
                  style={{
                    left: `${Math.min(82, Math.max(18, hoveredBarData.leftPct))}%`,
                    top: '4px',
                  }}
                  className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-2xl border border-white/15 bg-[#0A192F]/95 px-3.5 py-2.5 text-[11px] text-white shadow-[0_14px_30px_rgba(10,25,47,0.32)] backdrop-blur-md min-w-[205px]"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5 font-bold text-sky-200">
                    <span>{hoveredBarData.day.fullDateLabel}</span>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">
                      {hoveredBarData.day.bookingsCount} ca đặt
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1 tabular-nums">
                    <div className="flex justify-between gap-4">
                      <span className="text-white/70">Tổng GMV:</span>
                      <strong className="text-white">{formatVnd(hoveredBarData.total)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-sky-200/80">Tiền thuê sân:</span>
                      <span>{formatVnd(hoveredBarData.day.courtRevenue)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-teal-300/90">Dịch vụ đi kèm:</span>
                      <span>{formatVnd(hoveredBarData.day.serviceRevenue)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-white/10 pt-1 text-[10px] text-white/75">
                      <span>TB / ca đặt:</span>
                      <span>
                        {hoveredBarData.day.bookingsCount > 0
                          ? formatVnd(
                              Math.round(hoveredBarData.total / hoveredBarData.day.bookingsCount)
                            )
                          : '—'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[460px] h-56 overflow-visible"
              role="img"
              aria-label="Biểu đồ cột chồng doanh thu sân, dịch vụ và đường số lượt đặt"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padTop + plotH - ratio * (plotH * 0.88);
                const valM = Math.round((maxDayRev * ratio) / 1_000_000);
                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft}
                      x2={chartW - padRight}
                      y1={y}
                      y2={y}
                      stroke={ratio === 0 ? '#CBD5E1' : '#E2E8F0'}
                      strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#64748B"
                    >
                      {ratio === 0 ? '0đ' : `${valM}M`}
                    </text>
                  </g>
                );
              })}

              {dailyBars.map((b) => {
                const isSel = b.idx === activeDayIdx;
                return (
                  <g
                    key={b.day.dateIso + b.idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDayIdx(b.idx)}
                    onClick={() => {
                      setSelectedDayIdx(b.idx);
                      setHoveredDayIdx(b.idx);
                    }}
                  >
                    {isSel && (
                      <rect
                        x={b.cx - b.barW / 2 - 5}
                        y={padTop}
                        width={b.barW + 10}
                        height={plotH}
                        rx="8"
                        fill="#E6F1F8"
                        opacity="0.6"
                      />
                    )}
                    <motion.rect
                      x={b.cx - b.barW / 2}
                      y={b.courtY}
                      width={b.barW}
                      height={Math.max(2, b.courtH)}
                      rx={b.serviceH <= 1 ? '4' : '0'}
                      fill="#0E4F7E"
                      opacity={isSel ? 1 : 0.85}
                      style={{ transformOrigin: `${b.cx}px ${b.baseY}px` }}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={CARD_VIEWPORT}
                      transition={{
                        duration: 0.65,
                        delay: 0.08 + Math.min(0.45, b.idx * 0.05),
                        ease: EXPO_EASE,
                      }}
                    />
                    {b.serviceH > 0 && (
                      <motion.rect
                        x={b.cx - b.barW / 2}
                        y={b.serviceY}
                        width={b.barW}
                        height={b.serviceH}
                        rx="4"
                        fill="#0F766E"
                        opacity={isSel ? 1 : 0.88}
                        style={{ transformOrigin: `${b.cx}px ${b.courtY}px` }}
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={CARD_VIEWPORT}
                        transition={{
                          duration: 0.45,
                          delay: 0.25 + Math.min(0.45, b.idx * 0.05),
                          ease: EXPO_EASE,
                        }}
                      />
                    )}
                    <text
                      x={b.cx}
                      y={chartH - 10}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={isSel ? '700' : '600'}
                      fill={isSel ? '#0E4F7E' : '#64748B'}
                    >
                      {days <= 7 || b.idx % 2 === 0 ? b.day.dayLabel : ''}
                    </text>
                  </g>
                );
              })}

              {bookingsLinePath && (
                <motion.path
                  d={bookingsLinePath}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={CARD_VIEWPORT}
                  transition={{ duration: 0.9, delay: 0.15, ease: EXPO_EASE }}
                />
              )}

              {dailyBars.map((b) => {
                const isSel = b.idx === activeDayIdx;
                return (
                  <g
                    key={`bk-${b.day.dateIso}-${b.idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDayIdx(b.idx)}
                  >
                    <circle
                      cx={b.cx}
                      cy={b.bookY}
                      r={isSel ? 5.5 : 3.5}
                      fill={isSel ? '#D97706' : '#FFFFFF'}
                      stroke="#D97706"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-neutral-100 pt-3.5 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
              <div className="text-[10.5px] text-neutral-500">Trung bình / ngày</div>
              <div className="font-bold text-[#0F172A] tabular-nums">{formatVnd(avgDailyRev)}</div>
            </div>
            <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
              <div className="text-[10.5px] text-neutral-500">
                Ngày đỉnh ({peakDay?.dayLabel ?? '—'})
              </div>
              <div className="font-bold text-[#0E4F7E] tabular-nums">
                {peakDay ? formatVnd(peakDay.courtRevenue + peakDay.serviceRevenue) : '—'}
              </div>
            </div>
            <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
              <div className="text-[10.5px] text-neutral-500">Tỷ trọng Dịch vụ</div>
              <div className="font-bold text-[#0F766E] tabular-nums">{serviceSharePct}% GMV</div>
            </div>
            <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
              <div className="text-[10.5px] text-neutral-500">Giá trị TB / đơn</div>
              <div className="font-bold text-[#0F172A] tabular-nums">{formatVnd(aovVnd)}</div>
            </div>
          </div>
        </motion.div>

        {/* Interactive Multi-Segment Sport Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, delay: 0.1, ease: EXPO_EASE }}
          className="xl:col-span-4 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              <PieChart className="h-3.5 w-3.5" />
              Cơ cấu Bộ môn Thể thao
            </span>
            <h4 className="mt-0.5 text-base font-bold text-[#0F172A]">
              Tỷ trọng GMV Theo Lĩnh vực
            </h4>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Rê chuột vào biểu đồ tròn hoặc từng môn để soi chi tiết.
            </p>
          </div>

          {sportBreakdown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#F8FAFC] p-5 text-xs text-neutral-500">
              Chưa có dữ liệu bộ môn trong kỳ này.
            </div>
          ) : (
            <>
              <div className="relative mx-auto h-44 w-44">
                <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                  {donutSegments.map((seg) => {
                    const active = hoveredSportIdx === seg.idx;
                    return (
                      <motion.circle
                        key={seg.label}
                        cx="70"
                        cy="70"
                        r={donutR}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={active ? 19 : 14}
                        strokeDashoffset={seg.dashOffset}
                        initial={{ strokeDasharray: `0 ${donutC.toFixed(2)}` }}
                        whileInView={{ strokeDasharray: seg.dashArray }}
                        viewport={CARD_VIEWPORT}
                        transition={{
                          duration: 0.78,
                          delay: 0.14 + seg.idx * 0.08,
                          ease: EXPO_EASE,
                        }}
                        className="cursor-pointer transition-[stroke-width] duration-200"
                        onMouseEnter={() => setHoveredSportIdx(seg.idx)}
                        onMouseLeave={() => setHoveredSportIdx(null)}
                      />
                    );
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {activeDonutItem ? activeDonutItem.label : 'Tổng GMV'}
                  </span>
                  <span className="text-sm font-bold text-[#0F172A] tabular-nums">
                    {activeDonutItem ? `${activeDonutItem.pct}%` : formatVnd(grossGmv)}
                  </span>
                  {activeDonutItem && (
                    <span className="mt-0.5 text-[10px] font-bold text-[#0E4F7E] tabular-nums">
                      {formatVnd(activeDonutItem.amount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {donutSegments.map((seg) => {
                  const active = hoveredSportIdx === seg.idx;
                  const estComm = Math.round((seg.amount * Number(takeRatePct)) / 100);
                  return (
                    <div
                      key={seg.label}
                      onMouseEnter={() => setHoveredSportIdx(seg.idx)}
                      onMouseLeave={() => setHoveredSportIdx(null)}
                      className={`rounded-xl px-2.5 py-2 text-xs transition cursor-pointer ${
                        active
                          ? 'bg-[#0A192F] text-white shadow-xs'
                          : 'hover:bg-[#F4F8FB] text-[#0F172A]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-semibold truncate">{seg.label}</span>
                        </div>
                        <span
                          className={`tabular-nums font-bold shrink-0 ${
                            active ? 'text-sky-200' : 'text-[#0E4F7E]'
                          }`}
                        >
                          {seg.pct}% • {formatVnd(seg.amount)}
                        </span>
                      </div>
                      {active && (
                        <div className="mt-1 flex items-center justify-between text-[10.5px] text-sky-100/80 border-t border-white/10 pt-1">
                          <span>Hoa hồng sàn ước tính ({takeRatePct}%):</span>
                          <strong className="text-emerald-300 tabular-nums">
                            {formatVnd(estComm)}
                          </strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ================================================================= */}
      {/* ROW 3: HOURLY OCCUPANCY + PRICING CHART (6) & PROVIDER SHARE (6)  */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Vertical Bar Chart with Floating Per-Hour Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, ease: EXPO_EASE }}
          className="xl:col-span-6 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                <Clock className="h-4 w-4 text-[#0E4F7E]" />
                <span>Biểu đồ Công suất &amp; Giá Động theo Khung giờ</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                Rê vào từng khung giờ để xem giá động, tỷ lệ lấp đầy và phân tầng giờ.
              </p>
            </div>

            {activeHour && (
              <div className="rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-1.5 text-right text-[11px]">
                <div className="font-bold text-[#0F172A]">
                  {activeHour.hourLabel} • {activeHour.occupancyPct}% lấp đầy
                </div>
                <div className="text-[#0E4F7E] font-semibold tabular-nums">
                  {formatVnd(activeHour.avgPrice)} ({activeHour.tier})
                </div>
              </div>
            )}
          </div>

          {hourlySeries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#F8FAFC] p-5 text-xs text-neutral-500">
              Chưa ghi nhận khung giờ đặt sân trong kỳ.
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="relative flex items-end gap-2 h-48 pt-6 px-1"
                onMouseLeave={() => setHoveredHourIdx(null)}
              >
                {hourlySeries.map((pt, idx) => {
                  const isPeak = pt.tier === 'GIỜ VÀNG';
                  const isLow = pt.tier === 'THẤP ĐIỂM';
                  const isSelected = hoveredHourIdx === idx;
                  const barHeightPct = Math.max(12, Math.min(100, pt.occupancyPct));
                  const priceRatio = Math.round((pt.avgPrice / maxHourPrice) * 100);
                  return (
                    <div
                      key={pt.hourLabel}
                      onMouseEnter={() => setHoveredHourIdx(idx)}
                      onClick={() => setHoveredHourIdx(idx)}
                      className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                    >
                      {/* Floating tooltip directly above hovered hour column */}
                      {isSelected && (
                        <div className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-white/15 bg-[#0A192F]/95 px-2.5 py-1.5 text-[10.5px] text-white shadow-lg">
                          <div className="font-bold text-sky-200">
                            {pt.hourLabel} • {pt.tier}
                          </div>
                          <div className="tabular-nums">
                            Lấp đầy: <strong>{pt.occupancyPct}%</strong>
                          </div>
                          <div className="tabular-nums text-emerald-300">
                            Giá TB: <strong>{formatVnd(pt.avgPrice)}</strong>
                          </div>
                        </div>
                      )}

                      <span className="text-[9.5px] font-bold tabular-nums text-neutral-600 mb-1">
                        {pt.occupancyPct}%
                      </span>
                      <div className="relative w-full flex-1 flex items-end justify-center rounded-xl bg-slate-100/75 overflow-hidden">
                        <motion.div
                          initial={{ scaleY: 0, opacity: 0.25 }}
                          whileInView={{ scaleY: 1, opacity: 1 }}
                          viewport={CARD_VIEWPORT}
                          transition={{
                            duration: 0.65,
                            delay: 0.08 + idx * 0.05,
                            ease: EXPO_EASE,
                          }}
                          style={{ height: `${barHeightPct}%`, transformOrigin: 'bottom' }}
                          className={`w-full rounded-t-xl transition-colors duration-200 ${
                            isPeak
                              ? isSelected
                                ? 'bg-amber-600'
                                : 'bg-amber-500/90 group-hover:bg-amber-600'
                              : isLow
                                ? isSelected
                                  ? 'bg-slate-600'
                                  : 'bg-slate-400/80 group-hover:bg-slate-500'
                                : isSelected
                                  ? 'bg-[#0A192F]'
                                  : 'bg-[#0E4F7E]/90 group-hover:bg-[#0A192F]'
                          }`}
                        />
                        <span
                          style={{ bottom: `${Math.max(8, Math.min(92, priceRatio))}%` }}
                          className="absolute h-2 w-2 rounded-full border border-white bg-[#0F766E] shadow-xs"
                        />
                      </div>
                      <span className="mt-1.5 text-[10px] font-semibold text-neutral-600 tabular-nums">
                        {pt.hourLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-neutral-500 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Giờ vàng
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#0E4F7E]" />
                  Tiêu chuẩn
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
                  Thấp điểm
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#0F766E]" />
                  Mốc giá động
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Top Partners / Provider Market Share with Hover Detail Expand */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, delay: 0.08, ease: EXPO_EASE }}
          className="xl:col-span-6 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                <Building2 className="h-4 w-4" />
                <span>Xếp hạng Thị phần Đối tác Cho thuê ({providerRows.length})</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                Rê vào từng đối tác để xem khu vực, pháp nhân KYC &amp; hoa hồng sàn thu về.
              </p>
            </div>
            {onJumpToTab && (
              <button
                type="button"
                onClick={() => onJumpToTab('LESSOR_INSPECTOR')}
                className="rounded-xl bg-[#F4F8FB] px-3 py-1.5 text-[11px] font-bold text-[#0E4F7E] hover:bg-[#E6F1F8] transition cursor-pointer shrink-0"
              >
                Soi chi tiết →
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {providerRows.slice(0, 6).map((prov, idx) => {
              const hovered = hoveredProviderId === prov.providerId;
              return (
                <div
                  key={prov.providerId}
                  onMouseEnter={() => setHoveredProviderId(prov.providerId)}
                  onMouseLeave={() => setHoveredProviderId(null)}
                  className={`rounded-2xl border p-3 text-xs transition cursor-pointer ${
                    hovered
                      ? 'border-[#0E4F7E]/35 bg-[#F4F8FB] shadow-xs'
                      : 'border-transparent hover:border-neutral-200 hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                          idx === 0
                            ? 'bg-[#0A192F] text-white'
                            : idx === 1
                              ? 'bg-[#0E4F7E] text-white'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#0F172A] truncate">
                          {prov.providerName}
                        </div>
                        <div className="text-[10.5px] text-neutral-500">
                          {prov.groups} cụm • {prov.courts} sân • Phí sàn {prov.commissionRatePct}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-bold text-[#0F172A]">{formatVnd(prov.revenue)}</div>
                      <div className="text-[10.5px] font-semibold text-[#0E4F7E]">
                        {prov.sharePct}% thị phần
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={CARD_VIEWPORT}
                      transition={{
                        duration: 0.72,
                        delay: 0.1 + idx * 0.06,
                        ease: EXPO_EASE,
                      }}
                      className="h-full rounded-full bg-gradient-to-r from-[#0E4F7E] to-[#0F766E]"
                      style={{
                        width: `${Math.max(6, prov.sharePct)}%`,
                        transformOrigin: 'left',
                      }}
                    />
                  </div>
                  {hovered && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#0E4F7E]/15 pt-1.5 text-[10.5px] text-[#0E4F7E]">
                      <span>
                        Khu vực: <strong>{[prov.district, prov.city].filter(Boolean).join(', ')}</strong> •{' '}
                        {prov.legalEntityType}
                      </span>
                      <span className="font-bold text-[#0F766E] tabular-nums">
                        Hoa hồng dự thu: {formatVnd(prov.estCommission)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ================================================================= */}
      {/* ROW 4: COURT PERFORMANCE TABLE (8) + GOVERNANCE & ORDERS PULSE (4) */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Detailed Court Performance Table with Hover Row Detail Strip */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, ease: EXPO_EASE }}
          className="xl:col-span-8 overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs"
        >
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">
                Chi tiết Hiệu suất Cụm Sân ({filteredCourtPerf.length})
              </h4>
              <p className="text-[11px] text-neutral-500">
                Rê vào từng dòng để xem tỷ trọng đóng góp &amp; doanh thu bình quân mỗi ca.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sportFilters.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSelectedSportFilter(sp)}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition cursor-pointer ${
                    selectedSportFilter === sp
                      ? 'bg-[#0E4F7E] text-white'
                      : 'bg-[#F8FAFC] text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {sp === 'ALL' ? 'Tất cả' : sp}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[10.5px] uppercase text-neutral-500 border-b border-neutral-100">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Cụm Sân</th>
                  <th className="px-3 py-2.5 font-semibold">Bộ môn</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Giá gốc</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Lượt đặt</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Doanh thu</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Lấp đầy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredCourtPerf.slice(0, 7).map((court) => {
                  const rowHovered = hoveredCourtId === court.groupId;
                  const share = Math.round((court.totalRevenue / totalCourtPerfRev) * 100);
                  const avgPerBooking =
                    court.bookingsCount > 0
                      ? Math.round(court.totalRevenue / court.bookingsCount)
                      : court.basePrice;
                  return (
                    <React.Fragment key={court.groupId}>
                      <tr
                        onMouseEnter={() => setHoveredCourtId(court.groupId)}
                        onMouseLeave={() => setHoveredCourtId(null)}
                        className={`transition cursor-pointer ${
                          rowHovered ? 'bg-[#F4F8FB]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="px-5 py-3 font-semibold text-[#0F172A] max-w-[200px] truncate">
                          {court.groupName}
                        </td>
                        <td className="px-3 py-3 text-neutral-600">{court.sportName}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-neutral-600">
                          {formatVnd(court.basePrice)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-neutral-700 font-medium">
                          {court.bookingsCount}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-[#0F172A]">
                          {formatVnd(court.totalRevenue)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="hidden sm:block h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#0E4F7E]"
                                style={{ width: `${Math.min(100, court.occupancyPct)}%` }}
                              />
                            </div>
                            <span className="inline-flex rounded-full bg-[#E6F1F8] px-2 py-0.5 tabular-nums text-[10.5px] font-bold text-[#0E4F7E]">
                              {court.occupancyPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                      {rowHovered && (
                        <tr className="bg-[#0A192F] text-white text-[11px]">
                          <td colSpan={6} className="px-5 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="text-sky-200">
                                Tỷ trọng toàn sàn: <strong>{share}%</strong> • Bình quân:{' '}
                                <strong>{formatVnd(avgPerBooking)}/ca</strong>
                              </span>
                              <span className="text-emerald-300 font-semibold tabular-nums">
                                Hoa hồng sàn ước tính ({takeRatePct}%):{' '}
                                {formatVnd(Math.round((court.totalRevenue * Number(takeRatePct)) / 100))}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Governance Pulse + Recent Platform Orders */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CARD_VIEWPORT}
          transition={{ duration: 0.62, delay: 0.1, ease: EXPO_EASE }}
          className="xl:col-span-4 rounded-[26px] border border-neutral-200/90 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                <Activity className="h-4 w-4 text-[#0F766E]" />
                <span>Nhịp Vận hành Toàn Sàn</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onJumpToTab?.('USER_ACCOUNTS')}
                className="rounded-2xl border border-[#0E4F7E]/20 bg-[#F4F8FB] p-3 text-left hover:bg-[#E6F1F8] transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0E4F7E]">
                  <Users className="h-3.5 w-3.5" />
                  Tài khoản
                </div>
                <div className="mt-1 text-base font-bold text-[#0F172A] tabular-nums">
                  {activeAccounts}/{totalAccounts}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onJumpToTab?.('ADMIN_KYC')}
                className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-left hover:bg-amber-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  KYC chờ duyệt
                </div>
                <div className="mt-1 text-base font-bold text-amber-900 tabular-nums">
                  {pendingKycCount} hồ sơ
                </div>
              </button>
            </div>

            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Đơn phát sinh Gần nhất
                </span>
                <span>Trạng thái</span>
              </div>

              {recentOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-[#F8FAFC] p-3 text-[11px] text-neutral-500">
                  Đang đồng bộ danh sách đơn gần nhất từ các cụm sân.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 text-xs">
                  {recentOrders.slice(0, 4).map((ord) => (
                    <div key={ord.orderId} className="flex items-center justify-between py-2 gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0F172A] truncate">
                          {ord.groupName} • {ord.unitNumber}
                        </div>
                        <div className="text-[10.5px] text-neutral-500 truncate">
                          {ord.customerName} • {ord.slotLabel}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-[#0E4F7E] tabular-nums">
                          {formatVnd(ord.courtPrice + ord.addOnTotal)}
                        </div>
                        <span className="text-[10px] font-semibold text-[#0F766E]">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-[11px] text-neutral-600 border border-neutral-200/60">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#0E4F7E]" />
              Số liệu đồng bộ toàn bộ Cổng
            </span>
            <span className="font-bold text-[#0F766E]">✓ Real-time</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
