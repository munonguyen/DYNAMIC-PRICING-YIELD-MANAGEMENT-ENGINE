import React, { useEffect, useMemo, useState } from 'react';
import type {
  CourtServiceCategory,
  CourtServiceOption,
  PublishedListing,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import {
  COURT_SERVICE_CATEGORY_LABELS,
  PRESET_SERVICE_IMAGES,
  getSuggestedTemplatesBySport,
} from '../data/courtServicesData';
import { ActionButton, PillSelect } from './FairwayControls';

interface LessorAddOnServicesManagerProps {
  listings: PublishedListing[];
  initialGroupId?: string | null;
  onUpdateListingServices: (groupId: string, nextServices: CourtServiceOption[]) => void;
  onPreviewCourt?: (listing: PublishedListing) => void;
}

export const LessorAddOnServicesManager: React.FC<LessorAddOnServicesManagerProps> = ({
  listings,
  initialGroupId,
  onUpdateListingServices,
  onPreviewCourt,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialGroupId ?? listings[0]?.groupId ?? ''
  );

  useEffect(() => {
    if (initialGroupId && listings.some((l) => l.groupId === initialGroupId)) {
      setSelectedGroupId(initialGroupId);
    }
  }, [initialGroupId, listings]);

  useEffect(() => {
    if (!listings.some((l) => l.groupId === selectedGroupId) && listings[0]) {
      setSelectedGroupId(listings[0].groupId);
    }
  }, [listings, selectedGroupId]);

  const activeListing = useMemo(
    () => listings.find((l) => l.groupId === selectedGroupId) ?? listings[0] ?? null,
    [listings, selectedGroupId]
  );

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<CourtServiceCategory>('DRINKS');
  const [unitPriceStr, setUnitPriceStr] = useState<string>('25000');
  const [unitLabel, setUnitLabel] = useState<string>('chai');
  const [maxQtyStr, setMaxQtyStr] = useState<string>('10');
  const [description, setDescription] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>(PRESET_SERVICE_IMAGES[0].url);
  const [popular, setPopular] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!activeListing) {
    return (
      <div className="rounded-[26px] border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">
        Chưa có cụm sân nào để cấu hình sản phẩm dịch vụ đi kèm.
      </div>
    );
  }

  const configuredServices = activeListing.addOnServices ?? [];
  const activeCount = configuredServices.filter((s) => s.enabled !== false).length;
  const templates = getSuggestedTemplatesBySport(activeListing.sportCode);

  const flashNotice = (msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(null), 2600);
  };

  const handleUploadCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const price = Math.max(1_000, Number(unitPriceStr.replace(/\D/g, '')) || 20_000);
    const maxQty = Math.min(50, Math.max(1, Number(maxQtyStr) || 5));

    const newItem: CourtServiceOption = {
      id: `${activeListing.groupId}__custom_${Date.now()}`,
      sportCode: activeListing.sportCode,
      category,
      name: name.trim(),
      description:
        description.trim() ||
        `Phục vụ trực tiếp tại ${activeListing.venueName} cho khách đặt sân.`,
      unitLabel: unitLabel.trim() || 'món',
      unitPrice: price,
      maxQty,
      imageUrl,
      popular,
      enabled: true,
    };

    onUpdateListingServices(activeListing.groupId, [newItem, ...configuredServices]);
    setName('');
    setDescription('');
    setPopular(false);
    flashNotice(`Đã thêm "${newItem.name}" vào danh sách bán kèm của cụm sân!`);
  };

  const handleImportTemplate = (tpl: CourtServiceOption) => {
    const alreadyExists = configuredServices.some(
      (s) => s.name.toLowerCase() === tpl.name.toLowerCase()
    );
    if (alreadyExists) {
      flashNotice(`Sản phẩm "${tpl.name}" đã có trong danh sách của sân này.`);
      return;
    }
    const imported: CourtServiceOption = {
      ...tpl,
      id: `${activeListing.groupId}__${tpl.id}_${Date.now().toString(36)}`,
      enabled: true,
    };
    onUpdateListingServices(activeListing.groupId, [...configuredServices, imported]);
    flashNotice(`Đã nhập mẫu "${tpl.name}" vào sân!`);
  };

  const handleToggleEnabled = (serviceId: string) => {
    const next = configuredServices.map((s) =>
      s.id === serviceId ? { ...s, enabled: s.enabled === false ? true : false } : s
    );
    onUpdateListingServices(activeListing.groupId, next);
  };

  const handleChangePrice = (serviceId: string, rawVal: string) => {
    const numeric = Math.max(0, Number(rawVal.replace(/\D/g, '')) || 0);
    const next = configuredServices.map((s) =>
      s.id === serviceId ? { ...s, unitPrice: numeric } : s
    );
    onUpdateListingServices(activeListing.groupId, next);
  };

  const handleDeleteService = (serviceId: string) => {
    const next = configuredServices.filter((s) => s.id !== serviceId);
    onUpdateListingServices(activeListing.groupId, next);
    flashNotice('Đã gỡ sản phẩm khỏi cụm sân.');
  };

  const handleClearAllServices = () => {
    onUpdateListingServices(activeListing.groupId, []);
    flashNotice('Đã tắt toàn bộ dịch vụ bán kèm trực tuyến của cụm sân này.');
  };

  return (
    <div className="space-y-6">
      {/* Top Venue Group Selector Bar */}
      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#16422C]">
              Quản trị Danh mục Bán kèm Của Chủ sân
            </span>
            <h3 className="text-xl font-bold text-[#0F172A]">
              Thiết lập Nước uống, Dụng cụ &amp; Dịch vụ riêng cho từng Cụm sân
            </h3>
            <p className="text-xs text-neutral-500">
              Mỗi cụm sân chỉ hiển thị đúng các sản phẩm mà Chủ sân thêm và bật mở bán tại đây —
              không ép danh sách mặc định.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PillSelect
              prefix="Cụm sân:"
              ariaLabel="Chọn cụm sân cấu hình dịch vụ"
              value={activeListing.groupId}
              onChange={setSelectedGroupId}
              options={listings.map((l) => ({
                value: l.groupId,
                label: `${l.venueName} — ${l.sportName} (${(l.addOnServices ?? []).filter((s) => s.enabled !== false).length} món)`,
              }))}
            />
            {onPreviewCourt && (
              <ActionButton
                variant="outline"
                size="sm"
                arrow="up-right"
                onClick={() => onPreviewCourt(activeListing)}
              >
                Xem ngoài trang Đặt sân
              </ActionButton>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 rounded-xl border border-[#16422C]/25 bg-[#F4F8F4] px-4 py-2.5 text-xs font-semibold text-[#16422C]">
            ✓ {statusMessage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT 5 COLS: CREATE CUSTOM SERVICE / PRODUCT FORM */}
        <form
          onSubmit={handleAddCustomProduct}
          className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs lg:col-span-5 space-y-4 h-fit"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E4F7E]">
              Tạo Sản phẩm / Dịch vụ Mới
            </span>
            <h4 className="mt-0.5 text-base font-bold text-[#0F172A]">
              Thêm mặt hàng riêng của cơ sở “{activeListing.venueName}”
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-neutral-700">
                Tên sản phẩm / dịch vụ *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Trà tắc mật ong bình 2L, Thuê vợt Joola Perseus..."
                className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-neutral-700">Nhóm dịch vụ</label>
                <PillSelect
                  variant="soft"
                  ariaLabel="Chọn nhóm dịch vụ"
                  value={category}
                  onChange={(v) => setCategory(v as CourtServiceCategory)}
                  options={[
                    { value: 'DRINKS', label: 'Nước & Điện giải' },
                    { value: 'EQUIPMENT', label: 'Dụng cụ thi đấu' },
                    { value: 'SUPPORT', label: 'Hỗ trợ trận đấu' },
                    { value: 'FACILITY', label: 'Tiện ích & Hậu cần' },
                  ]}
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700">Đơn giá (VND) *</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={unitPriceStr}
                  onChange={(e) => setUnitPriceStr(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums font-semibold text-[#0F172A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-neutral-700">
                  Đơn vị tính (chai/ca/bộ)
                </label>
                <input
                  type="text"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="chai, thùng, cây, ca..."
                  className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A]"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700">
                  Tối đa mỗi đơn đặt
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxQtyStr}
                  onChange={(e) => setMaxQtyStr(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2.5 tabular-nums text-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-neutral-700">Mô tả ngắn</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú quy cách phục vụ tại sân..."
                className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Product Image Picker + Custom File Upload */}
            <div className="space-y-2 rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0F172A]">Hình ảnh sản phẩm</span>
                <label className="cursor-pointer rounded-full bg-white border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-[#16422C] hover:border-[#16422C]">
                  Tải ảnh từ máy…
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomImage}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="Xem trước sản phẩm"
                  className="h-14 w-20 shrink-0 rounded-xl object-cover border border-neutral-200 bg-white"
                />
                <PillSelect
                  variant="field"
                  ariaLabel="Chọn ảnh mẫu có sẵn"
                  value={
                    PRESET_SERVICE_IMAGES.some((p) => p.url === imageUrl) ? imageUrl : 'CUSTOM'
                  }
                  onChange={(v) => {
                    if (v !== 'CUSTOM') setImageUrl(v);
                  }}
                  options={[
                    ...(!PRESET_SERVICE_IMAGES.some((p) => p.url === imageUrl)
                      ? [{ value: 'CUSTOM', label: 'Ảnh riêng đã tải lên từ máy' }]
                      : []),
                    ...PRESET_SERVICE_IMAGES.map((img) => ({
                      value: img.url,
                      label: `Ảnh mẫu: ${img.label}`,
                    })),
                  ]}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={popular}
                onChange={(e) => setPopular(e.target.checked)}
                className="rounded border-neutral-300 text-[#16422C]"
              />
              <span className="text-neutral-700 font-medium">
                Gắn nhãn “Phổ biến” ưu tiên chú ý trên thẻ sản phẩm
              </span>
            </label>
          </div>

          <ActionButton type="submit" variant="forest" size="md" fullWidth>
            + Lưu &amp; Mở bán cho cụm sân này
          </ActionButton>
        </form>

        {/* RIGHT 7 COLS: CURRENT VENUE INVENTORY + QUICK INDUSTRY SUGGESTIONS */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Configured Products of This Court */}
          <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-4">
              <div>
                <h4 className="text-base font-bold text-[#0F172A]">
                  Danh sách sản phẩm đang gắn với cụm sân ({activeCount} đang mở /{' '}
                  {configuredServices.length} tổng)
                </h4>
                <p className="text-xs text-neutral-500">
                  Bật/tắt trạng thái bán, điều chỉnh giá tức thì hoặc xóa nếu cơ sở không cung cấp.
                </p>
              </div>

              {configuredServices.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllServices}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Gỡ toàn bộ ({configuredServices.length})
                </button>
              )}
            </div>

            {configuredServices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-[#F8FAFC] p-8 text-center space-y-2">
                <div className="text-sm font-semibold text-[#0F172A]">
                  Cụm sân này hiện không bán sản phẩm / dịch vụ đi kèm trực tuyến
                </div>
                <p className="text-xs text-neutral-500">
                  Khách đặt sân sẽ chỉ thanh toán tiền thuê mặt sân. Bạn có thể tự thêm mặt hàng ở
                  khung bên trái hoặc chọn nhanh từ gợi ý bên dưới.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {configuredServices.map((srv) => {
                  const isEnabled = srv.enabled !== false;
                  return (
                    <div
                      key={srv.id}
                      className={`flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between ${
                        isEnabled ? '' : 'opacity-55'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={srv.imageUrl}
                          alt={srv.name}
                          className="h-13 w-18 shrink-0 rounded-xl object-cover border border-neutral-200"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs sm:text-[13px] font-bold text-[#0F172A]">
                              {srv.name}
                            </span>
                            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                              {COURT_SERVICE_CATEGORY_LABELS[srv.category]}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
                            Đơn vị: {srv.unitLabel} • Tối đa {srv.maxQty} {srv.unitLabel}/đơn
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center rounded-xl border border-neutral-200 bg-[#F8FAFC] px-2.5 py-1 text-xs">
                          <input
                            type="number"
                            step={1000}
                            min={0}
                            aria-label={`Giá ${srv.name}`}
                            value={srv.unitPrice}
                            onChange={(e) => handleChangePrice(srv.id, e.target.value)}
                            className="w-22 bg-transparent tabular-nums font-bold text-[#16422C] focus:outline-none"
                          />
                          <span className="text-[10.5px] text-neutral-400">₫</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(srv.id)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            isEnabled
                              ? 'bg-[#E7F7D4] text-[#204E18]'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {isEnabled ? 'Đang bán' : 'Tạm ẩn'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteService(srv.id)}
                          className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:border-rose-300 hover:text-rose-600"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional Quick-Import Industry Templates */}
          {templates.length > 0 && (
            <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-3.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                  Thư viện Gợi ý Nhanh cho bộ môn {activeListing.sportName}
                </span>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Bấm “+ Nhập vào sân” nếu cơ sở của bạn có phục vụ mặt hàng tương ứng (sau khi nhập
                  có thể tự sửa giá bán).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {templates.map((tpl) => {
                  const added = configuredServices.some(
                    (s) => s.name.toLowerCase() === tpl.name.toLowerCase()
                  );
                  return (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between gap-2.5 rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={tpl.imageUrl}
                          alt={tpl.name}
                          className="h-10 w-12 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[#0F172A]">{tpl.name}</div>
                          <div className="tabular-nums text-[11px] text-[#16422C] font-semibold">
                            Gợi ý: {formatVnd(tpl.unitPrice)}/{tpl.unitLabel}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={added}
                        onClick={() => handleImportTemplate(tpl)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                          added
                            ? 'bg-neutral-200 text-neutral-500 cursor-default'
                            : 'border border-[#16422C] bg-white text-[#16422C] hover:bg-[#16422C] hover:text-[#E7F7D4]'
                        }`}
                      >
                        {added ? 'Đã có' : '+ Nhập'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

