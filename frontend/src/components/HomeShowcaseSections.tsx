import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type {
  AppPageId,
  PublishedListing,
  SportTypeItem,
  VenueLocationInfo,
  VenueProviderInfo,
} from '../types/marketplace';
import { formatSlotWindow, formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton } from './FairwayControls';

interface HomeShowcaseSectionsProps {
  sports: SportTypeItem[];
  listings?: PublishedListing[];
  locations: VenueLocationInfo[];
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
  onBrowseVenueCourts: (venueName: string) => void;
  onSelectCourt?: (listing: PublishedListing, preferredSlotStart?: string) => void;
  onOpenLessorShop?: (providerId: string) => void;
}

interface SportSpotlightItem {
  code: string;
  indexLabel: string;
  name: string;
  shortTab: string;
  tagline: string;
  standard: string;
  surface: string;
  lighting: string;
  proShopPerk: string;
  priceFrom: string;
  image: string;
  highlights: string[];
}

const SPORT_SPOTLIGHTS: SportSpotlightItem[] = [
  {
    code: 'FOOTBALL',
    indexLabel: '01',
    name: 'Bóng đá Sân cỏ 5v5 & 7v7',
    shortTab: 'Bóng đá',
    tagline:
      'Mặt cỏ nhân tạo sợi kim cương chuẩn FIFA Quality Pro, độ đàn hồi cao và hệ thống thoát nước ngầm tức thì.',
    standard: 'FIFA Quality Turf',
    surface: 'Cỏ nhân tạo 50mm + hạt cao su EPDM nguyên sinh',
    lighting: 'Đèn pha LED 450 Lux chống chói ban đêm',
    proShopPerk: 'Thùng nước ướp lạnh, áo bib khử khuẩn, trọng tài & quay Highlight AI',
    priceFrom: 'Từ 280.000₫/ca',
    image: '/images/sport-football-pitch.jpg',
    highlights: [
      'Cụm 6 sân liên hoàn tại Mỹ Đình hỗ trợ ghép sân 11v11 cho giải doanh nghiệp',
      'Hoàn tiền cọc 100% tự động nếu trời mưa bão không thể thi đấu',
      'Đặt kèm thùng nước đá & trọng tài ngay trong cùng một hóa đơn giữ sân',
    ],
  },
  {
    code: 'PICKLEBALL',
    indexLabel: '02',
    name: 'Pickleball & Padel Mái vòm',
    shortTab: 'Pickleball',
    tagline:
      'Hệ thống sân mái vòm cách nhiệt phủ Acrylic Cushion 7 lớp êm khớp, thi đấu xuyên suốt bất kể nắng mưa.',
    standard: 'USAPA Tournament Spec',
    surface: 'Acrylic Cushion 7 lớp độ nảy chuẩn giải đấu',
    lighting: 'LED trần gián tiếp không lóa mắt khi lob bóng',
    proShopPerk: 'Thuê vợt Carbon T700 / Joola Pro, bóng Franklin X-40 & HLV kèm riêng',
    priceFrom: 'Từ 120.000₫/ca',
    image: '/images/court-pickleball-padel.jpg',
    highlights: [
      '10 sân mái vòm tại Bách Khoa & cụm sân ven sông Thủ Thiêm thông thoáng',
      'Khoảng lùi cuối sân rộng 2.8m an toàn cho các pha cứu bóng tốc độ cao',
      'Giá ưu đãi tự động giảm sâu vào khung giờ sáng 07:00 – 11:00',
    ],
  },
  {
    code: 'BADMINTON',
    indexLabel: '03',
    name: 'Cầu lông Nhà thi đấu BWF',
    shortTab: 'Cầu lông',
    tagline:
      'Không gian trần cao 11m khép kín chống gió lùa hoàn toàn, trải thảm PVC Yonex giảm chấn đạt chuẩn thi đấu.',
    standard: 'BWF Grade Floor',
    surface: 'Thảm PVC 4.8mm giảm chấn bảo vệ cổ chân & đầu gối',
    lighting: 'Dải LED tuyến tính dọc hai biên không chiếu thẳng mắt',
    proShopPerk: 'Ống cầu Thành Công / Yonex AS-30, máy căng vợt điện tử lấy ngay',
    priceFrom: 'Từ 95.000₫/ca',
    image: '/images/court-badminton-arena.jpg',
    highlights: [
      'Hệ thống tường tiêu âm kết hợp thông gió đối lưu mát mẻ quanh năm',
      'Cho thuê giày cầu lông đế kếp khử khuẩn UV đủ size ngay tại sảnh',
      'Quét mã QR nhận sân tức thì, không cần chờ xác nhận thủ công',
    ],
  },
  {
    code: 'TENNIS',
    indexLabel: '04',
    name: 'Quần vợt Hardcourt Ngoài trời',
    shortTab: 'Tennis',
    tagline:
      'Cụm sân Hardcourt thoáng đãng ven Hồ Tây với mặt sơn Acrylic đa lớp và dịch vụ máy bắn bóng tự động.',
    standard: 'ITF Pace Category 3',
    surface: 'Sơn phủ Acrylic đa lớp chống trơn trượt',
    lighting: 'Trụ đèn cao áp 12m chuẩn thi đấu ban đêm',
    proShopPerk: 'Hộp bóng Wilson US Open, máy bắn bóng 60 quả & Ball Boy nhặt bóng',
    priceFrom: 'Từ 220.000₫/ca',
    image: '/images/sport-tennis-sunny.jpg',
    highlights: [
      'Mái hiên nghỉ vận động viên riêng biệt kèm xô đá lạnh & khăn mát từng sân',
      'Hỗ trợ đặt Sparring Partner bán chuyên tập luyện theo giờ',
      'Ưu đãi giảm tới 20% khi đặt lịch sớm trên 48 giờ',
    ],
  },
  {
    code: 'BASKETBALL',
    indexLabel: '05',
    name: 'Bóng rổ FIBA 5v5 & 3x3',
    shortTab: 'Bóng rổ',
    tagline:
      'Sân bóng rổ mái che kiến trúc gỗ Maple Bắc Mỹ hiện đại, vành rổ lò xo tiêu chuẩn và bảng điểm điện tử 24s.',
    standard: 'FIBA Pro Maple',
    surface: 'Sàn gỗ Maple giảm chấn / Polyurethane kháng UV',
    lighting: 'Chiếu sáng đồng đều 420 Lux đạt chuẩn ghi hình trận đấu',
    proShopPerk: 'Bóng da Molten BG4500, nhân sự bấm bảng điểm 24s & băng keo thể thao',
    priceFrom: 'Từ 240.000₫/ca',
    image: '/images/sport-basketball-ocean.jpg',
    highlights: [
      'Tích hợp đồng thời sân 5v5 tiêu chuẩn và khu đấu 3x3 sôi động tại Thủ Thiêm',
      'Hỗ trợ xuất hóa đơn VAT điện tử cho giải đấu CLB, trường học & doanh nghiệp',
      'Khu ghế đội dự bị trang bị sẵn thùng nước điện giải ướp lạnh',
    ],
  },
];

