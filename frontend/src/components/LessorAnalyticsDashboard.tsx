import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  LessorBookingOrder,
  PublishedListing,
  VenueProviderInfo,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';

interface LessorAnalyticsDashboardProps {
  mode?: 'LESSOR' | 'PLATFORM';
  provider?: VenueProviderInfo;
  listings: PublishedListing[];
  orders?: LessorBookingOrder[];
}

interface DailyRevenuePoint {
  dayLabel: string;
  fullDateLabel: string;
  courtRevenue: number;
  serviceRevenue: number;
  bookingsCount: number;
  occupancyPct: number;
}

interface HourlyCurvePoint {
  hourLabel: string;
  occupancyPct: number;
  avgPrice: number;
  tier: 'THẤP ĐIỂM' | 'TIÊU CHUẨN' | 'GIỜ VÀNG';
}

function buildDailySeries(
  range: '7D' | '14D',
  listings: PublishedListing[],
  orders: LessorBookingOrder[],
  isPlatform: boolean
): DailyRevenuePoint[] {
  const days = range === '7D' ? 7 : 14;
  const avgBasePrice =
    listings.length > 0
      ? listings.reduce((sum, l) => sum + l.basePrice, 0) / listings.length
      : 210_000;
  const scaleFactor = isPlatform
    ? Math.max(4.5, listings.length * 0.72)
    : Math.max(1, listings.length * 0.65);

  const liveAddOnTotal = orders.reduce((s, o) => s + o.addOnTotal, 0);
  const liveCourtTotal = orders.reduce((s, o) => s + o.courtPrice, 0);

  const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const wavePattern = [0.76, 0.84, 0.89, 0.94, 1.08, 1.32, 1.24];
  const occPattern = [62, 68, 72, 76, 84, 93, 91];

  return Array.from({ length: days }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - idx));
    const isToday = idx === days - 1;
    const wave = wavePattern[d.getDay()];
    const rawCourt =
      Math.round((avgBasePrice * 18 * scaleFactor * wave) / 10_000) * 10_000 +
      (isToday ? liveCourtTotal : 0);
    const hasActiveServices =
      isPlatform ||
      listings.some((l) => (l.addOnServices ?? []).some((s) => s.enabled !== false));
    const rawService = hasActiveServices
      ? Math.round((rawCourt * (0.14 + (idx % 3) * 0.025)) / 5_000) * 5_000 +
        (isToday ? liveAddOnTotal : 0)
      : isToday
        ? liveAddOnTotal
        : 0;
    const bookingsCount = Math.round(14 * scaleFactor * wave) + (isToday ? orders.length : 0);

    return {
      dayLabel: isToday ? 'Hôm nay' : weekdayNames[d.getDay()],
      fullDateLabel: d.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
      courtRevenue: rawCourt,
      serviceRevenue: rawService,
      bookingsCount,
      occupancyPct: Math.min(98, occPattern[d.getDay()] + (isToday ? 2 : 0)),
    };
  });
}

function buildHourlyCurve(listings: PublishedListing[]): HourlyCurvePoint[] {
  const avgMin =
    listings.length > 0
      ? listings.reduce((s, l) => s + l.minPrice, 0) / listings.length
      : 140_000;
  const avgBase =
    listings.length > 0
      ? listings.reduce((s, l) => s + l.basePrice, 0) / listings.length
      : 210_000;
  const avgMax =
    listings.length > 0
      ? listings.reduce((s, l) => s + l.maxPrice, 0) / listings.length
      : 330_000;

  const template: { h: string; occ: number; tier: HourlyCurvePoint['tier']; mult: number }[] = [
    { h: '06h', occ: 46, tier: 'THẤP ĐIỂM', mult: 0.05 },
    { h: '08h', occ: 68, tier: 'THẤP ĐIỂM', mult: 0.25 },
    { h: '10h', occ: 54, tier: 'THẤP ĐIỂM', mult: 0.15 },
    { h: '14h', occ: 61, tier: 'TIÊU CHUẨN', mult: 0.5 },
    { h: '16h', occ: 79, tier: 'TIÊU CHUẨN', mult: 0.65 },
    { h: '18h', occ: 95, tier: 'GIỜ VÀNG', mult: 0.94 },
    { h: '20h', occ: 92, tier: 'GIỜ VÀNG', mult: 1.0 },
    { h: '22h', occ: 70, tier: 'TIÊU CHUẨN', mult: 0.58 },
  ];

  return template.map((slot) => {
    const price =
      slot.tier === 'THẤP ĐIỂM'
        ? avgMin + (avgBase - avgMin) * slot.mult
        : slot.tier === 'GIỜ VÀNG'
          ? avgBase + (avgMax - avgBase) * slot.mult
          : avgBase;
    return {
      hourLabel: slot.h,
      occupancyPct: slot.occ,
      avgPrice: Math.round(price / 5_000) * 5_000,
      tier: slot.tier,
    };
  });
}

