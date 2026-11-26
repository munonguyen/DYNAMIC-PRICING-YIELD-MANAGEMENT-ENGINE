import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type {
  LessorApplicationPayload,
  LessorApplicationReceipt,
  LessorBusinessType,
  OtpChallengeResult,
  PropertyRightType,
  SportTypeItem,
} from '../types/marketplace';
import { marketplaceApi } from '../api/marketplaceApi';
import { validateLessorStep } from '../utils/lessorLegalValidator';
import { ActionButton, PillSelect } from './FairwayControls';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';

interface LessorOnboardingSectionProps {
  sports: SportTypeItem[];
  onNavigateInternalLogin: () => void;
}

const DEFAULT_PAYLOAD: LessorApplicationPayload = {
  otpVerificationToken: '',
  businessType: 'HOUSEHOLD_BUSINESS',
  legalEntityName: '',
  representativeFullName: '',
  representativeDob: '',
  representativeGender: 'MALE',
  cccdNumber: '',
  cccdIssueDate: '',
  cccdIssuePlace: 'Cục Cảnh sát QLHC về TTXH',
  contactPhone: '',
  contactEmail: '',
  taxCode: '',
  businessLicenseNumber: '',
  businessLicenseIssuedDate: '',
  venueName: '',
  venueAddress: '',
  city: 'Hà Nội',
  district: '',
  sportCodes: ['PICKLEBALL'],
  totalCourts: 4,
  propertyRightType: 'LEASE_WITH_SUBLEASE',
  propertyDocumentNumber: '',
  propertyExpiryDate: '',
  pcccCertificateNumber: '',
  fireSafetyConfirmed: false,
  sportSafetyConfirmed: false,
  bankCode: 'VCB',
  bankAccountNumber: '',
  bankAccountHolder: '',
  proposedDepositPercent: 35,
  acceptedCommissionRate: 10,
  legalCommitmentsAccepted: false,
};

const BANK_OPTIONS = [
  { value: 'VCB', label: 'Vietcombank (VCB)' },
  { value: 'TCB', label: 'Techcombank (TCB)' },
  { value: 'MB', label: 'MB Bank' },
  { value: 'BIDV', label: 'BIDV' },
  { value: 'CTG', label: 'VietinBank (CTG)' },
  { value: 'ACB', label: 'ACB' },
  { value: 'VPB', label: 'VPBank' },
];

