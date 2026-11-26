import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import jsQR from 'jsqr';
import type { LessorBookingOrder, QrInspectResult } from '../types/marketplace';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

export type QrModalTabId = 'SCANNER' | 'PIN_VERIFY';

interface QrCheckInScannerModalProps {
  open: boolean;
  initialTab?: QrModalTabId;
  initialOrder?: LessorBookingOrder | null;
  initialQuery?: string;
  providerOrders: LessorBookingOrder[];
  allSystemOrders: LessorBookingOrder[];
  activeProviderId: string;
  activeVenueName: string;
  onClose: () => void;
  onConfirmCheckIn: (orderId: string, method?: 'QR_SCAN' | 'PIN_COUNTER') => void;
  onPinFailedAttempt?: (orderId: string) => void;
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
  onPinFailedAttempt,
}) => {
  const [tab, setTab] = useState<QrModalTabId>(initialTab);
  const [tokenInput, setTokenInput] = useState<string>(initialQuery);
  const [inspectResult, setInspectResult] = useState<QrInspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [phoneLast4Check, setPhoneLast4Check] = useState<string>('');
  const [qrChallengeError, setQrChallengeError] = useState<string | null>(null);
  const [confirmingQr, setConfirmingQr] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Option 2 (PIN_COUNTER - no scanner required) state
  const pendingOrders = providerOrders.filter((o) => o.status === 'CONFIRMED');
  const [pinTargetOrderId, setPinTargetOrderId] = useState<string>('');
  const [pinCodeInput, setPinCodeInput] = useState<string>('');
  const [pinPhoneLast4Input, setPinPhoneLast4Input] = useState<string>('');
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);
  const [pinFeedback, setPinFeedback] = useState<{
    ok: boolean;
    message: string;
    locked?: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    setPhoneLast4Check('');
    setQrChallengeError(null);
    setStatusNotice(null);
    setPinCodeInput('');
    setPinPhoneLast4Input('');
    setPinFeedback(null);

    const defaultPinTarget =
      initialOrder?.orderId ?? pendingOrders[0]?.orderId ?? providerOrders[0]?.orderId ?? '';
    setPinTargetOrderId(defaultPinTarget);

    if (initialTab === 'SCANNER' && initialQuery.trim()) {
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
    setQrChallengeError(null);
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
            setStatusNotice('✓ Camera đã đọc được mã vé từ thiết bị của khách.');
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
      setCameraError(
        'Trình duyệt chưa hỗ trợ truy cập Camera. Hãy dùng nút Tải ảnh QR hoặc chuyển sang tab PIN 6 số.'
      );
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
      setCameraError(
        'Không mở được Camera. Nếu quầy không có thiết bị quét, chọn tab "PIN 6 số" ở góc trên.'
      );
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
          setCameraError('Không tìm thấy mã QR hợp lệ trong ảnh tải lên.');
          return;
        }
        setStatusNotice(`✓ Đã đọc thành công mã QR từ ảnh "${file.name}".`);
        void runInspect(decoded.data);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectedPinOrder =
    providerOrders.find((o) => o.orderId === pinTargetOrderId) ??
    pendingOrders[0] ??
    providerOrders[0] ??
    null;

  const handleConfirmQrWithChallenge = async () => {
    if (!inspectResult?.valid || !inspectResult.orderId) return;
    setQrChallengeError(null);
    setConfirmingQr(true);
    try {
      const res = await marketplaceApi.confirmQrCheckInWithPhoneChallenge(
        inspectResult.orderId,
        tokenInput,
        phoneLast4Check,
        providerOrders
      );
      if (!res.ok) {
        setQrChallengeError(res.message);
        return;
      }
      const targetOrderId = inspectResult.orderId;
      onConfirmCheckIn(targetOrderId, 'QR_SCAN');
      setInspectResult({
        ...inspectResult,
        valid: false,
        verdictCode: 'ALREADY_USED',
        unusedAntiReplay: false,
        verdictMessage: '✓ Đã mở sân & khóa vé dùng 1 lần thành công.',
      });
    } finally {
      setConfirmingQr(false);
    }
  };

  const handleSubmitPinVerify = async () => {
    if (!selectedPinOrder) return;
    setPinVerifying(true);
    try {
      const res = await marketplaceApi.verifyPinAtVenue(
        selectedPinOrder,
        pinCodeInput,
        pinPhoneLast4Input
      );
      setPinFeedback({
        ok: res.ok,
        message: res.message,
        locked: res.locked,
      });
      if (res.ok) {
        onConfirmCheckIn(selectedPinOrder.orderId, 'PIN_COUNTER');
      } else if (res.remainingAttempts !== undefined) {
        onPinFailedAttempt?.(selectedPinOrder.orderId);
      }
    } finally {
      setPinVerifying(false);
    }
  };

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
                Quầy Soát Vé &amp; Xác Minh Khách Hàng
              </span>
              <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-[#0F172A]">
                {tab === 'SCANNER'
                  ? `Quét Mã QR Nhận Sân — ${activeVenueName}`
                  : `Xác Thực Mã PIN 6 Số Nhận Sân — ${activeVenueName}`}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-neutral-200 bg-[#F8FAFC] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTab('SCANNER')}
                  className={`rounded-full px-3 py-1.5 font-bold transition cursor-pointer ${
                    tab === 'SCANNER' ? 'bg-[#16422C] text-white' : 'text-neutral-600'
                  }`}
                >
                  📷 Quét QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setTab('PIN_VERIFY');
                  }}
                  className={`rounded-full px-3 py-1.5 font-bold transition cursor-pointer ${
                    tab === 'PIN_VERIFY' ? 'bg-[#16422C] text-white' : 'text-neutral-600'
                  }`}
                >
                  🔢 PIN 6 số
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
              {/* CAMERA / IMAGE UPLOAD / CODE INPUT */}
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
                          Hoặc tải ảnh vé QR. Nếu không dùng máy quét, chọn tab{' '}
                          <strong>🔢 PIN 6 số</strong>.
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
                      Nhập mã vé hoặc mã đơn đặt sân khách xuất trình
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="VD: APQR-HN01-001 hoặc #AP-HN01-001…"
                        className="flex-1 rounded-xl border border-neutral-300 px-3.5 py-2.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                      />
                      <ActionButton type="submit" variant="forest" size="sm" disabled={inspecting}>
                        {inspecting ? 'Đang kiểm tra…' : 'Kiểm tra'}
                      </ActionButton>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-3.5 text-xs text-neutral-600 space-y-1">
                    <div className="font-bold text-[#0F172A]">Quy trình kiểm tra tại quầy</div>
                    <p className="text-[11px] leading-relaxed">
                      Hệ thống đối chiếu tự động tính hợp lệ của vé, đúng cơ sở sân, trạng thái chưa sử dụng và yêu cầu hỏi khách <strong>4 số cuối SĐT đăng ký</strong> trước khi mở sân.
                    </p>
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

              {/* SAFE 4-STEP VERIFICATION CARD (NO INTERNAL SECRETS / NO EXPOSED PHONE LAST 4) */}
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
                            ? 'VÉ HỢP LỆ — CHỜ ĐỐI CHIẾU CHỦ SÂN'
                            : 'TỪ CHỐI NHẬN SÂN'}
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

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                    {[
                      {
                        label: '1. Chứng thực vé điện tử',
                        ok: inspectResult.signatureValid,
                        yes: 'Vé hợp lệ',
                        no: 'Không hợp lệ',
                      },
                      {
                        label: '2. Đúng cụm sân',
                        ok: inspectResult.venueMatched,
                        yes: 'Khớp cơ sở này',
                        no: 'Sai cơ sở',
                      },
                      {
                        label: '3. Hiệu lực sử dụng',
                        ok: inspectResult.unusedAntiReplay,
                        yes: 'Chưa sử dụng',
                        no: 'Đã dùng / Hủy',
                      },
                      {
                        label: '4. Thời gian ca',
                        ok: inspectResult.notExpired,
                        yes: 'Còn hiệu lực',
                        no: 'Quá hạn',
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

                  {inspectResult.customerName && (
                    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-1.5">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                          Thông tin khách đặt sân
                        </div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {inspectResult.customerName}
                        </div>
                        <div className="text-neutral-600">
                          SĐT đăng ký: <strong>{inspectResult.customerPhoneMasked}</strong>
                        </div>
                        <div className="text-neutral-600">
                          Email nhận vé: <strong>{inspectResult.customerEmail}</strong>
                        </div>
                        <div className="text-[#16422C] font-semibold">
                          {inspectResult.unitNumber} • {inspectResult.groupName} ({inspectResult.slotLabel})
                        </div>
                      </div>

                      <div className="space-y-2 border-t pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0 border-neutral-100">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                          Thanh toán &amp; Đối chiếu 4 số cuối SĐT
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Đã cọc trước online:</span>
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

                        {inspectResult.valid && (
                          <div className="pt-1 space-y-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              value={phoneLast4Check}
                              onChange={(e) => {
                                setQrChallengeError(null);
                                setPhoneLast4Check(e.target.value.replace(/\D/g, ''));
                              }}
                              placeholder="Nhập 4 số cuối SĐT khách đọc…"
                              className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-[#16422C] focus:outline-none"
                            />
                            <p className="text-[10.5px] text-neutral-400">
                              4 số cuối được ẩn bảo mật để nhân viên xác nhận trực tiếp với khách.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {qrChallengeError && (
                    <div className="rounded-xl border border-rose-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                      {qrChallengeError}
                    </div>
                  )}

                  {inspectResult.valid && inspectResult.orderId && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ActionButton
                        variant="forest"
                        size="md"
                        disabled={confirmingQr || phoneLast4Check.trim().length !== 4}
                        onClick={() => void handleConfirmQrWithChallenge()}
                      >
                        {confirmingQr
                          ? 'Đang xác thực…'
                          : '✓ Xác nhận đúng khách — Mở sân & Giải ngân cọc'}
                      </ActionButton>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ) : (
            /* OPTION 2: NO SCANNER REQUIRED — 6-DIGIT EMAIL PIN VERIFICATION */
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 text-xs text-neutral-700 space-y-1">
                <div className="font-bold text-[#16422C]">
                  Xác thực nhận sân bằng Mã PIN 6 số (Dành cho cơ sở không dùng máy quét)
                </div>
                <p>
                  Khách đọc <strong>Mã PIN 6 số trong Email xác nhận</strong> kèm <strong>4 số cuối SĐT</strong>. Nhân viên nhập để xác nhận nhận sân 1 lần (tạm khóa 5 phút nếu sai quá 5 lần).
                </p>
              </div>

              {selectedPinOrder ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                  <div className="md:col-span-6 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 text-xs">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        Chọn đơn đặt sân của khách tại quầy
                      </label>
                      <select
                        value={selectedPinOrder.orderId}
                        onChange={(e) => {
                          setPinTargetOrderId(e.target.value);
                          setPinCodeInput('');
                          setPinPhoneLast4Input('');
                          setPinFeedback(null);
                        }}
                        className="w-full rounded-xl border border-neutral-300 bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                      >
                        {providerOrders.slice(0, 20).map((o) => (
                          <option key={o.orderId} value={o.orderId}>
                            {o.orderId} • {o.customerName} ({o.unitNumber}) —{' '}
                            {o.status === 'CONFIRMED' ? 'Chờ nhận' : o.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl bg-[#F8FAFC] p-3.5 space-y-1.5 border border-neutral-200/70">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Khách đặt:</span>
                        <strong className="text-[#0F172A]">{selectedPinOrder.customerName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Email nhận PIN:</span>
                        <strong className="text-[#0F172A]">
                          {selectedPinOrder.customerEmail || 'Đơn trực tuyến'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Trạng thái PIN:</span>
                        <span className="font-semibold text-[#16422C]">Đã phát hành qua Email</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Đã cọc online:</span>
                        <strong className="text-[#0E4F7E] tabular-nums">
                          {formatVnd(selectedPinOrder.paidEscrow)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Cần thu thêm tại sân:</span>
                        <strong className="text-amber-700 tabular-nums">
                          {formatVnd(selectedPinOrder.remainingAtVenue)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-6 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 text-xs">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmitPinVerify();
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="mb-1 block font-bold text-[#0F172A]">
                          1. Nhập Mã PIN 6 số khách đọc từ Email *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinCodeInput}
                          onChange={(e) => setPinCodeInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nhập 6 chữ số PIN…"
                          className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 font-mono text-base font-bold tracking-[0.28em] text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block font-bold text-[#0F172A]">
                          2. Nhập 4 số cuối SĐT khách đọc *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinPhoneLast4Input}
                          onChange={(e) => setPinPhoneLast4Input(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nhập 4 số cuối SĐT…"
                          className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 font-mono text-xs font-bold tracking-widest text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <ActionButton
                          type="submit"
                          variant="forest"
                          size="md"
                          disabled={
                            pinVerifying ||
                            selectedPinOrder.status === 'COMPLETED' ||
                            pinCodeInput.length !== 6 ||
                            pinPhoneLast4Input.length !== 4
                          }
                        >
                          {pinVerifying ? 'Đang kiểm tra…' : '✓ Xác thực PIN & Mở sân'}
                        </ActionButton>
                      </div>
                    </form>

                    {pinFeedback && (
                      <div
                        className={`rounded-xl border p-3 text-xs font-semibold ${
                          pinFeedback.ok
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-rose-300 bg-rose-50 text-rose-800'
                        }`}
                      >
                        {pinFeedback.message}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Chưa có đơn nào để xác thực PIN.
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
