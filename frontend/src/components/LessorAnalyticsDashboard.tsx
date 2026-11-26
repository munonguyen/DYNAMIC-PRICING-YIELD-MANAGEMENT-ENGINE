import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnalyticsDashboardData } from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import {
  AnimatedCounter,
  DASHBOARD_STAGGER_CONTAINER,
  DASHBOARD_STAGGER_ITEM,
  EXPO_EASE,
} from './motionPrimitives';

interface LessorAnalyticsDashboardProps {
  mode?: 'LESSOR' | 'PLATFORM';
  analytics: AnalyticsDashboardData;
  days: number;
  onChangeDays: (days: number) => void;
  onReindexEs?: () => Promise<void>;
  reindexing?: boolean;
  loading?: boolean;
}

const CHART_CARD_VIEWPORT = { once: true, amount: 0.16 } as const;

export const LessorAnalyticsDashboard: React.FC<LessorAnalyticsDashboardProps> = ({
  mode = 'LESSOR',
  analytics,
  days,
  onChangeDays,
  onReindexEs,
  reindexing = false,
  loading = false,
}) => {
  const isPlatform = mode === 'PLATFORM';
  const uid = useId().replace(/:/g, '');
  const dailySeries = analytics.dailyRevenue;
  const hourlySeries = analytics.hourlyOccupancy;
  const channelSegments = analytics.channelBreakdown;
  const courtPerf = analytics.courtPerformance;

  const [replayEpoch, setReplayEpoch] = useState(0);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number>(
    Math.max(0, dailySeries.length - 1)
  );
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number>(
    Math.max(0, Math.floor(hourlySeries.length / 2))
  );

  useEffect(() => {
    setHoveredDayIdx(Math.max(0, dailySeries.length - 1));
  }, [dailySeries.length]);

  useEffect(() => {
    setHoveredHourIdx(Math.max(0, Math.floor(hourlySeries.length / 2)));
  }, [hourlySeries.length]);

  const chartAnimKey = `${mode}-${days}-${dailySeries[0]?.dateIso ?? 'none'}-${analytics.indexedDocuments}-${replayEpoch}`;

  const maxDayTotal = Math.max(
    1,
    ...dailySeries.map((d) => d.courtRevenue + d.serviceRevenue)
  );

  const totalCourtRev = dailySeries.reduce((s, d) => s + d.courtRevenue, 0);
  const totalServiceRev = dailySeries.reduce((s, d) => s + d.serviceRevenue, 0);
  const activeDay =
    dailySeries[Math.min(hoveredDayIdx, Math.max(0, dailySeries.length - 1))] ?? null;
  const activeHour =
    hourlySeries[Math.min(hoveredHourIdx, Math.max(0, hourlySeries.length - 1))] ?? null;

  // SVG Geometry for Hourly Occupancy & Price Curve
  const chartW = 520;
  const chartH = 190;
  const padX = 28;
  const padTop = 20;
  const padBottom = 30;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padTop - padBottom;

  const hourCoords = hourlySeries.map((pt, idx) => {
    const x =
      hourlySeries.length <= 1
        ? padX + plotW / 2
        : padX + (idx / (hourlySeries.length - 1)) * plotW;
    const clampedOcc = Math.max(0, Math.min(100, pt.occupancyPct));
    const y = padTop + plotH - (clampedOcc / 100) * plotH;
    return { x, y, pt };
  });

  const linePath = hourCoords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    hourCoords.length >= 2
      ? `${linePath} L ${hourCoords[hourCoords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${hourCoords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const donutR = 46;
  const donutC = 2 * Math.PI * donutR;

  const sourceLabel =
    analytics.dataSource === 'ELASTICSEARCH_CQRS'
      ? 'Phân tích Thời gian thực'
      : analytics.dataSource === 'POSTGRESQL_DB'
        ? 'Dữ liệu Hệ thống Trực tiếp'
        : 'Dữ liệu Phiên làm việc';

  const sourceBadgeClass =
    analytics.dataSource === 'ELASTICSEARCH_CQRS'
      ? 'bg-[#E7F7D4] text-[#16422C] border-[#16422C]/25'
      : analytics.dataSource === 'POSTGRESQL_DB'
        ? 'bg-[#E6F1F8] text-[#0E4F7E] border-[#0E4F7E]/25'
        : 'bg-neutral-100 text-neutral-700 border-neutral-200';

  return (
    <motion.div
      variants={DASHBOARD_STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* SECTION HEADER + LIVE DB/ELASTICSEARCH TELEMETRY + PERIOD TOGGLE */}
      <motion.div
        variants={DASHBOARD_STAGGER_ITEM}
        className="flex flex-col gap-3 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10.5px] font-bold ${sourceBadgeClass}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {sourceLabel} • {analytics.queryLatencyMs}ms ({analytics.indexedDocuments} docs)
            </span>
            {loading && (
              <span className="text-[11px] font-medium text-neutral-400">
                Đang đồng bộ dữ liệu thực tế…
              </span>
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">
            {isPlatform
              ? 'Dashboard Phân tích Tăng trưởng, Ký quỹ & Hiệu suất Toàn Sàn'
              : 'Dashboard Doanh thu, Tỷ lệ Lấp đầy Ca & Kênh Thanh toán Thực tế'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setReplayEpoch((prev) => prev + 1)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-[#16422C] hover:text-[#16422C] transition cursor-pointer"
            title="Phát lại hiệu ứng xuất hiện toàn bộ biểu đồ"
          >
            ✦ Hiệu ứng
          </button>

          {onReindexEs && (
            <button
              type="button"
              disabled={reindexing}
              onClick={async () => {
                await onReindexEs();
                setReplayEpoch((prev) => prev + 1);
              }}
              className="rounded-full border border-neutral-200 bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#16422C] hover:bg-[#F4F8F4] disabled:opacity-60 transition cursor-pointer"
            >
              {reindexing ? 'Đang làm mới…' : '↻ Làm mới Dữ liệu Phân tích'}
            </button>
          )}

          <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-[#F8FAFC] p-1">
            {[7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onChangeDays(d);
                  setReplayEpoch((prev) => prev + 1);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  days === d
                    ? 'bg-[#16422C] text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-[#0F172A]'
                }`}
              >
                {d} ngày qua
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* CHARTS GRID ROW 1: STACKED REVENUE BAR + HOURLY OCCUPANCY CURVE */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* CHART 1: REAL REVENUE BAR CHART */}
        <motion.div
          key={`rev-card-${chartAnimKey}`}
          initial={{ opacity: 0, y: 24, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CHART_CARD_VIEWPORT}
          transition={{ duration: 0.62, ease: EXPO_EASE }}
          className="xl:col-span-7 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-neutral-500">
                Tổng doanh thu thực tế ({days} ngày qua)
              </div>
              <div className="mt-1 text-2xl sm:text-[28px] font-bold text-[#0F172A]">
                <AnimatedCounter value={analytics.grossRevenue} formatAsVnd />
              </div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={CHART_CARD_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.16, ease: EXPO_EASE }}
                className="mt-1 flex flex-wrap items-center gap-3 text-[11px]"
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#16422C]">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#16422C]" />
                  Tiền sân ({formatVnd(totalCourtRev)})
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#65A30D]">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#84CC16]" />
                  Nước &amp; Dịch vụ ({formatVnd(totalServiceRev)})
                </span>
              </motion.div>
            </div>

            <AnimatePresence mode="wait">
              {activeDay && (
                <motion.div
                  key={activeDay.dateIso}
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: EXPO_EASE }}
                  className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] px-3.5 py-2 text-right text-xs"
                >
                  <div className="font-bold text-[#16422C]">
                    {activeDay.fullDateLabel} • {activeDay.bookingsCount} ca đặt
                  </div>
                  <div className="mt-0.5 tabular-nums font-bold text-[#0F172A]">
                    {formatVnd(activeDay.courtRevenue + activeDay.serviceRevenue)}
                  </div>
                  <div className="text-[10.5px] text-neutral-500 tabular-nums">
                    Sân: {formatVnd(activeDay.courtRevenue)} + DV: {formatVnd(activeDay.serviceRevenue)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 relative">
            {/* Background reference horizontal gridlines */}
            <div className="pointer-events-none absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between">
              {[0, 1, 2].map((lineIdx) => (
                <motion.div
                  key={lineIdx}
                  initial={{ scaleX: 0, opacity: 0 }}
                  whileInView={{ scaleX: 1, opacity: 1 }}
                  viewport={CHART_CARD_VIEWPORT}
                  transition={{ duration: 0.55, delay: 0.08 + lineIdx * 0.06, ease: EXPO_EASE }}
                  style={{ transformOrigin: 'left' }}
                  className="w-full border-t border-dashed border-neutral-200/75"
                />
              ))}
            </div>

            <div className="relative flex h-48 items-end gap-1.5 sm:gap-2.5 border-b border-neutral-200/80 pb-2 pt-4">
              {dailySeries.map((day, idx) => {
                const total = day.courtRevenue + day.serviceRevenue;
                const totalPct =
                  total === 0 ? 4 : Math.max(12, Math.round((total / maxDayTotal) * 100));
                const serviceSharePct = total > 0 ? (day.serviceRevenue / total) * 100 : 0;
                const courtSharePct = 100 - serviceSharePct;
                const isSelected = idx === hoveredDayIdx;

                return (
                  <button
                    key={day.dateIso + idx}
                    type="button"
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onFocus={() => setHoveredDayIdx(idx)}
                    onClick={() => setHoveredDayIdx(idx)}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 focus:outline-none cursor-pointer"
                  >
                    <motion.div
                      initial={{ scaleY: 0, opacity: 0.15 }}
                      whileInView={{ scaleY: 1, opacity: 1 }}
                      whileHover={{ scaleY: 1.03 }}
                      viewport={CHART_CARD_VIEWPORT}
                      transition={{
                        duration: 0.78,
                        delay: 0.12 + Math.min(0.6, idx * 0.06),
                        ease: EXPO_EASE,
                      }}
                      style={{ height: `${totalPct}%`, transformOrigin: 'bottom' }}
                      className={`relative w-full max-w-[38px] overflow-hidden rounded-t-xl transition-shadow duration-200 flex flex-col justify-end ${
                        total === 0
                          ? 'bg-neutral-200/70'
                          : isSelected
                            ? 'ring-2 ring-[#16422C] ring-offset-2 shadow-sm'
                            : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {total > 0 && day.serviceRevenue > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scaleY: 0 }}
                          whileInView={{ opacity: 1, scaleY: 1 }}
                          viewport={CHART_CARD_VIEWPORT}
                          transition={{
                            duration: 0.45,
                            delay: 0.34 + Math.min(0.55, idx * 0.06),
                            ease: EXPO_EASE,
                          }}
                          style={{ height: `${serviceSharePct}%`, transformOrigin: 'bottom' }}
                          className="w-full bg-[#84CC16]"
                        />
                      )}
                      {total > 0 && (
                        <div
                          style={{ height: `${courtSharePct}%` }}
                          className={`w-full ${
                            isSelected ? 'bg-[#16422C]' : 'bg-[#1F5438]'
                          }`}
                        />
                      )}
                    </motion.div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 sm:gap-2.5 text-center">
              {dailySeries.map((day, idx) => (
                <motion.span
                  key={day.dateIso + '-lbl-' + idx}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={CHART_CARD_VIEWPORT}
                  transition={{
                    duration: 0.4,
                    delay: 0.18 + Math.min(0.55, idx * 0.045),
                    ease: EXPO_EASE,
                  }}
                  className={`flex-1 truncate text-[10px] font-semibold ${
                    idx === hoveredDayIdx ? 'text-[#16422C]' : 'text-neutral-400'
                  }`}
                >
                  {days <= 7 ? day.dayLabel : idx % 2 === 0 ? day.dayLabel : ''}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CHART 2: HOURLY OCCUPANCY & DYNAMIC PRICE CURVE */}
        <motion.div
          key={`occ-card-${chartAnimKey}`}
          initial={{ opacity: 0, y: 24, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CHART_CARD_VIEWPORT}
          transition={{ duration: 0.62, delay: 0.08, ease: EXPO_EASE }}
          className="xl:col-span-5 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-neutral-500">
                Công suất Lấp đầy &amp; Giá Động theo Khung giờ thực
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#0F172A]">
                  <AnimatedCounter value={analytics.avgOccupancyPct} suffix="%" />
                </span>
                <span className="text-xs font-semibold text-[#0E4F7E]">
                  công suất thực tế
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeHour && (
                <motion.div
                  key={activeHour.hourLabel}
                  initial={{ opacity: 0, scale: 0.94, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -4 }}
                  transition={{ duration: 0.22, ease: EXPO_EASE }}
                  className="rounded-xl bg-[#F4F8FB] border border-[#0E4F7E]/20 px-3 py-1.5 text-right text-[11px]"
                >
                  <div className="font-bold text-[#0E4F7E]">
                    {activeHour.hourLabel} • {activeHour.tier}
                  </div>
                  <div className="tabular-nums font-bold text-[#0F172A]">
                    {activeHour.occupancyPct}% lấp đầy • {formatVnd(activeHour.avgPrice)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {hourCoords.length === 0 ? (
            <div className="mt-6 flex h-44 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-[#F8FAFC] text-xs text-neutral-500">
              Chưa có khung giờ hoạt động nào được ghi nhận trong hệ thống.
            </div>
          ) : (
            <div className="mt-4 w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-48 overflow-visible"
                role="img"
                aria-label="Biểu đồ tỷ lệ lấp đầy sân theo khung giờ"
              >
                <defs>
                  <linearGradient id={`occAreaGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16422C" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#16422C" stopOpacity="0.02" />
                  </linearGradient>
                  <clipPath id={`occAreaClip-${uid}`}>
                    <motion.rect
                      x={0}
                      y={0}
                      height={chartH}
                      initial={{ width: 0 }}
                      whileInView={{ width: chartW }}
                      viewport={CHART_CARD_VIEWPORT}
                      transition={{ duration: 1.15, delay: 0.16, ease: EXPO_EASE }}
                    />
                  </clipPath>
                </defs>

                {[25, 50, 75, 100].map((pct, gIdx) => {
                  const y = padTop + plotH - (pct / 100) * plotH;
                  return (
                    <motion.g
                      key={pct}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={CHART_CARD_VIEWPORT}
                      transition={{ duration: 0.45, delay: 0.06 + gIdx * 0.06, ease: EXPO_EASE }}
                    >
                      <line
                        x1={padX}
                        x2={chartW - padX}
                        y1={y}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text x={0} y={y + 3} fontSize="10" fill="#94A3B8" fontWeight="600">
                        {pct}%
                      </text>
                    </motion.g>
                  );
                })}

                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#occAreaGrad-${uid})`}
                    clipPath={`url(#occAreaClip-${uid})`}
                  />
                )}

                {linePath && (
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="#16422C"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0.3 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={CHART_CARD_VIEWPORT}
                    transition={{ duration: 1.15, delay: 0.14, ease: EXPO_EASE }}
                  />
                )}

                {hourCoords.map(({ x, y, pt }, idx) => {
                  const active = idx === hoveredHourIdx;
                  const pointDelay =
                    0.18 + (idx / Math.max(1, hourCoords.length - 1)) * 0.92;
                  return (
                    <g
                      key={pt.hourLabel}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredHourIdx(idx)}
                      onClick={() => setHoveredHourIdx(idx)}
                    >
                      {(active || pt.tier === 'GIỜ VÀNG') && (
                        <motion.circle
                          cx={x}
                          cy={y}
                          r={active ? 11 : 9}
                          fill="none"
                          stroke={pt.tier === 'GIỜ VÀNG' ? '#84CC16' : '#0E4F7E'}
                          strokeWidth="1.5"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: [0.85, 1.45, 0.85], opacity: [0.65, 0, 0.65] }}
                          transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            delay: pointDelay,
                            ease: 'easeInOut',
                          }}
                        />
                      )}
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={active ? 7 : 4.5}
                        initial={{ scale: 0, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={CHART_CARD_VIEWPORT}
                        transition={{
                          delay: pointDelay,
                          duration: 0.38,
                          ease: EXPO_EASE,
                        }}
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
                      <motion.text
                        x={x}
                        y={chartH - 6}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight={active ? '700' : '600'}
                        fill={active ? '#16422C' : '#64748B'}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={CHART_CARD_VIEWPORT}
                        transition={{ delay: pointDelay, duration: 0.35 }}
                      >
                        {pt.hourLabel}
                      </motion.text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </motion.div>
      </div>

      {/* CHARTS GRID ROW 2: PAYMENT/SPORT DONUT + COURT PERFORMANCE */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* DONUT CHART */}
        <motion.div
          key={`donut-card-${chartAnimKey}`}
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CHART_CARD_VIEWPORT}
          transition={{ duration: 0.65, ease: EXPO_EASE }}
          className="lg:col-span-5 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs"
        >
          <h4 className="text-sm font-bold text-[#0F172A]">
            {isPlatform
              ? 'Cơ cấu Giá trị Giao dịch theo Bộ môn'
              : 'Tỷ trọng Kênh Thanh toán Khách đặt sân'}
          </h4>
          <p className="mt-0.5 text-xs text-neutral-500">
            Tính toán trực tiếp từ giao dịch thanh toán thực tế đã xác nhận.
          </p>

          {channelSegments.length === 0 ? (
            <div className="mt-5 flex h-32 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-[#F8FAFC] text-xs text-neutral-500">
              Chưa có giao dịch thanh toán phát sinh trong kỳ này.
            </div>
          ) : (
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
                    let accPct = 0;
                    return channelSegments.map((seg, idx) => {
                      const segLen = (seg.pct / 100) * donutC;
                      const startDeg = (accPct / 100) * 360;
                      accPct += seg.pct;
                      return (
                        <g key={seg.label} transform={`rotate(${startDeg.toFixed(2)} 60 60)`}>
                          <motion.circle
                            cx="60"
                            cy="60"
                            r={donutR}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="16"
                            strokeDasharray={donutC}
                            initial={{ strokeDashoffset: donutC, opacity: 0.35 }}
                            whileInView={{ strokeDashoffset: donutC - segLen, opacity: 1 }}
                            viewport={CHART_CARD_VIEWPORT}
                            transition={{
                              duration: 0.85,
                              delay: 0.16 + idx * 0.14,
                              ease: EXPO_EASE,
                            }}
                          />
                        </g>
                      );
                    });
                  })()}
                </svg>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={CHART_CARD_VIEWPORT}
                  transition={{ duration: 0.55, delay: 0.25, ease: EXPO_EASE }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-lg font-bold text-[#0F172A] tabular-nums">
                    <AnimatedCounter value={100} suffix="%" />
                  </span>
                  <span className="text-[10px] font-semibold text-neutral-500">Thực tế</span>
                </motion.div>
              </div>

              <div className="w-full flex-1 space-y-2.5 text-xs">
                {channelSegments.map((seg, idx) => (
                  <motion.div
                    key={seg.label}
                    initial={{ opacity: 0, x: 14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={CHART_CARD_VIEWPORT}
                    transition={{
                      duration: 0.5,
                      delay: 0.16 + idx * 0.1,
                      ease: EXPO_EASE,
                    }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-medium text-[#0F172A] truncate">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="tabular-nums font-bold text-[#0F172A] shrink-0">
                        {seg.pct}% ({formatVnd(seg.amount)})
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={CHART_CARD_VIEWPORT}
                        transition={{
                          duration: 0.8,
                          delay: 0.24 + idx * 0.12,
                          ease: EXPO_EASE,
                        }}
                        style={{
                          width: `${seg.pct}%`,
                          backgroundColor: seg.color,
                          transformOrigin: 'left',
                        }}
                        className="h-full rounded-full"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* COURT PERFORMANCE UTILIZATION */}
        <motion.div
          key={`perf-card-${chartAnimKey}`}
          initial={{ opacity: 0, y: 26, scale: 0.975 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={CHART_CARD_VIEWPORT}
          transition={{ duration: 0.65, delay: 0.1, ease: EXPO_EASE }}
          className="lg:col-span-7 rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">
                Hiệu suất Lấp đầy &amp; Doanh thu theo Cụm Sân ({courtPerf.length})
              </h4>
              <p className="mt-0.5 text-xs text-neutral-500">
                Tổng hợp từ dữ liệu đặt sân thực và số sân trống theo thời gian thực.
              </p>
            </div>
            <span className="rounded-full bg-[#F4F8F4] px-3 py-1 text-[11px] font-bold text-[#16422C] tabular-nums">
              <AnimatedCounter value={analytics.totalBookings} suffix=" lượt đặt" />
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {courtPerf.slice(0, 4).map((court, idx) => (
              <motion.div
                key={court.groupId}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={CHART_CARD_VIEWPORT}
                transition={{
                  duration: 0.5,
                  delay: 0.14 + idx * 0.1,
                  ease: EXPO_EASE,
                }}
                className="rounded-2xl border border-neutral-200/75 bg-[#F8FAFC] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-[#0F172A] truncate block">
                      {court.groupName}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {court.sportName} • Giá cơ sở {formatVnd(court.basePrice)} •{' '}
                      {court.bookingsCount} đơn • Doanh thu {formatVnd(court.totalRevenue)}
                    </span>
                  </div>
                  <span className="tabular-nums font-bold text-[#16422C]">
                    <AnimatedCounter value={court.occupancyPct} suffix="% lấp đầy" />
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200/80">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={CHART_CARD_VIEWPORT}
                    transition={{
                      duration: 0.9,
                      delay: 0.24 + idx * 0.12,
                      ease: EXPO_EASE,
                    }}
                    style={{
                      width: `${court.occupancyPct}%`,
                      transformOrigin: 'left',
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-[#16422C] to-[#84CC16]"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