const STATUS_BADGE: Record<
  VenueLocationInfo['operationalStatus'],
  { label: string; className: string }
> = {
  NORMAL: { label: 'Đang mở đón khách', className: 'bg-[#E7F7D4] text-[#204E18]' },
  WEATHER_WATCH: { label: 'Theo dõi thời tiết', className: 'bg-amber-100 text-amber-900' },
  PARTIAL_MAINTENANCE: { label: 'Bảo trì 1 phần', className: 'bg-[#E6F1F8] text-[#0E4F7E]' },
};

export const HomeShowcaseSections: React.FC<HomeShowcaseSectionsProps> = ({
  listings = [],
  locations,
  onNavigate,
  onBrowseSportPage,
  onBrowseVenueCourts,
  onSelectCourt,
  onOpenLessorShop,
}) => {
  const prefersReduced = useReducedMotion();
  const [activeSportIdx, setActiveSportIdx] = useState<number>(0);

  const activeSpotlight = SPORT_SPOTLIGHTS[activeSportIdx];

  const featuredListings = useMemo(() => listings.slice(0, 3), [listings]);

  const verifiedProviders = useMemo<VenueProviderInfo[]>(() => {
    const map = new Map<string, VenueProviderInfo>();
    for (const l of listings) {
      if (l.provider && !map.has(l.provider.providerId)) {
        map.set(l.provider.providerId, l.provider);
      }
    }
    return Array.from(map.values()).slice(0, 4);
  }, [listings]);

  return (
    <div className="bg-white">
      {/* ===================================================================== */}
      {/* SECTION 01: EXECUTIVE TRUST & ESCROW INFRASTRUCTURE RIBBON            */}
      {/* ===================================================================== */}
      <section className="border-b border-neutral-200/75 bg-[#FAFBFA]">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8">
          <ScrollReveal
            yOffset={14}
            className="flex flex-wrap items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-center gap-2.5 text-neutral-500">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#16422C]" />
              <span className="font-semibold uppercase tracking-[0.12em] text-[#0F172A]">
                Hạ tầng Bảo lãnh &amp; Thanh toán Chính thức
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {[
                { label: 'VNPAY Ký Quỹ v2.1', sub: 'HMAC-SHA512' },
                { label: 'MoMo PayGate', sub: 'Xác nhận 1 chạm' },
                { label: 'VietQR Napas 24/7', sub: 'Đối soát tức thì' },
                { label: 'PriceLock Token', sub: 'Giữ giá cứng 10 phút' },
                { label: 'Bảo hiểm Mưa bão', sub: 'Hoàn cọc 100%' },
              ].map((pill) => (
                <div
                  key={pill.label}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200/85 bg-white px-3.5 py-1.5 shadow-2xs"
                >
                  <span className="font-semibold text-[#0F172A]">{pill.label}</span>
                  <span className="text-[10.5px] font-medium text-[#16422C]">• {pill.sub}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 02: ASYMMETRIC ARCHITECTURAL BENTO SHOWCASE                   */}
      {/* ===================================================================== */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-22">
        <ScrollReveal className="flex flex-col gap-4 border-b border-neutral-200/80 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#16422C]/20 bg-[#F4F8F4] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#16422C]">
              Chuẩn mực Nền tảng Sân Thể Thao Thế Hệ Mới
            </span>
            <h2 className="mt-3 text-3xl sm:text-[42px] font-semibold tracking-[-0.03em] leading-[1.1] text-[#0F172A]">
              Kiến trúc vận hành minh bạch từ mặt sân đến ví ký quỹ
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm leading-relaxed text-neutral-500">
            Kết hợp công nghệ định giá động dưới 1ms, bảo lãnh đặt cọc hai chiều và chuỗi dịch vụ
            Pro-Shop giao tận đường biên trong một trải nghiệm liền mạch.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Bento Card 1 (7 cols): Flagship Architectural Complex */}
          <ScrollReveal className="group relative overflow-hidden rounded-[30px] bg-[#0B2217] text-white lg:col-span-7 min-h-[360px] flex flex-col justify-between p-6 sm:p-8 shadow-[0_24px_60px_rgba(11,34,23,0.16)]">
            <img
              src="/images/hero-fairway-complex.jpg"
              alt="Kiến trúc tổ hợp sân thể thao ArenaPulse"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06150E]/92 via-[#092116]/45 to-black/20" />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white/15 px-3.5 py-1 text-[11px] font-semibold text-[#E7F7D4] backdrop-blur-md border border-white/15">
                Flagship Multi-Sport Architecture
              </span>
              <span className="rounded-full bg-[#E7F7D4] px-3 py-1 tabular-nums text-[11px] font-bold text-[#0B2217]">
                Mở cửa 05:30 – 24:00
              </span>
            </div>

            <div className="relative z-10 mt-28 space-y-5">
              <div className="max-w-xl">
                <h3 className="text-2xl sm:text-[28px] font-semibold tracking-tight leading-snug">
                  Tổ hợp mái vòm &amp; sân cỏ đạt kiểm định thi đấu quốc tế
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-white/80">
                  100% đối tác chủ sân trên ArenaPulse trải qua quy trình thẩm định pháp lý KYC 7
                  bước, kiểm tra độ nảy mặt sân, độ rọi đèn LED và an toàn PCCC định kỳ.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { num: '71+', label: 'Sân chuẩn quốc tế' },
                  { num: '6 đối tác', label: 'Chủ sân KYC Mall' },
                  { num: '< 1ms', label: 'Báo giá Realtime' },
                  { num: '0₫', label: 'Phí nền tảng người chơi' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-md"
                  >
                    <div className="tabular-nums text-lg font-bold text-[#E7F7D4]">{m.num}</div>
                    <div className="mt-0.5 text-[11px] text-white/75">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Bento Card 2 (5 cols): Dynamic Price-Lock Shield */}
          <ScrollReveal
            delay={0.06}
            className="flex flex-col justify-between rounded-[30px] border border-neutral-200/90 bg-[#F6F8F6] p-6 sm:p-8 lg:col-span-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#16422C] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[#E7F7D4]">
                  Khóa giá HMAC 10 phút
                </span>
                <span className="tabular-nums text-xs font-semibold text-[#16422C]">
                  Tiết kiệm tới 30%
                </span>
              </div>

              <h3 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight text-[#0F172A]">
                Giá thuê linh hoạt theo khung giờ, đóng băng ngay khi bạn chọn ca
              </h3>
              <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-neutral-600">
                Ưu đãi sâu cho ca sáng &amp; đầu giờ chiều; khi bấm giữ chỗ, hệ thống cấp mã khóa
                giá cố định 10 phút giúp bạn thanh toán an tâm không lo biến động.
              </p>
            </div>

            <div className="mt-6 space-y-2.5">
              {[
                {
                  slot: 'Ca sáng thấp điểm (06:00 – 11:00)',
                  tag: 'Ưu đãi -22%',
                  price: '155.000₫',
                  tone: 'bg-white border-neutral-200/80 text-[#16422C]',
                },
                {
                  slot: 'Ca chiều tiêu chuẩn (14:00 – 17:00)',
                  tag: 'Giá chuẩn',
                  price: '198.000₫',
                  tone: 'bg-white border-neutral-200/80 text-[#0F172A]',
                },
                {
                  slot: 'Ca tối sôi động (18:00 – 21:00)',
                  tag: 'Khóa giá 10p',
                  price: '255.000₫',
                  tone: 'bg-[#16422C] border-[#16422C] text-[#E7F7D4]',
                },
              ].map((row) => (
                <div
                  key={row.slot}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs ${row.tone}`}
                >
                  <span className="font-medium">{row.slot}</span>
                  <div className="flex items-center gap-2.5">
                    <span className="opacity-80 text-[11px]">{row.tag}</span>
                    <strong className="tabular-nums text-sm">{row.price}</strong>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Bento Card 3 (5 cols): 2-Way Escrow Guarantee */}
          <ScrollReveal
            delay={0.04}
            className="flex flex-col justify-between rounded-[30px] border border-[#0E4F7E]/20 bg-[#F4F8FB] p-6 sm:p-7 lg:col-span-5"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0E4F7E]">
                Bảo vệ Ký quỹ Hai Chiều
              </span>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0F172A]">
                Cam kết hoàn cọc tự động minh bạch theo thời gian thực
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                Tiền đặt cọc được giữ an toàn tại tài khoản ký quỹ trung gian và chỉ giải ngân cho
                chủ sân sau khi bạn quét QR vào sân thành công.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white p-3.5 border border-[#0E4F7E]/15">
                <div className="tabular-nums text-base font-extrabold text-[#16422C]">100%</div>
                <div className="mt-0.5 text-[10.5px] text-neutral-500">Hủy trước ≥ 11h</div>
              </div>
              <div className="rounded-2xl bg-white p-3.5 border border-[#0E4F7E]/15">
                <div className="tabular-nums text-base font-extrabold text-[#0E4F7E]">50%</div>
                <div className="mt-0.5 text-[10.5px] text-neutral-500">Từ 4h – dưới 11h</div>
              </div>
              <div className="rounded-2xl bg-[#E7F7D4] p-3.5 text-[#204E18]">
                <div className="tabular-nums text-base font-extrabold">100%</div>
                <div className="mt-0.5 text-[10.5px] font-semibold">Mưa bão / Lỗi sân</div>
              </div>
            </div>
          </ScrollReveal>

          {/* Bento Card 4 (7 cols): Sideline Add-on Pro-Shop Visual */}
          <ScrollReveal
            delay={0.08}
            className="flex flex-col justify-between rounded-[30px] border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-2xs lg:col-span-7"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#16422C]">
                  Dịch vụ Đi kèm Tận Đường Biên
                </span>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A]">
                  Đặt sẵn nước ướp lạnh, vợt thi đấu &amp; trọng tài cùng đơn thuê sân
                </h3>
              </div>
              <ActionButton
                variant="outline"
                size="sm"
                arrow="right"
                onClick={() => onNavigate('courts')}
                className="self-start sm:self-auto shrink-0"
              >
                Trải nghiệm ngay
              </ActionButton>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  img: '/images/services/service-water-drinks.jpg',
                  title: 'Nước khoáng & Điện giải',
                  price: 'Từ 15.000₫',
                  sub: 'Ướp đá sẵn giao tận ghế nghỉ',
                },
                {
                  img: '/images/services/service-pickleball-paddle.jpg',
                  title: 'Vợt Carbon & Bóng chuẩn',
                  price: 'Từ 45.000₫',
                  sub: 'USAPA / FIFA / BWF / Wilson',
                },
                {
                  img: '/images/services/service-referee.jpg',
                  title: 'Trọng tài & Highlight AI',
                  price: 'Từ 120.000₫',
                  sub: 'Điều hành trận & trả clip Full HD',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group flex items-center gap-3 sm:flex-col sm:items-stretch overflow-hidden rounded-2xl border border-neutral-200/80 bg-[#FAFAFA] p-2.5 transition-colors hover:bg-white"
                >
                  <div className="h-16 w-20 sm:h-28 sm:w-full shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                    <img
                      src={item.img}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 px-1 pt-1">
                    <div className="truncate text-xs font-bold text-[#0F172A]">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500 truncate">{item.sub}</div>
                    <div className="mt-1 tabular-nums text-xs font-bold text-[#16422C]">
                      {item.price}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 03: LIVE FEATURED COURTS & VERIFIED LESSOR PROFILES           */}
      {/* ===================================================================== */}
      {featuredListings.length > 0 && (
        <section className="bg-[#F5F7F5] py-16 sm:py-22">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8 space-y-10">
            <ScrollReveal className="flex flex-col gap-4 border-b border-neutral-200/85 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#16422C]">
                  Lịch Sân Trực Tuyến Nổi Bật Hôm Nay
                </span>
                <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
                  Chọn ca trống &amp; giữ sân ngay trong 30 giây
                </h2>
              </div>

              <ActionButton
                variant="forest"
                size="md"
                arrow="right"
                onClick={() => onNavigate('courts')}
                className="self-start sm:self-auto"
              >
                Xem toàn bộ {listings.length} cụm sân
              </ActionButton>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {featuredListings.map((listing, idx) => {
                const maxAvail = Math.max(
                  0,
                  ...listing.upcomingSlots.map((s) => s.availableCourts)
                );
                const openSlot =
                  listing.upcomingSlots.find((s) => s.availableCourts > 0) ??
                  listing.upcomingSlots[0];
                return (
                  <ScrollReveal
                    key={listing.groupId}
                    delay={idx * 0.06}
                    className="group flex flex-col justify-between overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-[#16422C]/50 hover:shadow-[0_22px_50px_rgba(22,66,44,0.12)]"
                  >
                    <div>
                      <div
                        onClick={() =>
                          onSelectCourt
                            ? onSelectCourt(listing, openSlot?.slotStart)
                            : onNavigate('courts')
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            if (onSelectCourt) onSelectCourt(listing, openSlot?.slotStart);
                            else onNavigate('courts');
                          }
                        }}
                        className="relative h-52 w-full cursor-pointer overflow-hidden rounded-[20px] bg-neutral-200"
                      >
                        <img
                          src={listing.imageUrl || '/images/sport-complex-aerial.jpg'}
                          alt={listing.groupName}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute left-3 top-3 flex items-center gap-1.5">
                          <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#0F172A] shadow-2xs">
                            {listing.sportName}
                          </span>
                          <span className="rounded-full bg-[#16422C] px-2.5 py-1 tabular-nums text-[11px] font-semibold text-[#E7F7D4]">
                            Còn {maxAvail} sân
                          </span>
                        </div>
                        <div className="absolute bottom-0 right-0 rounded-tl-[16px] bg-white px-3.5 py-1.5 tabular-nums text-xs font-bold text-[#16422C]">
                          Cọc {listing.depositPercent}%
                        </div>
                      </div>

                      <div className="px-2 pt-4">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              listing.provider && onOpenLessorShop
                                ? onOpenLessorShop(listing.provider.providerId)
                                : onNavigate('courts')
                            }
                            className="truncate font-semibold text-[#0E4F7E] hover:text-[#16422C] hover:underline"
                          >
                            {listing.provider?.providerName ?? listing.venueName} →
                          </button>
                          <span className="shrink-0 tabular-nums font-bold text-amber-600">
                            ★ {(listing.rating ?? 4.9).toFixed(1)}
                          </span>
                        </div>

                        <h3 className="mt-1.5 line-clamp-2 text-[17px] font-semibold leading-snug text-[#0F172A]">
                          {listing.groupName}
                        </h3>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {listing.district}, {listing.city} • {listing.slotMinutes} phút/ca
                        </p>

                        {openSlot && (
                          <div className="mt-3.5 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-[#F8FAF8] px-3.5 py-2.5 text-xs">
                            <div>
                              <span className="text-[10.5px] text-neutral-400 block">
                                Ca trống gần nhất
                              </span>
                              <span className="tabular-nums font-semibold text-[#0F172A]">
                                {formatSlotWindow(openSlot.slotStart, openSlot.slotEnd)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="tabular-nums text-sm font-bold text-[#16422C] block">
                                {formatVnd(openSlot.currentDynamicPrice)}
                              </span>
                              <span className="text-[10px] font-medium text-[#0E4F7E]">
                                Khóa giá 10p
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 px-2 pt-3">
                      <span className="tabular-nums text-xs text-neutral-500">
                        Từ <strong className="text-[#0F172A]">{formatVnd(listing.minPrice)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectCourt
                            ? onSelectCourt(listing, openSlot?.slotStart)
                            : onNavigate('courts')
                        }
                        className="text-xs font-bold text-[#16422C] hover:underline"
                      >
                        Chọn ca &amp; dịch vụ →
                      </button>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* Verified Partner Lessors Strip */}
            {verifiedProviders.length > 0 && (
              <ScrollReveal className="rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-neutral-100">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0E4F7E]">
                      Đối tác Vận hành Tiêu biểu
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                      Xem hồ sơ pháp lý &amp; gian sân chính thức của các Chủ sân lớn
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('rankings')}
                    className="text-xs font-semibold text-[#16422C] hover:underline"
                  >
                    Xem Bảng xếp hạng Chủ sân →
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {verifiedProviders.map((prov) => (
                    <button
                      key={prov.providerId}
                      type="button"
                      onClick={() =>
                        onOpenLessorShop ? onOpenLessorShop(prov.providerId) : onNavigate('courts')
                      }
                      className="group flex items-center gap-3.5 rounded-2xl border border-neutral-200/80 bg-[#F8FAFC] p-3.5 text-left transition-all hover:border-[#16422C] hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#16422C] text-xs font-bold text-[#E7F7D4]">
                        {prov.providerName
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#0F172A] group-hover:text-[#16422C]">
                          {prov.providerName}
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
                          {prov.totalManagedCourts} sân • Phản hồi {prov.responseRatePct}% •{' '}
                          {prov.city}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollReveal>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* SECTION 04: INTERACTIVE 5-SPORT TECHNICAL SPOTLIGHT                   */}
      {/* ===================================================================== */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-22">
        <ScrollReveal className="flex flex-col gap-5 border-b border-neutral-200/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#16422C]">
              Tiêu Chuẩn Kỹ Thuật 5 Bộ Môn
            </div>
            <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
              Khám phá chuẩn mặt sân &amp; tiện ích chuyên sâu từng môn
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Chọn bộ môn thể thao để xem tiêu chuẩn"
            className="flex flex-wrap gap-1.5 rounded-2xl sm:rounded-full bg-[#F3F4F6] p-1.5 border border-neutral-200/80"
          >
            {SPORT_SPOTLIGHTS.map((item, idx) => {
              const active = idx === activeSportIdx;
              return (
                <button
                  key={item.code}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setActiveSportIdx(idx)}
                  className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="home-sport-spotlight-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-[#16422C]"
                    />
                  )}
                  <span className="relative z-10">
                    {item.indexLabel} • {item.shortTab}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-7 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSpotlight.code}
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.3, ease: EXPO_EASE }}
                className="group relative h-[320px] sm:h-[430px] w-full overflow-hidden rounded-[28px] bg-[#0F172A] shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
              >
                <img
                  src={activeSpotlight.image}
                  alt={activeSpotlight.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/15 to-transparent" />

                <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/95 px-3.5 py-1 text-[11px] font-semibold text-[#0F172A] shadow-xs">
                    {activeSpotlight.standard}
                  </span>
                  <span className="rounded-full bg-[#E7F7D4] px-3.5 py-1 tabular-nums text-[11px] font-bold text-[#204E18]">
                    {activeSpotlight.priceFrom}
                  </span>
                </div>

                <div className="absolute bottom-5 left-5 right-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black/55 p-3.5 text-white backdrop-blur-md border border-white/15">
                    <div className="text-[10px] uppercase tracking-wider text-[#E7F7D4]">
                      Cấu trúc bề mặt sân
                    </div>
                    <div className="mt-0.5 text-xs font-medium">{activeSpotlight.surface}</div>
                  </div>
                  <div className="rounded-2xl bg-black/55 p-3.5 text-white backdrop-blur-md border border-white/15">
                    <div className="text-[10px] uppercase tracking-wider text-[#E7F7D4]">
                      Chiếu sáng tiêu chuẩn
                    </div>
                    <div className="mt-0.5 text-xs font-medium">{activeSpotlight.lighting}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between rounded-[28px] border border-neutral-200/85 bg-[#FAFBF9] p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`detail-${activeSpotlight.code}`}
                initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.28, ease: EXPO_EASE }}
                className="space-y-5"
              >
                <div>
                  <span className="tabular-nums text-xs font-bold uppercase tracking-[0.14em] text-[#0E4F7E]">
                    Phân khu {activeSpotlight.indexLabel} / 05
                  </span>
                  <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0F172A]">
                    {activeSpotlight.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {activeSpotlight.tagline}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#16422C]/20 bg-white p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
                    Gói dịch vụ đi kèm tại sân
                  </div>
                  <div className="mt-1 text-xs sm:text-[13px] font-medium text-[#0F172A]">
                    {activeSpotlight.proShopPerk}
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-[13px] text-neutral-700">
                  {activeSpotlight.highlights.map((hl) => (
                    <li key={hl} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16422C]"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-5">
              <span className="text-xs font-medium text-neutral-500">
                Đặt kèm nước &amp; dụng cụ trực tuyến
              </span>
              <ActionButton
                variant="ink"
                size="md"
                arrow="right"
                onClick={() => onBrowseSportPage(activeSpotlight.code)}
              >
                Đặt sân {activeSpotlight.shortTab}
              </ActionButton>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 05: FLAGSHIP LOCATIONS & DUAL ECOSYSTEM FINALE                */}
      {/* ===================================================================== */}
      <section className="bg-[#F6F8F6] py-16 sm:py-22">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 space-y-12">
          <ScrollReveal className="flex flex-col gap-4 border-b border-neutral-200/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#0E4F7E]">
                Mạng Lưới Tổ Hợp Trọng Điểm
              </span>
              <h2 className="mt-1.5 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
                Trạng thái vận hành trực tiếp tại Hà Nội &amp; TP. Hồ Chí Minh
              </h2>
            </div>

            <ActionButton
              variant="outline"
              size="md"
              arrow="right"
              onClick={() => onNavigate('announcements')}
              className="self-start sm:self-auto"
            >
              Xem bản tin vận hành cơ sở
            </ActionButton>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {locations.map((loc, idx) => {
              const badge = STATUS_BADGE[loc.operationalStatus];
              return (
                <ScrollReveal
                  key={loc.locationId}
                  delay={idx * 0.05}
                  className="group flex flex-col justify-between overflow-hidden rounded-[26px] border border-neutral-200/85 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
                >
                  <div>
                    <div className="relative h-42 w-full overflow-hidden rounded-[18px]">
                      <img
                        src={loc.imageUrl}
                        alt={loc.venueName}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                        {loc.city} • {loc.district}
                      </span>
                    </div>

                    <div className="px-2 pt-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-[#0F172A]">
                        {loc.venueName}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500 line-clamp-1">{loc.address}</p>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-600 line-clamp-2">
                        {loc.parkingNote}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 px-2 pt-3 text-xs">
                    <span className="tabular-nums text-[11px] text-neutral-500">
                      {loc.openHours}
                    </span>
                    <button
                      type="button"
                      onClick={() => onBrowseVenueCourts(loc.venueName)}
                      className="font-bold text-[#16422C] hover:underline"
                    >
                      Đặt sân →
                    </button>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          {/* Dual Ecosystem Finale: For Players & For Partner Lessors */}
          <ScrollReveal className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-[30px] bg-gradient-to-br from-[#0B2217] via-[#123624] to-[#16422C] p-7 sm:p-9 text-white shadow-[0_24px_60px_rgba(11,34,23,0.2)] lg:col-span-7">
              <div className="space-y-3">
                <span className="inline-block rounded-full bg-[#E7F7D4] px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0B2217]">
                  Dành cho Người chơi &amp; CLB Thể thao
                </span>
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-snug">
                  Sẵn sàng ra sân với mức giá tốt nhất &amp; quyền lợi Hội viên Diamond?
                </h3>
                <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-white/80">
                  Tích lũy điểm Arena sau mỗi lượt quét vé QR đúng giờ, đua Top Bảng xếp hạng tháng
                  và đọc các bài phân tích chuyên sâu trên Tạp chí ArenaPulse.
                </p>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('courts')}
                  className="rounded-full bg-[#E7F7D4] px-6 py-3 text-xs sm:text-[13px] font-bold text-[#0B2217] transition-colors hover:bg-white"
                >
                  Đặt lịch sân ngay →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('rankings')}
                  className="rounded-full border border-white/30 bg-white/10 px-5 py-3 text-xs sm:text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Bảng xếp hạng Vinh danh
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('news')}
                  className="rounded-full border border-white/20 px-5 py-3 text-xs sm:text-[13px] font-semibold text-white/85 transition-colors hover:text-white"
                >
                  Tạp chí &amp; Cẩm nang
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[30px] border border-neutral-200/90 bg-white p-7 sm:p-9 shadow-xs lg:col-span-5">
              <div className="space-y-3">
                <span className="inline-block rounded-full bg-[#E6F1F8] px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0E4F7E]">
                  Dành cho Chủ đầu tư &amp; Đơn vị Vận hành Sân
                </span>
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0F172A]">
                  Tăng 24% hiệu suất lấp đầy nhờ Động cơ Định giá Động
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-neutral-600">
                  Đưa cơ sở của bạn lên sàn ArenaPulse với hồ sơ Gian hàng riêng, đối soát sổ cái
                  kép tự động qua VNPAY/MoMo và hệ thống quản trị phân quyền nội bộ.
                </p>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <ActionButton
                  variant="ink"
                  size="md"
                  arrow="up-right"
                  onClick={() => onNavigate('governance')}
                >
                  Đăng ký Đối tác Chủ sân
                </ActionButton>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};
