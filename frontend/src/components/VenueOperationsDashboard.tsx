import { Activity, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import type { VenueOperationsSnapshot } from '../types/marketplace';

const periods = [
  { label: 'Hôm nay', key: 'today' },
  { label: 'Tuần này', key: 'week' },
  { label: 'Tháng này', key: 'month' },
] as const;

const dayLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' });
const dateLabel = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const timeLabel = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
});

export function VenueOperationsDashboard({ tenantId, revision }: { tenantId: string; revision: number }) {
  const [snapshot, setSnapshot] = useState<{ tenantId: string; result: VenueOperationsSnapshot } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const result = await marketplaceApi.getVenueOperationsDashboard(tenantId, request.signal);
        if (request.signal.aborted) return;
        setSnapshot({ tenantId, result });
        setError(null);
      } catch (error) {
        if (!request.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Chưa tải được số liệu cơ sở.');
        }
      } finally {
        inFlight = false;
      }
    };

    setError(null);
    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      request.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tenantId, revision, reload]);

  const data = snapshot?.tenantId === tenantId ? snapshot.result : null;
  const maxActivity = Math.max(1, ...(data?.activity.flatMap(({ scheduled, arrivals }) => [scheduled, arrivals]) ?? []));

  return (
    <section aria-label="Doanh thu và hoạt động cơ sở" className="rounded-[26px] border border-neutral-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Doanh thu thực thu</h2>
          <p className="mt-1 text-xs text-neutral-600">Tiền đã được cổng xác nhận, sau khi trừ các khoản đã hoàn.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <p className="text-xs text-neutral-600">Cập nhật {timeLabel.format(new Date(data.updatedAt))}</p>}
          <button type="button" aria-label="Làm mới số liệu" title="Làm mới số liệu"
            onClick={() => setReload(value => value + 1)}
            className="rounded-full border border-neutral-200 p-2 text-[#16422C] hover:bg-emerald-50">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}{data && ' Đang hiển thị số liệu lần cập nhật trước.'}</p>}
      {!data && !error && <p role="status" className="mt-3 text-sm text-neutral-600">Đang tải dữ liệu cơ sở…</p>}
      {data && (
        <>
          <dl className="mt-4 grid gap-2 min-[360px]:grid-cols-3 sm:gap-3">
            {periods.map(({ label, key }) => (
              <div key={key} className="min-w-0 rounded-2xl border border-[#16422C]/15 bg-[#F4F8F4] px-3 py-3 sm:px-4">
                <dt className="text-xs font-medium text-[#325545]">{label}</dt>
                <dd className="mt-1 break-words text-sm font-bold tabular-nums text-[#16422C] sm:text-xl">
                  {formatVnd(data.revenue[key])}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                <Activity aria-hidden="true" className="h-4 w-4 text-[#16422C]" /> Hoạt động trong tuần
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#A9CFB2]" /> Lịch đã xác nhận</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#16422C]" /> Lượt nhận sân</span>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-3">
              {data.activity.map(({ day, scheduled, arrivals }) => {
                const date = new Date(`${day}T00:00:00Z`);
                const label = `${dayLabel.format(date)} ${dateLabel.format(date)}`;
                return (
                  <li key={day} aria-label={`${label}, ${scheduled} lịch đã xác nhận, ${arrivals} lượt nhận sân`}
                    className={`min-w-0 rounded-xl px-1 py-2 text-center ${day === data.today ? 'bg-[#EFF6EF]' : ''}`}>
                    <div aria-hidden="true" className="flex h-20 items-end justify-center gap-1 border-b border-neutral-100 sm:gap-2">
                      <div title={`${scheduled} lịch`} className="w-3 rounded-t bg-[#A9CFB2] sm:w-5"
                        style={{ height: `${(scheduled / maxActivity) * 100}%` }} />
                      <div title={`${arrivals} lượt`} className="w-3 rounded-t bg-[#16422C] sm:w-5"
                        style={{ height: `${(arrivals / maxActivity) * 100}%` }} />
                    </div>
                    <p aria-hidden="true" className="mt-1 text-xs font-medium text-[#0F172A]">{dayLabel.format(date)}</p>
                    <p aria-hidden="true" className="text-[10px] tabular-nums text-neutral-600">{dateLabel.format(date)}</p>
                    <p aria-hidden="true" className="mt-1 text-[11px] font-medium tabular-nums text-[#16422C]">{scheduled} / {arrivals}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