export const LessorAnalyticsDashboard: React.FC<LessorAnalyticsDashboardProps> = ({
  mode = 'LESSOR',
  provider,
  listings,
  orders = [],
}) => {
  const isPlatform = mode === 'PLATFORM';
  const [range, setRange] = useState<'7D' | '14D'>('7D');
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number>(range === '7D' ? 6 : 13);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number>(5);

  const dailySeries = useMemo(
    () => buildDailySeries(range, listings, orders, isPlatform),
    [range, listings, orders, isPlatform]
  );

  const hourlySeries = useMemo(() => buildHourlyCurve(listings), [listings]);

  const maxDayTotal = useMemo(
    () =>
      Math.max(
        1,
        ...dailySeries.map((d) => d.courtRevenue + d.serviceRevenue)
      ),
    [dailySeries]
  );

  const totals = useMemo(() => {
    const totalCourt = dailySeries.reduce((s, d) => s + d.courtRevenue, 0);
    const totalService = dailySeries.reduce((s, d) => s + d.serviceRevenue, 0);
    const totalBookings = dailySeries.reduce((s, d) => s + d.bookingsCount, 0);
    const avgOcc = Math.round(
      dailySeries.reduce((s, d) => s + d.occupancyPct, 0) / Math.max(1, dailySeries.length)
    );
    return {
      totalGross: totalCourt + totalService,
      totalCourt,
      totalService,
      totalBookings,
      avgOcc,
    };
  }, [dailySeries]);

  const activeDay = dailySeries[Math.min(hoveredDayIdx, dailySeries.length - 1)] ?? dailySeries[0];
  const activeHour = hourlySeries[Math.min(hoveredHourIdx, hourlySeries.length - 1)] ?? hourlySeries[0];

  // SVG Geometry for Hourly Occupancy & Price Trend Chart
  const chartW = 520;
  const chartH = 190;
  const padX = 28;
  const padTop = 20;
  const padBottom = 30;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padTop - padBottom;

  const hourCoords = hourlySeries.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, hourlySeries.length - 1)) * plotW;
    const y = padTop + plotH - ((pt.occupancyPct - 20) / 85) * plotH;
    return { x, y, pt };
  });

  const linePath = hourCoords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    hourCoords.length > 0
      ? `${linePath} L ${hourCoords[hourCoords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${hourCoords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  // Donut Chart Breakdown (Payment Channels or Sport Distribution)
  const channelSegments = useMemo(() => {
    if (isPlatform) {
      const sportCounts = new Map<string, number>();
      listings.forEach((l) => {
        sportCounts.set(l.sportName, (sportCounts.get(l.sportName) ?? 0) + l.basePrice);
      });
      const palette = ['#16422C', '#0E4F7E', '#84CC16', '#F59E0B', '#64748B'];
      const entries = Array.from(sportCounts.entries());
      const sumAll = entries.reduce((s, [, v]) => s + v, 0) || 1;
      return entries.slice(0, 5).map(([label, val], idx) => ({
        label,
        pct: Math.round((val / sumAll) * 100),
        color: palette[idx % palette.length],
      }));
    }

    return [
      { label: 'VietQR Napas 247', pct: 44, color: '#16422C' },
      { label: 'VNPAY Ký quỹ', pct: 31, color: '#0E4F7E' },
      { label: 'Ví MoMo', pct: 18, color: '#84CC16' },
      { label: 'Thẻ Quốc tế 3DS', pct: 7, color: '#F59E0B' },
    ];
  }, [isPlatform, listings]);

  const donutR = 46;
  const donutC = 2 * Math.PI * donutR;

  return (
    <div className="space-y-5">
      {/* SECTION HEADER + PERIOD TOGGLE */}
      <div className="flex flex-col gap-3 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#16422C]">
            {isPlatform
              ? 'Phân tích Tăng trưởng & Doanh thu Toàn Sàn'
              : `Trung tâm Phân tích Hiệu suất • ${provider?.providerName ?? 'Chủ sân'}`}
          </span>
          <h3 className="mt-0.5 text-lg sm:text-xl font-bold text-[#0F172A]">
            Dashboard Biểu đồ Doanh thu, Lấp đầy Ca &amp; Kênh Thanh toán
          </h3>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-[#F8FAFC] p-1 self-start sm:self-auto">
          {(['7D', '14D'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r);
                setHoveredDayIdx(r === '7D' ? 6 : 13);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                range === r
                  ? 'bg-[#16422C] text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-[#0F172A]'
              }`}
            >
              {r === '7D' ? '7 ngày qua' : '14 ngày qua'}
            </button>
          ))}
        </div>
      </div>

      {/* CHARTS GRID ROW 1: STACKED REVENUE BAR + HOURLY OCCUPANCY AREA */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* CHART 1: REVENUE STACKED BAR CHART */}
        <div className="xl:col-span-7 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-neutral-500">
                Tổng doanh thu kỳ ({range === '7D' ? '7 ngày' : '14 ngày'})
              </div>
              <div className="mt-1 tabular-nums text-2xl sm:text-[26px] font-bold text-[#0F172A]">
                {formatVnd(totals.totalGross)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#16422C]">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#16422C]" />
                  Tiền sân ({formatVnd(totals.totalCourt)})
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#65A30D]">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#84CC16]" />
                  Nước &amp; Dịch vụ ({formatVnd(totals.totalService)})
                </span>
              </div>
            </div>

            {/* Active Hovered Day Readout */}
            {activeDay && (
              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] px-3.5 py-2 text-right text-xs">
                <div className="font-bold text-[#16422C]">
                  {activeDay.fullDateLabel} • {activeDay.bookingsCount} ca đặt
                </div>
                <div className="mt-0.5 tabular-nums font-bold text-[#0F172A]">
                  {formatVnd(activeDay.courtRevenue + activeDay.serviceRevenue)}
                </div>
                <div className="text-[10.5px] text-neutral-500 tabular-nums">
                  Sân: {formatVnd(activeDay.courtRevenue)} + DV: {formatVnd(activeDay.serviceRevenue)}
                </div>
              </div>
            )}
          </div>

          {/* Interactive SVG Stacked Columns */}
          <div className="mt-5">
            <div className="flex h-48 items-end gap-1.5 sm:gap-2.5 border-b border-neutral-200/80 pb-2 pt-4">
              {dailySeries.map((day, idx) => {
                const total = day.courtRevenue + day.serviceRevenue;
                const totalPct = Math.max(12, Math.round((total / maxDayTotal) * 100));
                const serviceSharePct = total > 0 ? (day.serviceRevenue / total) * 100 : 0;
                const courtSharePct = 100 - serviceSharePct;
                const isSelected = idx === hoveredDayIdx;

                return (
                  <button
                    key={day.fullDateLabel + idx}
                    type="button"
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onFocus={() => setHoveredDayIdx(idx)}
                    onClick={() => setHoveredDayIdx(idx)}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 focus:outline-none"
                  >
                    <div
                      className={`w-full max-w-[38px] overflow-hidden rounded-t-xl transition-all duration-300 flex flex-col justify-end ${
                        isSelected
                          ? 'ring-2 ring-[#16422C] ring-offset-2 shadow-sm'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ height: `${totalPct}%` }}
                    >
                      {day.serviceRevenue > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${serviceSharePct}%` }}
                          transition={{ duration: 0.45, ease: EXPO_EASE }}
                          className="w-full bg-[#84CC16]"
                        />
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${courtSharePct}%` }}
                        transition={{ duration: 0.45, ease: EXPO_EASE }}
                        className={`w-full ${
                          isSelected ? 'bg-[#16422C]' : 'bg-[#1F5438]'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 sm:gap-2.5 text-center">
              {dailySeries.map((day, idx) => (
                <span
                  key={day.fullDateLabel + '-lbl-' + idx}
                  className={`flex-1 truncate text-[10px] font-semibold ${
                    idx === hoveredDayIdx ? 'text-[#16422C]' : 'text-neutral-400'
                  }`}
                >
                  {range === '7D' ? day.dayLabel : idx % 2 === 0 ? day.dayLabel : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CHART 2: HOURLY OCCUPANCY & DYNAMIC PRICE CURVE */}
        <div className="xl:col-span-5 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-neutral-500">
                Biểu đồ Mật độ Lấp đầy &amp; Giá Động theo Khung giờ
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-bold text-[#0F172A]">
                  {totals.avgOcc}%
                </span>
                <span className="text-xs font-semibold text-[#0E4F7E]">
                  công suất trung bình
                </span>
              </div>
            </div>

            {activeHour && (
              <div className="rounded-xl bg-[#F4F8FB] border border-[#0E4F7E]/20 px-3 py-1.5 text-right text-[11px]">
                <div className="font-bold text-[#0E4F7E]">
                  {activeHour.hourLabel} • {activeHour.tier}
                </div>
                <div className="tabular-nums font-bold text-[#0F172A]">
                  {activeHour.occupancyPct}% lấp đầy • {formatVnd(activeHour.avgPrice)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-48 overflow-visible"
              role="img"
              aria-label="Biểu đồ tỷ lệ lấp đầy sân theo khung giờ"
            >
              <defs>
                <linearGradient id="occAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16422C" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#16422C" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[40, 65, 90].map((pct) => {
                const y = padTop + plotH - ((pct - 20) / 85) * plotH;
                return (
                  <g key={pct}>
                    <line
                      x1={padX}
                      x2={chartW - padX}
                      y1={y}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={0}
                      y={y + 3}
                      fontSize="10"
                      fill="#94A3B8"
                      fontWeight="600"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              {areaPath && <path d={areaPath} fill="url(#occAreaGrad)" />}

              {/* Smooth Trend Path */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#16422C"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Data Points */}
              {hourCoords.map(({ x, y, pt }, idx) => {
                const active = idx === hoveredHourIdx;
                return (
                  <g
                    key={pt.hourLabel}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredHourIdx(idx)}
                    onClick={() => setHoveredHourIdx(idx)}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 7 : 4.5}
                      fill={
                        pt.tier === 'GIỜ VÀNG'
                          ? '#84CC16'
                          : active
                            ? '#0E4F7E'
                            : '#FFFFFF'
                      }
                      stroke="#16422C"
                      strokeWidth={active ? 3 : 2}
                    />
                    <text
                      x={x}
                      y={chartH - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={active ? '700' : '600'}
                      fill={active ? '#16422C' : '#64748B'}
                    >
                      {pt.hourLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* CHARTS GRID ROW 2: PAYMENT GATEWAY DONUT + PER-COURT PERFORMANCE BARS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* DONUT CHART: PAYMENT / SPORT DISTRIBUTION */}
        <div className="lg:col-span-5 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <h4 className="text-sm font-bold text-[#0F172A]">
            {isPlatform
              ? 'Cơ cấu Giá trị Giao dịch theo Bộ môn'
              : 'Tỷ trọng Kênh Thanh toán Khách đặt sân'}
          </h4>
          <p className="mt-0.5 text-xs text-neutral-500">
            {isPlatform
              ? 'Phân bổ tỷ trọng niêm yết trên toàn bộ cụm sân đang mở.'
              : '100% tiền cọc được bảo vệ tự động qua sổ cái kế toán kép.'}
          </p>

          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={donutR}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="16"
                />
                {(() => {
                  let acc = 0;
                  return channelSegments.map((seg) => {
                    const segLen = (seg.pct / 100) * donutC;
                    const dashOffset = -acc;
                    acc += segLen;
                    return (
                      <circle
                        key={seg.label}
                        cx="60"
                        cy="60"
                        r={donutR}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="16"
                        strokeDasharray={`${segLen} ${donutC}`}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-[#0F172A] tabular-nums">100%</span>
                <span className="text-[10px] font-semibold text-neutral-500">Đối soát</span>
              </div>
            </div>

            <div className="w-full flex-1 space-y-2.5 text-xs">
              {channelSegments.map((seg) => (
                <div key={seg.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-medium text-[#0F172A]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.label}
                    </span>
                    <span className="tabular-nums font-bold text-[#0F172A]">{seg.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COURT PERFORMANCE UTILIZATION */}
        <div className="lg:col-span-7 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">
                Hiệu suất Lấp đầy &amp; Doanh thu theo Cụm Sân ({listings.length})
              </h4>
              <p className="mt-0.5 text-xs text-neutral-500">
                So sánh công suất khai thác ca giờ trống và số sản phẩm dịch vụ đi kèm đang bật.
              </p>
            </div>
            <span className="rounded-full bg-[#F4F8F4] px-3 py-1 text-[11px] font-bold text-[#16422C] tabular-nums">
              {totals.totalBookings} lượt đặt / kỳ
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {listings.slice(0, 4).map((court) => {
              const slots = court.upcomingSlots ?? [];
              const capSum = slots.reduce((s, sl) => s + sl.totalCapacity, 0) || 1;
              const availSum = slots.reduce((s, sl) => s + sl.availableCourts, 0);
              const occPct = Math.min(98, Math.max(24, Math.round(((capSum - availSum) / capSum) * 100)));
              const activeAddonCount = (court.addOnServices ?? []).filter(
                (s) => s.enabled !== false
              ).length;

              return (
                <div
                  key={court.groupId}
                  className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-[#0F172A] truncate block">
                        {court.groupName}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {court.sportName} • Giá cơ sở {formatVnd(court.basePrice)} •{' '}
                        {activeAddonCount} dịch vụ kèm
                      </span>
                    </div>
                    <span className="tabular-nums font-bold text-[#16422C]">
                      {occPct}% lấp đầy
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200/80">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${occPct}%` }}
                      transition={{ duration: 0.6, ease: EXPO_EASE }}
                      className="h-full rounded-full bg-gradient-to-r from-[#16422C] to-[#84CC16]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

