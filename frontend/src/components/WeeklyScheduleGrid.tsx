import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import type { LessorBookingOrder, PublishedListing } from '../types/marketplace';
import { PillSelect } from './FairwayControls';

export interface WeeklyFixedBlock {
  id: string;
  dateIso: string;
  hour: number;
  groupId: string;
  groupName: string;
  unitNumber: string;
  title: string;
  kind: 'RECURRING_CLIENT' | 'MAINTENANCE';
}

interface WeeklyScheduleGridProps {
  listings: PublishedListing[];
  providerOrders: LessorBookingOrder[];
  fixedBlocks: WeeklyFixedBlock[];
  onAddFixedBlock: (block: WeeklyFixedBlock) => void;
  onRemoveFixedBlock: (blockId: string) => void;
  onOpenOrderDetail: (orderId: string) => void;
}

const WEEKDAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
const TIMETABLE_HOURS = Array.from({ length: 16 }, (_, idx) => 6 + idx); // 06:00 -> 21:00 (16 ca)

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDdMm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatFullDate(d: Date): string {
  return `${formatShortDdMm(d)}/${d.getFullYear()}`;
}

function getMondayOfWeek(refDate: Date, weekOffset: number): Date {
  const copy = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const jsDay = copy.getDay(); // 0=Sun, 1=Mon..6=Sat
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + diffToMonday + weekOffset * 7);
  return copy;
}

function resolveOrderHour(order: LessorBookingOrder): number {
  if (typeof order.slotHour === 'number' && order.slotHour >= 6 && order.slotHour <= 21) {
    return order.slotHour;
  }
  const match = order.slotLabel.match(/(\d{1,2}):\d{2}/);
  if (match) {
    const parsed = Number(match[1]);
    if (parsed >= 6 && parsed <= 21) return parsed;
  }
  return 8;
}

function resolveOrderDateIso(order: LessorBookingOrder, todayIso: string): string {
  if (order.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(order.dateIso)) {
    return order.dateIso;
  }
  if (order.slotLabel.toLowerCase().includes('hôm nay')) {
    return todayIso;
  }
  return todayIso;
}

