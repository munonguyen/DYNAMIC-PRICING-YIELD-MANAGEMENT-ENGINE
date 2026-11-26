import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type {
  AppPageId,
  SportTypeItem,
  VenueLocationInfo,
} from '../types/marketplace';
import { EXPO_EASE, ScrollReveal } from './motionPrimitives';
import { ActionButton } from './FairwayControls';

interface HomeShowcaseSectionsProps {
  sports: SportTypeItem[];
  locations: VenueLocationInfo[];
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
  onBrowseVenueCourts: (venueName: string) => void;
}

interface SportSpotlightItem {
  code: string;
  name: string;
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
    name: 'Bóng đá Sân cỏ 5v5 & 7v7',
    tagline: 'Mặt cỏ nhân tạo sợi kim cương chuẩn FIFA Quality, độ đàn hồi cao và thoát nước tức thì.',
    standard: 'FIFA Quality Turf',
    surface: 'Cỏ nhân tạo 50mm + hạt cao su EPDM nguyên sinh',
    lighting: 'Đèn pha LED 400 Lux chống chói ban đêm',
    proShopPerk: 'Cho thuê áo bib, bóng thi đấu Molten & dịch vụ trọng tài',
    priceFrom: 'Từ 340.000₫/ca',
    image: '/images/sport-football-pitch.jpg',
    highlights: [
      'Cụm 6 sân liên hoàn tại Mỹ Đình hỗ trợ ghép sân 11v11',
      'Hoàn tiền cọc 100% tự động nếu trời mưa lớn ngưng thi đấu',
      'Phòng thay đồ, tủ locker cá nhân và khu vực nước điện giải',
    ],
  },
  {
    code: 'PICKLEBALL',
    name: 'Pickleball & Padel Mái vòm',
    tagline: 'Hệ thống sân mái vòm cách nhiệt phủ Acrylic 7 lớp êm khớp, chơi xuyên suốt bất kể nắng mưa.',
    standard: 'USAPA Tournament Spec',
    surface: 'Acrylic Cushion 7 lớp độ nảy chuẩn giải đấu',
    lighting: 'LED trần gián tiếp không lóa mắt khi lob bóng',
    proShopPerk: 'Thử & thuê vợt Carbon T700 chính hãng tại Pro-Shop',
    priceFrom: 'Từ 168.000₫/ca',
    image: '/images/court-pickleball-padel.jpg',
    highlights: [
      '10 sân mái vòm tại Hai Bà Trưng & 4 sân kính cường lực tại Tây Hồ',
      'Khoảng lùi cuối sân rộng 2.8m an toàn cho pha cứu bóng',
      'Hỗ trợ ghép kèo giao lưu theo trình độ DUPR vào cuối tuần',
    ],
  },
  {
    code: 'BADMINTON',
    name: 'Cầu lông Nhà thi đấu BWF',
    tagline: 'Không gian trần cao 11m khép kín chống gió hoàn toàn, trải thảm PVC vân cát đạt chuẩn thi đấu.',
    standard: 'BWF Grade Floor',
    surface: 'Thảm PVC 4.5mm giảm chấn bảo vệ đầu gối',
    lighting: 'Dải LED tuyến tính dọc hai biên không chiếu thẳng mắt',
    proShopPerk: 'Quầy căng vợt điện tử 4 nút lấy liền & cầu lông vũ loại 1',
    priceFrom: 'Từ 125.000₫/ca',
    image: '/images/court-badminton-arena.jpg',
    highlights: [
      'Hệ thống tường tiêu âm lam gỗ kiến trúc sang trọng',
      'Điều hòa thông gió đối lưu giữ nhiệt độ lý tưởng quanh năm',
      'Khu vực nghỉ ngơi nhìn thẳng ra toàn bộ 8 sân đấu',
    ],
  },
  {
    code: 'TENNIS',
    name: 'Quần vợt Hardcourt Ngoài trời',
    tagline: 'Cụm sân Hardcourt xanh mát thoáng đãng ven Hồ Tây, tích hợp cổng check-in tự động hiện đại.',
    standard: 'ITF Pace Category 3',
    surface: 'Sơn phủ Acrylic đa lớp chống trơn trượt',
    lighting: 'Trụ đèn cao áp 12m chuẩn thi đấu ban đêm',
    proShopPerk: 'Máy bắn bóng tập luyện, bóng nén áp suất & quấn cán vợt',
    priceFrom: 'Từ 230.000₫/ca',
    image: '/images/sport-tennis-sunny.jpg',
    highlights: [
      'Mái hiên nghỉ vận động viên riêng biệt từng sân đấu',
      'Chế độ tự check-in bằng mã xác thực nhanh gọn không chờ quầy',
      'Giá ưu đãi tự động tới 20% vào khung giờ sáng & đầu chiều',
    ],
  },
  {
    code: 'BASKETBALL',
    name: 'Bóng rổ FIBA 5v5 & 3x3',
    tagline: 'Sân bóng rổ mái che kiến trúc gỗ-thép hiện đại, bảng rổ kính cường lực và khán đài cổ vũ mini.',
    standard: 'FIBA Outdoor Pro',
    surface: 'Sàn phủ Polyurethane kháng UV & độ bám cao',
    lighting: 'Hệ thống chiếu sáng đồng đều đạt chuẩn quay highlight',
    proShopPerk: 'Bóng da Molten GG7X, đồng hồ bấm giờ 24s & bảng điểm',
    priceFrom: 'Từ 295.000₫/ca',
    image: '/images/sport-basketball-ocean.jpg',
    highlights: [
      'Tích hợp đồng thời 2 sân 5v5 và khu tập ném 3x3 tại Thủ Thiêm',
      'Hầm gửi xe thông minh kết nối thang máy lên thẳng sảnh sân',
      'Phù hợp tổ chức giải đấu doanh nghiệp, câu lạc bộ & học viện',
    ],
  },
];

