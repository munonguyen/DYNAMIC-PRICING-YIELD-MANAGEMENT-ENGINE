import type { CustomerScheduleBooking } from '../types/marketplace';

const ZONE = 'Asia/Ho_Chi_Minh';
const venueDate = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const calendarDay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'short' });
export const shortDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
export const fullDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
export const time = new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const statuses: Record<CustomerScheduleBooking['status'], { label: string; color: string }> = {
  HELD: { label: 'Chờ thanh toán', color: 'bg-amber-100 text-amber-900' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-900' },
  COMPLETED: { label: 'Đã nhận sân', color: 'bg-sky-100 text-sky-900' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-rose-100 text-rose-900' },
  EXPIRED: { label: 'Hết hạn giữ sân', color: 'bg-neutral-200 text-neutral-700' },
  NO_SHOW: { label: 'Không đến', color: 'bg-slate-200 text-slate-800' },
};

export function dateInVietnam(date: Date) {
  const parts = venueDate.formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function asCalendarDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

export function offsetDate(day: string, offset: number) {
  const date = asCalendarDate(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(day: string) {
  return offsetDate(day, -((asCalendarDate(day).getUTCDay() + 6) % 7));
}

export function slotTime(booking: CustomerScheduleBooking) {
  const start = new Date(booking.slotStart);
  const end = new Date(booking.slotEnd);
  const nextDay = dateInVietnam(start) !== dateInVietnam(end);
  return `${time.format(start)}–${time.format(end)}${nextDay ? ` (${shortDate.format(asCalendarDate(dateInVietnam(end)))})` : ''}`;
}
