import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Ticket } from 'lucide-react';
import type { CustomerScheduleBooking } from '../types/marketplace';
import { asCalendarDate, calendarDay, dateInVietnam, fullDate, shortDate, slotTime, statuses } from '../utils/customerSchedule';

const weekLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const agendaDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' });
const weekButton = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#DCE7DE] bg-white text-[#16422C] hover:bg-emerald-50';

interface MobileScheduleWeekProps {
  days: string[];
  today: string;
  activeDay: string;
  loaded: boolean;
  byDay: ReadonlyMap<string, CustomerScheduleBooking[]>;
  onDayChange: (day: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

export function MobileScheduleWeek({
  days, today, activeDay, byDay, loaded, onDayChange, onPreviousWeek, onNextWeek,
}: MobileScheduleWeekProps) {
  return (
    <section aria-label="Chọn ngày theo tuần" className="rounded-[22px] border border-[#DFEAE1] bg-white px-2.5 pb-2.5 pt-3 shadow-sm lg:hidden">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-bold tabular-nums text-[#173C2B]">
          {shortDate.format(asCalendarDate(days[0]))} – {fullDate.format(asCalendarDate(days[6]))}
        </h2>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Tuần trước" onClick={onPreviousWeek} className={weekButton}>
            <ChevronLeft aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          <button type="button" aria-label="Tuần sau" onClick={onNextWeek} className={weekButton}>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div aria-label="Chọn ngày" className="mt-2 grid grid-cols-7 gap-0.5 rounded-[18px] bg-[#F3F7F4] p-0.5">
        {days.map((day, index) => {
          const date = asCalendarDate(day);
          const count = byDay.get(day)?.length ?? 0;
          const selected = day === activeDay;
          return (
            <button key={day} type="button" aria-pressed={selected} aria-current={day === today ? 'date' : undefined}
              aria-label={`${calendarDay.format(date)} ${shortDate.format(date)}${loaded ? `, ${count} ca` : ''}`}
              onClick={() => onDayChange(day)}
              className={`flex min-h-[68px] min-w-0 flex-col items-center justify-center rounded-[14px] py-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#16422C] ${selected
                ? 'bg-[#16422C] text-white shadow-[0_3px_7px_rgba(22,66,44,0.2)]'
                : day === today ? 'bg-[#E0EDE5] text-[#173C2B]' : 'text-[#374C42] hover:bg-[#E8F0EA]'}`}>
              <span className={`text-[10px] font-semibold ${selected ? 'text-emerald-50/90' : 'text-[#475F51]'}`}>{weekLabels[index]}</span>
              <span className="text-[17px] font-bold leading-6 tabular-nums">{date.getUTCDate().toString().padStart(2, '0')}</span>
              <span aria-hidden="true" className={`min-h-3.5 min-w-3.5 rounded-full px-0.5 text-[9px] font-bold leading-3.5 tabular-nums ${count
                ? selected ? 'bg-white/20 text-white' : 'bg-[#E0ECE4] text-[#214C35]' : ''}`}>
                {count || ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface MobileScheduleAgendaProps {
  activeDay: string;
  today: string;
  bookings: CustomerScheduleBooking[];
  upcomingDay: string | null;
  onToday: () => void;
  onRefresh: () => void;
  onDayChange: (day: string) => void;
  onOpenBooking: (id: string, showTicket?: boolean) => void;
  busy: boolean;
  error: boolean;
}

export function MobileScheduleAgenda({
  activeDay, today, bookings, upcomingDay, onToday, onRefresh, onDayChange, onOpenBooking, busy, error,
}: MobileScheduleAgendaProps) {
  const displayedDate = asCalendarDate(activeDay);
  return (
    <section aria-label="Lịch theo ngày" className="mt-5 lg:hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold capitalize leading-tight text-[#1A382B]">{agendaDate.format(displayedDate)}</h2>
          {!busy && !error && (
            <p className="mt-0.5 text-xs font-medium text-[#50645A]">
              {activeDay === today ? 'Hôm nay · ' : ''}{bookings.length} ca
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {activeDay !== today && (
            <button type="button" onClick={onToday}
              className="min-h-11 rounded-2xl border border-[#DCE7DE] bg-white px-2.5 text-xs font-bold text-[#16422C] hover:bg-emerald-50">
              Hôm nay
            </button>
          )}
          <button type="button" aria-label="Làm mới lịch" onClick={onRefresh} className={weekButton}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {busy && <p role="status" className="rounded-[20px] border border-[#DFEAE1] bg-white p-4 text-sm text-neutral-600">Đang tải lịch thuê sân…</p>}
      {!busy && !error && bookings.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#CEDDD2] bg-white p-5 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto h-5 w-5 text-[#41604C]" />
          <p className="mt-2 text-sm font-semibold text-[#3A5345]">Không có ca thuê vào ngày này.</p>
          {upcomingDay && (
            <button type="button" onClick={() => onDayChange(upcomingDay)}
              className="mt-2 min-h-11 rounded-2xl bg-[#EAF3ED] px-3 text-xs font-bold text-[#16422C] hover:bg-[#E0EDE4]">
              Xem ca sắp tới · {shortDate.format(asCalendarDate(upcomingDay))}
            </button>
          )}
        </div>
      )}

      {bookings.length > 0 && (
        <ol className="space-y-2.5" aria-label="Các ca trong ngày">
          {bookings.map(booking => (
            <li key={booking.reservationId} className="overflow-hidden rounded-[20px] border border-[#DFEAE1] bg-white shadow-[0_4px_14px_rgba(22,66,44,0.035)]">
              <button type="button" aria-haspopup="dialog" onClick={() => onOpenBooking(booking.reservationId)}
                className="block w-full min-w-0 p-3.5 text-left hover:bg-[#F8FBF8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#16422C]">
                <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-lg font-bold leading-6 tabular-nums tracking-tight text-[#16422C]">{slotTime(booking)}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statuses[booking.status].color}`}>
                    {statuses[booking.status].label}
                  </span>
                </span>
                <span className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-bold leading-snug text-[#183226]">{booking.groupName}</span>
                    <span className="mt-1 block break-words text-xs leading-relaxed text-[#4B6255]">
                      {booking.venueName} · {booking.unitNumber}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#476B55]" />
                </span>
              </button>
              {booking.status === 'CONFIRMED' && (
                <div className="border-t border-[#EDF2EE] px-2.5 py-1.5">
                  <button type="button" aria-haspopup="dialog" onClick={() => onOpenBooking(booking.reservationId, true)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#EAF3ED] px-3.5 text-xs font-bold text-[#16422C] hover:bg-[#E0EDE4]">
                    <Ticket aria-hidden="true" className="h-4 w-4" /> Mở vé nhận sân
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function findUpcomingScheduleDay(bookings: CustomerScheduleBooking[], activeDay: string, now: number) {
  const next = bookings.find(booking => (booking.status === 'HELD' || booking.status === 'CONFIRMED')
    && Date.parse(booking.slotStart) >= now);
  if (!next) return null;
  const nextDay = dateInVietnam(new Date(next.slotStart));
  return nextDay === activeDay ? null : nextDay;
}
