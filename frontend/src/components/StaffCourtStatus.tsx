import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, ExternalLink, RefreshCw, Search, Users } from 'lucide-react';
import type { LessorBookingOrder, VenueCourt, VenueCourtSnapshot } from '../types/marketplace';
import { PillSelect } from './FairwayControls';

const courtStatuses = {
  RENTED: { label: 'Đang thuê', tone: 'border-[#BFDBCC] bg-[#EAF4ED] text-[#16422C]', dot: 'bg-[#287552]' },
  AWAITING_CHECK_IN: { label: 'Chờ nhận sân', tone: 'border-amber-200 bg-amber-50 text-amber-900', dot: 'bg-amber-600' },
  PAYMENT_HOLD: { label: 'Giữ chỗ', tone: 'border-sky-200 bg-sky-50 text-sky-900', dot: 'bg-sky-600' },
  AVAILABLE: { label: 'Chưa được thuê', tone: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
  UNAVAILABLE: { label: 'Tạm ngừng', tone: 'border-rose-200 bg-rose-50 text-rose-900', dot: 'bg-rose-600' },
} satisfies Record<VenueCourt['status'], { label: string; tone: string; dot: string }>;

const bookingStatuses = {
  ...courtStatuses,
  CHECKED_IN: { label: 'Đã nhận sân', tone: courtStatuses.RENTED.tone, dot: courtStatuses.RENTED.dot },
  ENDED: { label: 'Đã qua ca', tone: courtStatuses.AVAILABLE.tone, dot: courtStatuses.AVAILABLE.dot },
  CANCELLED: { label: 'Đã hủy', tone: courtStatuses.AVAILABLE.tone, dot: courtStatuses.AVAILABLE.dot },
  NO_SHOW: { label: 'Bỏ lịch', tone: courtStatuses.UNAVAILABLE.tone, dot: courtStatuses.UNAVAILABLE.dot },
};
const venueTimeZone = 'Asia/Ho_Chi_Minh';
const localClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: venueTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const localRefreshClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: venueTimeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const localDate = new Intl.DateTimeFormat('sv-SE', { timeZone: venueTimeZone, dateStyle: 'short' });
const pageSize = 10;
const guestColumns = 'md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.25fr)_8.5rem]';
const courtStatusesByOrder = Object.entries(courtStatuses) as [VenueCourt['status'], typeof courtStatuses.RENTED][];

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
}

function bookingBadge(order: LessorBookingOrder, updatedAt: number) {
  if (order.status === 'CANCELLED' || order.status === 'NO_SHOW') return bookingStatuses[order.status];
  if (order.slotEnd && Date.parse(order.slotEnd) <= updatedAt) return bookingStatuses.ENDED;
  if (order.status === 'HELD') return bookingStatuses.PAYMENT_HOLD;
  if (order.status === 'CONFIRMED') return bookingStatuses.AWAITING_CHECK_IN;
  return order.slotStart && Date.parse(order.slotStart) <= updatedAt ? bookingStatuses.RENTED : bookingStatuses.CHECKED_IN;
}

function bookingTime(order: LessorBookingOrder, today: string) {
  if (!order.slotStart) return order.slotLabel;
  const label = (iso: string) => {
    const date = new Date(iso);
    const day = localDate.format(date);
    const clock = localClock.format(date);
    return day === today ? clock : `${clock} (${day.slice(8, 10)}/${day.slice(5, 7)})`;
  };
  const start = label(order.slotStart);
  return order.slotEnd ? `${start} – ${label(order.slotEnd)}` : start;
}

interface StaffCourtStatusProps {
  snapshot: VenueCourtSnapshot | null;
  error: string | null;
  venueName: string;
  onRefresh: () => void;
  onOpenSchedule: () => void;
  onOpenVenue?: () => void;
  onOpenOrder: (reservationId: string) => void;
}

