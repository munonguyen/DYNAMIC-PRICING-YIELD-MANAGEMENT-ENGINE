import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
  PriceQuote,
  PublishedListing,
  RoleCode,
  SimulationResult,
} from '../types/marketplace';
import { formatVnd, marketplaceApi } from '../api/marketplaceApi';
import { AnimatedVnd, EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton, PillSelect } from './FairwayControls';

export interface ListingPricingPatch {
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  depositPercent: number;
}

interface YieldTelemetryBentoSectionProps {
  activeListing: PublishedListing | null;
  activeQuote: PriceQuote | null;
  listings?: PublishedListing[];
  session?: AuthSession | null;
  activeRole?: RoleCode;
  onSelectListing?: (listing: PublishedListing) => void;
  onUpdateListingPricing?: (groupId: string, patch: ListingPricingPatch) => void;
  onNavigate?: (page: AppPageId) => void;
}

const MATRIX_OCC_BANDS = [
  { label: '80–100%', min: 80, max: 100, values: [1.15, 1.22, 1.30, 1.38] },
  { label: '60–80%', min: 60, max: 79.9, values: [1.05, 1.12, 1.18, 1.25] },
  { label: '30–60%', min: 30, max: 59.9, values: [0.95, 1.0, 1.05, 1.1] },
  { label: '0–30%', min: 0, max: 29.9, values: [0.78, 0.82, 0.88, 0.94] },
];

const LEAD_COLUMNS = [
  { label: '> 48h', check: (h: number) => h >= 48 },
  { label: '12–48h', check: (h: number) => h >= 12 && h < 48 },
  { label: '3–12h', check: (h: number) => h >= 3 && h < 12 },
  { label: '< 3h', check: (h: number) => h < 3 },
];

