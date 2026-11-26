import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  AppPageId,
  PriceQuote,
  SportTypeItem,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';
import { CircleArrowButton, PillSelect } from './FairwayControls';

interface FairwayHeroProps {
  sports: SportTypeItem[];
  totalOpenCourts?: number;
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
  onQuickSearch?: (sportCode: string, city: string) => void;
  activeQuote: PriceQuote | null;
}

interface VideoSportChapter {
  sportCode: string;
  label: string;
  thumb: string;
  priceHint: number;
  startSec: number;
  endSec: number;
}

const VIDEO_CHAPTERS: VideoSportChapter[] = [
  {
    sportCode: 'TENNIS',
    label: 'Tennis & Pickleball',
    thumb: '/images/sport-tennis-sunny.jpg',
    priceHint: 193_000,
    startSec: 0,
    endSec: 4.0,
  },
  {
    sportCode: 'FOOTBALL',
    label: 'Bóng đá sân cỏ',
    thumb: '/images/sport-football-pitch.jpg',
    priceHint: 450_000,
    startSec: 4.0,
    endSec: 8.5,
  },
  {
    sportCode: 'BASKETBALL',
    label: 'Bóng rổ 3x3 & 5v5',
    thumb: '/images/sport-basketball-ocean.jpg',
    priceHint: 350_000,
    startSec: 8.5,
    endSec: 12.25,
  },
  {
    sportCode: 'PICKLEBALL',
    label: 'Tổ hợp đa sân',
    thumb: '/images/sport-complex-aerial.jpg',
    priceHint: 200_000,
    startSec: 12.25,
    endSec: 16.0,
  },
];

const BottomLeftCutoutFillet: React.FC<{ className: string }> = ({ className }) => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 26 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    shapeRendering="geometricPrecision"
    className={`pointer-events-none absolute z-30 ${className}`}
    aria-hidden="true"
  >
    <path d="M0 0V26H26C11.6406 26 0 14.3594 0 0Z" fill="#FFFFFF" />
  </svg>
);

