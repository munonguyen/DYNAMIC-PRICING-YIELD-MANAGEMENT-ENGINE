import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import type { LessorBookingOrder, QrInspectResult } from '../types/marketplace';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

interface QrCheckInScannerModalProps {
  open: boolean;
  initialTab?: 'SCANNER' | 'TICKET_PREVIEW';
  initialOrder?: LessorBookingOrder | null;
  initialQuery?: string;
  providerOrders: LessorBookingOrder[];
  allSystemOrders: LessorBookingOrder[];
  activeProviderId: string;
  activeVenueName: string;
  onClose: () => void;
  onConfirmCheckIn: (orderId: string) => void;
}

export const QrCheckInScannerModal: React.FC<QrCheckInScannerModalProps> = ({
  open,
  initialTab = 'SCANNER',
  initialOrder = null,
  initialQuery = '',
  providerOrders,
  allSystemOrders,
  activeProviderId,
  activeVenueName,
  onClose,
  onConfirmCheckIn,
}) => {
  const [tab, setTab] = useState<'SCANNER' | 'TICKET_PREVIEW'>(initialTab);
  const [previewOrder, setPreviewOrder] = useState<LessorBookingOrder | null>(initialOrder);
  const [tokenInput, setTokenInput] = useState<string>(initialQuery);
  const [inspectResult, setInspectResult] = useState<QrInspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [phoneLast4Check, setPhoneLast4Check] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrSvgWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setTab(initialTab);
    setPreviewOrder(initialOrder);
    setPhoneLast4Check('');
    setStatusNotice(null);
    if (initialQuery.trim()) {
      setTokenInput(initialQuery.trim());
      void runInspect(initialQuery.trim());
    } else if (initialTab === 'SCANNER') {
      setInspectResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, initialOrder?.orderId, initialQuery]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const runInspect = async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setTokenInput(clean);
    setInspecting(true);
    setPhoneLast4Check('');
    setStatusNotice(null);
    try {
      const res = await marketplaceApi.inspectQrTicket(
        clean,
        providerOrders,
        allSystemOrders,
        activeProviderId
      );
      setInspectResult(res);
    } finally {
      setInspecting(false);
    }
  };

  // Live Camera Loop with jsQR
  useEffect(() => {
    if (!cameraActive || !open || tab !== 'SCANNER') return;
    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth || 480;
        const h = video.videoHeight || 360;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const decoded = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (decoded?.data) {
            stopCamera();
            setStatusNotice('✓ Camera đã đọc được dữ liệu mã hóa từ mã QR!');
            void runInspect(decoded.data);
            return;
          }
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, open, tab]);

  const startCamera = async () => {
    setCameraError(null);
    setStatusNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt chưa hỗ trợ truy cập Camera hoặc đang chặn quyền Camera. Hãy dùng nút Tải ảnh QR bên cạnh.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraError('Không mở được Camera (có thể chưa cấp quyền). Bạn vẫn có thể tải trực tiếp ảnh vé QR từ Email để kiểm tra.');
    }
  };

  const handleDecodeUploadedImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    setStatusNotice(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (!decoded?.data) {
          setCameraError('Không tìm thấy mã QR hợp lệ trong ảnh tải lên. Hãy chọn ảnh rõ nét chứa mã QR vé.');
          return;
        }
        setStatusNotice(`✓ Đã giải mã QR từ ảnh "${file.name}".`);
        void runInspect(decoded.data);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadTicketPng = (order: LessorBookingOrder) => {
    const svg = qrSvgWrapRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const size = 360;
      const pad = 28;
      const canvas = document.createElement('canvas');
      canvas.width = size + pad * 2;
      canvas.height = size + pad * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, pad, pad, size, size);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `ve-qr-${order.qrCode.toLowerCase()}.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const firstPendingOrder = providerOrders.find((o) => o.status === 'CONFIRMED') ?? null;
  const firstCompletedOrder = providerOrders.find((o) => o.status === 'COMPLETED') ?? null;
  const effectivePreview = previewOrder ?? firstPendingOrder ?? providerOrders[0] ?? null;

  const phoneMatchStatus =
    inspectResult?.customerPhoneLast4 && phoneLast4Check.trim().length === 4
      ? phoneLast4Check.trim() === inspectResult.customerPhoneLast4
        ? 'MATCH'
        : 'MISMATCH'
      : 'IDLE';

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.28, ease: EXPO_EASE }}
          className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-neutral-200 bg-white p-5 sm:p-7 shadow-2xl"
        >
          {/* TOP BAR */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7D4] px-3 py-0.5 text-[10.5px] font-bold text-[#16422C]">
                Hệ thống Soát Vé &amp; Chống Giả Mạo Tại Quầy
              </span>
              <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-[#0F172A]">
                {tab === 'SCANNER'
                  ? `Quét Mã QR & Đối Chiếu Chủ Vé — ${activeVenueName}`
                  : `Mẫu Email Vé QR Ký Số Đã Gửi Khách`}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-neutral-200 bg-[#F8FAFC] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTab('SCANNER')}
                  className={`rounded-full px-3.5 py-1.5 font-bold transition cursor-pointer ${
                    tab === 'SCANNER' ? 'bg-[#16422C] text-white' : 'text-neutral-600'
                  }`}
                >
                  Máy quét Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setTab('TICKET_PREVIEW');
                  }}
                  className={`rounded-full px-3.5 py-1.5 font-bold transition cursor-pointer ${
                    tab === 'TICKET_PREVIEW' ? 'bg-[#16422C] text-white' : 'text-neutral-600'
                  }`}
                >
                  Vé Email Khách
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>

          {tab === 'SCANNER' ? (
            <div className="mt-5 space-y-5">
              {/* CAMERA / IMAGE UPLOAD / TOKEN INPUT */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-5 space-y-3">
                  <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#16422C]/35 bg-[#F4F8F4] p-3 text-center">
                    {cameraActive ? (
                      <>
                        <video
                          ref={videoRef}
                          className="h-full w-full rounded-xl object-cover"
                          muted
                          playsInline
                        />
                        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-[#84CC16] shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
                      </>
                    ) : (
                      <div className="space-y-2 text-xs text-neutral-600">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-xs">
                          📷
                        </div>
                        <p className="font-semibold text-[#0F172A]">
                          Đưa mã QR trên Email khách vào Camera
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Hoặc tải file ảnh PNG/JPG vé QR khách đưa để kiểm tra chữ ký HMAC-SHA256.
                        </p>
                      </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={cameraActive ? stopCamera : startCamera}
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        cameraActive
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#16422C] text-white hover:bg-[#123524]'
                      }`}
                    >
                      {cameraActive ? '■ Tắt Camera' : '📷 Bật Camera'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-[#0F172A] hover:bg-neutral-50 cursor-pointer"
                    >
                      🖼️ Tải ảnh QR
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleDecodeUploadedImage}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void runInspect(tokenInput);
                    }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-[#0F172A]">
                      Dán chuỗi Token QR ký số hoặc nhập Mã vé / Mã đơn
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="VD: APQR-HN01-001 hoặc eyJ..."
                        className="flex-1 rounded-xl border border-neutral-300 px-3.5 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                      />
                      <ActionButton type="submit" variant="forest" size="sm" disabled={inspecting}>
                        {inspecting ? 'Đang soi…' : 'Kiểm tra'}
                      </ActionButton>
                    </div>
                  </form>

                  {/* QUICK SIMULATION BUTTONS TO TEST ANTI-COUNTERFEIT */}
                  <div className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-3 space-y-2">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                      Mô phỏng nhanh cơ chế phát hiện vé thật / vé giả
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {firstPendingOrder && (
                        <button
                          type="button"
                          onClick={() =>
                            void runInspect(firstPendingOrder.qrToken || firstPendingOrder.qrCode)
                          }
                          className="rounded-full bg-[#E7F7D4] px-3 py-1 text-[11px] font-bold text-[#16422C] hover:brightness-95 cursor-pointer"
                        >
                          ✓ Thử quét vé thật ({firstPendingOrder.orderId})
                        </button>
                      )}
                      {firstCompletedOrder && (
                        <button
                          type="button"
                          onClick={() =>
                            void runInspect(
                              firstCompletedOrder.qrToken || firstCompletedOrder.qrCode
                            )
                          }
                          className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 hover:brightness-95 cursor-pointer"
                        >
                          ⚠ Thử vé đã dùng lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void runInspect('eyJwdXJwb3NlIjoiUVJfQ0hFQ0tJTiIsImZha2UiOnRydWV9.FAKE_SIG_TAMPERED')
                        }
                        className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-800 hover:brightness-95 cursor-pointer"
                      >
                        ✕ Thử vé giả sửa chữ ký
                      </button>
                    </div>
                  </div>

                  {cameraError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {cameraError}
                    </div>
                  )}
                  {statusNotice && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                      {statusNotice}
                    </div>
                  )}
                </div>
              </div>

              {/* 4-LAYER ANTI-COUNTERFEIT VERIFICATION RESULT CARD */}
              {inspectResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-[24px] border p-5 space-y-4 ${
                    inspectResult.valid
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : 'border-rose-300 bg-rose-50/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white ${
                          inspectResult.valid ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        {inspectResult.valid ? '✓' : '!'}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {inspectResult.valid
                            ? 'KẾT LUẬN: VÉ CHÍNH CHỦ HỢP LỆ'
                            : 'CẢNH BÁO: TỪ CHỐI NHẬN SÂN'}
                        </div>
                        <p className="text-xs text-neutral-700">{inspectResult.verdictMessage}</p>
                      </div>
                    </div>
                    {inspectResult.orderId && (
                      <span className="rounded-full bg-[#0F172A] px-3 py-1 text-[11px] font-bold text-white">
                        {inspectResult.orderId}
                      </span>
                    )}
                  </div>

                  {/* 4 SECURITY GATES */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                    {[
                      {
                        label: '1. Chữ ký HMAC-SHA256',
                        ok: inspectResult.signatureValid,
                        yes: 'Khớp chữ ký gốc',
                        no: 'Sai chữ ký / Vé giả',
                      },
                      {
                        label: '2. Đúng cụm sân',
                        ok: inspectResult.venueMatched,
                        yes: 'Khớp cơ sở này',
                        no: 'Sai sân / Không khớp',
                      },
                      {
                        label: '3. Vé dùng 1 lần',
                        ok: inspectResult.unusedAntiReplay,
                        yes: 'Chưa từng quét',
                        no: 'Đã sử dụng / Hủy',
                      },
                      {
                        label: '4. Hạn ca đặt',
                        ok: inspectResult.notExpired,
                        yes: 'Trong hiệu lực ca',
                        no: 'Quá hạn / Lỗi token',
                      },
                    ].map((gate) => (
                      <div
                        key={gate.label}
                        className={`rounded-xl border px-3 py-2 ${
                          gate.ok
                            ? 'border-emerald-200 bg-white text-emerald-900'
                            : 'border-rose-200 bg-white text-rose-800'
                        }`}
                      >
                        <div className="font-semibold text-neutral-500">{gate.label}</div>
                        <div className="mt-0.5 font-bold">
                          {gate.ok ? `✓ ${gate.yes}` : `✕ ${gate.no}`}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* IDENTITY & ESCROW VERIFICATION FOR STAFF */}
                  {inspectResult.customerName && (
                    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-1.5">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                          Thông tin người đặt đối chiếu trực tiếp
                        </div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {inspectResult.customerName}
                        </div>
                        <div className="text-neutral-600">
                          SĐT đăng ký: <strong>{inspectResult.customerPhoneMasked}</strong>
                        </div>
                        <div className="text-neutral-600">
                          Email nhận QR: <strong>{inspectResult.customerEmail}</strong>
                        </div>
                        <div className="text-[#16422C] font-semibold">
                          {inspectResult.unitNumber} • {inspectResult.groupName} ({inspectResult.slotLabel})
                        </div>
                      </div>

                      <div className="space-y-2 border-t pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0 border-neutral-100">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                          Tài chính &amp; Xác minh 4 số cuối SĐT khách
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Đã cọc ký quỹ online:</span>
                          <strong className="text-[#0E4F7E] tabular-nums">
                            {formatVnd(inspectResult.paidAmount ?? 0)}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Cần thu thêm tại sân:</span>
                          <strong
                            className={`tabular-nums ${
                              (inspectResult.remainingAtVenue ?? 0) > 0
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatVnd(inspectResult.remainingAtVenue ?? 0)}
                          </strong>
                        </div>

                        {inspectResult.valid && inspectResult.customerPhoneLast4 && (
                          <div className="pt-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={4}
                                value={phoneLast4Check}
                                onChange={(e) => setPhoneLast4Check(e.target.value)}
                                placeholder="Hỏi khách 4 số cuối SĐT…"
                                className="w-44 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] focus:border-[#16422C] focus:outline-none"
                              />
                              {phoneMatchStatus === 'MATCH' && (
                                <span className="font-bold text-emerald-700">✓ Đúng chính chủ</span>
                              )}
                              {phoneMatchStatus === 'MISMATCH' && (
                                <span className="font-bold text-rose-600">✕ Sai 4 số cuối</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {inspectResult.valid && inspectResult.orderId && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ActionButton
                        variant="forest"
                        size="md"
                        onClick={() => {
                          const targetOrderId = inspectResult.orderId!;
                          onConfirmCheckIn(targetOrderId);
                          setInspectResult({
                            ...inspectResult,
                            valid: false,
                            verdictCode: 'ALREADY_USED',
                            unusedAntiReplay: false,
                            verdictMessage:
                              '✓ ĐÃ MỞ SÂN & KHÓA VÉ QR 1 LẦN (nếu quét lại lần 2 hệ thống sẽ báo đỏ chặn ngay).',
                          });
                        }}
                      >
                        ✓ Xác nhận đúng khách — Mở sân &amp; Giải ngân cọc
                      </ActionButton>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ) : effectivePreview ? (
            /* EMAIL TICKET PREVIEW FOR TESTING & VISUALIZING WHAT CUSTOMER RECEIVES */
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-3 text-xs">
                  <div>
                    <div className="font-bold text-[#0F172A]">
                      Từ: ArenaPulse Tickets &lt;noreply@arenapulse.vn&gt;
                    </div>
                    <div className="text-neutral-500">
                      Đến: <strong>{effectivePreview.customerEmail || 'khach@gmail.com'}</strong> • Chủ đề: [ArenaPulse] Vé QR nhận sân {effectivePreview.orderId}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#16422C] px-3 py-0.5 text-[10.5px] font-bold text-white">
                    {effectivePreview.status === 'CONFIRMED' ? 'Sẵn sàng quét' : effectivePreview.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-12 items-center">
                  <div className="sm:col-span-5 flex flex-col items-center">
                    <div
                      ref={qrSvgWrapRef}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs"
                    >
                      <QRCodeSVG
                        value={effectivePreview.qrToken || effectivePreview.qrCode}
                        size={176}
                        level="M"
                        bgColor="#FFFFFF"
                        fgColor="#0F172A"
                      />
                    </div>
                    <span className="mt-2 font-mono text-[11px] font-bold text-[#16422C]">
                      Mã vé: {effectivePreview.qrCode}
                    </span>
                  </div>

                  <div className="sm:col-span-7 space-y-2.5 text-xs">
                    <h4 className="text-base font-bold text-[#0F172A]">
                      Phiếu Xác Nhận Đặt Cọc &amp; Vé Vào Sân
                    </h4>
                    <div className="space-y-1 text-neutral-600">
                      <div>
                        Khách hàng: <strong className="text-[#0F172A]">{effectivePreview.customerName}</strong> ({effectivePreview.customerPhone})
                      </div>
                      <div>
                        Cơ sở &amp; Sân: <strong className="text-[#0F172A]">{effectivePreview.venueName} — {effectivePreview.unitNumber}</strong>
                      </div>
                      <div>
                        Khung giờ: <strong className="text-[#0F172A]">{effectivePreview.slotLabel}</strong>
                      </div>
                      <div>
                        Đã thanh toán ký quỹ: <strong className="text-[#0E4F7E]">{formatVnd(effectivePreview.paidEscrow)}</strong> • Còn thu tại sân:{' '}
                        <strong className="text-[#16422C]">{formatVnd(effectivePreview.remainingAtVenue)}</strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-2.5 text-[10.5px] text-neutral-500 break-all">
                      <span className="font-bold text-[#0F172A]">Chữ ký Token nhúng trong QR: </span>
                      <span className="font-mono">
                        {(effectivePreview.qrToken || effectivePreview.qrCode).slice(0, 72)}…
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <ActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTicketPng(effectivePreview)}
                      >
                        ⬇ Tải ảnh QR PNG (như Gmail đính kèm)
                      </ActionButton>
                      <ActionButton
                        variant="forest"
                        size="sm"
                        onClick={() => {
                          setTab('SCANNER');
                          void runInspect(effectivePreview.qrToken || effectivePreview.qrCode);
                        }}
                      >
                        🔍 Quét thử vé này trên Máy Staff
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-neutral-500">
              Chưa có đơn đặt sân nào trong danh sách để xem trước vé QR.
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