const PRO_SHOP_SERVICES = [
  {
    badge: 'Pro-Shop Dụng Cụ',
    title: 'Thuê & Thử vợt, bóng, giày thi đấu chính hãng',
    desc: 'Trang bị đầy đủ vợt Pickleball Carbon, vợt Cầu lông, bóng FIFA/FIBA mới 100% và máy căng vợt điện tử lấy ngay tại sảnh.',
  },
  {
    badge: 'Clubhouse & Lounge',
    title: 'Phòng tắm nóng lạnh, Locker & Quầy đồ uống thể thao',
    desc: 'Không gian thư giãn sau trận đấu với nước điện giải, cà phê pha máy, khăn lạnh và tủ giữ đồ khóa từ riêng tư.',
  },
  {
    badge: 'Tổ Chức Giải Đấu',
    title: 'Gói đặt sân doanh nghiệp, CLB & sự kiện giao lưu',
    desc: 'Hỗ trợ giữ nhiều sân liền kề, xuất hóa đơn VAT điện tử tự động, bảng điểm trực tiếp và đội ngũ vận hành tại chỗ.',
  },
];

const STATUS_BADGE: Record<
  VenueLocationInfo['operationalStatus'],
  { label: string; className: string }
> = {
  NORMAL: { label: 'Mở cửa đón khách', className: 'bg-[#E7F7D4] text-[#204E18]' },
  WEATHER_WATCH: { label: 'Theo dõi thời tiết', className: 'bg-amber-100 text-amber-900' },
  PARTIAL_MAINTENANCE: { label: 'Bảo trì 1 phần', className: 'bg-[#E6F1F8] text-[#0E4F7E]' },
};

