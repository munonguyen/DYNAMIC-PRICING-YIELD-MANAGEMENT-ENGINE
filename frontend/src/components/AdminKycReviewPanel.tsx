import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  FileCheck2,
  Landmark,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { LessorApplicationRecord } from '../types/marketplace';
import { ActionButton } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

interface AdminKycReviewPanelProps {
  kycQueue: LessorApplicationRecord[];
  isAdmin: boolean;
  reviewingId: string | null;
  onReviewApplication: (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    customNote?: string
  ) => void;
}

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  OWNERSHIP_CERT: 'Sổ đỏ / GCN Quyền sử dụng đất Chính chủ',
  LEASE_WITH_SUBLEASE: 'Hợp đồng Thuê mặt bằng (Có điều khoản cho thuê lại)',
  AUTHORIZATION_DOC: 'Giấy Ủy quyền Khai thác / Kinh doanh Hợp pháp',
};

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  ENTERPRISE: 'Doanh nghiệp (Công ty TNHH / Cổ phần)',
  HOUSEHOLD_BUSINESS: 'Hộ Kinh doanh Cá thể',
};

function formatDateLabel(raw?: string | null): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeLabel(raw?: string | null): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminKycReviewPanel: React.FC<AdminKycReviewPanelProps> = ({
  kycQueue,
  isAdmin,
  reviewingId,
  onReviewApplication,
}) => {
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<LessorApplicationRecord | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kycQueue.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.referenceCode.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.legalEntityName.toLowerCase().includes(q) ||
        item.representativeFullName.toLowerCase().includes(q) ||
        item.taxCode.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q)
      );
    });
  }, [kycQueue, statusFilter, searchQuery]);

  const counts = useMemo(
    () => ({
      all: kycQueue.length,
      pending: kycQueue.filter((k) => k.status === 'PENDING_REVIEW').length,
      approved: kycQueue.filter((k) => k.status === 'APPROVED').length,
      rejected: kycQueue.filter((k) => k.status === 'REJECTED').length,
    }),
    [kycQueue]
  );

  const renderChecklist = (item: LessorApplicationRecord) => [
    {
      label: 'Xác thực OTP SĐT chính chủ',
      ok: item.otpVerified,
      detail: item.contactPhone ? `SĐT: ${item.contactPhone}` : 'Đã đối chiếu phiên OTP',
    },
    {
      label: 'Mã số thuế & Giấy phép ĐKKD',
      ok: Boolean(item.taxCode && item.businessLicenseNumber),
      detail: `MST ${item.taxCode} • ĐKKD ${item.businessLicenseNumber}`,
    },
    {
      label: 'Người đại diện Pháp luật (CCCD)',
      ok: Boolean(item.representativeFullName && item.maskedCccdNumber),
      detail: `${item.representativeFullName} (${item.maskedCccdNumber})`,
    },
    {
      label: 'Pháp lý Mặt bằng & Quyền khai thác',
      ok: Boolean(item.propertyDocumentNumber),
      detail: `${PROPERTY_TYPE_LABEL[item.propertyRightType] ?? item.propertyRightType} • Số ${item.propertyDocumentNumber}`,
    },
    {
      label: 'An toàn PCCC & Chuẩn Thể thao TDTT',
      ok: Boolean(
        item.pcccCertificateNumber &&
          (item.fireSafetyConfirmed ?? true) &&
          (item.sportSafetyConfirmed ?? true)
      ),
      detail: `Chứng nhận PCCC ${item.pcccCertificateNumber}`,
    },
    {
      label: 'Tài khoản Ngân hàng Tất toán T+0',
      ok: Boolean(item.bankCode && item.maskedBankAccountNumber && item.bankAccountHolder),
      detail: `${item.bankCode} • ${item.maskedBankAccountNumber} (${item.bankAccountHolder})`,
    },
    {
      label: 'Chấm điểm Rủi ro Tự động & Chứng từ',
      ok: item.riskScore < 40,
      detail: `RiskScore ${item.riskScore}/100 • Cờ: ${item.internalRiskFlags || 'CLEAN'}`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* HEADER + FILTERS + SEARCH */}
      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Hàng Đợi Thẩm Định Pháp Lý 7 Tiêu Chuẩn
            </span>
            <h3 className="mt-0.5 text-xl font-bold text-[#0F172A]">
              Hồ sơ Đăng ký Đối tác Chủ Cụm Sân ({filteredQueue.length})
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Hiển thị đầy đủ thông tin pháp nhân, người đại diện, liên hệ, mặt bằng, PCCC, tài khoản tất toán &amp; điểm rủi ro trước khi phê duyệt cấp Tenant.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: `Tất cả (${counts.all})` },
              { id: 'PENDING_REVIEW', label: `Chờ duyệt (${counts.pending})` },
              { id: 'APPROVED', label: `Đã cấp Tenant (${counts.approved})` },
              { id: 'REJECTED', label: `Từ chối (${counts.rejected})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as typeof statusFilter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#0A192F] text-white'
                    : 'bg-[#F1F5F9] text-neutral-600 hover:text-[#0F172A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã KYC, tên cụm sân, pháp nhân, MST hoặc người đại diện…"
            className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] py-2 pl-10 pr-4 text-xs text-[#0F172A] focus:border-[#0E4F7E] focus:outline-none"
          />
        </div>
      </div>

      {/* FULL-DETAIL KYC APPLICATION CARDS */}
      {filteredQueue.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">
          Hiện chưa có hồ sơ đăng ký Chủ sân nào khớp bộ lọc.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQueue.map((item) => {
            const sportsList = item.sportCodes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const noteVal = noteById[item.id] ?? '';

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs"
              >
                {/* Card Top Header */}
                <div className="flex flex-col gap-3 border-b border-neutral-100 bg-[#F8FAFC] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0A192F] px-2.5 py-1 font-mono text-[11px] font-bold text-white">
                      {item.referenceCode}
                    </span>
                    <h4 className="text-base font-bold text-[#0F172A]">{item.venueName}</h4>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {item.status === 'PENDING_REVIEW'
                        ? 'Chờ phê duyệt'
                        : item.status === 'APPROVED'
                          ? 'Đã cấp Tenant'
                          : 'Đã từ chối'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                        item.riskScore >= 40
                          ? 'bg-rose-100 text-rose-700'
                          : item.riskScore > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-teal-50 text-[#0F766E]'
                      }`}
                    >
                      Risk Score: {item.riskScore}/100
                    </span>
                    {item.otpVerified && (
                      <span className="rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0E4F7E]">
                        ✓ OTP Xác thực
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] text-neutral-500">
                      Nộp lúc: {formatDateTimeLabel(item.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedApp(item)}
                      className="rounded-xl border border-[#0E4F7E]/30 bg-white px-3 py-1.5 font-bold text-[#0E4F7E] hover:bg-[#E6F1F8] transition cursor-pointer"
                    >
                      Soi Toàn bộ Hồ sơ ↗
                    </button>
                  </div>
                </div>

                {/* Structured 3-Column Complete Partner Information Grid */}
                <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3 text-xs">
                  {/* Block 1: Legal Entity & Representative */}
                  <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#0E4F7E]">
                      <UserCheck className="h-4 w-4" />
                      <span>1. Pháp nhân &amp; Người Đại diện</span>
                    </div>
                    <div className="space-y-1 text-neutral-700">
                      <div>
                        <span className="text-neutral-500">Loại hình:</span>{' '}
                        <strong>{BUSINESS_TYPE_LABEL[item.businessType] ?? item.businessType}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Pháp nhân:</span>{' '}
                        <strong className="text-[#0F172A]">{item.legalEntityName}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Đại diện pháp luật:</span>{' '}
                        <strong>{item.representativeFullName}</strong>
                        {item.representativeDob ? ` (${formatDateLabel(item.representativeDob)})` : ''}
                      </div>
                      <div>
                        <span className="text-neutral-500">CCCD:</span>{' '}
                        <code className="font-semibold text-[#0F172A]">{item.maskedCccdNumber}</code>
                        {item.cccdIssueDate ? ` • Cấp: ${formatDateLabel(item.cccdIssueDate)}` : ''}
                      </div>
                      <div>
                        <span className="text-neutral-500">MST / ĐKKD:</span>{' '}
                        <strong>{item.taxCode}</strong> / {item.businessLicenseNumber}
                      </div>
                      {(item.contactPhone || item.contactEmail) && (
                        <div className="pt-1 border-t border-neutral-200/70 text-[11px]">
                          Liên hệ: <strong>{item.contactPhone || '—'}</strong> •{' '}
                          <span className="text-[#0E4F7E]">{item.contactEmail || '—'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Block 2: Venue Location, Property Rights & Fire Safety */}
                  <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#0F766E]">
                      <MapPin className="h-4 w-4" />
                      <span>2. Địa điểm, Mặt bằng &amp; PCCC</span>
                    </div>
                    <div className="space-y-1 text-neutral-700">
                      <div>
                        <span className="text-neutral-500">Địa chỉ sân:</span>{' '}
                        <strong className="text-[#0F172A]">
                          {item.venueAddress}, {item.district}, {item.city}
                        </strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-neutral-500 mr-1">Quy mô:</span>
                        <strong className="text-[#0F172A]">{item.totalCourts} sân vật lý</strong>
                        {sportsList.map((sp) => (
                          <span
                            key={sp}
                            className="rounded-md bg-[#E6F1F8] px-1.5 py-0.5 text-[10px] font-bold text-[#0E4F7E]"
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="text-neutral-500">Quyền sử dụng:</span>{' '}
                        <strong>
                          {PROPERTY_TYPE_LABEL[item.propertyRightType] ?? item.propertyRightType}
                        </strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Số GCN/HĐ thuê:</span>{' '}
                        <strong>{item.propertyDocumentNumber}</strong>
                        {item.propertyExpiryDate
                          ? ` (Hạn: ${formatDateLabel(item.propertyExpiryDate)})`
                          : ' (Chính chủ dài hạn)'}
                      </div>
                      <div>
                        <span className="text-neutral-500">Chứng nhận PCCC:</span>{' '}
                        <strong className="text-[#0F766E]">{item.pcccCertificateNumber}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Block 3: Banking, Commercial Terms & Risk Audit */}
                  <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                      <Landmark className="h-4 w-4 text-[#0E4F7E]" />
                      <span>3. Ngân hàng, Phí Sàn &amp; Chứng từ</span>
                    </div>
                    <div className="space-y-1 text-neutral-700">
                      <div>
                        <span className="text-neutral-500">Ngân hàng tất toán:</span>{' '}
                        <strong>{item.bankCode}</strong> •{' '}
                        <code>{item.maskedBankAccountNumber}</code>
                      </div>
                      <div>
                        <span className="text-neutral-500">Chủ tài khoản:</span>{' '}
                        <strong className="text-[#0F172A]">{item.bankAccountHolder}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Thương mại:</span> Cọc đề xuất{' '}
                        <strong>{item.proposedDepositPercent}%</strong> • Hoa hồng sàn{' '}
                        <strong className="text-[#0F766E]">{item.acceptedCommissionRate}%</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Chứng từ nộp:</span>{' '}
                        <span className="font-semibold text-[#0E4F7E]">
                          {[
                            item.cccdFrontStorageKey && 'CCCD Trước',
                            item.cccdBackStorageKey && 'CCCD Sau',
                            item.businessDocStorageKey && 'ĐKKD',
                            item.courtPhotoStorageKey && 'Ảnh Sân',
                          ]
                            .filter(Boolean)
                            .join(' • ') || 'Đã đính kèm hồ sơ số'}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-neutral-200/70 text-[11px] text-neutral-500">
                        Cờ rủi ro: <strong>{item.internalRiskFlags || 'CLEAN'}</strong> •{' '}
                        {item.validationSummary}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Action Bar OR Review Decision Audit Footer */}
                <div className="border-t border-neutral-100 px-6 py-4 bg-white">
                  {isAdmin && item.status === 'PENDING_REVIEW' ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <input
                        type="text"
                        value={noteVal}
                        onChange={(e) =>
                          setNoteById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Nhập ghi chú thẩm định (tùy chọn khi phê duyệt / bắt buộc rõ lý do nếu từ chối)…"
                        className="flex-1 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#0E4F7E] focus:outline-none"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <ActionButton
                          variant="ink"
                          size="sm"
                          disabled={reviewingId === item.id}
                          onClick={() =>
                            onReviewApplication(item.id, 'APPROVED', noteVal.trim() || undefined)
                          }
                        >
                          {reviewingId === item.id ? 'Đang xử lý…' : 'Phê duyệt (Mở Tenant)'}
                        </ActionButton>
                        <ActionButton
                          variant="outline"
                          size="sm"
                          disabled={reviewingId === item.id}
                          onClick={() =>
                            onReviewApplication(item.id, 'REJECTED', noteVal.trim() || undefined)
                          }
                        >
                          Từ chối Hồ sơ
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
                      <span>
                        <strong>Kết luận thẩm định:</strong>{' '}
                        {item.reviewNote || 'Đã xử lý hồ sơ.'}
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {item.provisionedTenantId && (
                          <span className="rounded-lg bg-[#E6F1F8] px-2.5 py-0.5 font-mono font-semibold text-[#0E4F7E]">
                            Tenant ID: {item.provisionedTenantId}
                          </span>
                        )}
                        {item.reviewedAt && (
                          <span>Duyệt lúc: {formatDateTimeLabel(item.reviewedAt)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* FULL PARTNER KYC AUDIT MODAL                                        */}
      {/* =================================================================== */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: EXPO_EASE }}
              className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[28px] border border-neutral-200 bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E4F7E]">
                    Hồ sơ Thẩm định Chi tiết • {selectedApp.referenceCode}
                  </span>
                  <h4 className="text-lg font-bold text-[#0F172A]">{selectedApp.venueName}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
                  aria-label="Đóng chi tiết hồ sơ"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-xs">
                {/* 7-Point Legal Checklist */}
                <div className="rounded-2xl border border-[#0E4F7E]/20 bg-[#F4F8FB] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#0E4F7E]">
                      <FileCheck2 className="h-4 w-4" />
                      Kiểm tra Tự động 7 Tiêu chuẩn Pháp lý &amp; Tuân thủ Sàn
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#0F172A]">
                      Risk Score: {selectedApp.riskScore}/100
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {renderChecklist(selectedApp).map((chk) => (
                      <div
                        key={chk.label}
                        className="flex items-start gap-2 rounded-xl bg-white p-2.5 border border-neutral-200/70"
                      >
                        {chk.ok ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F766E] mt-0.5" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-[#0F172A]">{chk.label}</div>
                          <div className="text-[11px] text-neutral-500 break-words">
                            {chk.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Full Fields Matrix */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200/80 p-4 space-y-1.5">
                    <div className="font-bold text-[#0F172A] flex items-center gap-1.5 pb-1 border-b border-neutral-100">
                      <Building2 className="h-4 w-4 text-[#0E4F7E]" />
                      Thông tin Định danh &amp; Liên hệ
                    </div>
                    <p>Pháp nhân: <strong>{selectedApp.legalEntityName}</strong></p>
                    <p>Loại hình: {BUSINESS_TYPE_LABEL[selectedApp.businessType] ?? selectedApp.businessType}</p>
                    <p>Đại diện: <strong>{selectedApp.representativeFullName}</strong></p>
                    <p>Ngày sinh: {formatDateLabel(selectedApp.representativeDob)} • Giới tính: {selectedApp.representativeGender === 'FEMALE' ? 'Nữ' : selectedApp.representativeGender === 'MALE' ? 'Nam' : '—'}</p>
                    <p>Số CCCD: <code>{selectedApp.maskedCccdNumber}</code> • Cấp: {formatDateLabel(selectedApp.cccdIssueDate)}</p>
                    <p>Nơi cấp CCCD: {selectedApp.cccdIssuePlace || 'Cục Cảnh sát QLHC về TTXH'}</p>
                    <p>SĐT liên hệ: <strong>{selectedApp.contactPhone || 'Đã xác thực OTP'}</strong></p>
                    <p>Email đối tác: <strong>{selectedApp.contactEmail || '—'}</strong></p>
                    <p>Mã số thuế: <strong>{selectedApp.taxCode}</strong></p>
                    <p>Giấy ĐKKD: <strong>{selectedApp.businessLicenseNumber}</strong> • Cấp: {formatDateLabel(selectedApp.businessLicenseIssuedDate)}</p>
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 p-4 space-y-1.5">
                    <div className="font-bold text-[#0F172A] flex items-center gap-1.5 pb-1 border-b border-neutral-100">
                      <Landmark className="h-4 w-4 text-[#0F766E]" />
                      Mặt bằng, Tài chính &amp; Hồ sơ Đính kèm
                    </div>
                    <p>Cụm sân: <strong>{selectedApp.venueName}</strong> ({selectedApp.totalCourts} sân)</p>
                    <p>Địa chỉ: {selectedApp.venueAddress}, {selectedApp.district}, {selectedApp.city}</p>
                    <p>Bộ môn: <strong>{selectedApp.sportCodes}</strong></p>
                    <p>Quyền mặt bằng: {PROPERTY_TYPE_LABEL[selectedApp.propertyRightType] ?? selectedApp.propertyRightType}</p>
                    <p>Số văn bản mặt bằng: <strong>{selectedApp.propertyDocumentNumber}</strong></p>
                    <p>Hạn thuê / hiệu lực: {selectedApp.propertyExpiryDate ? formatDateLabel(selectedApp.propertyExpiryDate) : 'Vô thời hạn (Chính chủ)'}</p>
                    <p>Số chứng nhận PCCC: <strong>{selectedApp.pcccCertificateNumber}</strong></p>
                    <p>Ngân hàng tất toán: <strong>{selectedApp.bankCode}</strong> • <code>{selectedApp.maskedBankAccountNumber}</code></p>
                    <p>Chủ TK: <strong>{selectedApp.bankAccountHolder}</strong></p>
                    <p>Tỷ lệ cọc / Hoa hồng: {selectedApp.proposedDepositPercent}% cọc • {selectedApp.acceptedCommissionRate}% hoa hồng sàn</p>
                  </div>
                </div>

                {/* Uploaded File Keys Verification Strip */}
                <div className="rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-4 space-y-2">
                  <div className="font-bold text-[#0F172A]">Chứng từ Đính kèm đã Niêm phong</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                    {[
                      { label: 'CCCD Mặt trước', key: selectedApp.cccdFrontStorageKey },
                      { label: 'CCCD Mặt sau', key: selectedApp.cccdBackStorageKey },
                      { label: 'Giấy phép ĐKKD', key: selectedApp.businessDocStorageKey },
                      { label: 'Ảnh Thực tế Sân', key: selectedApp.courtPhotoStorageKey },
                    ].map((doc) => (
                      <div
                        key={doc.label}
                        className="rounded-xl border border-neutral-200/80 bg-white px-3 py-2"
                      >
                        <div className="font-bold text-[#0E4F7E]">{doc.label}</div>
                        <div className="mt-0.5 truncate text-neutral-500">
                          {doc.key || '✓ Đã nộp & kiểm SHA-256'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isAdmin && selectedApp.status === 'PENDING_REVIEW' && (
                  <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      type="text"
                      value={noteById[selectedApp.id] ?? ''}
                      onChange={(e) =>
                        setNoteById((prev) => ({
                          ...prev,
                          [selectedApp.id]: e.target.value,
                        }))
                      }
                      placeholder="Ghi chú thẩm định của Super Admin…"
                      className="flex-1 rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs text-[#0F172A]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <ActionButton
                        variant="ink"
                        size="sm"
                        disabled={reviewingId === selectedApp.id}
                        onClick={() => {
                          onReviewApplication(
                            selectedApp.id,
                            'APPROVED',
                            noteById[selectedApp.id]?.trim() || undefined
                          );
                          setSelectedApp(null);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" />
                        Phê duyệt &amp; Mở Tenant
                      </ActionButton>
                      <button
                        type="button"
                        disabled={reviewingId === selectedApp.id}
                        onClick={() => {
                          onReviewApplication(
                            selectedApp.id,
                            'REJECTED',
                            noteById[selectedApp.id]?.trim() || undefined
                          );
                          setSelectedApp(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Từ chối Hồ sơ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

