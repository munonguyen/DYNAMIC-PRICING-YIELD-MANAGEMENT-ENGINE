import { useEffect, useState } from 'react';
import { Clock3, ScanLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { BookingPaymentStatus } from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';

interface MoMoCheckoutQrProps {
  qr: NonNullable<BookingPaymentStatus['paymentQr']>;
  amount: number;
  reference: string;
}

export function MoMoCheckoutQr({ qr, amount, reference }: MoMoCheckoutQrProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.ceil((Date.parse(qr.holdUntil) - now) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return <p className="text-sm text-amber-900" role="status">Đã hết thời gian giữ sân. Vui lòng dừng quét mã.</p>;
  }
  const timeLeft = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const wallet = qr.sandbox ? 'MoMo Test' : 'MoMo';

  return (
    <section aria-label="Quét QR thanh toán" className="mt-5 rounded-3xl border border-neutral-200 bg-[#F8FAF8] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[#16422C]">
          <ScanLine aria-hidden="true" className="h-5 w-5" />
          QR thanh toán {wallet}
        </h4>
        <p className="flex items-center gap-1.5 text-xs text-neutral-700">
          <Clock3 aria-hidden="true" className="h-4 w-4" />
          Còn giữ sân <span className="font-semibold tabular-nums">{timeLeft}</span>
        </p>
      </div>
      <div className="my-4 flex justify-center">
        <div className="w-full max-w-[250px] rounded-xl border border-neutral-200 bg-white p-2.5">
          <QRCodeSVG value={qr.payload} size={226} marginSize={4} level="M"
            className="block h-auto w-full" title={`Mã QR thanh toán ${wallet}`} />
        </div>
      </div>
      <p className="text-center text-xl font-semibold tabular-nums text-[#16422C]">{formatVnd(amount)}</p>
      <p className="mt-2 text-center text-sm text-neutral-700">
        Mở ứng dụng {wallet}, chọn quét mã rồi xác nhận số tiền trong ứng dụng.
      </p>
      {qr.sandbox && <p className="mt-2 text-center text-xs font-medium text-amber-900">Giao dịch thử nghiệm. Dùng ví MoMo Test.</p>}
      <p className="mt-3 break-all border-t border-neutral-200 pt-3 text-xs text-neutral-600">
        Mã giao dịch <span className="font-mono font-semibold">{reference}</span>
      </p>
    </section>
  );
}
