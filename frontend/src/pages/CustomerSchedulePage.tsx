import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, Ticket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { marketplaceApi } from '../api/marketplaceApi';
import { ActionButton } from '../components/FairwayControls';
import type { CustomerSchedule, MyTicketRecord } from '../types/marketplace';

import {
  asCalendarDate, calendarDay, dateInVietnam, fullDate, mondayOf, offsetDate, shortDate, slotTime, statuses, time,
} from '../utils/customerSchedule';
import { findUpcomingScheduleDay, MobileScheduleAgenda, MobileScheduleWeek } from '../components/CustomerScheduleMobile';

type Booking = CustomerSchedule['bookings'][number];

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
  const [selection, setSelection] = useState<{ id: string; showTicket: boolean } | null>(null);
  const activeBookingId = selection?.id;
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

  const goToDay = (day: string) => {
    setActiveDay(day);
    setSelection(null);
  };
  const openBooking = (id: string, showTicket = false) => setSelection({ id, showTicket });
  const refreshSchedule = () => setRevision(value => value + 1);

  const goToWeek = (week: string) => {
    setWeekStart(week);
    goToDay(week === thisWeek ? today : week);
  };

  return (
    <div className="min-h-[75vh] bg-[#F5F8F6] px-3.5 pb-24 pt-24 sm:px-7 sm:pt-28">
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
          <section aria-label="Thời khóa biểu thuê sân" className="mt-5 lg:overflow-hidden lg:rounded-[22px] lg:border lg:border-[#E0E9E3] lg:bg-white lg:shadow-sm">
            <MobileScheduleWeek days={days} today={today} activeDay={activeDay} byDay={byDay} loaded={data !== null}
              onDayChange={goToDay} onPreviousWeek={() => goToWeek(offsetDate(weekStart, -7))}
              onNextWeek={() => goToWeek(offsetDate(weekStart, 7))} />

            <div className="hidden flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-[#E9EFEA] px-3.5 py-3.5 sm:px-5 lg:flex">
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
                <button type="button" aria-label="Làm mới lịch" title="Làm mới lịch" onClick={refreshSchedule}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE7DE] text-[#16422C] hover:bg-emerald-50">
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {loadError && (
              <p role="alert" className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800 lg:mt-0 lg:rounded-none lg:border-x-0 lg:border-t-0">
                Chưa cập nhật được lịch. {data ? 'Đang hiển thị lịch lần tải trước.' : 'Bấm Làm mới lịch để thử lại.'}
              </p>
            )}
            {!data && !loadError && <p role="status" className="hidden px-4 py-6 text-sm text-neutral-600 lg:block">Đang tải lịch thuê sân…</p>}

            <MobileScheduleAgenda activeDay={activeDay} today={today} bookings={byDay.get(activeDay) ?? []}
              busy={!data && !loadError} error={loadError} onToday={() => goToWeek(thisWeek)} onRefresh={refreshSchedule}
              onDayChange={goToDay} onOpenBooking={openBooking}
              upcomingDay={findUpcomingScheduleDay(data?.bookings ?? [], activeDay, Date.now())} />

            {data && (
              <>
                <ol aria-label="Lịch trong tuần" className="hidden grid-cols-7 divide-x divide-[#E9EFEA] lg:grid">
                  {days.map(day => {
                    const date = asCalendarDate(day);
                    const bookings = byDay.get(day) ?? [];
                    return (
                      <li key={day} className="min-w-0">
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
                              onClick={() => {
                                if (booking.reservationId === activeBookingId) setSelection(null);
                                else openBooking(booking.reservationId);
                              }}
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
                  <p className="hidden border-t border-[#E9EFEA] px-4 py-3 text-center text-sm text-neutral-600 lg:block">Bạn chưa có ca thuê sân trong tuần này.</p>
                )}
              </>
            )}
          </section>
        )}

        {activeBooking && selection && (
          <ScheduleBookingDetail key={`${activeBooking.reservationId}:${selection.showTicket}`} booking={activeBooking}
            startWithTicket={selection.showTicket} onClose={() => setSelection(null)} />
        )}
      </div>
    </div>
  );
}

const desktopQuery = '(min-width: 64rem)';

function ScheduleBookingDetail({ booking, startWithTicket, onClose }: {
  booking: Booking;
  startWithTicket: boolean;
  onClose: () => void;
}) {
  const [showTicket, setShowTicket] = useState(startWithTicket);
  const [desktop, setDesktop] = useState(() => window.matchMedia(desktopQuery).matches);
  const [ticket, setTicket] = useState<MyTicketRecord | null>();
  const [ticketError, setTicketError] = useState(false);
  const [ticketRevision, setTicketRevision] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeDetail = () => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    const query = window.matchMedia(desktopQuery);
    const update = (event: MediaQueryListEvent) => setDesktop(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const detail = detailRef.current;
    if (desktop) {
      if (detail && detail.getBoundingClientRect().top > window.innerHeight - 140) {
        detail.scrollIntoView({ block: 'start' });
      }
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [desktop]);

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

  const details = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className="text-base font-bold text-[#152B22]">{booking.groupName} · {booking.unitNumber}</h2>
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statuses[booking.status].color}`}>
            {statuses[booking.status].label}
          </span>
        </div>
        <button type="button" onClick={closeDetail} aria-label="Đóng chi tiết ca thuê"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#E0E9E3] text-neutral-700 hover:bg-neutral-100 lg:h-9 lg:w-9">
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
          <ActionButton variant="outline" size="sm" className="mt-4 min-h-11 lg:min-h-0" onClick={() => setShowTicket(value => !value)}>
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
                <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-3 text-center lg:flex-row lg:bg-transparent lg:p-0 lg:text-left">
                  {ticket.qrToken && <QRCodeSVG value={ticket.qrToken} size={196} marginSize={4} title="Vé QR nhận sân" className="h-auto max-w-full" />}
                  {ticket.checkinPinCode && <p>PIN nhận sân <strong className="ml-1 select-all font-mono text-base tracking-widest">{ticket.checkinPinCode}</strong></p>}
                </div>
              ) : <p>Ca này chưa có vé QR hoặc PIN khả dụng.</p>}
            </div>
          )}
        </>
      )}
    </>
  );

  if (desktop) {
    return (
      <section id="schedule-booking-detail" ref={detailRef} aria-label="Chi tiết ca thuê"
        className="mt-4 scroll-mt-24 rounded-[22px] border border-[#E0E9E3] bg-white p-5">
        {details}
      </section>
    );
  }

  return (
    <dialog id="schedule-booking-detail" ref={dialogRef} aria-label="Chi tiết ca thuê"
      onCancel={event => { event.preventDefault(); closeDetail(); }}
      onClick={event => { if (event.target === event.currentTarget) closeDetail(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[calc(100dvh-3rem)] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[26px] border border-[#E0E9E3] bg-white shadow-xl backdrop:bg-[#10251A]/55">
      <div className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {details}
      </div>
    </dialog>
  );
}