export const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  listings,
  providerOrders,
  fixedBlocks,
  onAddFixedBlock,
  onRemoveFixedBlock,
  onOpenOrderDetail,
}) => {
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [showConfirmed, setShowConfirmed] = useState<boolean>(true);
  const [showFixed, setShowFixed] = useState<boolean>(true);
  const [showConflictOnly, setShowConflictOnly] = useState<boolean>(false);

  const [draftCell, setDraftCell] = useState<{ dateIso: string; dayLabel: string; hour: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('Lịch tập cố định CLB');
  const [draftUnit, setDraftUnit] = useState<string>('Sân 01');
  const [draftKind, setDraftKind] = useState<'RECURRING_CLIENT' | 'MAINTENANCE'>('RECURRING_CLIENT');

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toLocalIso(today), [today]);

  const weekOptions = useMemo(() => {
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const mon = getMondayOfWeek(today, offset);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const tag = offset === 0 ? 'Tuần này' : offset < 0 ? `Tuần trước (${Math.abs(offset)})` : `Tuần tới (+${offset})`;
      return {
        value: String(offset),
        label: `${tag} [${formatFullDate(mon)} → ${formatFullDate(sun)}]`,
      };
    });
  }, [today]);

  const weekDays = useMemo(() => {
    const mon = getMondayOfWeek(today, weekOffset);
    return WEEKDAY_NAMES.map((dayName, idx) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + idx);
      const iso = toLocalIso(d);
      return {
        dayName,
        shortDate: formatShortDdMm(d),
        iso,
        isToday: iso === todayIso,
      };
    });
  }, [today, weekOffset, todayIso]);

  const availableUnits = useMemo(() => {
    const maxCap = listings.reduce(
      (max, l) => Math.max(max, l.upcomingSlots[0]?.totalCapacity ?? 4),
      4
    );
    return Array.from({ length: Math.min(12, Math.max(4, maxCap)) }, (_, i) => `Sân ${String(i + 1).padStart(2, '0')}`);
  }, [listings]);

  // Index orders + fixed blocks by `${dateIso}__${hour}`
  const cellIndex = useMemo(() => {
    const map = new Map<
      string,
      { orders: LessorBookingOrder[]; blocks: WeeklyFixedBlock[]; hasCollision: boolean }
    >();

    const ensureEntry = (key: string) => {
      let existing = map.get(key);
      if (!existing) {
        existing = { orders: [], blocks: [], hasCollision: false };
        map.set(key, existing);
      }
      return existing;
    };

    for (const order of providerOrders) {
      if (order.status === 'NO_SHOW' || order.status === 'CANCELLED') continue;
      if (order.status === 'COMPLETED' && !showCompleted) continue;
      if (order.status === 'CONFIRMED' && !showConfirmed) continue;
      if (groupFilter !== 'ALL' && order.groupId !== groupFilter) continue;
      if (unitFilter !== 'ALL' && !order.unitNumber.includes(unitFilter.replace('Sân ', ''))) continue;

      const dIso = resolveOrderDateIso(order, todayIso);
      const hr = resolveOrderHour(order);
      const entry = ensureEntry(`${dIso}__${hr}`);
      entry.orders.push(order);
    }

    if (showFixed) {
      for (const blk of fixedBlocks) {
        if (groupFilter !== 'ALL' && blk.groupId !== groupFilter) continue;
        if (unitFilter !== 'ALL' && blk.unitNumber !== unitFilter) continue;
        const entry = ensureEntry(`${blk.dateIso}__${blk.hour}`);
        entry.blocks.push(blk);
      }
    }

    for (const entry of map.values()) {
      const seenUnit = new Set<string>();
      for (const o of entry.orders) {
        const key = `${o.groupId}__${o.unitNumber}`;
        if (seenUnit.has(key)) entry.hasCollision = true;
        seenUnit.add(key);
      }
      for (const b of entry.blocks) {
        const key = `${b.groupId}__${b.unitNumber}`;
        if (seenUnit.has(key)) entry.hasCollision = true;
        seenUnit.add(key);
      }
    }

    return map;
  }, [
    providerOrders,
    fixedBlocks,
    showCompleted,
    showConfirmed,
    showFixed,
    groupFilter,
    unitFilter,
    todayIso,
  ]);

  const weekSummary = useMemo(() => {
    let totalOrders = 0;
    let completed = 0;
    let confirmed = 0;
    let fixed = 0;
    let collisions = 0;
    for (const day of weekDays) {
      for (const hr of TIMETABLE_HOURS) {
        const cell = cellIndex.get(`${day.iso}__${hr}`);
        if (!cell) continue;
        totalOrders += cell.orders.length;
        completed += cell.orders.filter((o) => o.status === 'COMPLETED').length;
        confirmed += cell.orders.filter((o) => o.status === 'CONFIRMED').length;
        fixed += cell.blocks.length;
        if (cell.hasCollision) collisions += 1;
      }
    }
    return { totalOrders, completed, confirmed, fixed, collisions };
  }, [weekDays, cellIndex]);

  const handleSaveFixedBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftCell) return;
    const targetListing =
      (groupFilter !== 'ALL' ? listings.find((l) => l.groupId === groupFilter) : listings[0]) ??
      listings[0];
    onAddFixedBlock({
      id: `blk-${Date.now()}`,
      dateIso: draftCell.dateIso,
      hour: draftCell.hour,
      groupId: targetListing?.groupId ?? '',
      groupName: targetListing?.groupName ?? 'Cụm sân cơ sở',
      unitNumber: draftUnit,
      title:
        draftTitle.trim() ||
        (draftKind === 'MAINTENANCE' ? 'Bảo trì mặt sân / Đèn' : 'Lịch cố định khách quen'),
      kind: draftKind,
    });
    setDraftCell(null);
  };

  return (
    <div className="space-y-4">
      {/* TOP CONTROL & LEGEND BAR */}
      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1F8] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0E4F7E]">
              <Calendar className="h-3 w-3" />
              Thời khóa biểu Vận hành Theo Tuần
            </span>
            <h3 className="mt-1 text-xl font-bold text-[#0F172A]">
              Lịch Thuê Sân &amp; Điều Phối Khung Giờ Theo Tuần
            </h3>
            <p className="text-xs text-neutral-500">
              Theo dõi toàn cảnh lịch đặt từ Thứ 2 đến Chủ Nhật • Bấm vào ca đã đặt để xem chi tiết đơn, hoặc bấm ô trống để thêm lịch cố định / bảo trì.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#F4F8F4] px-3 py-1 font-semibold text-[#16422C] tabular-nums">
              {weekSummary.totalOrders} ca đặt trong tuần
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 font-semibold text-[#0F172A] hover:border-[#16422C] cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              In lịch tuần
            </button>
          </div>
        </div>

        {/* Week Selector + Filters */}
        <div className="grid grid-cols-1 gap-2.5 border-t border-neutral-100 pt-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => Math.max(-2, w - 1))}
              aria-label="Tuần trước"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-[#F8FAFC] text-[#0F172A] hover:border-[#16422C] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <PillSelect
                variant="soft"
                ariaLabel="Chọn tuần hiển thị"
                value={String(weekOffset)}
                onChange={(v) => setWeekOffset(Number(v))}
                options={weekOptions}
              />
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => Math.min(4, w + 1))}
              aria-label="Tuần tiếp theo"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-[#F8FAFC] text-[#0F172A] hover:border-[#16422C] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="shrink-0 rounded-xl border border-[#16422C]/25 bg-[#F4F8F4] px-2.5 py-2 text-[11px] font-bold text-[#16422C] hover:bg-[#E7F7D4] cursor-pointer"
              >
                Tuần này
              </button>
            )}
          </div>

          <div className="lg:col-span-4">
            <PillSelect
              variant="soft"
              ariaLabel="Lọc cụm sân trên lịch tuần"
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { value: 'ALL', label: `Tất cả cụm sân (${listings.length})` },
                ...listings.map((l) => ({ value: l.groupId, label: l.groupName })),
              ]}
            />
          </div>

          <div className="lg:col-span-3">
            <PillSelect
              variant="soft"
              ariaLabel="Lọc theo ô sân"
              value={unitFilter}
              onChange={setUnitFilter}
              options={[
                { value: 'ALL', label: 'Tất cả ô sân' },
                ...availableUnits.map((u) => ({ value: u, label: u })),
              ]}
            />
          </div>
        </div>

        {/* Interactive Legend Strip matching Timetable UX */}
        <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showConfirmed}
              onChange={(e) => setShowConfirmed(e.target.checked)}
              className="rounded border-neutral-300 text-[#0E4F7E]"
            />
            <span className="h-3 w-3 rounded-sm bg-[#0EA5E9]" />
            <span className="font-medium text-neutral-700">
              Lịch khách đã đặt ({weekSummary.confirmed})
            </span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-neutral-300 text-[#16422C]"
            />
            <span className="h-3 w-3 rounded-sm bg-[#16A34A]" />
            <span className="font-medium text-neutral-700">
              Đã nhận sân ({weekSummary.completed})
            </span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showFixed}
              onChange={(e) => setShowFixed(e.target.checked)}
              className="rounded border-neutral-300 text-purple-600"
            />
            <span className="h-3 w-3 rounded-sm bg-purple-600" />
            <span className="font-medium text-neutral-700">
              Lịch cố định / Bảo trì ({weekSummary.fixed})
            </span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showConflictOnly}
              onChange={(e) => setShowConflictOnly(e.target.checked)}
              className="rounded border-neutral-300 text-amber-500"
            />
            <span className="h-3 w-3 rounded-sm bg-amber-400" />
            <span className="font-medium text-neutral-700">
              Trùng ô sân ({weekSummary.collisions})
            </span>
          </label>
        </div>
      </div>

      {/* TIMETABLE GRID TABLE */}
      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] text-[#0F172A] border-b border-neutral-200">
                <th className="w-16 border-r border-neutral-200 bg-[#0E4F7E] px-2 py-3 text-center text-white font-bold">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((w) => Math.max(-2, w - 1))}
                    title="Tuần trước"
                    className="inline-flex items-center justify-center rounded-md px-1.5 py-0.5 hover:bg-white/15 cursor-pointer"
                  >
                    ←
                  </button>
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.iso}
                    className={`w-[12.5%] border-r border-neutral-200 px-2 py-2.5 text-center ${
                      day.isToday ? 'bg-[#E7F7D4]/75 text-[#16422C]' : ''
                    }`}
                  >
                    <span className="font-bold">{day.dayName}</span>{' '}
                    <span
                      className={`font-medium ${
                        day.isToday
                          ? 'rounded-full bg-[#16422C] px-2 py-0.5 text-[10.5px] text-white'
                          : 'text-neutral-500'
                      }`}
                    >
                      ({day.shortDate})
                    </span>
                  </th>
                ))}
                <th className="w-24 bg-[#0E4F7E] px-2 py-3 text-center text-white font-bold">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((w) => Math.min(4, w + 1))}
                    title="Tuần sau"
                    className="inline-flex items-center justify-center rounded-md px-1.5 py-0.5 hover:bg-white/15 cursor-pointer"
                  >
                    →
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200">
              {TIMETABLE_HOURS.map((hour, rowIdx) => {
                const startStr = `${String(hour).padStart(2, '0')}:00`;
                const endStr = `${String(hour + 1).padStart(2, '0')}:00`;

                return (
                  <tr key={hour} className="group">
                    {/* Left Slot Badge */}
                    <td className="border-r border-b border-white/25 bg-[#0E4F7E] px-2 py-2 text-center font-bold text-white whitespace-nowrap">
                      Ca {rowIdx + 1}
                    </td>

                    {/* 7 Day Cells */}
                    {weekDays.map((day) => {
                      const key = `${day.iso}__${hour}`;
                      const cell = cellIndex.get(key);
                      const hasContent = Boolean(
                        cell && (cell.orders.length > 0 || cell.blocks.length > 0)
                      );
                      const matchesConflict = !showConflictOnly || Boolean(cell?.hasCollision);

                      return (
                        <td
                          key={key}
                          className={`align-top border-r border-neutral-200 p-1 min-h-[54px] transition ${
                            day.isToday ? 'bg-[#F4F8F4]/45' : 'bg-white'
                          }`}
                        >
                          {hasContent && matchesConflict ? (
                            <div className="space-y-1">
                              {cell!.orders.map((ord) => {
                                const isCompleted = ord.status === 'COMPLETED';
                                const blockStyle = cell!.hasCollision
                                  ? 'border-amber-500 bg-amber-50 text-amber-950'
                                  : isCompleted
                                    ? 'border-[#16422C]/40 bg-[#E7F7D4]/80 text-[#0F172A]'
                                    : 'border-[#0EA5E9]/45 bg-[#E0F2FE] text-[#0F172A]';

                                return (
                                  <button
                                    key={ord.orderId}
                                    type="button"
                                    onClick={() => onOpenOrderDetail(ord.orderId)}
                                    className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug transition hover:shadow-xs cursor-pointer ${blockStyle}`}
                                  >
                                    <div className="font-bold line-clamp-1">
                                      {ord.unitNumber} • {ord.groupName}
                                    </div>
                                    <div className="truncate font-medium text-neutral-700">
                                      Khách: {ord.customerName}
                                    </div>
                                    <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-600 mt-0.5">
                                      <span className="inline-flex items-center gap-0.5 tabular-nums font-semibold">
                                        <Clock className="h-2.5 w-2.5 text-rose-500" />
                                        {startStr} → {endStr}
                                      </span>
                                      <span className="font-bold">{ord.orderId}</span>
                                    </div>
                                  </button>
                                );
                              })}

                              {cell!.blocks.map((blk) => (
                                <div
                                  key={blk.id}
                                  className={`rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${
                                    blk.kind === 'MAINTENANCE'
                                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                                      : 'border-purple-300 bg-purple-50 text-purple-950'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="font-bold line-clamp-1">
                                      {blk.unitNumber} • {blk.title}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveFixedBlock(blk.id)}
                                      title="Xóa lịch cố định này"
                                      className="text-neutral-500 hover:text-rose-700 cursor-pointer shrink-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] opacity-80 truncate">
                                    {blk.groupName}
                                  </div>
                                </div>
                              ))}

                              {/* Quick + button in occupied cell to add another court unit at same hour */}
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftCell({
                                    dateIso: day.iso,
                                    dayLabel: `${day.dayName} (${day.shortDate})`,
                                    hour,
                                  })
                                }
                                className="w-full rounded border border-dashed border-neutral-200 py-0.5 text-[10px] font-medium text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:border-[#16422C] hover:text-[#16422C] cursor-pointer"
                              >
                                + Thêm ô
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftCell({
                                  dateIso: day.iso,
                                  dayLabel: `${day.dayName} (${day.shortDate})`,
                                  hour,
                                })
                              }
                              aria-label={`Thêm lịch ${day.dayName} ${startStr}`}
                              className="flex h-11 w-full items-center justify-center rounded-lg text-[10px] font-medium text-transparent transition hover:border hover:border-dashed hover:border-[#16422C]/40 hover:bg-[#F4F8F4]/70 hover:text-[#16422C] cursor-pointer"
                            >
                              <Plus className="h-3 w-3 mr-0.5" /> Khóa ca
                            </button>
                          )}
                        </td>
                      );
                    })}

                    {/* Right Time Axis */}
                    <td className="border-l border-b border-white/25 bg-[#0E4F7E] px-2 py-2 text-center font-bold tabular-nums text-white whitespace-nowrap">
                      {startStr} – {endStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="bg-[#F8FAFC] text-[#0F172A] border-t border-neutral-200">
                <th className="border-r border-neutral-200 bg-[#0E4F7E] px-2 py-2.5 text-center text-white">
                  ←
                </th>
                {weekDays.map((day) => (
                  <th
                    key={`foot-${day.iso}`}
                    className={`border-r border-neutral-200 px-2 py-2 text-center text-[11px] font-bold ${
                      day.isToday ? 'bg-[#E7F7D4]/75 text-[#16422C]' : 'text-neutral-600'
                    }`}
                  >
                    {day.dayName} ({day.shortDate})
                  </th>
                ))}
                <th className="bg-[#0E4F7E] px-2 py-2.5 text-center text-white">→</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* OVERLAY MODAL FOR ADDING FIXED / MAINTENANCE BLOCK */}
      {draftCell && (
        <div
          onClick={() => setDraftCell(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveFixedBlock}
            className="w-full max-w-md rounded-[26px] border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10.5px] font-bold text-purple-900">
                  <Lock className="h-3 w-3" />
                  Đánh dấu khung giờ
                </span>
                <h4 className="mt-1 text-base font-bold text-[#0F172A]">
                  {draftCell.dayLabel} • {String(draftCell.hour).padStart(2, '0')}:00 –{' '}
                  {String(draftCell.hour + 1).padStart(2, '0')}:00
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setDraftCell(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'RECURRING_CLIENT' as const, label: 'Khách quen cố định' },
                { id: 'MAINTENANCE' as const, label: 'Bảo trì / Vệ sinh sân' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraftKind(opt.id)}
                  className={`rounded-xl border px-3 py-2 font-bold transition cursor-pointer ${
                    draftKind === opt.id
                      ? 'border-[#16422C] bg-[#E7F7D4]/70 text-[#16422C]'
                      : 'border-neutral-200 bg-[#F8FAFC] text-neutral-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block font-semibold text-neutral-700">Áp dụng cho ô sân</label>
              <PillSelect
                variant="soft"
                ariaLabel="Chọn ô sân"
                value={draftUnit}
                onChange={setDraftUnit}
                options={availableUnits.map((u) => ({ value: u, label: u }))}
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-neutral-700">Ghi chú lịch *</label>
              <input
                type="text"
                required
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="VD: CLB Bách Khoa đánh cố định T2/T4..."
                className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDraftCell(null)}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#16422C] px-4 py-2 font-bold text-white hover:bg-[#0F172A] cursor-pointer"
              >
                ✓ Lưu lên lịch tuần
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
