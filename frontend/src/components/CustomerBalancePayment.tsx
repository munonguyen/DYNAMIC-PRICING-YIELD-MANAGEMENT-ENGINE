import { useCallback, useEffect, useRef, useState } from 'react';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import type { BookingPaymentStatus } from '../types/marketplace';
import { CheckoutPaymentQr } from './CheckoutPaymentQr';
import { ActionButton } from './FairwayControls';

const PENDING_REFRESH_MS = 2_000;
const REVIEW_REFRESH_MS = 15_000;
const LATE_NOTICE_WINDOW_MS = 2 * 60_000;

function isPaidInFull(status: BookingPaymentStatus | null) {
  return status?.paymentStatus === 'VERIFIED' && status.remainingAtVenue === 0;
}

export function CustomerBalancePayment({ reservationId }: { reservationId: string }) {
  const [payment, setPayment] = useState<BookingPaymentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const createRequest = useRef<AbortController | null>(null);
  const notified = useRef(false);
  const watchUntil = useRef(0);
  const acceptStatus = useCallback((status: BookingPaymentStatus) => {
    const expiresAt = status.balancePayment?.qr?.holdUntil;
    if (expiresAt) watchUntil.current = Date.parse(expiresAt) + LATE_NOTICE_WINDOW_MS;
    setPayment(status);
    if (!notified.current && isPaidInFull(status)) {
      notified.current = true;
      window.dispatchEvent(new CustomEvent('arenapulse:balance-updated', { detail: status }));
    }
  }, []);

  useEffect(() => () => createRequest.current?.abort(), []);

  const balance = payment?.balancePayment;
  const watchingLateNotice = payment?.reservationStatus === 'CONFIRMED' && payment.remainingAtVenue > 0
    && Date.now() < watchUntil.current;
  const refreshInterval = balance?.state === 'PENDING' ? PENDING_REFRESH_MS
    : balance?.state === 'REVIEW_REQUIRED' || watchingLateNotice ? REVIEW_REFRESH_MS : null;

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let delay = refreshInterval ?? PENDING_REFRESH_MS;
    let timer: number | undefined;
    let inFlight = false;
    const refresh = async () => {
      if (controller.signal.aborted || document.hidden || inFlight || notified.current) return;
      window.clearTimeout(timer);
      inFlight = true;
      try {
        const status = await marketplaceApi.getBookingPaymentStatus(reservationId, controller.signal);
        if (controller.signal.aborted) return;
        setStatusError(null);
        acceptStatus(status);
        delay = refreshInterval ?? PENDING_REFRESH_MS;
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatusError(error instanceof Error ? error.message : 'Chưa tải được thông tin thanh toán.');
          delay = Math.min(delay * 2, 30_000);
        }
      } finally {
        inFlight = false;
        if (refreshInterval && !document.hidden && !controller.signal.aborted && !notified.current) {
          timer = window.setTimeout(refresh, delay);
        }
      }
    };

    void refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reservationId, refreshInterval, busy, revision, acceptStatus]);

  const createQr = async () => {
    if (createRequest.current) return;
    const request = new AbortController();
    createRequest.current = request;
    setActionError(null);
    setBusy(true);
    try {
      const status = await marketplaceApi.createVietQrBalance(reservationId, request.signal);
      if (!request.signal.aborted) acceptStatus(status);
    } catch (error) {
      if (!request.signal.aborted) {
        setActionError(error instanceof Error ? error.message : 'Chưa tạo được mã thanh toán.');
      }
    } finally {
      createRequest.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  };

  const error = statusError || (balance?.qr ? null : actionError);
  const paidInFull = isPaidInFull(payment);
  if (!balance && !error && !paidInFull) return null;

  return (
    <section aria-label="Thanh toán phần còn lại" className="mt-4 space-y-2 rounded-2xl border border-[#16422C]/20 bg-[#F5F9F5] p-3 sm:p-4">
      <h4 className="text-sm font-semibold text-[#16422C]">Thanh toán phần còn lại</h4>
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-xs text-rose-700">{error}</p>
          <button type="button" className="text-xs font-medium underline" onClick={() => setRevision(value => value + 1)}>
            Kiểm tra lại
          </button>
        </div>
      )}
      {paidInFull && <p role="status" className="text-xs text-[#16422C]">Đã thanh toán đủ tiền sân.</p>}
      {balance?.state === 'AVAILABLE' && (
        <ActionButton variant="forest" size="sm" disabled={busy} onClick={() => void createQr()}>
          {busy ? 'Đang tạo mã…' : `Tạo mã VietQR · ${formatVnd(balance.amount)}`}
        </ActionButton>
      )}
      {balance?.state === 'PENDING' && (
        <p role="status" className="text-xs text-neutral-700">
          {balance.qr ? 'Đang chờ VietQR báo tiền vào. Trạng thái sẽ tự cập nhật.' : 'Chưa tải được mã. Đang kiểm tra trạng thái với hệ thống.'}
        </p>
      )}
      {balance?.state === 'REVIEW_REQUIRED' && (
        <p role="alert" className="text-xs text-amber-900">Khoản chuyển đang được đối soát. Vui lòng chờ trước khi chuyển lại.</p>
      )}
      {balance?.qr && balance.reference && (
        <CheckoutPaymentQr qr={balance.qr} provider="VIETQR_NAPAS" amount={balance.amount}
          reference={balance.reference} isBalance />
      )}
    </section>
  );
}