export const LessorOnboardingSection: React.FC<LessorOnboardingSectionProps> = ({
  sports,
  onNavigateInternalLogin,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<LessorApplicationPayload>(DEFAULT_PAYLOAD);

  // OTP ownership verification state
  const [otpChallenge, setOtpChallenge] = useState<OtpChallengeResult | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // 4 distinct eKYC documents (hash-deduplicated on backend)
  const [cccdFront, setCccdFront] = useState<File | null>(null);
  const [cccdBack, setCccdBack] = useState<File | null>(null);
  const [businessDoc, setBusinessDoc] = useState<File | null>(null);
  const [courtPhoto, setCourtPhoto] = useState<File | null>(null);

  const [commitments, setCommitments] = useState<boolean[]>([false, false, false, false, false]);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    receipt: LessorApplicationReceipt;
    live: boolean;
  } | null>(null);

  const updateField = <K extends keyof LessorApplicationPayload>(
    key: K,
    value: LessorApplicationPayload[K]
  ) => {
    setStepError(null);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'contactPhone' || key === 'contactEmail') {
        next.otpVerificationToken = '';
      }
      return next;
    });
    if (key === 'contactPhone' || key === 'contactEmail') {
      setOtpChallenge(null);
      setOtpInput('');
      setOtpMessage(null);
    }
  };

  const toggleSport = (code: string) => {
    setStepError(null);
    setForm((prev) => {
      const exists = prev.sportCodes.includes(code);
      const next = exists ? prev.sportCodes.filter((c) => c !== code) : [...prev.sportCodes, code];
      return { ...prev, sportCodes: next };
    });
  };

  const handleToggleCommitment = (idx: number) => {
    setStepError(null);
    const next = commitments.map((v, i) => (i === idx ? !v : v));
    setCommitments(next);
    setForm((prev) => ({ ...prev, legalCommitmentsAccepted: next.every(Boolean) }));
  };

  const handleRequestOtp = async () => {
    if (!form.contactPhone.trim() || !form.contactEmail.trim()) {
      setStepError('Vui lòng nhập SĐT di động và Email liên hệ trước khi lấy mã xác thực OTP.');
      return;
    }
    setOtpBusy(true);
    setStepError(null);
    setOtpMessage(null);
    try {
      const challenge = await marketplaceApi.requestLessorOtp(
        form.contactPhone.trim(),
        form.contactEmail.trim()
      );
      setOtpChallenge(challenge);
      setOtpMessage(
        challenge.sandboxOtpHint
          ? `Đã gửi mã xác thực tới ${challenge.maskedTarget} (Mã xác thực nhanh: ${challenge.sandboxOtpHint})`
          : `Đã gửi mã xác thực 6 chữ số tới ${challenge.maskedTarget} (hiệu lực 5 phút).`
      );
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Không thể tạo phiên xác thực OTP.');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpChallenge || otpInput.trim().length !== 6) {
      setStepError('Vui lòng nhập đủ 6 chữ số OTP.');
      return;
    }
    setOtpBusy(true);
    setStepError(null);
    try {
      const res = await marketplaceApi.verifyLessorOtp(otpChallenge.challengeId, otpInput.trim());
      if (res.verified) {
        updateField('otpVerificationToken', res.verificationToken);
        setOtpMessage('✓ Đã xác thực thành công SĐT & Email chính chủ.');
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Mã OTP chưa chính xác.');
    } finally {
      setOtpBusy(false);
    }
  };

  const goToStep = (target: 2 | 3) => {
    if (target === 2) {
      const check1 = validateLessorStep(1, form);
      if (!check1.valid) {
        setStepError(check1.error);
        return;
      }
      if (!cccdFront || !cccdBack) {
        setStepError('Vui lòng tải lên đầy đủ ảnh CCCD mặt trước và mặt sau.');
        return;
      }
    }
    if (target === 3) {
      const check2 = validateLessorStep(2, form);
      if (!check2.valid) {
        setStepError(check2.error);
        return;
      }
      if (!businessDoc || !courtPhoto) {
        setStepError('Vui lòng đính kèm bản chụp Giấy ĐKKD/Hợp đồng mặt bằng và ảnh chụp thực tế cụm sân.');
        return;
      }
    }
    setStepError(null);
    setStep(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check3 = validateLessorStep(3, form);
    if (!check3.valid) {
      setStepError(check3.error);
      return;
    }
    if (!cccdFront || !cccdBack || !businessDoc || !courtPhoto) {
      setStepError('Thiếu tài liệu đính kèm eKYC bắt buộc.');
      return;
    }
    setStepError(null);
    setSubmitting(true);
    try {
      const res = await marketplaceApi.submitLessorApplication(form, {
        cccdFront,
        cccdBack,
        businessDoc,
        courtPhoto,
      });
      setSubmittedReceipt(res);
    } catch (err) {
      setStepError(
        err instanceof Error ? err.message : 'Hồ sơ chưa hợp lệ hoặc chưa thể gửi lúc này.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="command-center" className="bg-[#F6F8F6] py-12 sm:py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 space-y-8">
        <ScrollReveal className="flex flex-col gap-5 border-b border-neutral-200/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
              Cổng Đăng Ký Đối Tác Cho Thuê Sân • Sàn Trung Gian ArenaPulse
            </div>
            <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
              Đăng ký mở gian hàng cụm sân tại cơ sở của bạn
            </h2>
            <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed">
              Hoàn tất hồ sơ pháp nhân, xác thực định danh chủ cơ sở qua OTP &amp; giấy tờ gốc để đội ngũ kiểm duyệt nội bộ kích hoạt nhận lịch đặt sân và đối soát thanh toán tự động.
            </p>
          </div>

          <div className="shrink-0 rounded-2xl border border-[#16422C]/20 bg-white px-4 py-3 text-xs">
            <div className="font-semibold text-[#16422C]">Tiến độ hồ sơ hiện tại</div>
            <div className="mt-0.5 tabular-nums font-bold text-[#0F172A]">Bước {step} / 3</div>
          </div>
        </ScrollReveal>

        {submittedReceipt ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EXPO_EASE }}
            className="rounded-[28px] border border-[#16422C]/25 bg-white p-7 sm:p-10 shadow-xs space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-[#E7F7D4] px-3.5 py-1 text-xs font-bold text-[#204E18]">
                ĐÃ TIẾP NHẬN HỒ SƠ • CHỜ THẨM ĐỊNH NỘI BỘ
              </span>
              <span className="tabular-nums text-xs font-semibold text-[#0E4F7E]">
                Mã tiếp nhận: {submittedReceipt.receipt.referenceCode}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-semibold text-[#0F172A]">
                Cảm ơn đối tác đã đăng ký cơ sở “{submittedReceipt.receipt.venueName}”
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Hồ sơ pháp lý và tệp chứng từ đã được mã hóa lưu trữ. Bộ phận kiểm duyệt nội bộ sẽ đối chiếu giấy tờ thực tế và phản hồi kết quả kích hoạt tài khoản Quản lý cụm sân qua Email/SĐT trong vòng 24 giờ làm việc.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                variant="outline"
                size="md"
                onClick={() => {
                  setSubmittedReceipt(null);
                  setForm(DEFAULT_PAYLOAD);
                  setCccdFront(null);
                  setCccdBack(null);
                  setBusinessDoc(null);
                  setCourtPhoto(null);
                  setCommitments([false, false, false, false, false]);
                  setOtpChallenge(null);
                  setOtpInput('');
                  setOtpMessage(null);
                  setStep(1);
                }}
              >
                Đăng ký thêm cơ sở khác
              </ActionButton>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
            {/* LEFT 8 COLS: CLEAN PARTNER REGISTRATION FORM */}
            <form
              onSubmit={handleSubmit}
              className="rounded-[28px] border border-neutral-200/90 bg-white p-5 sm:p-8 shadow-xs lg:col-span-8 space-y-6"
            >
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F3F4F6] p-1.5 text-xs">
                {[
                  { num: 1 as const, label: '1. Chủ thể & Định danh' },
                  { num: 2 as const, label: '2. Thuế & Cơ sở sân' },
                  { num: 3 as const, label: '3. Tài khoản & Xác nhận' },
                ].map((s) => {
                  const active = step === s.num;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (s.num < step) {
                          setStepError(null);
                          setStep(s.num);
                        }
                      }}
                      className={`rounded-xl px-3 py-2 text-center font-semibold transition-all ${
                        active
                          ? 'bg-[#16422C] text-white shadow-xs'
                          : s.num < step
                            ? 'text-[#16422C] hover:bg-white/70'
                            : 'text-neutral-400 cursor-default'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[#0F172A]">
                      Thông tin Chủ thể &amp; Người đại diện
                    </h3>
                    <PillSelect
                      prefix="Loại hình:"
                      ariaLabel="Chọn loại hình chủ thể kinh doanh"
                      value={form.businessType}
                      onChange={(v) => updateField('businessType', v as LessorBusinessType)}
                      options={[
                        { value: 'HOUSEHOLD_BUSINESS', label: 'Hộ kinh doanh cá thể' },
                        { value: 'ENTERPRISE', label: 'Doanh nghiệp / Công ty' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Tên Doanh nghiệp / Hộ kinh doanh *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Công ty TNHH Thể Thao Bách Khoa"
                        value={form.legalEntityName}
                        onChange={(e) => updateField('legalEntityName', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Họ tên Người đại diện hợp pháp *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nguyễn Văn Minh"
                        value={form.representativeFullName}
                        onChange={(e) => updateField('representativeFullName', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Ngày sinh *
                      </label>
                      <input
                        type="date"
                        required
                        value={form.representativeDob}
                        onChange={(e) => updateField('representativeDob', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Giới tính *
                      </label>
                      <div className="pt-1">
                        <PillSelect
                          prefix="Giới tính:"
                          ariaLabel="Giới tính"
                          value={form.representativeGender}
                          onChange={(v) => updateField('representativeGender', v as 'MALE' | 'FEMALE')}
                          options={[
                            { value: 'MALE', label: 'Nam' },
                            { value: 'FEMALE', label: 'Nữ' },
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số CCCD gắn chip (12 chữ số) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={12}
                        placeholder="Nhập chính xác 12 số CCCD"
                        value={form.cccdNumber}
                        onChange={(e) => updateField('cccdNumber', e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Ngày cấp CCCD *
                      </label>
                      <input
                        type="date"
                        required
                        value={form.cccdIssueDate}
                        onChange={(e) => updateField('cccdIssueDate', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-neutral-300 bg-[#F8F9FA] p-3 text-xs hover:border-[#16422C]">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setStepError(null);
                          setCccdFront(e.target.files?.[0] ?? null);
                        }}
                        className="sr-only"
                      />
                      <span className="font-semibold text-[#16422C]">Ảnh CCCD mặt trước (chụp rõ nét) *</span>
                      <span className="mt-1 truncate text-neutral-500">
                        {cccdFront ? `Đã chọn: ${cccdFront.name}` : 'Tải lên ảnh JPG, PNG hoặc WebP…'}
                      </span>
                    </label>

                    <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-neutral-300 bg-[#F8F9FA] p-3 text-xs hover:border-[#16422C]">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setStepError(null);
                          setCccdBack(e.target.files?.[0] ?? null);
                        }}
                        className="sr-only"
                      />
                      <span className="font-semibold text-[#16422C]">Ảnh CCCD mặt sau (chụp rõ mã QR) *</span>
                      <span className="mt-1 truncate text-neutral-500">
                        {cccdBack ? `Đã chọn: ${cccdBack.name}` : 'Tải lên ảnh JPG, PNG hoặc WebP…'}
                      </span>
                    </label>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số điện thoại liên hệ chính chủ *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="09xxxxxxxx"
                        value={form.contactPhone}
                        onChange={(e) => updateField('contactPhone', e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Email nhận thông báo &amp; đối soát *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="partner@company.vn"
                        value={form.contactEmail}
                        onChange={(e) => updateField('contactEmail', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                  </div>

                  {/* OTP Ownership Verification Box */}
                  <div className="rounded-2xl border border-[#0E4F7E]/25 bg-[#F4F8FB] p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#0E4F7E]">
                        Xác thực SĐT &amp; Email chính chủ (Bắt buộc)
                      </span>
                      <ActionButton
                        variant="outline"
                        size="sm"
                        disabled={otpBusy || Boolean(form.otpVerificationToken)}
                        onClick={handleRequestOtp}
                      >
                        {form.otpVerificationToken
                          ? 'Đã xác thực OTP ✓'
                          : otpChallenge
                            ? 'Gửi lại mã OTP'
                            : 'Gửi mã OTP'}
                      </ActionButton>
                    </div>

                    {otpChallenge && !form.otpVerificationToken && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Nhập 6 số OTP…"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          className="w-44 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 tabular-nums text-xs text-[#0F172A]"
                        />
                        <ActionButton variant="ink" size="sm" disabled={otpBusy} onClick={handleVerifyOtp}>
                          Xác nhận mã OTP
                        </ActionButton>
                      </div>
                    )}

                    {otpMessage && <div className="font-medium text-[#16422C]">{otpMessage}</div>}
                  </div>

                  {stepError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                      {stepError}
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-neutral-100">
                    <ActionButton variant="forest" size="md" arrow="right" onClick={() => goToStep(2)}>
                      Tiếp tục Bước 2
                    </ActionButton>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#0F172A]">
                    Hồ sơ Thuế, Mặt bằng Sân &amp; An toàn PCCC
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Mã số thuế (10 số hoặc mã chi nhánh) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        placeholder="Nhập chính xác Mã số thuế"
                        value={form.taxCode}
                        onChange={(e) => updateField('taxCode', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số Giấy chứng nhận ĐKKD / Hộ KD *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Theo bản gốc ĐKKD"
                        value={form.businessLicenseNumber}
                        onChange={(e) => updateField('businessLicenseNumber', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Ngày cấp Giấy ĐKKD *
                      </label>
                      <input
                        type="date"
                        required
                        value={form.businessLicenseIssuedDate}
                        onChange={(e) => updateField('businessLicenseIssuedDate', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Tên Cụm sân kinh doanh *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Tổ Hợp Pickleball Cầu Giấy"
                        value={form.venueName}
                        onChange={(e) => updateField('venueName', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Địa chỉ thực tế cơ sở sân *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Số nhà, đường, phường/xã…"
                        value={form.venueAddress}
                        onChange={(e) => updateField('venueAddress', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">Tỉnh / Thành phố *</label>
                      <input
                        type="text"
                        required
                        value={form.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">Quận / Huyện *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Cầu Giấy / Quận 7"
                        value={form.district}
                        onChange={(e) => updateField('district', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="mb-1.5 text-xs font-medium text-neutral-700">
                        Lĩnh vực sân cho thuê *
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sports.map((sp) => {
                          const picked = form.sportCodes.includes(sp.code);
                          return (
                            <button
                              key={sp.code}
                              type="button"
                              onClick={() => toggleSport(sp.code)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                picked
                                  ? 'bg-[#16422C] text-white'
                                  : 'border border-neutral-200 bg-[#F8F9FA] text-neutral-700'
                              }`}
                            >
                              {sp.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Hồ sơ mặt bằng sân *
                      </label>
                      <PillSelect
                        prefix="Loại:"
                        ariaLabel="Loại hồ sơ mặt bằng"
                        value={form.propertyRightType}
                        onChange={(v) => updateField('propertyRightType', v as PropertyRightType)}
                        options={[
                          { value: 'LEASE_WITH_SUBLEASE', label: 'Hợp đồng thuê mặt bằng' },
                          { value: 'OWNERSHIP_CERT', label: 'Giấy CN Quyền sử dụng đất' },
                          { value: 'PPP_CONCESSION', label: 'Hợp đồng hợp tác khai thác' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số Hợp đồng mặt bằng / Số GCN *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập số hợp đồng hoặc mã sổ"
                        value={form.propertyDocumentNumber}
                        onChange={(e) => updateField('propertyDocumentNumber', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Ngày hết hạn quyền sử dụng đất/thuê *
                      </label>
                      <input
                        type="date"
                        required={form.propertyRightType !== 'OWNERSHIP_CERT'}
                        value={form.propertyExpiryDate}
                        onChange={(e) => updateField('propertyExpiryDate', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số biên bản nghiệm thu / hồ sơ PCCC *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập mã hồ sơ PCCC tại cơ sở"
                        value={form.pcccCertificateNumber}
                        onChange={(e) => updateField('pcccCertificateNumber', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A]"
                      />
                    </div>

                    <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-neutral-300 bg-[#F8F9FA] p-3 text-xs hover:border-[#16422C]">
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setStepError(null);
                          setBusinessDoc(e.target.files?.[0] ?? null);
                        }}
                        className="sr-only"
                      />
                      <span className="font-semibold text-[#16422C]">Bản chụp ĐKKD / Hợp đồng mặt bằng *</span>
                      <span className="mt-1 truncate text-neutral-500">
                        {businessDoc ? `Đã chọn: ${businessDoc.name}` : 'Tải lên PDF, JPG, PNG hoặc WebP…'}
                      </span>
                    </label>

                    <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-neutral-300 bg-[#F8F9FA] p-3 text-xs hover:border-[#16422C]">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setStepError(null);
                          setCourtPhoto(e.target.files?.[0] ?? null);
                        }}
                        className="sr-only"
                      />
                      <span className="font-semibold text-[#16422C]">Ảnh chụp toàn cảnh sân thực tế *</span>
                      <span className="mt-1 truncate text-neutral-500">
                        {courtPhoto ? `Đã chọn: ${courtPhoto.name}` : 'Tải lên ảnh chụp thực tế tại sân…'}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-[#F8F9FA] p-3.5 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.fireSafetyConfirmed}
                        onChange={(e) => updateField('fireSafetyConfirmed', e.target.checked)}
                        className="mt-0.5 accent-[#16422C]"
                      />
                      <span>
                        Cơ sở trang bị đầy đủ phương tiện PCCC và lối thoát hiểm an toàn.
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.sportSafetyConfirmed}
                        onChange={(e) => updateField('sportSafetyConfirmed', e.target.checked)}
                        className="mt-0.5 accent-[#16422C]"
                      />
                      <span>
                        Mặt sân, ánh sáng và thiết bị tập luyện đạt điều kiện an toàn cho người chơi.
                      </span>
                    </label>
                  </div>

                  {stepError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                      {stepError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                    <ActionButton variant="outline" size="md" arrow="back" onClick={() => setStep(1)}>
                      Quay lại Bước 1
                    </ActionButton>
                    <ActionButton variant="forest" size="md" arrow="right" onClick={() => goToStep(3)}>
                      Tiếp tục Bước 3
                    </ActionButton>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#0F172A]">
                    Tài khoản Nhận Thanh Toán &amp; Cam kết Hợp tác
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">Ngân hàng thụ hưởng *</label>
                      <PillSelect
                        prefix="Ngân hàng:"
                        ariaLabel="Chọn ngân hàng"
                        value={form.bankCode}
                        onChange={(v) => updateField('bankCode', v)}
                        options={BANK_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Số tài khoản nhận giải ngân *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="Nhập số tài khoản ngân hàng"
                        value={form.bankAccountNumber}
                        onChange={(e) => updateField('bankAccountNumber', e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 tabular-nums text-sm text-[#0F172A]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-700">
                        Tên chủ tài khoản ngân hàng *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Trùng khớp tên pháp nhân hoặc người đại diện"
                        value={form.bankAccountHolder}
                        onChange={(e) => updateField('bankAccountHolder', e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm uppercase text-[#0F172A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4 text-xs">
                    <div className="font-semibold text-[#16422C]">
                      Cam kết trách nhiệm đối tác cho thuê sân:
                    </div>
                    {[
                      'Cam kết toàn bộ thông tin định danh và chứng từ cung cấp là xác thực, chịu trách nhiệm trước pháp luật.',
                      'Đồng ý để ArenaPulse giữ hộ tiền cọc ký quỹ và hoàn trả 100% cho người chơi nếu sân hủy lịch hoặc không đạt chuẩn.',
                      'Đồng ý mức chiết khấu hoa hồng sàn 10% trên tiền cọc thu hộ và nghĩa vụ kê khai thuế theo quy định.',
                      'Duy trì đầy đủ điều kiện an toàn sân bãi, ánh sáng và phòng cháy chữa cháy trong suốt quá trình mở bán.',
                      'Chấp thuận quy trình kiểm duyệt hồ sơ và xác minh thực địa trước khi gian hàng được kích hoạt.',
                    ].map((text, idx) => (
                      <label key={idx} className="flex items-start gap-2.5 cursor-pointer text-[#0F172A]">
                        <input
                          type="checkbox"
                          checked={commitments[idx]}
                          onChange={() => handleToggleCommitment(idx)}
                          className="mt-0.5 accent-[#16422C]"
                        />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>

                  {stepError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                      {stepError}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
                    <ActionButton variant="outline" size="md" arrow="back" onClick={() => setStep(2)}>
                      Quay lại Bước 2
                    </ActionButton>
                    <ActionButton type="submit" variant="forest" size="lg" arrow="right" disabled={submitting}>
                      {submitting ? 'Đang gửi hồ sơ xác thực…' : 'Nộp hồ sơ Đăng ký Đối tác'}
                    </ActionButton>
                  </div>
                </div>
              )}
            </form>

            {/* RIGHT 4 COLS: CLEAN PARTNER PREPARATION GUIDE (NO VALIDATION RULE LEAKS) */}
            <aside className="rounded-[28px] border border-neutral-200/90 bg-white p-6 shadow-xs lg:col-span-4 space-y-5 h-fit">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0E4F7E]">
                  Hướng dẫn hồ sơ
                </span>
                <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
                  Hồ sơ đối tác cần chuẩn bị
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                  Để quá trình kiểm duyệt diễn ra nhanh chóng trong 24 giờ, vui lòng chuẩn bị sẵn ảnh chụp rõ nét các chứng từ gốc dưới đây:
                </p>
              </div>

              <ul className="space-y-3 text-xs text-neutral-700">
                {[
                  {
                    title: '1. Giấy tờ định danh chính chủ',
                    desc: 'Ảnh chụp CCCD gắn chip 2 mặt của người đại diện và SĐT/Email xác thực OTP.',
                  },
                  {
                    title: '2. Giấy phép ĐKKD & Quyền mặt bằng',
                    desc: 'Bản chụp Giấy đăng ký doanh nghiệp/Hộ kinh doanh kèm Sổ đỏ hoặc Hợp đồng thuê mặt bằng còn hạn.',
                  },
                  {
                    title: '3. Hình ảnh sân thực tế & PCCC',
                    desc: 'Ảnh chụp trực tiếp bề mặt sân tại cơ sở cùng mã biên bản nghiệm thu an toàn PCCC.',
                  },
                  {
                    title: '4. Tài khoản ngân hàng thụ hưởng',
                    desc: 'Tài khoản đứng tên doanh nghiệp hoặc người đại diện hợp pháp để đối soát ký quỹ.',
                  },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border border-neutral-200/70 bg-[#F8F9FA] p-3.5"
                  >
                    <div className="font-semibold text-[#0F172A]">{item.title}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}

        {/* Internal Portal Entry Footer */}
        <ScrollReveal className="flex flex-col justify-between gap-3 rounded-2xl border border-neutral-200/90 bg-white px-5 py-4 sm:flex-row sm:items-center text-xs">
          <div className="text-neutral-600">
            <strong className="text-[#0F172A]">Cổng Quản trị &amp; Đối soát Nội bộ</strong> chỉ dành cho
            Quản trị viên, Kế toán sàn, Chủ sân đã phê duyệt và Nhân viên vận hành sau khi đăng nhập.
          </div>
          <ActionButton variant="ink" size="sm" arrow="up-right" onClick={onNavigateInternalLogin} className="shrink-0">
            Đăng nhập Hệ thống Nội bộ
          </ActionButton>
        </ScrollReveal>
      </div>
    </section>
  );
};