export function StaffCourtStatus({ snapshot, error, venueName, onRefresh, onOpenSchedule, onOpenVenue, onOpenOrder }: StaffCourtStatusProps) {
  const [groupId, setGroupId] = useState('ALL');
  const [courtFilter, setCourtFilter] = useState<VenueCourt['status'] | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const groups = useMemo(() => {
    const entries = new Map<string, string>();
    for (const item of [...(snapshot?.courts ?? []), ...(snapshot?.bookings ?? [])]) {
      entries.set(item.groupId, item.groupName);
    }
    return [...entries].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [snapshot]);

  const { courts, bookings, bookingById, counts } = useMemo(() => {
    const scopedCourts = snapshot?.courts.filter(court => groupId === 'ALL' || court.groupId === groupId) ?? [];
    const allBookings = snapshot?.bookings ?? [];
    const bookingById = new Map(allBookings.map(order => [order.reservationId, order]));
    const queryText = normalizeSearch(query.trim());
    const counts = { RENTED: 0, AWAITING_CHECK_IN: 0, PAYMENT_HOLD: 0, AVAILABLE: 0, UNAVAILABLE: 0 };
    for (const court of scopedCourts) counts[court.status]++;
    return {
      courts: scopedCourts.filter(court => !courtFilter || court.status === courtFilter),
      bookings: allBookings.filter(order => (groupId === 'ALL' || order.groupId === groupId)
        && normalizeSearch(`${order.customerName} ${order.customerPhone?.slice(-4) ?? ''} ${order.orderId} ${order.unitNumber}`).includes(queryText)),
      bookingById, counts,
    };
  }, [snapshot, groupId, courtFilter, query]);

  const courtsByGroup = useMemo(() => {
    const grouped = new Map<string, VenueCourt[]>();
    for (const court of courts) {
      const group = grouped.get(court.groupId);
      if (group) group.push(court);
      else grouped.set(court.groupId, [court]);
    }
    return grouped;
  }, [courts]);

  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const refreshedAt = snapshot ? Date.parse(snapshot.updatedAt) : 0;

  return (
    <div className="space-y-4">
      <section aria-label="Trạng thái sân hiện tại" className="rounded-[24px] border border-[#DEE9E1] bg-white shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1EBE4] px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#15382A] sm:text-xl">Trạng thái sân hiện tại</h2>
            <p className="mt-0.5 hidden text-sm text-[#426154] lg:block">{venueName}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {snapshot && <><time dateTime={snapshot.updatedAt}>Cập nhật lúc {localRefreshClock.format(refreshedAt)}</time> · </>}
              Giờ Việt Nam
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenVenue && (
              <button type="button" onClick={onOpenVenue}
                className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-[#DDE8E1] px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF] lg:inline-flex">
                <ExternalLink aria-hidden="true" size={14} /> Xem gian hàng
              </button>
            )}
            <button type="button" onClick={onRefresh}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#DDE8E1] px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF]">
              <RefreshCw aria-hidden="true" size={14} /> Làm mới
            </button>
            <button type="button" onClick={onOpenSchedule}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#16422C] px-3 text-xs font-semibold text-white hover:bg-[#23563C]">
              <CalendarDays aria-hidden="true" size={14} /> Mở lịch tuần
            </button>
          </div>
        </header>
        <div className="space-y-4 px-4 py-4 sm:px-6">
          {error && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {snapshot ? 'Chưa làm mới được. Dữ liệu hiển thị là lần cập nhật gần nhất.' : error}
          </p>}
          {!snapshot && !error && <p role="status" className="text-sm text-slate-600">Đang tải danh sách sân và khách đặt…</p>}
          {snapshot && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {courtStatusesByOrder.map(([status, style]) => (
                  <button key={status} type="button" aria-pressed={status === courtFilter}
                    onClick={() => setCourtFilter(current => current === status ? null : status)}
                    className={`rounded-xl border p-3 text-left hover:brightness-[0.97] ${style.tone} ${status === courtFilter ? 'ring-2 ring-[#2A7350]/50' : ''}`}>
                    <span className="block text-xl font-bold tabular-nums">{counts[status]}</span>
                    <span className="text-xs font-semibold">{style.label}</span>
                  </button>
                ))}
              </div>
              <div className="max-w-sm">
                <PillSelect variant="soft" ariaLabel="Lọc sân và khách theo cụm" value={groupId}
                  onChange={value => { setGroupId(value); setPage(1); }}
                  options={[{ value: 'ALL', label: 'Tất cả cụm sân' }, ...groups.map(([id, name]) => ({ value: id, label: name }))]} />
              </div>
              {courts.length === 0 && <p className="text-sm text-slate-600">Không có sân khớp với bộ lọc.</p>}
              {[...courtsByGroup].map(([id, group]) => (
                <div key={id} className="border-t border-[#E6EEE8] pt-3">
                  <h3 className="mb-2 text-sm font-bold text-[#15382A]">{group[0].groupName}</h3>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {group.map(court => {
                      const style = courtStatuses[court.status];
                      const order = court.reservationId ? bookingById.get(court.reservationId) : undefined;
                      return (
                        <li key={court.id} className="min-w-0 rounded-xl border border-[#E2EAE4] p-3">
                          <p className="font-bold text-[#15382A]">{court.unitNumber}</p>
                          <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${style.tone}`}>
                            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />{style.label}
                          </span>
                          {order && (
                            <button type="button" onClick={() => onOpenOrder(order.reservationId)}
                              className="mt-1.5 flex min-h-8 w-full items-center gap-1 text-left text-xs font-semibold text-[#24593F] hover:underline">
                              <span className="min-w-0 break-words">{order.customerName}</span><ChevronRight aria-hidden="true" size={13} className="shrink-0" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {snapshot && (
        <section aria-label="Khách đặt sân hôm nay" className="overflow-hidden rounded-[24px] border border-[#DEE9E1] bg-white shadow-xs">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1EBE4] px-4 py-4 sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#15382A] sm:text-xl">
                <Users aria-hidden="true" size={18} /> Khách đặt sân hôm nay
              </h2>
              <p className="mt-0.5 text-xs text-slate-600"><time dateTime={snapshot.today}>{snapshot.today.split('-').reverse().join('/')}</time> · {bookings.length} ca</p>
            </div>
            <label className="relative w-full sm:w-64">
              <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
              <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
                aria-label="Tìm khách đặt sân" placeholder="Tên khách, mã đơn, 4 số cuối SĐT"
                className="min-h-10 w-full rounded-xl border border-[#DDE8E1] bg-[#F8FBF9] pl-9 pr-3 text-xs text-slate-900" />
            </label>
          </header>
          <div aria-hidden="true" className={`hidden gap-3 bg-[#F8FBF9] px-6 py-2.5 text-xs font-semibold text-[#426154] md:grid ${guestColumns}`}>
            <span>Khách đặt</span><span>Giờ thuê</span><span>Sân</span><span>Trạng thái</span>
          </div>
          {bookings.length === 0
            ? <p className="px-4 py-6 text-sm text-slate-600 sm:px-6">Không tìm thấy ca đặt sân phù hợp trong ngày.</p>
            : (
              <ul className="divide-y divide-[#E6EEE8]">
                {bookings.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(order => {
                  const status = bookingBadge(order, refreshedAt);
                  return (
                    <li key={order.reservationId}>
                      <button type="button" onClick={() => onOpenOrder(order.reservationId)}
                        className={`grid w-full grid-cols-1 items-center gap-1.5 px-4 py-3 text-left text-sm hover:bg-[#F8FBF9] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2A7350] sm:px-6 md:gap-3 ${guestColumns}`}>
                        <span className="min-w-0 break-words">
                          <span className="block font-bold text-[#15382A]">{order.customerName}</span>
                          <span className="text-xs text-slate-600">{order.orderId}{order.customerPhone && ` · •••• ${order.customerPhone.slice(-4)}`}</span>
                        </span>
                        <span className="tabular-nums text-slate-700">{bookingTime(order, snapshot.today)}</span>
                        <span className="min-w-0 break-words text-xs text-slate-700">{order.unitNumber} · {order.groupName}</span>
                        <span className="flex items-center justify-between gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                          <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-[#527064]" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          {pageCount > 1 && (
            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E6EEE8] px-4 py-3 text-xs text-slate-700 sm:px-6">
              <span>Trang {currentPage}/{pageCount}</span>
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-[#DDE8E1] px-3 py-1.5 font-semibold disabled:opacity-45">Trước</button>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-[#DDE8E1] px-3 py-1.5 font-semibold disabled:opacity-45">Sau</button>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}