function shouldSkipAutoVideo(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

export const FairwayHero: React.FC<FairwayHeroProps> = ({
  sports,
  totalOpenCourts = 48,
  onBrowseSportPage,
  onQuickSearch,
  activeQuote,
}) => {
  const prefersReduced = useReducedMotion();
  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [chapterIdx, setChapterIdx] = useState<number>(0);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [enableVideoStream, setEnableVideoStream] = useState<boolean>(false);
  const [now, setNow] = useState(() => new Date());
  const [cardsCrystallized, setCardsCrystallized] = useState<boolean>(false);

  const [quickSport, setQuickSport] = useState<string>('ALL');
  const [quickCity, setQuickCity] = useState<string>('ALL');

  useEffect(() => {
    if (prefersReduced || shouldSkipAutoVideo()) {
      setEnableVideoStream(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEnableVideoStream(true));
    return () => window.cancelAnimationFrame(raf);
  }, [prefersReduced]);

  useEffect(() => {
    const t = window.setTimeout(() => setCardsCrystallized(true), prefersReduced ? 0 : 540);
    const clockInterval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(clockInterval);
    };
  }, [prefersReduced]);

  useEffect(() => {
    const video = videoRef.current;
    const container = heroContainerRef.current;
    if (!video || !container || !enableVideoStream) return;

    let inViewport = true;

    const syncPlayback = () => {
      if (!video) return;
      if (inViewport && !document.hidden) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        inViewport = entries[0]?.isIntersecting ?? false;
        syncPlayback();
      },
      { threshold: 0.08 }
    );

    io.observe(container);
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [enableVideoStream]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    const found = VIDEO_CHAPTERS.findIndex((c) => t >= c.startSec && t < c.endSec);
    if (found !== -1 && found !== chapterIdx) {
      setChapterIdx(found);
    }
  };

  const seekToChapter = (idx: number) => {
    setChapterIdx(idx);
    const v = videoRef.current;
    if (v && enableVideoStream) {
      v.currentTime = VIDEO_CHAPTERS[idx].startSec + 0.15;
      v.play().catch(() => {});
    }
  };

  const currentChapter = VIDEO_CHAPTERS[chapterIdx];
  const nextChapter = VIDEO_CHAPTERS[(chapterIdx + 1) % VIDEO_CHAPTERS.length];

  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });

  const liveDisplayPrice = activeQuote?.currentPrice ?? currentChapter.priceHint;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onQuickSearch) {
      onQuickSearch(quickSport, quickCity);
    } else {
      onBrowseSportPage(quickSport);
    }
  };

  return (
    <section
      id="hero"
      className="bg-white px-2.5 pb-2.5 pt-20 sm:px-4 sm:pb-4 sm:pt-22 lg:px-5 lg:pb-5"
    >
      <div
        ref={heroContainerRef}
        className="relative mx-auto min-h-[640px] lg:h-[calc(100vh-104px)] lg:min-h-[660px] max-h-[870px] w-full max-w-[1440px] overflow-hidden rounded-[26px] sm:rounded-[34px] bg-[#0B2A1E] ring-1 ring-black/5"
      >
        {/* =================================================================== */}
        {/* 1. NATIVE 1080P DUAL-CODEC VIDEO + EDITORIAL ATMOSPHERIC SCRIM      */}
        {/* =================================================================== */}
        <div className="absolute inset-0 z-0">
          <img
            src="/videos/hero-poster.jpg"
            alt="Toàn cảnh tổ hợp sân thể thao đa môn ArenaPulse từ trên cao"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />

          {enableVideoStream && (
            <video
              ref={videoRef}
              poster="/videos/hero-poster.jpg"
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
              onCanPlay={() => setVideoReady(true)}
              onTimeUpdate={handleTimeUpdate}
              className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
                videoReady ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <source src="/videos/hero-multisport.webm" type="video/webm" />
              <source src="/videos/hero-multisport.mp4" type="video/mp4" />
            </video>
          )}

          {/* Multi-layer architectural contrast scrims */}
          <div
            className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-[#061811]/78 via-[#082117]/38 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#061811]/35 via-black/15 to-[#061811]/62"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#05130D]/80 via-[#05130D]/28 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* =================================================================== */}
        {/* 2. HERO EDITORIAL STAGE + QUICK CONCIERGE + CORNER GLASS CARDS      */}
        {/* =================================================================== */}
        <div className="relative z-20 flex h-full flex-col justify-between px-5 pb-6 pt-6 sm:px-10 sm:pb-8 sm:pt-9 lg:pt-10">
          {/* Top-Right Focal Content */}
          <div className="flex flex-col lg:items-end lg:pr-4">
            <div className="lg:w-[68%] xl:w-[63%]">
              {/* Live Telemetry + Video Chapter Switcher */}
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: EXPO_EASE }}
                className="mb-4 flex flex-wrap items-center gap-2"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E7F7D4]/30 bg-[#0B2217]/75 px-3 py-1 text-[11px] font-semibold text-[#E7F7D4] backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="tabular-nums">{totalOpenCourts}+ sân trống trực tuyến</span>
                </span>

                <div
                  role="tablist"
                  aria-label="Chuyển cảnh video theo lĩnh vực thể thao"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {VIDEO_CHAPTERS.map((c, idx) => {
                    const active = idx === chapterIdx;
                    return (
                      <button
                        key={c.sportCode}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => seekToChapter(idx)}
                        className={`inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1 text-xs font-medium backdrop-blur-md transition-all ${
                          active
                            ? 'bg-white text-[#0F172A] font-semibold shadow-sm'
                            : 'bg-white/14 text-white/90 border border-white/20 hover:bg-white/24'
                        }`}
                      >
                        <img
                          src={c.thumb}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-5 w-5 rounded-full object-cover"
                        />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Editorial Headline */}
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.72, delay: 0.18, ease: EXPO_EASE }}
                className="mt-4 sm:mt-5 select-none"
              >
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="h-[2px] w-8 rounded-full bg-[#E7F7D4]" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#E7F7D4]">
                    ArenaPulse.vn • Dynamic Sports Marketplace
                  </span>
                </div>

                <h1 className="text-[32px] sm:text-[46px] lg:text-[54px] xl:text-[60px] font-semibold tracking-[-0.032em] leading-[1.1] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
                  <span className="block">Chuẩn mực sân đấu quốc tế,</span>
                  <span className="block text-[#E7F7D4]">khóa giá minh bạch từng ca.</span>
                </h1>

                <p className="mt-3.5 max-w-xl text-xs sm:text-sm leading-relaxed text-white/82">
                  Đặt lịch sân Bóng đá, Pickleball, Cầu lông, Tennis &amp; Bóng rổ tại các tổ hợp đã
                  xác thực KYC — giữ giá cố định 10 phút, bảo lãnh cọc 100% qua VNPAY / MoMo và nhận
                  vé QR một chạm.
                </p>
              </motion.div>

              {/* Executive Quick-Search Concierge Bar */}
              <motion.form
                initial={prefersReduced ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.72, delay: 0.26, ease: EXPO_EASE }}
                onSubmit={handleQuickSubmit}
                className="mt-6 flex flex-col gap-2 rounded-3xl sm:rounded-full border border-white/25 bg-white/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:flex-row sm:items-center max-w-2xl"
              >
                <div className="flex-1 px-3.5 py-1.5 sm:border-r sm:border-neutral-200/80">
                  <label
                    htmlFor="hero-quick-sport"
                    className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400"
                  >
                    Bộ môn thi đấu
                  </label>
                  <PillSelect
                    id="hero-quick-sport"
                    variant="hero"
                    menuAlign="left"
                    ariaLabel="Chọn bộ môn thi đấu"
                    value={quickSport}
                    onChange={setQuickSport}
                    options={[
                      { value: 'ALL', label: 'Tất cả 5 bộ môn' },
                      ...sports.map((s) => ({ value: s.code, label: s.name })),
                    ]}
                  />
                </div>

                <div className="flex-1 px-3.5 py-1.5">
                  <label
                    htmlFor="hero-quick-city"
                    className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400"
                  >
                    Thành phố / Khu vực
                  </label>
                  <PillSelect
                    id="hero-quick-city"
                    variant="hero"
                    menuAlign="left"
                    ariaLabel="Chọn thành phố hoặc khu vực"
                    value={quickCity}
                    onChange={setQuickCity}
                    options={[
                      { value: 'ALL', label: 'Toàn quốc (HN • HCM • ĐN)' },
                      { value: 'Hà Nội', label: 'Hà Nội (Mỹ Đình, Bách Khoa, Tây Hồ)' },
                      { value: 'TP. Hồ Chí Minh', label: 'TP. Hồ Chí Minh (Thủ Thiêm, Q.7)' },
                      { value: 'Đà Nẵng', label: 'Đà Nẵng (Hải Châu)' },
                    ]}
                  />
                </div>

                <button
                  type="submit"
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#16422C] px-6 py-3.5 text-xs sm:text-[13px] font-bold text-[#E7F7D4] shadow-sm transition-all hover:bg-[#0F172A] hover:text-white"
                >
                  <span>Tìm ca trống</span>
                  <span aria-hidden="true">→</span>
                </button>
              </motion.form>
            </div>
          </div>

          {/* Bottom Row: Sport Summary Card + Next Video Chapter Card */}
          <div className="mt-8 flex flex-col gap-4 sm:mt-0 sm:flex-row sm:items-end sm:justify-between sm:pl-14 lg:pl-16">
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.72, delay: 0.32, ease: EXPO_EASE }}
              className={`w-full sm:w-[312px] rounded-[24px] p-5 ring-1 ring-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-colors duration-700 ${
                cardsCrystallized
                  ? 'bg-white/96 backdrop-blur-xl text-[#111827]'
                  : 'bg-white/60 backdrop-blur-xl text-[#111827]/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2.5">
                  {VIDEO_CHAPTERS.map((sp) => (
                    <img
                      key={sp.sportCode}
                      src={sp.thumb}
                      alt={sp.label}
                      title={sp.label}
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white"
                    />
                  ))}
                  <span className="inline-flex h-9 px-2.5 items-center justify-center rounded-full bg-[#E7F7D4] tabular-nums text-[11px] font-bold text-[#204E18] ring-2 ring-white">
                    6 đối tác
                  </span>
                </div>
                <span className="rounded-full bg-[#F4F8F4] px-2.5 py-0.5 text-[10px] font-bold text-[#16422C]">
                  KYC 100%
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[14.5px] font-bold tracking-tight text-[#0F172A]">
                    Hệ sinh thái {sports.length} bộ môn chuẩn quốc tế
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-neutral-500">
                    Kèm nước điện giải, vợt Carbon &amp; trọng tài tại sân
                  </div>
                </div>

                <CircleArrowButton
                  onClick={() => onBrowseSportPage('ALL')}
                  aria-label="Mở danh sách cụm sân đa môn"
                />
              </div>
            </motion.div>

            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.74, delay: 0.38, ease: EXPO_EASE }}
              className={`w-full sm:w-[328px] self-end rounded-[26px] p-3.5 ring-1 ring-black/5 shadow-[0_22px_54px_rgba(0,0,0,0.26)] transition-colors duration-700 ${
                cardsCrystallized
                  ? 'bg-white/96 backdrop-blur-xl text-[#111827]'
                  : 'bg-white/55 backdrop-blur-xl text-[#111827]/80'
              }`}
            >
              <div className="relative h-28 w-full overflow-hidden rounded-[18px] bg-neutral-200">
                <img
                  src={nextChapter.thumb}
                  alt={`Sân ${nextChapter.label}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                  Tiếp theo: {nextChapter.label}
                </span>
                <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 tabular-nums text-[11px] font-bold text-[#16422C] shadow-xs">
                  {formatVnd(liveDisplayPrice)}/ca
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3 px-1 pb-0.5">
                <div>
                  <div className="text-[14px] font-bold leading-snug text-[#0F172A]">
                    Khám phá {nextChapter.label.toLowerCase()}
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    Chuyển nhanh cảnh quay hoặc cuộn xem bảng sân thực tế
                  </div>
                </div>

                <CircleArrowButton
                  onClick={() => seekToChapter((chapterIdx + 1) % VIDEO_CHAPTERS.length)}
                  aria-label={`Tua tới cảnh ${nextChapter.label}`}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* 3. BOTTOM-LEFT VERTICAL WHITE CLOCK & DATE CUTOUT TAB */}
        <div className="hidden sm:flex absolute -bottom-px -left-px z-30 h-[256px] lg:h-[286px] w-[55px] lg:w-[63px] flex-col items-center justify-center rounded-tr-[26px] lg:rounded-tr-[30px] bg-white">
          <BottomLeftCutoutFillet className="left-0 -top-[25px]" />
          <BottomLeftCutoutFillet className="-right-[25px] bottom-0" />

          <div className="vertical-fairway-clock flex items-center gap-3.5 select-none">
            <span className="tabular-nums text-[16px] lg:text-[18px] font-medium tracking-tight text-[#111827]">
              {timeString}
            </span>
            <span className="text-[11.5px] lg:text-[12.5px] font-normal text-neutral-400 capitalize">
              {dateString}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