export const YieldTelemetryBentoSection: React.FC<YieldTelemetryBentoSectionProps> = ({
  activeListing,
  activeQuote,
  listings = [],
  session = null,
  activeRole = 'USER',
  onSelectListing,
  onUpdateListingPricing,
  onNavigate,
}) => {
  const canManagePricing = Boolean(
    session && (activeRole === 'MANAGER' || activeRole === 'ADMIN')
  );
  const isAdmin = activeRole === 'ADMIN';

  const basePrice = activeListing?.basePrice ?? 200_000;
  const minPrice = activeListing?.minPrice ?? 120_000;
  const maxPrice = activeListing?.maxPrice ?? 350_000;
  const depositPercent = activeListing?.depositPercent ?? 35;

  // Editable Pricing Policy State (Lessor / Admin)
  const [editBasePrice, setEditBasePrice] = useState<number>(basePrice);
  const [editMinPrice, setEditMinPrice] = useState<number>(minPrice);
  const [editMaxPrice, setEditMaxPrice] = useState<number>(maxPrice);
  const [editDepositPct, setEditDepositPct] = useState<number>(depositPercent);
  const [pricingSaveError, setPricingSaveError] = useState<string | null>(null);
  const [pricingSavedToast, setPricingSavedToast] = useState<string | null>(null);

  const [occSlider, setOccSlider] = useState<number>(60);
  const [leadSlider, setLeadSlider] = useState<number>(4);
  const [timeMultSlider, setTimeMultSlider] = useState<number>(1.25);
  const [contextSlider, setContextSlider] = useState<number>(1.0);

  const [simUsers, setSimUsers] = useState<number>(1500);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    setEditBasePrice(basePrice);
    setEditMinPrice(minPrice);
    setEditMaxPrice(maxPrice);
    setEditDepositPct(depositPercent);
    setPricingSaveError(null);
  }, [activeListing?.groupId, basePrice, minPrice, maxPrice, depositPercent]);

  useEffect(() => {
    if (activeQuote) {
      setOccSlider(Math.round(activeQuote.audit.occupancyPercentage));
      setLeadSlider(Number(activeQuote.audit.leadHours.toFixed(1)));
      setTimeMultSlider(Number(activeQuote.audit.timeMultiplier.toFixed(2)));
      setContextSlider(Number(activeQuote.audit.contextMultiplier.toFixed(2)));
    }
  }, [activeQuote]);

  useEffect(() => {
    if (!canManagePricing) return;
    marketplaceApi.runMonteCarloSimulation(1500, 7).then(({ result }) => setSimResult(result));
  }, [canManagePricing]);

  // =========================================================================
  // STRICT ACCESS GATE: LESSOR (MANAGER) & ADMIN ONLY
  // =========================================================================
  if (!canManagePricing) {
    return (
      <section id="yield-matrix" className="bg-[#F7F9F8] py-16 sm:py-24">
        <div className="mx-auto max-w-[960px] px-4 sm:px-8">
          <ScrollReveal className="rounded-[30px] border border-neutral-200/90 bg-white p-7 sm:p-11 shadow-[0_24px_60px_rgba(15,23,42,0.06)] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1 text-xs font-semibold text-rose-700">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
                </svg>
                Phân hệ Nội bộ • Yêu cầu Quyền Chủ sân hoặc Admin
              </span>
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-medium text-neutral-600">
                {session ? `Phiên hiện tại: ${session.fullName} (${activeRole})` : 'Chưa đăng nhập'}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0F172A]">
                Công cụ Định giá Động &amp; Tối ưu Doanh thu chỉ dành cho Người cho thuê &amp; Admin
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Khu vực này chứa cấu hình giá sàn/giá trần cụm sân, ma trận hệ số lấp đầy 2 chiều và
                mô phỏng doanh thu Monte Carlo. Tài khoản khách chơi (<strong>USER</strong>) hoặc chưa
                đăng nhập chỉ xem giá niêm yết cuối cùng tại trang <strong>Thuê sân</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-5 space-y-2">
                <div className="font-semibold text-[#16422C]">
                  Người cho thuê sân (MANAGER)
                </div>
                <ul className="space-y-1 text-neutral-600">
                  <li>• Thiết lập Giá cơ sở, Giá sàn, Giá trần &amp; % Tiền cọc cho cụm sân của mình</li>
                  <li>• Thử nghiệm ma trận hệ số giờ vắng / giờ cao điểm</li>
                  <li>• Mô phỏng tăng trưởng RevPAR theo nhu cầu khách hàng</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#0E4F7E]/20 bg-[#F4F8FB] p-5 space-y-2">
                <div className="font-semibold text-[#0E4F7E]">
                  Quản trị viên Hệ thống (ADMIN)
                </div>
                <ul className="space-y-1 text-neutral-600">
                  <li>• Giám sát biên độ giá động và ma trận hệ số toàn sàn ArenaPulse.vn</li>
                  <li>• Kiểm tra quy tắc chống chồng lấn PostgreSQL GiST giữa các đối tác</li>
                  <li>• Phân quyền MANAGER / ACCOUNTANT / STAFF và duyệt hồ sơ KYC</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
              <ActionButton
                variant="outline"
                size="md"
                onClick={() => onNavigate?.('courts')}
              >
                ← Quay lại Xem lịch &amp; Thuê sân
              </ActionButton>

              <div className="flex flex-wrap items-center gap-2.5">
                {session ? (
                  <ActionButton
                    variant="forest"
                    size="md"
                    arrow="right"
                    onClick={() => onNavigate?.('governance')}
                  >
                    Đăng ký Đối tác Chủ sân
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="forest"
                    size="md"
                    arrow="right"
                    onClick={() => onNavigate?.('login')}
                  >
                    Đăng nhập Chủ sân / Admin
                  </ActionButton>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  const handleRunSim = async () => {
    setSimRunning(true);
    const { result } = await marketplaceApi.runMonteCarloSimulation(simUsers, 7);
    setSimResult(result);
    setSimRunning(false);
  };

  const handleSavePricingPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaveError(null);
    setPricingSavedToast(null);

    if (!activeListing) return;
    if (editMinPrice < 50_000) {
      setPricingSaveError('Giá sàn tối thiểu phải từ 50.000₫ trở lên.');
      return;
    }
    if (editBasePrice < editMinPrice || editBasePrice > editMaxPrice) {
      setPricingSaveError('Bắt buộc thỏa mãn: Giá sàn <= Giá cơ sở <= Giá trần.');
      return;
    }
    if (editDepositPct < 0 || editDepositPct > 100) {
      setPricingSaveError('Tỷ lệ đặt cọc phải nằm trong khoảng 0% – 100%.');
      return;
    }

    onUpdateListingPricing?.(activeListing.groupId, {
      basePrice: editBasePrice,
      minPrice: editMinPrice,
      maxPrice: editMaxPrice,
      depositPercent: editDepositPct,
    });
    setPricingSavedToast(
      `Đã cập nhật chính sách giá cho ${activeListing.groupName} (${formatVnd(editMinPrice)} – ${formatVnd(editMaxPrice)} • Cọc ${editDepositPct}%).`
    );
    window.setTimeout(() => setPricingSavedToast(null), 4000);
  };

  const activeRowIndex = MATRIX_OCC_BANDS.findIndex(
    (b) => occSlider >= b.min && occSlider <= b.max
  );
  const safeRow = activeRowIndex === -1 ? 0 : activeRowIndex;
  const activeColIndex = LEAD_COLUMNS.findIndex((c) => c.check(leadSlider));
  const safeCol = activeColIndex === -1 ? 3 : activeColIndex;

  const matrixMultiplier = MATRIX_OCC_BANDS[safeRow].values[safeCol];
  const rawPrice = editBasePrice * timeMultSlider * matrixMultiplier * contextSlider;
  const roundedNearestThousand = Math.round(rawPrice / 1000) * 1000;
  const clampedFinal = Math.min(editMaxPrice, Math.max(editMinPrice, roundedNearestThousand));

  return (
    <section id="yield-matrix" className="bg-[#F7F9F8] py-14 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 space-y-6">
        {/* INTERNAL OPERATOR HEADER */}
        <ScrollReveal className="rounded-[28px] border border-neutral-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-[#0F172A] text-[#E7F7D4]'
                      : 'bg-[#16422C] text-[#E7F7D4]'
                  }`}
                >
                  {isAdmin ? 'ADMIN • Giám sát Định giá Toàn sàn' : 'CHỦ SÂN (MANAGER) • Quản trị Định giá'}
                </span>
                <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-medium text-neutral-600">
                  Phiên: {session?.fullName}
                </span>
              </div>

              <h1 className="mt-3 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
                Hệ thống Định giá Động &amp; Tối ưu Công suất Sân
              </h1>
              <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
                {isAdmin
                  ? 'Kiểm soát biên độ giá sàn/giá trần trên toàn mạng lưới cụm sân đối tác, điều chỉnh hệ số ma trận và mô phỏng tác động doanh thu.'
                  : 'Cấu hình trực tiếp đơn giá cơ sở, biên độ kẹp sàn/trần, tỷ lệ đặt cọc cho từng cụm sân của bạn và kiểm chứng doanh thu kỳ vọng.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {listings.length > 0 && onSelectListing && (
                <div className="min-w-[260px]">
                  <PillSelect
                    id="pricing-group-select"
                    ariaLabel="Chọn cụm sân cấu hình giá"
                    value={activeListing?.groupId ?? listings[0].groupId}
                    onChange={(groupId) => {
                      const found = listings.find((l) => l.groupId === groupId);
                      if (found) onSelectListing(found);
                    }}
                    options={listings.map((l) => ({
                      value: l.groupId,
                      label: `${l.venueName} — ${l.groupName}`,
                    }))}
                  />
                </div>
              )}

              {onNavigate && (
                <ActionButton
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('governance')}
                >
                  Mở Cổng Quản trị &amp; Sổ cái →
                </ActionButton>
              )}
            </div>
          </div>
        </ScrollReveal>

        {/* INTERACTIVE PRICE & GUARDRAIL POLICY EDITOR FOR LESSOR & ADMIN */}
        {activeListing && (
          <ScrollReveal className="rounded-[26px] border border-[#16422C]/20 bg-white p-6 sm:p-7 shadow-xs">
            <form onSubmit={handleSavePricingPolicy} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={activeListing.imageUrl || '/images/court-pickleball-padel.jpg'}
                    alt={activeListing.groupName}
                    className="h-12 w-16 rounded-xl object-cover border border-neutral-200"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#16422C]">
                      Cấu hình chính sách giá cho Cụm sân ({activeListing.sportCode})
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#0F172A]">
                      {activeListing.venueName} — {activeListing.groupName}
                    </h2>
                  </div>
                </div>

                {isAdmin && (
                  <span className="rounded-full bg-[#E6F1F8] border border-[#0E4F7E]/20 px-3 py-1 text-[11px] font-semibold text-[#0E4F7E]">
                    Biên độ Surge toàn sàn: 0.78× – 1.38×
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <label htmlFor="edit-min-price" className="mb-1.5 block font-semibold text-neutral-700">
                    Giá sàn tối thiểu (VNĐ/ca)
                  </label>
                  <input
                    id="edit-min-price"
                    type="number"
                    min={50000}
                    step={5000}
                    value={editMinPrice}
                    onChange={(e) => setEditMinPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 tabular-nums font-semibold text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-base-price" className="mb-1.5 block font-semibold text-neutral-700">
                    Giá chuẩn cơ sở (VNĐ/ca)
                  </label>
                  <input
                    id="edit-base-price"
                    type="number"
                    min={50000}
                    step={5000}
                    value={editBasePrice}
                    onChange={(e) => setEditBasePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 tabular-nums font-semibold text-[#16422C] focus:border-[#16422C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-max-price" className="mb-1.5 block font-semibold text-neutral-700">
                    Giá trần tối đa (VNĐ/ca)
                  </label>
                  <input
                    id="edit-max-price"
                    type="number"
                    min={50000}
                    step={5000}
                    value={editMaxPrice}
                    onChange={(e) => setEditMaxPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 tabular-nums font-semibold text-[#0E4F7E] focus:border-[#16422C] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-deposit-pct" className="mb-1.5 block font-semibold text-neutral-700">
                    Tỷ lệ đặt cọc giữ sân (%)
                  </label>
                  <input
                    id="edit-deposit-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={editDepositPct}
                    onChange={(e) => setEditDepositPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 tabular-nums font-semibold text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {pricingSaveError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                  {pricingSaveError}
                </div>
              )}

              {pricingSavedToast && (
                <div className="rounded-xl border border-[#16422C]/25 bg-[#F4F8F4] px-4 py-2.5 text-xs font-semibold text-[#16422C]">
                  {pricingSavedToast}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs text-neutral-500">
                  Sau khi lưu, bảng giá trên trang Thuê sân của khách hàng sẽ cập nhật ngay theo khung giá mới.
                </span>
                <ActionButton type="submit" variant="forest" size="md">
                  Lưu cấu hình giá cụm sân
                </ActionButton>
              </div>
            </form>
          </ScrollReveal>
        )}

        {/* Row 1: 4-Factor Studio (7 Cols) + 2D Heatmap Matrix (5 Cols) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <ScrollReveal className="rounded-[26px] bg-white p-6 sm:p-7 border border-neutral-200/80 lg:col-span-7 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#0E4F7E]">
                Mô phỏng Công thức = Kẹp biên (Giá chuẩn × Hệ số giờ × Lấp đầy × Bối cảnh)
              </span>
              <span className="rounded-full bg-[#E7F7D4] px-3 py-0.5 tabular-nums text-[11px] font-semibold text-[#204E18]">
                Làm tròn 1.000₫
              </span>
            </div>

            <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0E4F7E] to-[#16422C] p-5 text-white sm:flex-row sm:items-center">
              <div>
                <div className="text-xs text-white/75">Giá tính thô trước kẹp biên</div>
                <div className="mt-0.5 tabular-nums text-lg font-semibold text-white/95">
                  {formatVnd(rawPrice)}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs text-[#E7F7D4]">Giá thuê áp dụng thực tế</div>
                <AnimatedVnd
                  value={clampedFinal}
                  className="text-3xl font-bold text-white"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F8FAFC] p-3.5 border border-neutral-200/70">
                <div className="mb-1.5 flex justify-between text-xs">
                  <label htmlFor="occ-range" className="font-medium text-neutral-700">
                    Độ lấp đầy cụm sân
                  </label>
                  <span className="tabular-nums font-semibold text-[#16422C]">{occSlider}%</span>
                </div>
                <input
                  id="occ-range"
                  name="occSlider"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={occSlider}
                  onChange={(e) => setOccSlider(Number(e.target.value))}
                  className="w-full accent-[#16422C]"
                />
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] p-3.5 border border-neutral-200/70">
                <div className="mb-1.5 flex justify-between text-xs">
                  <label htmlFor="lead-range" className="font-medium text-neutral-700">
                    Thời gian đặt trước
                  </label>
                  <span className="tabular-nums font-semibold text-[#0E4F7E]">{leadSlider}h</span>
                </div>
                <input
                  id="lead-range"
                  name="leadSlider"
                  type="range"
                  min={0.5}
                  max={72}
                  step={0.5}
                  value={leadSlider}
                  onChange={(e) => setLeadSlider(Number(e.target.value))}
                  className="w-full accent-[#0E4F7E]"
                />
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] p-3.5 border border-neutral-200/70">
                <div className="mb-1.5 flex justify-between text-xs">
                  <label htmlFor="time-range" className="font-medium text-neutral-700">
                    Hệ số khung giờ
                  </label>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {timeMultSlider.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="time-range"
                  name="timeMultSlider"
                  type="range"
                  min={0.7}
                  max={1.6}
                  step={0.05}
                  value={timeMultSlider}
                  onChange={(e) => setTimeMultSlider(Number(e.target.value))}
                  className="w-full accent-[#16422C]"
                />
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] p-3.5 border border-neutral-200/70">
                <div className="mb-1.5 flex justify-between text-xs">
                  <label htmlFor="ctx-range" className="font-medium text-neutral-700">
                    Hệ số cuối tuần / giải đấu
                  </label>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {contextSlider.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="ctx-range"
                  name="ctxMultSlider"
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={contextSlider}
                  onChange={(e) => setContextSlider(Number(e.target.value))}
                  className="w-full accent-[#0E4F7E]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-between tabular-nums text-[11px] text-neutral-500">
              <span>Giá sàn: {formatVnd(editMinPrice)}</span>
              <span>Giá cơ sở: {formatVnd(editBasePrice)}</span>
              <span>Giá trần: {formatVnd(editMaxPrice)}</span>
            </div>
          </ScrollReveal>

          <ScrollReveal
            delay={0.06}
            className="rounded-[26px] bg-white p-6 sm:p-7 border border-neutral-200/80 lg:col-span-5 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#0F172A]">Ma trận hệ số 2 chiều</h3>
                <span className="rounded-full bg-[#F8FAFC] border border-neutral-200 px-3 py-1 tabular-nums text-xs font-semibold text-[#0E4F7E]">
                  Đang khớp: {matrixMultiplier.toFixed(2)}x
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Bấm trực tiếp vào từng ô để thử nghiệm kịch bản ưu đãi thấp điểm hoặc cao điểm.
              </p>

              <div className="mt-4 overflow-x-auto rounded-2xl bg-[#F8FAFC] p-3 border border-neutral-200/70">
                <table className="w-full border-separate border-spacing-1.5 text-center text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-[10px] font-medium uppercase text-neutral-400">
                        Lấp đầy \ Giờ
                      </th>
                      {LEAD_COLUMNS.map((col, cIdx) => (
                        <th
                          key={col.label}
                          className={`p-1 text-[11px] font-semibold ${
                            cIdx === safeCol ? 'text-[#16422C]' : 'text-neutral-500'
                          }`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX_OCC_BANDS.map((band, rIdx) => (
                      <tr key={band.label}>
                        <td
                          className={`p-1 text-left tabular-nums text-[11px] font-medium ${
                            rIdx === safeRow ? 'text-[#16422C] font-semibold' : 'text-neutral-500'
                          }`}
                        >
                          {band.label}
                        </td>
                        {band.values.map((val, cIdx) => {
                          const isHit = rIdx === safeRow && cIdx === safeCol;
                          return (
                            <td key={`${band.label}-${cIdx}`} className="p-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setOccSlider(Math.round((band.min + band.max) / 2));
                                  setLeadSlider([60, 24, 6, 1.5][cIdx]);
                                }}
                                className={`w-full rounded-xl py-2.5 tabular-nums text-xs font-semibold transition-transform ${
                                  isHit
                                    ? 'bg-[#16422C] text-white scale-105 shadow-sm'
                                    : val >= 1.2
                                      ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                                      : val < 0.95
                                        ? 'bg-[#E7F7D4] text-[#204E18]'
                                        : 'bg-white text-neutral-700'
                                }`}
                              >
                                {val.toFixed(2)}x
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-[11.5px] leading-relaxed text-neutral-500">
              Hệ thống khóa không chồng lấn các ô ma trận ngay tại tầng cơ sở dữ liệu PostgreSQL 16.
            </div>
          </ScrollReveal>
        </div>

        {/* Row 2: Integrated Monte Carlo 7-Day Uplift Comparison */}
        {simResult && (
          <ScrollReveal
            delay={0.1}
            className="rounded-[26px] border border-neutral-200/80 bg-white p-6 sm:p-7 shadow-xs"
          >
            <div className="flex flex-col gap-4 border-b border-neutral-200/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">
                  Mô phỏng Monte Carlo 7 ngày: Bảng giá cố định vs. Định giá động
                </h3>
                <p className="mt-0.5 text-xs text-neutral-500">{simResult.summaryMessage}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <PillSelect
                  id="sim-users"
                  prefix="Quy mô cầu:"
                  ariaLabel="Chọn quy mô lượt khách mô phỏng"
                  value={String(simUsers)}
                  onChange={(val) => setSimUsers(Number(val))}
                  options={[
                    { value: '800', label: '800 lượt khách' },
                    { value: '1500', label: '1.500 lượt khách' },
                    { value: '2500', label: '2.500 lượt khách' },
                  ]}
                />

                <ActionButton
                  variant="ink"
                  size="sm"
                  disabled={simRunning}
                  onClick={handleRunSim}
                >
                  {simRunning ? 'Đang chạy mô phỏng…' : 'Chạy kiểm chứng lại'}
                </ActionButton>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 space-y-4">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-neutral-600">
                      Giá cố định truyền thống ({simResult.fixedPricing.occupancyRate}% lấp đầy)
                    </span>
                    <span className="tabular-nums font-semibold text-neutral-800">
                      {formatVnd(simResult.fixedPricing.totalRevenue)}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#F1F5F9] border border-neutral-200/70">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 0.68 }}
                      viewport={{ once: true }}
                      style={{ transformOrigin: '0% 50%' }}
                      transition={{ duration: 0.8, ease: EXPO_EASE }}
                      className="h-full w-full rounded-full bg-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-semibold text-[#16422C]">
                      Định giá động đa nhân tố ({simResult.dynamicPricing.occupancyRate}% lấp đầy)
                    </span>
                    <span className="tabular-nums font-bold text-[#16422C]">
                      {formatVnd(simResult.dynamicPricing.totalRevenue)}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#F1F5F9] border border-neutral-200/70">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 0.94 }}
                      viewport={{ once: true }}
                      style={{ transformOrigin: '0% 50%' }}
                      transition={{ duration: 0.95, ease: EXPO_EASE }}
                      className="h-full w-full rounded-full bg-gradient-to-r from-[#0E4F7E] to-[#16422C]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#F4F8F4] p-5 border border-[#16422C]/20 lg:col-span-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-500">Tăng trưởng RevPAR / giờ sân</div>
                  <div className="mt-1 tabular-nums text-3xl font-bold text-[#16422C]">
                    +{simResult.revParUpliftPct}%
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-neutral-400">RevPAR động</div>
                  <div className="tabular-nums font-semibold text-[#0F172A]">
                    {formatVnd(simResult.dynamicPricing.revPar)}/h
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
};
