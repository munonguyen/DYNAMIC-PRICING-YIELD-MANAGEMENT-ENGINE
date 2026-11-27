import { CalendarDays, CalendarRange, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import type { VenueOperationsSnapshot } from '../types/marketplace';
import { VenueWeeklyActivityChart } from './VenueWeeklyActivityChart';

const periods = [
  { label: 'Hôm nay', key: 'today', Icon: Wallet },
  { label: 'Tuần này', key: 'week', Icon: CalendarRange },
  { label: 'Tháng này', key: 'month', Icon: CalendarDays },
] as const;

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

  return (
    <section aria-label="Doanh thu và hoạt động cơ sở" className="rounded-[26px] border border-[#E1EBE9] bg-white p-4 shadow-[0_10px_36px_rgba(21,49,43,0.05)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#152938]">Doanh thu thực thu</h2>
          <p className="mt-1 text-xs text-neutral-600">Tiền đã được cổng xác nhận, sau khi trừ các khoản đã hoàn.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <p className="text-xs tabular-nums text-[#526674]">Cập nhật {timeLabel.format(new Date(data.updatedAt))}</p>}
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
          <dl className="mt-4 grid grid-cols-2 gap-2.5 min-[520px]:grid-cols-3 sm:gap-3">
            {periods.map(({ label, key, Icon }) => {
              const primary = key === 'today';
              return (
                <div key={key}
                  className={`min-w-0 rounded-2xl border p-3.5 sm:p-4 ${primary
                    ? 'col-span-2 border-[#154C40] bg-gradient-to-br from-[#133B38] to-[#246A53] text-white min-[520px]:col-span-1'
                    : 'border-[#E2ECEA] bg-[#F5F9F8] text-[#153F37]'}`}>
                  <dt className="flex items-center gap-2 text-xs font-semibold">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${primary ? 'bg-white/15' : 'bg-white text-[#247362]'}`}>
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-xl font-bold tabular-nums tracking-tight lg:text-2xl">
                    {formatVnd(data.revenue[key])}
                  </dd>
                </div>
              );
            })}
          </dl>

          <VenueWeeklyActivityChart activity={data.activity} today={data.today} />
        </>
      )}
    </section>
  );
}
