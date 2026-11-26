import type { LessorApplicationPayload } from '../types/marketplace';

/** Internal Vietnam CCCD 63 province code map used quietly for strict anti-fraud checking. */
const CCCD_PROVINCE_CODES: Record<string, string> = {
  '001': 'Hà Nội', '002': 'Hà Giang', '004': 'Cao Bằng', '006': 'Bắc Kạn', '008': 'Tuyên Quang',
  '010': 'Lào Cai', '011': 'Điện Biên', '012': 'Lai Châu', '014': 'Sơn La', '015': 'Yên Bái',
  '017': 'Hòa Bình', '019': 'Thái Nguyên', '020': 'Lạng Sơn', '022': 'Quảng Ninh', '024': 'Bắc Giang',
  '025': 'Phú Thọ', '026': 'Vĩnh Phúc', '027': 'Bắc Ninh', '030': 'Hải Dương', '031': 'Hải Phòng',
  '033': 'Hưng Yên', '034': 'Thái Bình', '035': 'Hà Nam', '036': 'Nam Định', '037': 'Ninh Bình',
  '038': 'Thanh Hóa', '040': 'Nghệ An', '042': 'Hà Tĩnh', '044': 'Quảng Bình', '045': 'Quảng Trị',
  '046': 'Thừa Thiên Huế', '048': 'Đà Nẵng', '049': 'Quảng Nam', '051': 'Quảng Ngãi', '052': 'Bình Định',
  '054': 'Phú Yên', '056': 'Khánh Hòa', '058': 'Ninh Thuận', '060': 'Bình Thuận', '062': 'Kon Tum',
  '064': 'Gia Lai', '066': 'Đắk Lắk', '067': 'Đắk Nông', '068': 'Lâm Đồng', '070': 'Bình Phước',
  '072': 'Tây Ninh', '074': 'Bình Dương', '075': 'Đồng Nai', '077': 'Bà Rịa - Vũng Tàu',
  '079': 'TP. Hồ Chí Minh', '080': 'Long An', '082': 'Tiền Giang', '083': 'Bến Tre', '084': 'Trà Vinh',
  '086': 'Vĩnh Long', '087': 'Đồng Tháp', '089': 'An Giang', '091': 'Kiên Giang', '092': 'Cần Thơ',
  '093': 'Hậu Giang', '094': 'Sóc Trăng', '095': 'Bạc Liêu', '096': 'Cà Mau',
};

const MST_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];
const VN_PHONE_REGEX = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;

export function normalizeVietnameseName(input: string): string {
  return input
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidVietnamTaxCode(rawTaxCode: string): boolean {
  const trimmed = rawTaxCode.trim();
  if (!/^\d{10}(-\d{3})?$/.test(trimmed)) return false;
  if (trimmed.length === 14 && Number(trimmed.slice(11)) < 1) return false;
  const base10 = trimmed.slice(0, 10);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(base10[i]) * MST_WEIGHTS[i];
  }
  const remainder = sum % 11;
  if (remainder === 0) return false;
  return Number(base10[9]) === 10 - remainder;
}

