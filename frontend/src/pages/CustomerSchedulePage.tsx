import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, Ticket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { marketplaceApi } from '../api/marketplaceApi';
import { ActionButton } from '../components/FairwayControls';
import type { CustomerSchedule, MyTicketRecord } from '../types/marketplace';

const ZONE = 'Asia/Ho_Chi_Minh';
const venueDate = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const calendarDay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'short' });
const shortDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const fullDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
const time = new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

type Booking = CustomerSchedule['bookings'][number];

const statuses: Record<Booking['status'], { label: string; color: string }> = {
  HELD: { label: 'Chờ thanh toán', color: 'bg-amber-100 text-amber-900' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-900' },
  COMPLETED: { label: 'Đã nhận sân', color: 'bg-sky-100 text-sky-900' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-rose-100 text-rose-900' },
  EXPIRED: { label: 'Hết hạn giữ sân', color: 'bg-neutral-200 text-neutral-700' },
  NO_SHOW: { label: 'Không đến', color: 'bg-slate-200 text-slate-800' },
};

function dateInVietnam(date: Date) {
  const parts = venueDate.formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function asCalendarDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function offsetDate(day: string, offset: number) {
  const date = asCalendarDate(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function mondayOf(day: string) {
  return offsetDate(day, -((asCalendarDate(day).getUTCDay() + 6) % 7));
}

function slotTime(booking: Booking) {
  const start = new Date(booking.slotStart);
  const end = new Date(booking.slotEnd);
  const nextDay = dateInVietnam(start) !== dateInVietnam(end);
  return `${time.format(start)}–${time.format(end)}${nextDay ? ` (${shortDate.format(asCalendarDate(dateInVietnam(end)))})` : ''}`;
}

interface CustomerSchedulePageProps {
  userId?: string;
  onLogin: () => void;
  onBrowse: () => void;
}

export function CustomerSchedulePage({ userId, onLogin, onBrowse }: CustomerSchedulePageProps) {
  const today = dateInVietnam(new Date());
  const thisWeek = mondayOf(today);
  const [weekStart, setWeekStart] = useState(() => thisWeek);
  const [activeDay, setActiveDay] = useState(() => today);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ userId: string; data: CustomerSchedule } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setLoadError(false);
    if (!userId) {
      setSnapshot(null);
      return;
    }
    const request = new AbortController();
    let inFlight = false;

    const refresh = async () => {
      if (inFlight || request.signal.aborted || document.hidden) return;
      inFlight = true;
      try {
        const data = await marketplaceApi.getMySchedule(weekStart, request.signal);
        if (!request.signal.aborted) {
          setSnapshot({ userId, data });
          setLoadError(false);
        }
      } catch {
        if (!request.signal.aborted) setLoadError(true);
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      request.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId, weekStart, revision]);

  const data = snapshot?.userId === userId && snapshot?.data.weekStart === weekStart ? snapshot.data : null;
  const days = Array.from({ length: 7 }, (_, index) => offsetDate(weekStart, index));
  const byDay = new Map<string, Booking[]>();
  for (const booking of data?.bookings ?? []) {
    const key = dateInVietnam(new Date(booking.slotStart));
    const matches = byDay.get(key);
    if (matches) matches.push(booking);
    else byDay.set(key, [booking]);
  }
  const activeBooking = data?.bookings.find(booking => booking.reservationId === activeBookingId);

  const goToWeek = (week: string) => {
    setWeekStart(week);
    setActiveDay(week === thisWeek ? today : week);
    setActiveBookingId(null);
  };

  return (
    <div className="min-h-[75vh] bg-[#F5F8F6] px-4 pb-24 pt-24 sm:px-7 sm:pt-28">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#16422C] text-white sm:h-12 sm:w-12">
              <CalendarDays aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#152B22] sm:text-3xl">Lịch thuê của tôi</h1>
              <p className="mt-0.5 text-xs text-neutral-600">Thời khóa biểu theo giờ Việt Nam</p>
            </div>
          </div>
          {userId && <ActionButton variant="forest" size="sm" onClick={onBrowse}>Tìm sân</ActionButton>}
        </header>

        {!userId ? (
          <section className="mt-6 rounded-[22px] border border-[#E0E9E3] bg-white px-5 py-10 text-center">
            <p className="text-sm text-neutral-700">Đăng nhập để xem lịch thuê, trạng thái đơn và vé nhận sân của bạn.</p>
            <ActionButton variant="forest" size="sm" className="mt-4" onClick={onLogin}>Đăng nhập</ActionButton>
          </section>
        ) : (
          <section aria-label="Thời khóa biểu thuê sân" className="mt-5 overflow-hidden rounded-[22px] border border-[#E0E9E3] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-[#E9EFEA] px-3.5 py-3.5 sm:px-5">
              <h2 className="text-sm font-bold tabular-nums text-[#152B22] sm:text-base">
                {shortDate.format(asCalendarDate(weekStart))} – {fullDate.format(asCalendarDate(days[6]))}
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button type="button" aria-label="Tuần trước" title="Tuần trước" onClick={() => goToWeek(offsetDate(weekStart, -7))}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE7DE] text-[#16422C] hover:bg-emerald-50">
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => goToWeek(thisWeek)}
                  className="h-9 rounded-xl border border-[#DCE7DE] px-2.5 text-xs font-semibold text-[#16422C] hover:bg-emerald-50 sm:px-3">
                  Tuần này
                </button>
                <button type="button" aria-label="Tuần sau" title="Tuần sau" onClick={() => goToWeek(offsetDate(weekStart, 7))}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE7DE] text-[#16422C] hover:bg-emerald-50">
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Làm mới lịch" title="Làm mới lịch" onClick={() => setRevision(value => value + 1)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE7DE] text-[#16422C] hover:bg-emerald-50">
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {loadError && (
              <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Chưa cập nhật được lịch. {data ? 'Đang hiển thị lịch lần tải trước.' : 'Bấm Làm mới lịch để thử lại.'}
              </p>
            )}
            {!data && !loadError && <p role="status" className="px-4 py-6 text-sm text-neutral-600">Đang tải lịch thuê sân…</p>}

            {data && (
              <>
                <div aria-label="Chọn ngày" className="grid grid-cols-7 gap-1 border-b border-[#E9EFEA] bg-[#F8FAF8] px-2 py-2 lg:hidden">
                  {days.map(day => {
                    const date = asCalendarDate(day);
                    return (
                      <button key={day} type="button" aria-pressed={day === activeDay}
                        aria-label={`${calendarDay.format(date)} ${shortDate.format(date)}, ${byDay.get(day)?.length ?? 0} ca`}
                        onClick={() => { setActiveDay(day); setActiveBookingId(null); }}
                        className={`min-w-0 rounded-xl py-2 text-center ${day === activeDay
                          ? 'bg-[#16422C] text-white' : 'text-[#284D3E] hover:bg-[#E7EFEA]'}`}>
                        <span className="block text-[10px] font-medium">{calendarDay.format(date)}</span>
                        <span className="mt-0.5 block text-xs font-bold tabular-nums">{shortDate.format(date)}</span>
                      </button>
                    );
                  })}
                </div>

                <ol aria-label="Lịch trong tuần" className="grid lg:grid-cols-7 lg:divide-x lg:divide-[#E9EFEA]">
                  {days.map(day => {
                    const date = asCalendarDate(day);
                    const bookings = byDay.get(day) ?? [];
                    return (
                      <li key={day} className={`min-w-0 ${day !== activeDay ? 'hidden lg:block' : ''}`}>
                        <div className={`flex items-center justify-between gap-1 border-b border-[#E9EFEA] px-3 py-2.5
                          ${day === today ? 'bg-[#EAF4ED]' : 'bg-[#F8FAF8]'}`}>
                          <time dateTime={day} className="text-xs font-semibold tabular-nums text-[#254437]">
                            {calendarDay.format(date)} · {shortDate.format(date)}
                          </time>
                          {bookings.length > 0 && <span className="shrink-0 text-[10px] tabular-nums text-[#466355]">{bookings.length} ca</span>}
                        </div>
                        <div className="min-h-[135px] space-y-2 px-2 py-2.5 lg:min-h-[235px]">
                          {bookings.length === 0 ? (
                            <p className="px-1 py-2 text-xs text-neutral-500">{data.bookings.length ? 'Không có lịch' : '—'}</p>
                          ) : bookings.map(booking => (
                            <button key={booking.reservationId} type="button"
                              onClick={() => setActiveBookingId(booking.reservationId === activeBookingId ? null : booking.reservationId)}
                              aria-expanded={booking.reservationId === activeBookingId}
                              aria-controls={booking.reservationId === activeBookingId ? 'schedule-booking-detail' : undefined}
                              className={`block w-full rounded-xl border p-2.5 text-left hover:border-[#88AD99] focus-visible:outline-[#16422C]
                                ${booking.reservationId === activeBookingId ? 'border-[#88AD99] bg-[#EDF6F0]' : 'border-[#E4EBE7] bg-[#FAFCFA]'}`}>
                              <span className="block break-words text-xs font-bold tabular-nums text-[#16422C]">{slotTime(booking)}</span>
                              <span className="mt-1 block break-words text-xs font-semibold text-[#172E25]">{booking.groupName}</span>
                              <span className="mt-0.5 block break-words text-[11px] text-neutral-600">{booking.venueName} · {booking.unitNumber}</span>
                              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statuses[booking.status].color}`}>
                                {statuses[booking.status].label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {data.bookings.length === 0 && (
                  <p className="border-t border-[#E9EFEA] px-4 py-3 text-center text-sm text-neutral-600">Bạn chưa có ca thuê sân trong tuần này.</p>
                )}
              </>
            )}
          </section>
        )}

        {activeBooking && <ScheduleBookingDetail key={activeBooking.reservationId} booking={activeBooking}
          onClose={() => setActiveBookingId(null)} />}
      </div>
    </div>
  );
}

function ScheduleBookingDetail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [showTicket, setShowTicket] = useState(false);
  const [ticket, setTicket] = useState<MyTicketRecord | null>();
  const [ticketError, setTicketError] = useState(false);
  const [ticketRevision, setTicketRevision] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const detail = detailRef.current;
    if (detail && detail.getBoundingClientRect().top > window.innerHeight - 140) {
      detail.scrollIntoView({ block: 'start' });
    }
  }, []);

  const canViewTicket = booking.status === 'CONFIRMED';
  const ticketExpired = ticket?.qrExpiresAt ? Date.parse(ticket.qrExpiresAt) <= Date.now() : false;

  useEffect(() => {
    if (!showTicket || !canViewTicket) return;
    const request = new AbortController();
    setTicketError(false);
    void marketplaceApi.getMyTicket(booking.reservationId, request.signal).then(result => {
      if (!request.signal.aborted) setTicket(result);
    }).catch(() => {
      if (!request.signal.aborted) setTicketError(true);
    });
    return () => request.abort();
  }, [booking.reservationId, showTicket, canViewTicket, ticketRevision]);

  return (
    <section id="schedule-booking-detail" ref={detailRef} aria-label="Chi tiết ca thuê" className="mt-4 scroll-mt-24 rounded-[22px] border border-[#E0E9E3] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#152B22]">{booking.groupName} · {booking.unitNumber}</h2>
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statuses[booking.status].color}`}>
            {statuses[booking.status].label}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết ca thuê"
          className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2 text-sm text-neutral-700">
        <p className="flex gap-2"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#16422C]" />
          {slotTime(booking)} · {fullDate.format(asCalendarDate(dateInVietnam(new Date(booking.slotStart))))}</p>
        <p className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#16422C]" />
          <span>{booking.venueName}{booking.venueAddress && <span className="block text-xs text-neutral-600">{booking.venueAddress}</span>}</span></p>
        {booking.holdExpiresAt && (
          <p className="text-xs text-amber-900">Giữ sân đến {time.format(new Date(booking.holdExpiresAt))}.</p>
        )}
      </div>

      {canViewTicket && (
        <>
          <ActionButton variant="outline" size="sm" className="mt-4" onClick={() => setShowTicket(value => !value)}>
            <span className="inline-flex items-center gap-1.5">
              <Ticket aria-hidden="true" className="h-4 w-4" /> {showTicket ? 'Ẩn vé nhận sân' : 'Xem vé nhận sân'}
            </span>
          </ActionButton>
          {showTicket && (
            <div className="mt-3 rounded-xl border border-[#E0E9E3] bg-[#F5F9F6] p-3 text-sm text-[#16422C]">
              {ticketError ? (
                <p role="alert">Chưa tải được vé. <button type="button" className="underline" onClick={() => setTicketRevision(value => value + 1)}>Thử lại</button></p>
              ) : ticket === undefined ? (
                <p role="status">Đang tải vé…</p>
              ) : !ticket ? (
                <p>Chưa tìm thấy vé cho ca này.</p>
              ) : ticketExpired ? (
                <p>Vé nhận sân đã hết hạn.</p>
              ) : ticket.qrToken || ticket.checkinPinCode ? (
                <div className="flex flex-wrap items-center gap-3">
                  {ticket.qrToken && <QRCodeSVG value={ticket.qrToken} size={180} marginSize={4} title="Vé QR nhận sân" />}
                  {ticket.checkinPinCode && <p>PIN nhận sân <strong className="ml-1 font-mono tracking-widest">{ticket.checkinPinCode}</strong></p>}
                </div>
              ) : <p>Ca này chưa có vé QR hoặc PIN khả dụng.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
