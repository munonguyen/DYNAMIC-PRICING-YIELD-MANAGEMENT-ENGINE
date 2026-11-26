import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type { LessorBookingOrder, QrInspectResult } from '../types/marketplace';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { ActionButton, PillSelect } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

export type QrModalTabId = 'SCANNER' | 'PIN_VERIFY';

interface QrCheckInScannerModalProps {
  open: boolean;
  initialTab?: QrModalTabId;
  allowedModes?: QrModalTabId[];
  initialOrder?: LessorBookingOrder | null;
  initialQuery?: string;
  providerOrders: LessorBookingOrder[];
  activeVenueName: string;
  onClose: () => void;
  onConfirmCheckIn: (orderId: string, method?: 'QR_SCAN' | 'PIN_COUNTER') => void;
  onPinFailedAttempt?: (orderId: string) => void;
}

export const QrCheckInScannerModal: React.FC<QrCheckInScannerModalProps> = ({
  open,
  initialTab = 'SCANNER',
  allowedModes = ['SCANNER', 'PIN_VERIFY'],
  initialOrder = null,
  initialQuery = '',
  providerOrders,
  activeVenueName,
  onClose,
  onConfirmCheckIn,
  onPinFailedAttempt,
}) => {
  const effectiveAllowed: QrModalTabId[] =
    allowedModes.length > 0 ? allowedModes : ['SCANNER', 'PIN_VERIFY'];
  const supportsQr = effectiveAllowed.includes('SCANNER');
  const supportsPin = effectiveAllowed.includes('PIN_VERIFY');

  const resolveInitialTab = (): QrModalTabId =>
    effectiveAllowed.includes(initialTab) ? initialTab : effectiveAllowed[0];

  const [tab, setTab] = useState<QrModalTabId>(resolveInitialTab);
  const [tokenInput, setTokenInput] = useState<string>(initialQuery);
  const [inspectResult, setInspectResult] = useState<QrInspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [phoneLast4Check, setPhoneLast4Check] = useState<string>('');
  const [qrChallengeError, setQrChallengeError] = useState<string | null>(null);
  const [confirmingQr, setConfirmingQr] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

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
    const nextTab = resolveInitialTab();
    setTab(nextTab);
    setPhoneLast4Check('');
    setQrChallengeError(null);
    setStatusNotice(null);
    setCameraError(null);
    setPinCodeInput('');
    setPinPhoneLast4Input('');
    setPinFeedback(null);

    const defaultPinTarget =
      initialOrder?.orderId ?? pendingOrders[0]?.orderId ?? providerOrders[0]?.orderId ?? '';
    setPinTargetOrderId(defaultPinTarget);

    if (nextTab === 'SCANNER' && initialQuery.trim()) {
      setTokenInput(initialQuery.trim());
      void runInspect(initialQuery.trim());
    } else if (nextTab === 'SCANNER') {
      setInspectResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, allowedModes.join(','), initialOrder?.orderId, initialQuery]);

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
      setInspectResult(null);
      const res = await marketplaceApi.inspectQrTicket(clean, providerOrders);
      setInspectResult(res);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : 'Chưa thể kiểm tra mã QR.');
    } finally {
      setInspecting(false);
    }
  };

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
            setStatusNotice('Đã đọc được mã QR từ thiết bị của khách hàng.');
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
        'Trình duyệt hiện chưa hỗ trợ truy cập Camera. Vui lòng chọn ảnh vé QR hoặc nhập mã vé trực tiếp.'
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
        'Không thể kích hoạt Camera trên thiết bị này. Bạn có thể tải ảnh chụp vé QR từ khách hàng để kiểm tra.'
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
          setCameraError('Không tìm thấy mã QR hợp lệ trong hình ảnh tải lên.');
          return;
        }
        setStatusNotice(`Đã đọc thành công mã QR từ tệp "${file.name}".`);
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
        tokenInput,
        phoneLast4Check
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
        verdictMessage: 'Đã hoàn tất mở sân và khóa hiệu lực vé dùng 1 lần.',
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

  const maskPhoneSafe = (raw: string) => {
    const clean = raw.replace(/\s+/g, '');
    return clean.length >= 4 ? `${clean.slice(0, 4)} ••• •••` : 'Đã bảo mật';
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
          className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-2xl flex flex-col"
        >
          {/* EXECUTIVE MODAL HEADER */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 bg-[#F8FAFC] px-6 py-4 sm:px-7 sm:py-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7D4] px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#16422C]">
                {tab === 'SCANNER' ? (
                  <>
                    <QrCode className="h-3.5 w-3.5" /> Quầy Quét Mã QR
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" /> Quầy Xác Thực Mã PIN (Không Máy Quét)
                  </>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]">
                {tab === 'SCANNER'
                  ? 'Kiểm tra Vé QR & Đối chiếu Khách nhận sân'
                  : 'Xác thực Mã Số 6 Chữ Số Nhận Sân'}
              </h3>
              <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <MapPin className="h-3.5 w-3.5 text-[#16422C]" />
                {activeVenueName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {supportsQr && supportsPin && (
                <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setTab('SCANNER')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition cursor-pointer ${
                      tab === 'SCANNER'
                        ? 'bg-[#16422C] text-white'
                        : 'text-neutral-600 hover:text-[#0F172A]'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Máy quét QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setTab('PIN_VERIFY');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition cursor-pointer ${
                      tab === 'PIN_VERIFY'
                        ? 'bg-[#16422C] text-white'
                        : 'text-neutral-600 hover:text-[#0F172A]'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Mã PIN 6 số
                  </button>
                </div>
              )}

              <button
                type="button"
                aria-label="Đóng hộp thoại"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-[#0F172A] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-6 sm:p-7">
            {tab === 'SCANNER' && supportsQr ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                  {/* Camera & File Upload Column */}
                  <div className="md:col-span-5 space-y-3">
                    <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-[#F4F8F4] p-4 text-center">
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
                        <div className="space-y-2.5 text-xs text-neutral-600">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#16422C] shadow-xs">
                            <Camera className="h-6 w-6" />
                          </div>
                          <p className="font-semibold text-[#0F172A]">
                            Khung quét mã QR khách hàng
                          </p>
                          <p className="text-[11px] leading-relaxed text-neutral-500">
                            Đưa mã QR từ màn hình của khách vào trước camera hoặc chọn tệp ảnh vé QR để kiểm tra.
                          </p>
                        </div>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={cameraActive ? stopCamera : startCamera}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                          cameraActive
                            ? 'bg-rose-600 text-white'
                            : 'bg-[#16422C] text-white hover:bg-[#123524]'
                        }`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#0F172A] hover:bg-neutral-50 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Tải ảnh QR
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

                  {/* Direct Code Verification Column */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void runInspect(tokenInput);
                        }}
                        className="space-y-2"
                      >
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Mã vé điện tử hoặc mã đơn đặt sân
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

                      <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-[#0F172A]">
                          <ShieldCheck className="h-4 w-4 text-[#16422C]" />
                          Quy chuẩn kiểm duyệt tại quầy
                        </div>
                        <ul className="space-y-1 text-[11px] text-neutral-600 list-disc pl-4">
                          <li>Xác nhận tính hợp lệ của vé phát hành và đúng cụm sân quản lý.</li>
                          <li>Mỗi vé QR chỉ kích hoạt nhận sân một lần duy nhất.</li>
                          <li>Nhân viên đối chiếu 4 số cuối SĐT khách đọc trước khi bấm Mở sân.</li>
                        </ul>
                      </div>
                    </div>

                    {cameraError && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                    {statusNotice && (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{statusNotice}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* VERIFICATION RESULT CARD */}
                {inspectResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border p-5 space-y-4 ${
                      inspectResult.valid
                        ? 'border-emerald-200 bg-emerald-50/55'
                        : 'border-rose-200 bg-rose-50/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                            inspectResult.valid ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                        >
                          {inspectResult.valid ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-[#0F172A]">
                            {inspectResult.valid
                              ? 'Vé hợp lệ — Chờ xác nhận thông tin khách'
                              : 'Không đủ điều kiện mở sân'}
                          </div>
                          <p className="text-xs text-neutral-600">{inspectResult.verdictMessage}</p>
                        </div>
                      </div>
                      {inspectResult.orderId && (
                        <span className="rounded-lg bg-[#0F172A] px-3 py-1 text-[11px] font-bold text-white tabular-nums">
                          {inspectResult.orderId}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                      {[
                        {
                          label: 'Chứng thực vé',
                          ok: inspectResult.signatureValid,
                          yes: 'Hợp lệ',
                          no: 'Không hợp lệ',
                        },
                        {
                          label: 'Phạm vi cơ sở',
                          ok: inspectResult.venueMatched,
                          yes: 'Đúng cơ sở',
                          no: 'Sai cơ sở',
                        },
                        {
                          label: 'Hiệu lực dùng 1 lần',
                          ok: inspectResult.unusedAntiReplay,
                          yes: 'Chưa sử dụng',
                          no: 'Đã sử dụng',
                        },
                        {
                          label: 'Khung giờ chơi',
                          ok: inspectResult.notExpired,
                          yes: 'Đúng hạn',
                          no: 'Hết hiệu lực',
                        },
                      ].map((gate) => (
                        <div
                          key={gate.label}
                          className={`rounded-xl border px-3 py-2 bg-white ${
                            gate.ok ? 'border-emerald-200 text-emerald-900' : 'border-rose-200 text-rose-800'
                          }`}
                        >
                          <div className="font-medium text-neutral-500">{gate.label}</div>
                          <div className="mt-0.5 font-bold">{gate.ok ? gate.yes : gate.no}</div>
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
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <Phone className="h-3.5 w-3.5 text-neutral-400" />
                            SĐT: <strong>{inspectResult.customerPhoneMasked}</strong>
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <Mail className="h-3.5 w-3.5 text-neutral-400" />
                            <span>{inspectResult.customerEmail}</span>
                          </div>
                          <div className="pt-0.5 font-semibold text-[#16422C]">
                            {inspectResult.unitNumber} • {inspectResult.groupName} ({inspectResult.slotLabel})
                          </div>
                        </div>

                        <div className="space-y-2.5 border-t pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0 border-neutral-100">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                            Thanh toán &amp; Đối chiếu chính chủ
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Đã cọc online:</span>
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
                            <div className="pt-1 space-y-1">
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
                                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold tracking-wider text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                              />
                              <p className="text-[10.5px] text-neutral-400">
                                Nhập 4 số cuối SĐT do khách cung cấp để xác nhận đúng người đặt.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {qrChallengeError && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{qrChallengeError}</span>
                      </div>
                    )}

                    {inspectResult.valid && inspectResult.orderId && (
                      <div className="flex justify-end">
                        <ActionButton
                          variant="forest"
                          size="md"
                          disabled={confirmingQr || phoneLast4Check.trim().length !== 4}
                          onClick={() => void handleConfirmQrWithChallenge()}
                        >
                          {confirmingQr
                            ? 'Đang xác thực…'
                            : 'Xác nhận đúng khách & Mở sân'}
                        </ActionButton>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            ) : (
              /* OPTION 2: DEDICATED NO-SCANNER 6-DIGIT PIN VERIFICATION DESK */
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 text-xs text-neutral-700">
                  <ShieldCheck className="h-5 w-5 text-[#16422C] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#0F172A]">
                      Quy trình nhận sân không cần máy quét QR
                    </div>
                    <p className="leading-relaxed text-neutral-600">
                      Khách hàng cung cấp <strong>Mã PIN 6 chữ số</strong> từ Email xác nhận cùng <strong>4 số cuối SĐT</strong>. Mã PIN chỉ dùng được 1 lần và sẽ tự tạm khóa 5 phút nếu nhập sai quá 5 lần.
                    </p>
                  </div>
                </div>

                {selectedPinOrder ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                    <div className="md:col-span-6 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 text-xs">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                          Đơn đặt sân cần đối chiếu
                        </label>
                        <PillSelect
                          variant="soft"
                          ariaLabel="Chọn đơn đặt sân cần đối chiếu"
                          value={selectedPinOrder.orderId}
                          onChange={(v) => {
                            setPinTargetOrderId(v);
                            setPinCodeInput('');
                            setPinPhoneLast4Input('');
                            setPinFeedback(null);
                          }}
                          options={providerOrders.slice(0, 25).map((o) => ({
                            value: o.orderId,
                            label: `${o.orderId} • ${o.customerName} (${o.unitNumber}) — ${
                              o.status === 'CONFIRMED' ? 'Chờ nhận sân' : o.status
                            }`,
                          }))}
                        />
                      </div>

                      <div className="rounded-xl bg-[#F8FAFC] p-4 space-y-2 border border-neutral-200/70">
                        <div className="flex justify-between gap-2">
                          <span className="text-neutral-500">Khách đặt:</span>
                          <strong className="text-[#0F172A] text-right">
                            {selectedPinOrder.customerName}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-neutral-500">SĐT đăng ký:</span>
                          <strong className="text-[#0F172A]">
                            {maskPhoneSafe(selectedPinOrder.customerPhone)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-neutral-500">Sân &amp; Khung giờ:</span>
                          <strong className="text-[#16422C] text-right">
                            {selectedPinOrder.unitNumber} • {selectedPinOrder.slotLabel}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-neutral-200/70 pt-2">
                          <span className="text-neutral-500">Đã cọc online:</span>
                          <strong className="text-[#0E4F7E] tabular-nums">
                            {formatVnd(selectedPinOrder.paidEscrow)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-neutral-500">Cần thu thêm tại sân:</span>
                          <strong className="text-amber-700 tabular-nums">
                            {formatVnd(selectedPinOrder.remainingAtVenue)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 flex flex-col justify-between space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 text-xs">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSubmitPinVerify();
                        }}
                        className="space-y-3.5"
                      >
                        <div>
                          <label className="mb-1.5 block font-semibold text-[#0F172A]">
                            1. Mã PIN 6 chữ số từ Email khách *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={pinCodeInput}
                            onChange={(e) => setPinCodeInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="• • • • • •"
                            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.35em] text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block font-semibold text-[#0F172A]">
                            2. 4 số cuối SĐT khách cung cấp *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={pinPhoneLast4Input}
                            onChange={(e) =>
                              setPinPhoneLast4Input(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="Nhập 4 số cuối SĐT…"
                            className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-center font-mono text-sm font-bold tracking-[0.25em] text-[#0F172A] focus:border-[#16422C] focus:outline-none"
                          />
                        </div>

                        <ActionButton
                          type="submit"
                          variant="forest"
                          size="md"
                          fullWidth
                          disabled={
                            pinVerifying ||
                            selectedPinOrder.status === 'COMPLETED' ||
                            pinCodeInput.length !== 6 ||
                            pinPhoneLast4Input.length !== 4
                          }
                        >
                          {pinVerifying ? 'Đang kiểm tra…' : 'Xác nhận Mã PIN & Mở sân'}
                        </ActionButton>
                      </form>

                      {pinFeedback && (
                        <div
                          className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold ${
                            pinFeedback.ok
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'border-rose-300 bg-rose-50 text-rose-800'
                          }`}
                        >
                          {pinFeedback.ok ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          )}
                          <span>{pinFeedback.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-neutral-500">
                    Chưa có đơn đặt sân nào cần xác thực mã số.
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
