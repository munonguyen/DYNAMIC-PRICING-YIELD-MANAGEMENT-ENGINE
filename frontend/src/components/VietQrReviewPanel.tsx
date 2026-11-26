import { useEffect, useState } from 'react';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import type { VietQrReviewItem } from '../types/marketplace';

const reasons: Record<string, string> = {
  ACCOUNT_MISMATCH: 'Sai tài khoản nhận',
  CONTENT_MISMATCH: 'Sai nội dung chuyển khoản',
  AMOUNT_MISMATCH: 'Số tiền không khớp',
  ADDITIONAL_TRANSFER: 'Có thêm khoản chuyển cho giao dịch đã xử lý',
  UNMATCHED_TRANSFER: 'Chưa khớp đơn đặt sân',
  AMBIGUOUS_TRANSFER: 'Chưa xác định được đơn duy nhất',
  BOOKING_NOT_AVAILABLE: 'Không còn lượt đặt sân phù hợp',
};

export function VietQrReviewPanel() {
  const [items, setItems] = useState<VietQrReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const rows = await marketplaceApi.getVietQrReviewQueue(request.signal);
        if (!request.signal.aborted) { setItems(rows); setError(null); }
      } catch {
        if (!request.signal.aborted) setError('Chưa tải được danh sách đối soát VietQR.');
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15_000);
    return () => { request.abort(); window.clearInterval(timer); };
  }, [revision]);

  async function closeReview(id: string) {
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.closeVietQrReview(id, note.trim());
      setItems(rows => rows?.filter(row => row.id !== id) ?? null);
      setCurrent(null);
      setNote('');
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được kết quả đối soát.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="vietqr-review-title" className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
      <h4 id="vietqr-review-title" className="text-base font-bold text-[#0F172A]">Giao dịch VietQR cần đối soát</h4>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      {!items && !error && <p className="mt-2 text-sm text-neutral-600">Đang tải giao dịch…</p>}
      {items?.length === 0 && !error && <p className="mt-2 text-sm text-neutral-600">Không có giao dịch đang chờ.</p>}
      {items && items.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs text-neutral-600">
              <tr><th scope="col">Giao dịch</th><th scope="col">Số tiền</th><th scope="col">Lý do</th><th scope="col">Xử lý</th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="align-top border-t border-neutral-200">
                  <td className="py-3 pr-3 break-all">
                    <p className="font-mono font-medium">{item.reference}</p>
                    <p className="text-xs text-neutral-600">{item.content || 'Không có nội dung chuyển khoản'}</p>
                    {item.reservationId && <p className="text-xs text-neutral-600">Đơn {item.reservationId}</p>}
                    <p className="text-xs text-neutral-600">{new Date(item.receivedAt).toLocaleString('vi-VN')}</p>
                  </td>
                  <td className="py-3 pr-3 tabular-nums">{formatVnd(item.amount)}</td>
                  <td className="py-3 pr-3">{reasons[item.reason] || item.reason}</td>
                  <td className="py-3">
                    {current === item.id ? (
                      <form className="space-y-2" onSubmit={event => { event.preventDefault(); void closeReview(item.id); }}>
                        <label className="block text-xs" htmlFor="vietqr-review-note">Kết quả đã đối soát</label>
                        <textarea id="vietqr-review-note" required maxLength={500} value={note}
                          onChange={event => setNote(event.target.value)} className="w-full rounded-lg border border-neutral-300 p-2" />
                        <button type="submit" disabled={busy || !note.trim()} className="rounded-lg bg-[#16422C] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu và đóng</button>
                        <button type="button" disabled={busy} onClick={() => { setCurrent(null); setNote(''); }}
                          className="ml-2 px-2 py-2 text-xs">Hủy</button>
                      </form>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => { setCurrent(item.id); setNote(''); }}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold">Ghi kết quả</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
