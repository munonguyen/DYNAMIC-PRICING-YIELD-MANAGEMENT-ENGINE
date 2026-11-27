import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, ExternalLink, LayoutGrid, List, RefreshCw, Search, Users } from 'lucide-react';
import type { LessorBookingOrder, PublishedListing, VenueCourtSnapshot } from '../types/marketplace';
import { floorStatuses } from './CourtFloorCanvas';
import { LiveCourtFloor } from './LiveCourtFloor';
import { PillSelect } from './FairwayControls';

const bookingStatuses = {
  RENTED: { label: floorStatuses.RENTED.label, tone: floorStatuses.RENTED.tile },
  CONFIRMED: { label: 'Chờ nhận sân', tone: floorStatuses.AWAITING_CHECK_IN.tile },
  HELD: { label: 'Chờ thanh toán', tone: floorStatuses.PAYMENT_HOLD.tile },
  CHECKED_IN: { label: 'Đã nhận sân', tone: 'border-[#B2D1C5] bg-[#DDEDE6] text-[#15473B]' },
  ENDED: { label: 'Đã qua ca', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  CANCELLED: { label: 'Đã hủy', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  NO_SHOW: { label: 'Bỏ lịch', tone: 'border-rose-200 bg-rose-50 text-rose-900' },
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

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
}

function bookingBadge(order: LessorBookingOrder, updatedAt: number) {
  if (order.status === 'CANCELLED' || order.status === 'NO_SHOW') return bookingStatuses[order.status];
  if (order.slotEnd && Date.parse(order.slotEnd) <= updatedAt) return bookingStatuses.ENDED;
  if (order.status === 'HELD') return bookingStatuses.HELD;
  if (order.status === 'CONFIRMED') return bookingStatuses.CONFIRMED;
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

interface StaffCourtStatusBase {
  snapshot: VenueCourtSnapshot | null;
  error: string | null;
  onRefresh: () => void;
  onOpenOrder: (reservationId: string) => void;
}

type StaffCourtStatusProps = StaffCourtStatusBase & ({
  view: 'floor';
  venueName: string;
  listings: PublishedListing[];
  onOpenVenue?: () => void;
  floorGroup: string;
  selectedCourtId: string | null;
  onSelectCourt: (id: string) => void;
  onSelectFloorGroup: (groupId: string) => void;
  onEditFloor?: (groupId: string, groupName: string) => void;
} | {
  view: 'roster';
  onOpenSchedule: () => void;
  onOpenInventory: () => void;
});

const headerAction = 'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#DDE8E1] px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF]';

export function StaffCourtStatus(props: StaffCourtStatusProps) {
  const { snapshot, error, onRefresh, onOpenOrder } = props;
  const [rosterGroup, setRosterGroup] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const floorListings = props.view === 'floor' ? props.listings : undefined;

  const groups = useMemo(() => {
    const entries = new Map(floorListings?.map(listing => [listing.groupId, listing.groupName]));
    for (const item of [...(snapshot?.courts ?? []), ...(snapshot?.bookings ?? [])]) {
      entries.set(item.groupId, item.groupName);
    }
    return [...entries].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [snapshot, floorListings]);

  const activeGroup = (props.view === 'floor' ? groups.find(([id]) => id === props.floorGroup) : undefined) ?? groups[0];
  const activeGroupId = activeGroup?.[0];
  const listing = floorListings?.find(item => item.groupId === activeGroupId);
  const courts = useMemo(() => snapshot?.courts.filter(court => court.groupId === activeGroupId) ?? [],
    [snapshot, activeGroupId]);
  const bookingById = useMemo(() => new Map(snapshot?.bookings.map(order => [order.reservationId, order])), [snapshot]);
  const bookings = useMemo(() => {
    const queryText = normalizeSearch(query.trim());
    return snapshot?.bookings.filter(order => (rosterGroup === 'ALL' || order.groupId === rosterGroup)
      && normalizeSearch(`${order.customerName} ${order.customerPhone?.slice(-4) ?? ''} ${order.orderId} ${order.unitNumber}`).includes(queryText)) ?? [];
  }, [snapshot, rosterGroup, query]);

  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const refreshedAt = snapshot ? Date.parse(snapshot.updatedAt) : 0;

  const loadStatus = error
    ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      {snapshot ? 'Chưa làm mới được. Dữ liệu hiển thị là lần cập nhật gần nhất.' : error}
    </p>
    : !snapshot && <p role="status" className="text-sm text-slate-600">
      {props.view === 'floor' ? 'Đang tải sơ đồ sân…' : 'Đang tải danh sách khách đặt…'}
    </p>;

  if (props.view === 'floor') {
    const { venueName, onEditFloor, onOpenVenue } = props;
    return (
      <section id="so-do-cum-san" tabIndex={-1} aria-label="Trạng thái sân hiện tại"
        className="scroll-mt-24 rounded-[24px] border border-[#DEE9E1] bg-white shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1EBE4] px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#15382A] sm:text-xl">Sơ đồ quản lý sân</h2>
            <p className="mt-0.5 hidden text-sm text-[#426154] lg:block">{venueName}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {snapshot && <><time dateTime={snapshot.updatedAt}>Cập nhật lúc {localRefreshClock.format(refreshedAt)}</time> · </>}
                Giờ Việt Nam
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onOpenVenue && (
                <button type="button" onClick={onOpenVenue}
                  className={`${headerAction} hidden lg:inline-flex`}>
                  <ExternalLink aria-hidden="true" size={14} /> Xem gian hàng
                </button>
              )}
              <button type="button" onClick={onRefresh} className={headerAction}>
                <RefreshCw aria-hidden="true" size={14} /> Làm mới
              </button>
              <a href="#danh-sach-cum-san"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#16422C] px-3 text-xs font-semibold text-white hover:bg-[#23563C]">
                <List aria-hidden="true" size={14} /> Đến danh sách sân
              </a>
            </div>
          </header>
          <div className="space-y-4 px-4 py-4 sm:px-6">
            {loadStatus}
            {snapshot && (activeGroup ? (
              <>
                <div className="max-w-md">
                  <PillSelect variant="soft" ariaLabel="Chọn cụm sân trên sơ đồ" value={activeGroup[0]} onChange={props.onSelectFloorGroup}
                    options={groups.map(([id, name]) => ({ value: id, label: name }))} />
                </div>
                <LiveCourtFloor key={activeGroup[0]} courts={courts}
                  layout={snapshot.layouts.find(layout => layout.groupId === activeGroup[0])}
                  selectedId={props.selectedCourtId} onSelectCourt={props.onSelectCourt}
                  sportCode={listing?.sportCode} sportName={listing?.sportName}
                  bookings={bookingById} bookingTime={order => bookingTime(order, snapshot.today)} onOpenOrder={onOpenOrder}
                  onEdit={onEditFloor ? () => onEditFloor(...activeGroup) : undefined} />
              </>
            ) : <p className="text-sm text-slate-600">Cơ sở chưa có cụm sân để hiển thị.</p>)}
          </div>
        </section>
      );
    }

    return (
      <section aria-label="Khách đặt sân hôm nay" className="overflow-hidden rounded-[24px] border border-[#DEE9E1] bg-white shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1EBE4] px-4 py-4 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#15382A] sm:text-xl">
              <Users aria-hidden="true" size={18} /> Khách đặt sân hôm nay
            </h2>
            {snapshot && (
              <p className="mt-0.5 text-xs text-slate-600"><time dateTime={snapshot.today}>{snapshot.today.split('-').reverse().join('/')}</time> · {bookings.length} ca</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRefresh} className={headerAction}>
              <RefreshCw aria-hidden="true" size={14} /> Làm mới
            </button>
            <button type="button" onClick={props.onOpenSchedule} className={headerAction}>
              <CalendarDays aria-hidden="true" size={14} /> Mở lịch tuần
            </button>
            <button type="button" onClick={props.onOpenInventory}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#16422C] px-3 text-xs font-semibold text-white hover:bg-[#23563C]">
              <LayoutGrid aria-hidden="true" size={14} /> Sơ đồ & cụm sân
            </button>
          </div>
          {snapshot && <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,13rem)_16rem]">
            <PillSelect variant="soft" ariaLabel="Lọc danh sách khách theo cụm" value={rosterGroup}
              onChange={value => { setRosterGroup(value); setPage(1); }}
              options={[{ value: 'ALL', label: 'Tất cả cụm sân' }, ...groups.map(([id, name]) => ({ value: id, label: name }))]} />
            <label className="relative">
              <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
              <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
                aria-label="Tìm khách đặt sân" placeholder="Tên khách, mã đơn, 4 số cuối SĐT"
                className="min-h-10 w-full rounded-xl border border-[#DDE8E1] bg-[#F8FBF9] pl-9 pr-3 text-xs text-slate-900" />
            </label>
          </div>}
        </header>
        {loadStatus && <div className="px-4 py-3 sm:px-6">{loadStatus}</div>}
        {snapshot && <>
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
      </>}
    </section>
  );
}
