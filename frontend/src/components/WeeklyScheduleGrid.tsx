import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus, Printer, Trash2, X } from 'lucide-react';
import type { LessorBookingOrder, PublishedListing } from '../types/marketplace';
import { PillSelect } from './FairwayControls';
import { WeeklyBookingCard, weeklyBookingStatus } from './WeeklyBookingCard';

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

interface ScheduleCell {
  orders: LessorBookingOrder[];
  blocks: WeeklyFixedBlock[];
  hasCollision: boolean;
}

const weekdayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
const time = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const scheduleStatuses = ['CONFIRMED', 'COMPLETED', 'HELD'] as const;
const weekOffsets = [-2, -1, 0, 1, 2, 3, 4];
const weekButton = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#DDE8E1] bg-white text-[#16422C] hover:bg-[#EDF5EF] disabled:opacity-40';

function shiftDate(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function unitKey(unit: string) {
  const number = unit.match(/\d+$/)?.[0];
  return number ? String(Number(number)) : unit.trim().toLowerCase();
}

function orderTimeLabel(order: LessorBookingOrder) {
  if (!order.slotStart) return order.slotLabel;
  const start = new Date(order.slotStart);
  if (!order.slotEnd) return time.format(start);
  const end = new Date(order.slotEnd);
  const day = vietnamDate.format(end);
  return `${time.format(start)}–${time.format(end)}${day !== vietnamDate.format(start) ? ` (${formatShortDate(day)})` : ''}`;
}

export function WeeklyScheduleGrid({
  listings, providerOrders, fixedBlocks, onAddFixedBlock, onRemoveFixedBlock, onOpenOrderDetail,
}: WeeklyScheduleGridProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileDay, setMobileDay] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<LessorBookingOrder['status']>>(() => new Set());
  const [showFixed, setShowFixed] = useState(true);
  const [showConflictOnly, setShowConflictOnly] = useState(false);
  const [compact, setCompact] = useState(false);

  const [draftCell, setDraftCell] = useState<{ dateIso: string; dayLabel: string; hour: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState('Lịch tập cố định CLB');
  const [draftUnit, setDraftUnit] = useState('Sân 01');
  const [draftKind, setDraftKind] = useState<WeeklyFixedBlock['kind']>('RECURRING_CLIENT');

  const today = vietnamDate.format(new Date());
  const weekBase = shiftDate(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weekStart = shiftDate(weekBase, weekOffset * 7);
  const weekDays = weekdayNames.map((dayName, index) => {
    const iso = shiftDate(weekStart, index);
    return { dayName, iso, short: formatShortDate(iso), isToday: iso === today };
  });
  const weekEnd = weekDays[6].iso;
  const currentMobileDay = weekDays.find(day => day.iso === mobileDay)
    ?? weekDays.find(day => day.isToday) ?? weekDays[0];

  const weekOptions = weekOffsets.map(offset => {
    const start = shiftDate(weekBase, offset * 7);
    const end = shiftDate(start, 6);
    return { value: String(offset), label: `${formatShortDate(start)} – ${formatShortDate(end)}/${end.slice(0, 4)}` };
  });

  const changeWeek = (offset: number) => {
    setWeekOffset(offset);
    setMobileDay(null);
  };
  const changeStatusVisibility = (status: LessorBookingOrder['status']) => {
    setHiddenStatuses(current => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const availableUnits = useMemo(() => {
    const capacity = listings.reduce((max, listing) => Math.max(max, listing.upcomingSlots[0]?.totalCapacity ?? 4), 4);
    return Array.from({ length: Math.min(12, capacity) }, (_, index) => `Sân ${String(index + 1).padStart(2, '0')}`);
  }, [listings]);

  const { cellIndex, hours, countByDay, totalOrders } = useMemo(() => {
    const cells = new Map<string, ScheduleCell>();
    const counts = new Map<string, number>();
    let firstHour = 6;
    let lastHour = 21;
    let total = 0;
    const getCell = (date: string, hour: number) => {
      const key = `${date}__${hour}`;
      const cell = cells.get(key) ?? { orders: [], blocks: [], hasCollision: false };
      cells.set(key, cell);
      firstHour = Math.min(firstHour, hour);
      lastHour = Math.max(lastHour, hour);
      return cell;
    };

    for (const order of providerOrders) {
      if (!scheduleStatuses.some(status => status === order.status) || hiddenStatuses.has(order.status)) continue;
      if (groupFilter !== 'ALL' && order.groupId !== groupFilter) continue;
      if (unitFilter !== 'ALL' && unitKey(order.unitNumber) !== unitKey(unitFilter)) continue;
      const date = order.dateIso ?? (order.slotStart ? vietnamDate.format(new Date(order.slotStart)) : '');
      const hour = order.slotHour ?? (order.slotStart ? Number(time.format(new Date(order.slotStart)).slice(0, 2)) : NaN);
      if (date < weekStart || date > weekEnd || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      getCell(date, hour).orders.push(order);
    }

    if (showFixed) {
      for (const block of fixedBlocks) {
        if (block.dateIso < weekStart || block.dateIso > weekEnd) continue;
        if (groupFilter !== 'ALL' && block.groupId !== groupFilter) continue;
        if (unitFilter !== 'ALL' && unitKey(block.unitNumber) !== unitKey(unitFilter)) continue;
        getCell(block.dateIso, block.hour).blocks.push(block);
      }
    }

    for (const [key, cell] of cells) {
      cell.orders.sort((left, right) => (left.slotStart ?? left.slotLabel).localeCompare(right.slotStart ?? right.slotLabel));
      const units = [...cell.orders, ...cell.blocks].map(item => `${item.groupId}__${unitKey(item.unitNumber)}`);
      cell.hasCollision = new Set(units).size < units.length;
      if (!showConflictOnly || cell.hasCollision) {
        const day = key.slice(0, 10);
        counts.set(day, (counts.get(day) ?? 0) + cell.orders.length + cell.blocks.length);
        total += cell.orders.length;
      }
    }

    return {
      cellIndex: cells, hours: Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index),
      countByDay: counts, totalOrders: total,
    };
  }, [providerOrders, fixedBlocks, groupFilter, unitFilter, hiddenStatuses, showFixed, showConflictOnly, weekStart, weekEnd]);

  const handleSaveFixedBlock = (event: FormEvent) => {
    event.preventDefault();
    if (!draftCell) return;
    const listing = listings.find(item => item.groupId === groupFilter) ?? listings[0];
    onAddFixedBlock({
      id: `blk-${Date.now()}`, dateIso: draftCell.dateIso, hour: draftCell.hour,
      groupId: listing?.groupId ?? '', groupName: listing?.groupName ?? 'Cụm sân cơ sở',
      unitNumber: draftUnit, title: draftTitle.trim()
        || (draftKind === 'MAINTENANCE' ? 'Bảo trì mặt sân / Đèn' : 'Lịch cố định khách quen'),
      kind: draftKind,
    });
    setDraftCell(null);
  };

  const openBlock = (day: (typeof weekDays)[number], hour: number) => {
    setDraftCell({ dateIso: day.iso, dayLabel: `${day.dayName} · ${day.short}`, hour });
  };

  const renderCell = (cell: ScheduleCell, day: (typeof weekDays)[number], preview: boolean) => (
    <div className="space-y-1.5">
      {cell.hasCollision && <p className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Trùng ô sân</p>}
      {cell.orders.map(order => (
        <WeeklyBookingCard key={order.orderId} order={order} dateLabel={`${day.dayName}, ${day.short}`}
          timeLabel={orderTimeLabel(order)} preview={preview} onOpen={() => onOpenOrderDetail(order.orderId)} />
      ))}
      {cell.blocks.map(block => (
        <div key={block.id} className={`flex items-start gap-1.5 rounded-xl border p-2 text-[11px] ${block.kind === 'MAINTENANCE'
          ? 'border-[#E9DAB6] bg-[#FCF7EB] text-[#604721]' : 'border-[#D4DFD8] bg-[#F0F5F2] text-[#284B3A]'}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{block.unitNumber} · {block.title}</p>
            <p className="truncate opacity-80">{block.groupName}</p>
          </div>
          <button type="button" onClick={() => onRemoveFixedBlock(block.id)} aria-label={`Xóa lịch ${block.title}`}
            className="rounded p-1.5 hover:bg-white/70 hover:text-rose-700">
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  const visibleHours = compact || showConflictOnly
    ? hours.filter(hour => weekDays.some(day => {
        const cell = cellIndex.get(`${day.iso}__${hour}`);
        return cell && (!showConflictOnly || cell.hasCollision);
      }))
    : hours;

  const dayCells = hours.flatMap(hour => {
    const cell = cellIndex.get(`${currentMobileDay.iso}__${hour}`);
    return cell && (!showConflictOnly || cell.hasCollision) ? [{ hour, cell }] : [];
  });

  return (
    <section aria-label="Lịch tuần vận hành" className="min-w-0 overflow-hidden rounded-[24px] border border-[#DEE9E1] bg-white shadow-xs">
      <header className="border-b border-[#E1EBE4] bg-gradient-to-r from-[#F3F8F4] to-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#16422C] text-white">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#15382A] sm:text-xl">Lịch thuê sân</h2>
              <p className="text-xs tabular-nums text-[#466355]">{totalOrders} ca đặt · Giờ Việt Nam</p>
            </div>
          </div>
          <button type="button" onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#DDE8E1] bg-white px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF]">
            <Printer aria-hidden="true" className="h-4 w-4" /> In lịch
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
          <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2 xl:col-span-1">
            <button type="button" aria-label="Tuần trước" className={weekButton}
              disabled={weekOffset === weekOffsets[0]} onClick={() => changeWeek(weekOffset - 1)}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <PillSelect variant="soft" ariaLabel="Chọn tuần hiển thị" value={String(weekOffset)}
                onChange={value => changeWeek(Number(value))} options={weekOptions} />
            </div>
            <button type="button" aria-label="Tuần tiếp theo" className={weekButton}
              disabled={weekOffset === weekOffsets[weekOffsets.length - 1]} onClick={() => changeWeek(weekOffset + 1)}>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button type="button" onClick={() => changeWeek(0)}
                className="h-10 shrink-0 rounded-xl border border-[#DDE8E1] bg-white px-2 text-[11px] font-semibold text-[#16422C] hover:bg-[#EDF5EF]">
                Tuần này
              </button>
            )}
          </div>
          <PillSelect variant="soft" ariaLabel="Lọc cụm sân trên lịch tuần" value={groupFilter} onChange={setGroupFilter}
            options={[{ value: 'ALL', label: 'Tất cả cụm sân' }, ...listings.map(listing => ({ value: listing.groupId, label: listing.groupName }))]} />
          <PillSelect variant="soft" ariaLabel="Lọc theo ô sân" value={unitFilter} onChange={setUnitFilter}
            options={[{ value: 'ALL', label: 'Tất cả ô sân' }, ...availableUnits.map(unit => ({ value: unit, label: unit }))]} />
        </div>

        <div aria-label="Bộ lọc trạng thái lịch" className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {scheduleStatuses.map(key => (
            <label key={key} className="flex items-center gap-1.5 text-[11px] font-medium text-[#345546]">
              <input type="checkbox" checked={!hiddenStatuses.has(key)} onChange={() => changeStatusVisibility(key)}
                className="accent-[#16422C]" />
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${weeklyBookingStatus[key].marker}`} />
              {weeklyBookingStatus[key].title}
            </label>
          ))}
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#345546]">
            <input type="checkbox" checked={showFixed} onChange={event => setShowFixed(event.target.checked)} className="accent-[#16422C]" />
            Lịch cố định / bảo trì
          </label>
          <label className="hidden items-center gap-1.5 text-[11px] font-medium text-[#345546] lg:flex">
            <input type="checkbox" checked={compact} onChange={event => setCompact(event.target.checked)} className="accent-[#16422C]" />
            Chỉ giờ có ca
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#345546]">
            <input type="checkbox" checked={showConflictOnly} onChange={event => setShowConflictOnly(event.target.checked)} className="accent-[#16422C]" />
            Chỉ xem trùng ô sân
          </label>
        </div>
      </header>

      <div className="hidden overflow-x-auto lg:block print:block print:overflow-visible">
        <table aria-label="Thời khóa biểu từ thứ Hai đến Chủ nhật" className="w-full min-w-[790px] table-fixed border-separate border-spacing-0 text-xs print:min-w-0">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] w-[68px] border-b border-r border-[#E3ECE5] bg-[#F1F6F2] px-2 py-2 text-left font-semibold text-[#355545]">Giờ</th>
              {weekDays.map(day => (
                <th key={day.iso} scope="col" aria-current={day.isToday ? 'date' : undefined}
                  className={`border-b border-r border-[#E3ECE5] px-2 py-2 text-left last:border-r-0 ${day.isToday
                    ? 'bg-[#16422C] text-white' : 'bg-[#F6F9F6] text-[#254737]'}`}>
                  <span className="block font-bold">{day.dayName}</span>
                  <time dateTime={day.iso} className={`text-[11px] font-medium tabular-nums ${day.isToday ? 'text-emerald-50/90' : 'text-[#537064]'}`}>{day.short}</time>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleHours.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-sm text-[#50685D]">Không có ca phù hợp trong tuần này.</td></tr>
            )}
            {visibleHours.map(hour => (
              <tr key={hour}>
                <th scope="row" className="sticky left-0 z-[1] border-b border-r border-[#E6EEE8] bg-[#F8FAF8] px-2 py-2 text-left align-top text-[11px] font-semibold tabular-nums text-[#436355]">
                  {hourLabel(hour)}
                </th>
                {weekDays.map(day => {
                  const cell = cellIndex.get(`${day.iso}__${hour}`);
                  const visible = cell && (!showConflictOnly || cell.hasCollision);
                  return (
                    <td key={day.iso} className={`group/cell h-9 border-b border-r border-[#E6EEE8] p-1 align-top last:border-r-0 ${day.isToday ? 'bg-[#F3F8F3]' : 'bg-white'}`}>
                      {visible && renderCell(cell, day, true)}
                      {!showConflictOnly && (
                        <button type="button" onClick={() => openBlock(day, hour)} aria-label={`Thêm lịch ${day.dayName} ${hourLabel(hour)}`}
                          className={`flex w-full items-center justify-center rounded-md text-[#387256] opacity-0 group-hover/cell:opacity-100 hover:bg-[#E6F1E9] focus-visible:opacity-100 ${visible ? 'mt-0.5 h-5' : 'h-7'}`}>
                          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 pb-4 pt-3 lg:hidden print:hidden">
        <div aria-label="Chọn ngày trên lịch tuần" className="grid grid-cols-7 gap-px rounded-[16px] bg-[#F1F6F2] p-0.5">
          {weekDays.map(day => (
            <button type="button" key={day.iso} onClick={() => setMobileDay(day.iso)} aria-pressed={day.iso === currentMobileDay.iso}
              aria-current={day.isToday ? 'date' : undefined} aria-label={`${day.dayName}, ${day.short}, ${countByDay.get(day.iso) ?? 0} ca`}
              className={`min-h-12 min-w-0 rounded-xl text-center text-[10px] font-semibold tabular-nums ${day.iso === currentMobileDay.iso
                ? 'bg-[#16422C] text-white' : 'text-[#355545] hover:bg-[#E5EFE8]'}`}>
              <span className="block">{day.dayName}</span><span className="block text-xs">{day.short}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#15382A]">{currentMobileDay.dayName} · {currentMobileDay.short}</h3>
          {!showConflictOnly && (
            <button type="button" onClick={() => openBlock(currentMobileDay, hours[0])}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#DDE8E1] px-2.5 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF]">
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Thêm lịch
            </button>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {dayCells.length ? dayCells.map(({ hour, cell }) => (
            <div key={hour}>{renderCell(cell, currentMobileDay, false)}</div>
          )) : <p className="rounded-xl border border-dashed border-[#DDE8E1] p-3 text-sm text-[#50685D]">Không có ca trong ngày này.</p>}
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
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0EA] px-2.5 py-0.5 text-[10.5px] font-bold text-[#16422C]">
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
                aria-label="Đóng thêm lịch"
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

            <PillSelect variant="soft" ariaLabel="Chọn giờ bắt đầu"
              value={String(draftCell.hour)} onChange={value => setDraftCell({ ...draftCell, hour: Number(value) })}
              options={hours.map(hour => ({ value: String(hour), label: hourLabel(hour) }))} />

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
    </section>
  );
}