export const HomeShowcaseSections: React.FC<HomeShowcaseSectionsProps> = ({
  sports,
  locations,
  onNavigate,
  onBrowseSportPage,
  onBrowseVenueCourts,
}) => {
  const prefersReduced = useReducedMotion();
  const [activeSportIdx, setActiveSportIdx] = useState<number>(0);

  const activeSpotlight = SPORT_SPOTLIGHTS[activeSportIdx];

  return (
    <div className="bg-white">
      {/* ===================================================================== */}
      {/* SECTION 01: BRAND INTRODUCTION & ARCHITECTURAL METRICS                */}
      {/* ===================================================================== */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <ScrollReveal className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#16422C]/20 bg-[#F4F8F4] px-3.5 py-1 text-xs font-semibold text-[#16422C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16422C]" aria-hidden="true" />
              Về Hệ Thống Sân &amp; Pro-Shop ArenaPulse
            </span>

            <h2 className="text-3xl sm:text-[42px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
              Không gian thể thao kiến trúc đương đại cho mọi trận đấu trọn vẹn
            </h2>

            <p className="text-sm sm:text-[15.5px] leading-[1.7] text-neutral-600">
              ArenaPulse xây dựng mạng lưới tổ hợp sân thể thao đa bộ môn đạt chuẩn thi đấu quốc tế
              tại Hà Nội và TP. Hồ Chí Minh. Từ mặt sân êm khớp, hệ thống chiếu sáng chống chói cho
              đến quầy Pro-Shop dụng cụ chính hãng và quy trình đặt sân khóa giá minh bạch — mọi trải
              nghiệm đều được chăm chút để bạn chỉ cần tập trung vào cuộc chơi.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ActionButton variant="forest" size="md" arrow="right" onClick={() => onNavigate('courts')}>
                Khám phá lịch sân trống
              </ActionButton>
              <ActionButton variant="outline" size="md" onClick={() => onNavigate('announcements')}>
                Xem hệ thống cơ sở
              </ActionButton>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.08} className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-[28px] bg-[#0F3828] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              <div className="group relative h-64 sm:h-72 w-full overflow-hidden rounded-[20px]">
                <img
                  src="/images/hero-fairway-complex.jpg"
                  alt="Kiến trúc tổ hợp sân thể thao kính cường lực ArenaPulse"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#081F17]/85 via-[#081F17]/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-white">
                  <div>
                    <div className="text-[11px] font-medium text-[#E7F7D4]">
                      Flagship Sports Complex
                    </div>
                    <div className="text-base sm:text-lg font-semibold">
                      Thiết kế mái vòm &amp; nhà kính chuẩn thi đấu
                    </div>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
                    05:30 – 24:00
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { num: '32+', label: 'Sân thi đấu chuẩn' },
                  { num: `${sports.length} môn`, label: 'Đa lĩnh vực thể thao' },
                  { num: '< 1ms', label: 'Định giá minh bạch' },
                  { num: '100%', label: 'Hoàn cọc khi mưa' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-white/95 px-3.5 py-3 text-center transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="tabular-nums text-lg font-bold text-[#16422C]">{stat.num}</div>
                    <div className="mt-0.5 text-[11px] font-medium text-neutral-600">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 02: INTERACTIVE 5-SPORT SPOTLIGHT & PRO-SHOP STANDARDS        */}
      {/* ===================================================================== */}
      <section className="bg-[#F6F8F6] py-14 sm:py-20">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
          <ScrollReveal className="flex flex-col gap-5 border-b border-neutral-200/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16422C]">
                Hệ Sinh Thái Bộ Môn Tại ArenaPulse
              </div>
              <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
                Trải nghiệm mặt sân &amp; dịch vụ từng bộ môn
              </h2>
            </div>

            {/* Animated Sport Selector Pills */}
            <div
              role="tablist"
              aria-label="Chọn bộ môn thể thao để xem giới thiệu"
              className="flex flex-wrap gap-1.5 rounded-2xl sm:rounded-full bg-white p-1.5 border border-neutral-200/80"
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
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-full bg-[#16422C]"
                      />
                    )}
                    <span className="relative z-10">{item.name.split(' ')[0] === 'Bóng' ? item.name.split(' ').slice(0, 2).join(' ') : item.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </ScrollReveal>

          <div className="mt-8 grid grid-cols-1 items-stretch gap-7 lg:grid-cols-12">
            {/* Left 7 Cols: Animated Visual Stage */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSpotlight.code}
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReduced ? undefined : { opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.35, ease: EXPO_EASE }}
                  className="group relative h-[320px] sm:h-[420px] w-full overflow-hidden rounded-[28px] bg-[#0F172A] shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
                >
                  <img
                    src={activeSpotlight.image}
                    alt={activeSpotlight.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                  <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/95 px-3.5 py-1 text-[11px] font-semibold text-[#0F172A] shadow-xs">
                      {activeSpotlight.standard}
                    </span>
                    <span className="rounded-full bg-[#E7F7D4] px-3.5 py-1 tabular-nums text-[11px] font-semibold text-[#204E18]">
                      {activeSpotlight.priceFrom}
                    </span>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-2xl bg-black/50 p-3.5 text-white backdrop-blur-md border border-white/15">
                      <div className="text-[10px] uppercase tracking-wider text-[#E7F7D4]">
                        Tiêu chuẩn mặt sân
                      </div>
                      <div className="mt-0.5 text-xs font-medium">{activeSpotlight.surface}</div>
                    </div>
                    <div className="rounded-2xl bg-black/50 p-3.5 text-white backdrop-blur-md border border-white/15">
                      <div className="text-[10px] uppercase tracking-wider text-[#E7F7D4]">
                        Hệ thống chiếu sáng
                      </div>
                      <div className="mt-0.5 text-xs font-medium">{activeSpotlight.lighting}</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right 5 Cols: Facility & Pro-Shop Details */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-[28px] border border-neutral-200/85 bg-white p-6 sm:p-8 shadow-xs">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`detail-${activeSpotlight.code}`}
                  initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReduced ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: EXPO_EASE }}
                  className="space-y-5"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0E4F7E]">
                      Giới thiệu cụm sân
                    </span>
                    <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0F172A]">
                      {activeSpotlight.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {activeSpotlight.tagline}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16422C]">
                      Tiện ích Pro-Shop đi kèm
                    </div>
                    <div className="mt-1 text-xs sm:text-[13px] font-medium text-[#0F172A]">
                      {activeSpotlight.proShopPerk}
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs sm:text-[13px] text-neutral-700">
                    {activeSpotlight.highlights.map((hl) => (
                      <li key={hl} className="flex items-start gap-2.5">
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#16422C]"
                          aria-hidden="true"
                        />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                <span className="text-xs text-neutral-500">Khóa giá cố định 10 phút</span>
                <ActionButton
                  variant="ink"
                  size="md"
                  arrow="right"
                  onClick={() => onBrowseSportPage(activeSpotlight.code)}
                >
                  Xem lịch sân {activeSpotlight.code === 'FOOTBALL' ? 'Bóng đá' : activeSpotlight.name.split(' ')[0]}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 03: FLAGSHIP LOCATIONS & PRO-SHOP EXPERIENCE                  */}
      {/* ===================================================================== */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 sm:py-20">
        <ScrollReveal className="flex flex-col gap-4 border-b border-neutral-200/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0E4F7E]">
              Chuỗi Cơ Sở Trực Thuộc
            </span>
            <h2 className="mt-1.5 text-3xl sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A]">
              4 tổ hợp sân trọng điểm tại Hà Nội &amp; TP. Hồ Chí Minh
            </h2>
          </div>

          <ActionButton
            variant="outline"
            size="md"
            arrow="right"
            onClick={() => onNavigate('courts')}
            className="self-start sm:self-auto"
          >
            Xem tất cả 6 cụm sân
          </ActionButton>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {locations.map((loc, idx) => {
            const badge = STATUS_BADGE[loc.operationalStatus];
            return (
              <ScrollReveal
                key={loc.locationId}
                delay={idx * 0.06}
                className="group flex flex-col justify-between overflow-hidden rounded-[26px] border border-neutral-200/85 bg-[#F8F9FA] p-3 transition-all duration-300 hover:bg-white hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden rounded-[18px]">
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

                <div className="mt-4 flex items-center justify-between border-t border-neutral-200/70 px-2 pt-3 text-xs">
                  <span className="tabular-nums text-[11px] text-neutral-500">{loc.openHours}</span>
                  <button
                    type="button"
                    onClick={() => onBrowseVenueCourts(loc.venueName)}
                    className="font-semibold text-[#16422C] hover:underline"
                  >
                    Đặt sân →
                  </button>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Pro-Shop & Clubhouse Service Strip */}
        <ScrollReveal
          delay={0.08}
          className="mt-10 rounded-[28px] bg-[#0F172A] p-6 sm:p-9 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]"
        >
          <div className="flex flex-col gap-3 border-b border-white/12 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E7F7D4]">
                Dịch Vụ Tại Quầy Pro-Shop &amp; Clubhouse
              </span>
              <h3 className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight">
                Đầy đủ tiện nghi trước, trong và sau mỗi ca thi đấu
              </h3>
            </div>
            <span className="text-xs text-white/70">
              Phục vụ xuyên suốt tại sảnh đón tiếp tất cả cơ sở
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PRO_SHOP_SERVICES.map((srv) => (
              <div
                key={srv.badge}
                className="rounded-2xl border border-white/12 bg-white/6 p-5 transition-colors duration-300 hover:bg-white/10"
              >
                <span className="inline-block rounded-full bg-[#E7F7D4] px-3 py-0.5 text-[10.5px] font-semibold text-[#204E18]">
                  {srv.badge}
                </span>
                <h4 className="mt-3 text-base font-semibold leading-snug text-white">{srv.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-white/75">{srv.desc}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 04: 3-STEP EXPERIENCE GUIDE                                   */}
      {/* ===================================================================== */}
      <section className="bg-[#F6F8F6] py-14 sm:py-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
          <ScrollReveal className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Chọn cơ sở & Khóa giá 10 phút',
                desc: 'Xem lịch sân trống thời gian thực, nhận báo giá động dưới 1ms và khóa cứng mức giá trong 10 phút.',
              },
              {
                step: '02',
                title: 'Đặt cọc ký quỹ linh hoạt',
                desc: 'Hỗ trợ VietQR 24/7, VNPAY, MoMo hoặc thẻ quốc tế. Hoàn cọc 100% tự động nếu thời tiết xấu.',
              },
              {
                step: '03',
                title: 'Quét mã vé QR một lần vào sân',
                desc: 'Nhận vé QR điện tử ký số ngay sau khi thanh toán, quét mã tại cổng sân và nhận dụng cụ Pro-Shop.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-[24px] border border-neutral-200/80 bg-white p-6 shadow-xs transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F7D4] tabular-nums text-xs font-bold text-[#204E18]">
                  {item.step}
                </span>
                <h3 className="mt-3.5 text-base font-semibold text-[#0F172A]">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{item.desc}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};