function calcAgeYears(dateStr: string, ref: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = ref.getFullYear() - d.getFullYear();
  const mDiff = ref.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < d.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Validates step fields internally and returns concise user-facing messages
 * WITHOUT revealing algorithmic checksums or anti-fraud thresholds.
 */
export function validateLessorStep(
  step: 1 | 2 | 3,
  payload: LessorApplicationPayload,
  now = new Date()
): { valid: boolean; error: string | null } {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (step === 1) {
    if (payload.legalEntityName.trim().length < 3 || payload.representativeFullName.trim().length < 3) {
      return { valid: false, error: 'Vui lòng nhập đầy đủ tên đơn vị kinh doanh và họ tên người đại diện.' };
    }
    const entityNorm = normalizeVietnameseName(payload.legalEntityName);
    if (
      payload.businessType === 'HOUSEHOLD_BUSINESS' &&
      (entityNorm.includes('TAP DOAN') || entityNorm.includes('CO PHAN') || entityNorm.includes('TNHH'))
    ) {
      return { valid: false, error: 'Tên đơn vị chưa khớp với loại hình Hộ kinh doanh đã chọn.' };
    }
    const age = calcAgeYears(payload.representativeDob, todayMidnight);
    if (age === null || age < 18 || age > 95) {
      return { valid: false, error: 'Ngày sinh người đại diện chưa hợp lệ hoặc chưa đủ độ tuổi quy định.' };
    }
    const cccd = payload.cccdNumber.trim();
    const dob = new Date(`${payload.representativeDob}T00:00:00`);
    const issue = payload.cccdIssueDate ? new Date(`${payload.cccdIssueDate}T00:00:00`) : null;
    const provinceOk = Boolean(CCCD_PROVINCE_CODES[cccd.slice(0, 3)]);
    const birthYear = dob.getFullYear();
    const genderDigit =
      birthYear >= 2000
        ? payload.representativeGender === 'MALE'
          ? '2'
          : '3'
        : payload.representativeGender === 'MALE'
          ? '0'
          : '1';
    const cccdMatch =
      /^\d{12}$/.test(cccd) &&
      provinceOk &&
      cccd[3] === genderDigit &&
      cccd.slice(4, 6) === String(birthYear % 100).padStart(2, '0');
    const issueOk =
      issue !== null &&
      !Number.isNaN(issue.getTime()) &&
      issue <= todayMidnight &&
      issue.getFullYear() - birthYear >= 14;
    if (!cccdMatch || !issueOk) {
      return {
        valid: false,
        error: 'Thông tin số CCCD, ngày sinh, giới tính hoặc ngày cấp không trùng khớp.',
      };
    }
    if (!VN_PHONE_REGEX.test(payload.contactPhone.trim())) {
      return { valid: false, error: 'Số điện thoại liên hệ chưa đúng định dạng di động Việt Nam.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail.trim())) {
      return { valid: false, error: 'Địa chỉ email liên hệ chưa hợp lệ.' };
    }
    if (!payload.otpVerificationToken) {
      return { valid: false, error: 'Vui lòng hoàn tất xác thực mã OTP qua SĐT / Email trước khi tiếp tục.' };
    }
    return { valid: true, error: null };
  }

  if (step === 2) {
    if (!isValidVietnamTaxCode(payload.taxCode)) {
      return { valid: false, error: 'Mã số thuế chưa hợp lệ theo giấy chứng nhận đăng ký thuế.' };
    }
    const licDate = payload.businessLicenseIssuedDate
      ? new Date(`${payload.businessLicenseIssuedDate}T00:00:00`)
      : null;
    if (
      payload.businessLicenseNumber.trim().length < 5 ||
      !licDate ||
      Number.isNaN(licDate.getTime()) ||
      licDate > todayMidnight ||
      licDate.getFullYear() < 1990
    ) {
      return { valid: false, error: 'Số giấy phép kinh doanh hoặc ngày cấp chưa hợp lệ.' };
    }
    if (
      payload.venueName.trim().length < 3 ||
      payload.venueAddress.trim().length < 8 ||
      payload.district.trim().length < 2 ||
      payload.sportCodes.length === 0
    ) {
      return { valid: false, error: 'Vui lòng điền đầy đủ thông tin địa điểm cụm sân và bộ môn hoạt động.' };
    }
    const exp = payload.propertyExpiryDate ? new Date(`${payload.propertyExpiryDate}T00:00:00`) : null;
    const minValid = new Date(todayMidnight.getTime() + 180 * 86_400_000);
    if (payload.propertyDocumentNumber.trim().length < 4) {
      return { valid: false, error: 'Vui lòng nhập số chứng từ quyền sở hữu hoặc hợp đồng thuê mặt bằng.' };
    }
    if (payload.propertyRightType !== 'OWNERSHIP_CERT' && (!exp || exp < minValid)) {
      return {
        valid: false,
        error: 'Hợp đồng mặt bằng phải còn hiệu lực tối thiểu 6 tháng để đảm bảo lịch đặt sân ổn định.',
      };
    }
    if (
      payload.pcccCertificateNumber.trim().length < 4 ||
      !payload.fireSafetyConfirmed ||
      !payload.sportSafetyConfirmed
    ) {
      return { valid: false, error: 'Vui lòng cung cấp số hồ sơ PCCC và xác nhận đủ điều kiện an toàn cơ sở.' };
    }
    return { valid: true, error: null };
  }

  const bankNorm = normalizeVietnameseName(payload.bankAccountHolder);
  const repNorm = normalizeVietnameseName(payload.representativeFullName);
  const entityNorm = normalizeVietnameseName(payload.legalEntityName);
  if (!/^\d{6,19}$/.test(payload.bankAccountNumber.trim())) {
    return { valid: false, error: 'Số tài khoản ngân hàng chưa hợp lệ.' };
  }
  const holderOk =
    bankNorm.split(' ').length >= 2 &&
    (payload.businessType === 'HOUSEHOLD_BUSINESS'
      ? bankNorm === repNorm || bankNorm === entityNorm || (repNorm.length >= 4 && bankNorm.includes(repNorm))
      : bankNorm === entityNorm ||
        bankNorm === repNorm ||
        (entityNorm.length >= 4 && bankNorm.includes(entityNorm)) ||
        (bankNorm.length >= 4 && entityNorm.includes(bankNorm)));
  if (!holderOk) {
    return {
      valid: false,
      error: 'Tên chủ tài khoản nhận giải ngân phải trùng khớp tên đơn vị kinh doanh hoặc người đại diện.',
    };
  }
  if (!payload.legalCommitmentsAccepted) {
    return { valid: false, error: 'Vui lòng xác nhận đầy đủ các cam kết hợp tác và bảo vệ tiền cọc.' };
  }
  return { valid: true, error: null };
}

export function computeInternalRiskSummary(payload: LessorApplicationPayload): {
  riskScore: number;
  flags: string;
} {
  const flags: string[] = [];
  let score = 0;
  const cityNorm = normalizeVietnameseName(payload.city);
  const taxPrefix = payload.taxCode.trim().slice(0, 2);
  if (cityNorm === 'HA NOI' && taxPrefix !== '01' && payload.taxCode.trim().length === 10) {
    score += 20;
    flags.push(`TAX_PROVINCE_PREFIX_DIFFERS(${taxPrefix} vs ${payload.city})`);
  } else if (
    (cityNorm.includes('HO CHI MINH') || cityNorm.includes('HCM')) &&
    taxPrefix !== '03' &&
    payload.taxCode.trim().length === 10
  ) {
    score += 20;
    flags.push(`TAX_PROVINCE_PREFIX_DIFFERS(${taxPrefix} vs ${payload.city})`);
  }
  const entityNorm = normalizeVietnameseName(payload.legalEntityName);
  if (
    payload.businessType === 'ENTERPRISE' &&
    !(
      entityNorm.includes('CONG TY') ||
      entityNorm.includes('TNHH') ||
      entityNorm.includes('CO PHAN') ||
      entityNorm.includes('DNTN')
    )
  ) {
    score += 25;
    flags.push('ENTERPRISE_MISSING_LEGAL_KEYWORD');
  }
  return {
    riskScore: Math.min(100, score),
    flags: flags.length > 0 ? flags.join('; ') : 'CLEAN',
  };
}
