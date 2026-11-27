import { Activity } from 'lucide-react';
import { useState } from 'react';
import type { VenueOperationsSnapshot } from '../types/marketplace';

const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const number = new Intl.NumberFormat('vi-VN');
const GRID_STEPS = 4;

const activitySeries = [
  { key: 'scheduled', label: 'Lịch đã xác nhận', swatch: 'bg-[#7FA8EB]', bar: 'bg-gradient-to-t from-[#477ACD] to-[#91B8F4]' },
  { key: 'arrivals', label: 'Lượt nhận sân', swatch: 'bg-[#158263]', bar: 'bg-gradient-to-t from-[#0B5946] to-[#20A47C]' },
] as const;

export function VenueWeeklyActivityChart({ activity, today }: Pick<VenueOperationsSnapshot, 'activity' | 'today'>) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = activity.find(({ day }) => day === selectedDay)
    ?? activity.find(({ day }) => day === today)
    ?? activity[0];
  if (!selected) return null;

  const peak = Math.max(0, ...activity.flatMap(({ scheduled, arrivals }) => [scheduled, arrivals]));
  const targetStep = Math.max(1, peak / GRID_STEPS);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = ([1, 2, 5].find(factor => targetStep <= factor * magnitude) ?? 10) * magnitude;
  const upperBound = GRID_STEPS * step;
  const ticks = Array.from({ length: GRID_STEPS + 1 }, (_, index) => index * step);
  const firstDate = toDate(activity[0].day);
  const lastDate = toDate(activity[activity.length - 1].day);
  const selectedDate = toDate(selected.day);

  return (
    <section aria-label="Biểu đồ hoạt động trong tuần"
      className="mt-4 min-w-0 rounded-[22px] border border-[#E4EBEC] bg-gradient-to-b from-[#FAFCFD] to-white px-3.5 py-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#E0ECE9] bg-[#ECF7F2] text-[#145D4A]">
            <Activity aria-hidden="true" className="h-[17px] w-[17px]" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#152938] sm:text-base">Hoạt động trong tuần</h3>
            <p className="text-xs font-medium tabular-nums text-[#526674]">
              {shortDate.format(firstDate)} – {shortDate.format(lastDate)}
            </p>
          </div>
        </div>
        <ul aria-label="Chú giải" className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-[#405866]">
          {activitySeries.map(({ key, label, swatch }) => (
            <li key={key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${swatch}`} />{label}
            </li>
          ))}
        </ul>
      </div>

      {peak === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-[#526674]">
          Tuần này chưa có lịch đã xác nhận hay lượt nhận sân.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 pt-2 sm:gap-3">
            <div aria-hidden="true" className="relative h-32 min-w-4 text-right text-[10px] tabular-nums text-[#526674] sm:h-40 sm:text-[11px]">
              <span className="invisible">{number.format(upperBound)}</span>
              {ticks.map(value => (
                <span key={value} className="absolute right-0 translate-y-1/2" style={{ bottom: `${value / upperBound * 100}%` }}>
                  {number.format(value)}
                </span>
              ))}
            </div>
            <div className="relative min-w-0">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 sm:h-40">
                {ticks.map(value => (
                  <div key={value}
                    className={`absolute inset-x-0 border-t ${value === 0 ? 'border-[#B7C7CA]' : 'border-dashed border-[#DDE6E8]'}`}
                    style={{ bottom: `${value / upperBound * 100}%` }} />
                ))}
              </div>
              <ul aria-label="Số lượt theo ngày" className="relative grid grid-cols-7">
                {activity.map(row => {
                  const date = toDate(row.day);
                  const active = row.day === selected.day;
                  return (
                    <li key={row.day} className="min-w-0 px-px sm:px-1">
                      <button type="button" aria-pressed={active}
                        aria-label={`${weekday.format(date)} ${shortDate.format(date)}: ${row.scheduled} lịch đã xác nhận, ${row.arrivals} lượt nhận sân`}
                        onClick={() => setSelectedDay(row.day)}
                        className={`group block w-full rounded-lg text-center outline-offset-2 hover:bg-[#F0F7F5] focus-visible:outline-2 focus-visible:outline-[#158263] ${active ? 'bg-[#E2F2EC]/65' : ''}`}>
                        <span aria-hidden="true" className="flex h-32 items-end justify-center gap-0.5 px-1 sm:h-40 sm:gap-1.5">
                          {activitySeries.map(({ key, bar }) => (
                            <span key={key} className={`w-[37%] max-w-6 rounded-t-md ${bar}`}
                              style={{ height: `${row[key] / upperBound * 100}%` }} />
                          ))}
                        </span>
                        <span className={`mt-2 block text-[10px] leading-4 sm:text-xs ${active ? 'font-bold text-[#12513E]' : 'font-semibold text-[#374F5C]'}`}>
                          {weekday.format(date)}
                        </span>
                        <span aria-hidden="true" className="block pb-1 text-[9px] tabular-nums text-[#637683] sm:text-[11px]">
                          {shortDate.format(date)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <dl aria-live="polite"
            className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-[#E5EDEC] bg-[#F7FAF9] px-3 py-2.5 text-xs min-[480px]:grid-cols-[1fr_auto_auto] min-[480px]:gap-x-6 sm:px-4">
            <div className="col-span-2 self-center min-[480px]:col-span-1">
              <dt className="sr-only">Ngày được chọn</dt>
              <dd className="font-semibold text-[#223B45]">{weekday.format(selectedDate)}, {shortDate.format(selectedDate)}</dd>
            </div>
            {activitySeries.map(({ key, label, swatch }) => (
              <div key={key} className="flex items-center gap-1.5 sm:gap-2">
                <dt className="flex items-center gap-1.5 text-[#405866]">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${swatch}`} />{label}
                </dt>
                <dd className="font-bold tabular-nums text-[#223B45]">{number.format(selected[key])}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

function toDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}
