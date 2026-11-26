import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, KeyRound, MapPin, QrCode, Upload, X } from 'lucide-react';
import type {
  CheckinVerificationMode,
  PublishedListing,
  SportTypeItem,
  VenueProviderInfo,
} from '../types/marketplace';
import { buildFreshListingSlots, formatVnd } from '../api/marketplaceApi';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

interface CreateCourtGroupModalProps {
  open: boolean;
  onClose: () => void;
  sports: SportTypeItem[];
  activeProvider: VenueProviderInfo;
  defaultVenueName: string;
  defaultAddress: string;
  presetCovers: { label: string; url: string }[];
  onCreateListing: (created: PublishedListing) => void;
  onCreatedSuccess: (groupName: string) => void;
}

export const CreateCourtGroupModal: React.FC<CreateCourtGroupModalProps> = ({
  open,
  onClose,
  sports,
  activeProvider,
  defaultVenueName,
  defaultAddress,
  presetCovers,
  onCreateListing,
  onCreatedSuccess,
}) => {
  const [groupName, setGroupName] = useState('');
  const [sportCode, setSportCode] = useState(sports[0]?.code ?? 'PICKLEBALL');
  const [venueName, setVenueName] = useState(defaultVenueName);
  const [address, setAddress] = useState(defaultAddress);
  const [capacity, setCapacity] = useState(6);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [basePrice, setBasePrice] = useState(220000);
  const [minPrice, setMinPrice] = useState(140000);
  const [maxPrice, setMaxPrice] = useState(360000);
  const [depositPct, setDepositPct] = useState(35);
  const [checkinMode, setCheckinMode] = useState<CheckinVerificationMode>('QR_STAFF');
  const [surface, setSurface] = useState('Mặt sân tiêu chuẩn thi đấu chống trượt, thoát nước nhanh');
  const [lighting, setLighting] = useState('Hệ thống đèn LED chống chói 500 Lux');
  const [coverUrl, setCoverUrl] = useState(presetCovers[0]?.url ?? '/images/court-pickleball-dome.jpg');
  const [showSpecs, setShowSpecs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVenueName(defaultVenueName || activeProvider.providerName);
    setAddress(defaultAddress || `${activeProvider.district}, ${activeProvider.city}`);
  }, [open, defaultVenueName, defaultAddress, activeProvider]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const safeMin = Math.max(50_000, minPrice);
  const safeMax = Math.max(safeMin + 20_000, maxPrice);
  const safeBase = Math.min(safeMax, Math.max(safeMin, basePrice));
  const safeDeposit = Math.min(100, Math.max(10, depositPct));
  const sampleDepositAmount = Math.round((safeBase * safeDeposit) / 100);
  const sampleAtVenueAmount = Math.max(0, safeBase - sampleDepositAmount);

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    const sportObj = sports.find((s) => s.code === sportCode) ?? sports[0];

    const created: PublishedListing = {
      groupId: `custom-group-${Date.now()}`,
      groupCode: `${sportCode}_${Date.now().toString(36).toUpperCase()}`,
      groupName: groupName.trim(),
      tenantId: '00000000-0000-0000-0000-000000000001',
      venueName: venueName.trim() || activeProvider.providerName,
      venueAddress: address.trim(),
      city: activeProvider.city,
      district: activeProvider.district,
      sportCode: sportObj.code,
      sportName: sportObj.name,
      basePrice: safeBase,
      minPrice: safeMin,
      maxPrice: safeMax,
      depositPercent: safeDeposit,
      slotMinutes: durationMinutes,
      checkinMode,
      imageUrl: coverUrl,
      galleryImages: [coverUrl],
      galleryCaptions: [`Ảnh thực tế cụm sân ${groupName.trim()} do Chủ sân đăng tải`],
      architecturalBadge: 'Cụm sân mới mở • Đã xác thực',
      rating: 5.0,
      reviewCount: 1,
      provider: activeProvider,
      specs: {
        surface: surface.trim(),
        lighting: lighting.trim(),
        dimensions: `Tiêu chuẩn ${sportObj.name} (${capacity} sân vật lý)`,
        amenities: [
          'Bãi đỗ xe rộng',
          'Phòng thay đồ',
          checkinMode === 'PIN_COUNTER' ? 'Nhận sân bằng PIN 6 số' : 'Check-in mã QR nhanh',
        ],
      },
      addOnServices: [],
      published: true,
      upcomingSlots: buildFreshListingSlots(
        safeBase,
        safeMin,
        safeMax,
        durationMinutes,
        capacity
      ),
    };

    onCreateListing(created);
    onCreatedSuccess(created.groupName);
    setGroupName('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-court-modal-title"
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: EXPO_EASE }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.34)]"
          >
            {/* STICKY MODAL HEADER */}
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-white px-6 py-4">
              <div>
                <span className="inline-flex items-center rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#16422C]">
                  Tạo cụm sân mới
                </span>
                <h3 id="create-court-modal-title" className="mt-1 text-lg sm:text-xl font-bold text-[#0F172A]">
                  Đăng Cụm Sân Cho Thuê Mới
                </h3>
                <p className="text-xs text-neutral-500">
                  Cơ sở áp dụng: <span className="font-semibold text-[#0F172A]">{activeProvider.providerName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại tạo cụm sân"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs">
              {/* SECTION 1: BASIC INFO & PHOTO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#16422C]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16422C] text-[10px] text-white">
                    1
                  </span>
                  Thông tin cơ bản &amp; Hình ảnh
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Tên cụm sân *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="VD: Cụm 6 Sân Pickleball Mái Che Khu B"
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Bộ môn *
                    </label>
                    <select
                      value={sportCode}
                      onChange={(e) => setSportCode(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                    >
                      {sports.map((sp) => (
                        <option key={sp.code} value={sp.code}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Tên cơ sở
                    </label>
                    <input
                      type="text"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Địa chỉ sân *
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-neutral-400" />
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] pl-8 pr-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Compact Cover Photo Picker */}
                <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#0F172A]">Ảnh bìa hiển thị</span>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#16422C]/30 bg-white px-3 py-1 text-[11px] font-bold text-[#16422C] hover:bg-[#E7F7D4]/50">
                      <Upload className="h-3 w-3" />
                      Tải ảnh từ máy
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCover}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    {presetCovers.map((c) => {
                      const selected = coverUrl === c.url;
                      return (
                        <button
                          key={c.url}
                          type="button"
                          onClick={() => setCoverUrl(c.url)}
                          title={c.label}
                          className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                            selected ? 'border-[#16422C] ring-2 ring-[#16422C]/25' : 'border-transparent opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img src={c.url} alt={c.label} className="h-full w-full object-cover" />
                          {selected && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#16422C] text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {!presetCovers.some((c) => c.url === coverUrl) && (
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-[#16422C]">
                        <img src={coverUrl} alt="Ảnh đã tải lên" className="h-full w-full object-cover" />
                        <span className="absolute bottom-0.5 left-1 rounded bg-black/70 px-1 text-[9px] text-white">
                          Ảnh riêng
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: CAPACITY & PRICING */}
              <div className="space-y-4 border-t border-neutral-100 pt-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#16422C]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16422C] text-[10px] text-white">
                    2
                  </span>
                  Quy mô sân &amp; Biểu giá
                </div>

                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Số sân con (vật lý)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={capacity}
                      onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Thời lượng 1 ca
                    </label>
                    <select
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                    >
                      <option value={60}>60 phút / ca</option>
                      <option value={90}>90 phút / ca</option>
                      <option value={120}>120 phút / ca</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Đặt cọc giữ sân (%)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={depositPct}
                      onChange={(e) => setDepositPct(Number(e.target.value) || 35)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Giá thấp điểm (₫)
                    </label>
                    <input
                      type="number"
                      step={10000}
                      value={minPrice}
                      onChange={(e) => setMinPrice(Number(e.target.value) || 100000)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Giá cơ sở (₫) *
                    </label>
                    <input
                      type="number"
                      step={10000}
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value) || 200000)}
                      className="w-full rounded-xl border border-[#16422C]/40 bg-[#F4F8F4] px-3 py-2.5 tabular-nums font-bold text-[#16422C]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Giá giờ vàng (₫)
                    </label>
                    <input
                      type="number"
                      step={10000}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value) || 350000)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>
                </div>

                {/* Live calculation summary */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4]/70 px-4 py-2.5 text-[11.5px]">
                  <span className="text-neutral-600">
                    Ví dụ ca tiêu chuẩn <strong className="text-[#0F172A]">{formatVnd(safeBase)}</strong>:
                  </span>
                  <div className="flex flex-wrap items-center gap-3 font-semibold tabular-nums">
                    <span className="text-[#16422C]">
                      Khách cọc online ({safeDeposit}%): {formatVnd(sampleDepositAmount)}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-[#0E4F7E]">
                      Thu thêm tại sân: {formatVnd(sampleAtVenueAmount)}
                    </span>
                  </div>
                </div>

                {/* Optional technical specs toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSpecs((v) => !v)}
                    className="text-[11px] font-semibold text-[#0E4F7E] hover:underline"
                  >
                    {showSpecs ? '− Ẩn thông số mặt sân & đèn' : '+ Tuỳ chỉnh thông số mặt sân & chiếu sáng (tuỳ chọn)'}
                  </button>
                  {showSpecs && (
                    <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Mặt sân &amp; Kết cấu
                        </label>
                        <input
                          type="text"
                          value={surface}
                          onChange={(e) => setSurface(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-neutral-700">
                          Hệ thống Chiếu sáng
                        </label>
                        <input
                          type="text"
                          value={lighting}
                          onChange={(e) => setLighting(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 text-[#0F172A]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: CHECK-IN METHOD */}
              <div className="space-y-3 border-t border-neutral-100 pt-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#16422C]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16422C] text-[10px] text-white">
                    3
                  </span>
                  Cách xác nhận vé khi khách đến sân
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: 'QR_STAFF' as const,
                      title: 'Có máy quét QR / Camera quầy',
                      desc: 'Khách đưa mã QR trong Email; nhân viên quét mã và đối chiếu 4 số cuối SĐT.',
                    },
                    {
                      id: 'PIN_COUNTER' as const,
                      title: 'Không có máy quét — Chỉ dùng Mã PIN 6 số',
                      desc: 'Không phát hành hay quét QR. Khách chỉ cần đọc Mã PIN 6 số trong Email tại quầy.',
                    },
                  ].map((opt) => {
                    const active = checkinMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCheckinMode(opt.id)}
                        className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                          active
                            ? 'border-[#16422C] bg-[#E7F7D4]/55 ring-2 ring-[#16422C]/25'
                            : 'border-neutral-200 bg-[#F8FAFC] hover:border-neutral-300'
                        }`}
                      >
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                          {opt.id === 'QR_STAFF' ? (
                            <QrCode className="h-3.5 w-3.5 text-[#16422C]" />
                          ) : (
                            <KeyRound className="h-3.5 w-3.5 text-[#0E4F7E]" />
                          )}
                          {opt.title}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STICKY FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-[#F8FAFC] px-6 py-4">
              <span className="text-[11px] text-neutral-500">
                Cụm sân sẽ hiển thị và mở nhận lịch ngay trên sàn sau khi tạo.
              </span>
              <div className="flex items-center gap-2.5">
                <ActionButton type="button" variant="outline" size="sm" onClick={onClose}>
                  Hủy bỏ
                </ActionButton>
                <ActionButton type="submit" variant="forest" size="md">
                  ✓ Tạo &amp; Mở bán cụm sân
                </ActionButton>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
