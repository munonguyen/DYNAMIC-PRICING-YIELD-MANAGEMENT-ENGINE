import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  AppPageId,
  PriceQuote,
  SportTypeItem,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';
import { CircleArrowButton } from './FairwayControls';

interface FairwayHeroProps {
  sports: SportTypeItem[];
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
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

/**
 * Detects Data-Saver mode or 2G network so low-bandwidth devices never download video bytes.
 */
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
  onBrowseSportPage,
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

  // Defer video attachment until after initial paint so LCP poster renders in 0ms
  useEffect(() => {
    if (prefersReduced || shouldSkipAutoVideo()) {
      setEnableVideoStream(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEnableVideoStream(true));
    return () => window.cancelAnimationFrame(raf);
  }, [prefersReduced]);

  useEffect(() => {
    const t = window.setTimeout(() => setCardsCrystallized(true), prefersReduced ? 0 : 680);
    const clockInterval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(clockInterval);
    };
  }, [prefersReduced]);

  // IntersectionObserver + Visibility API: 0% GPU/CPU video decoding when scrolled past Hero or tab hidden
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

  return (
    <section id="hero" className="bg-white px-2.5 pb-2.5 pt-20 sm:px-4 sm:pb-4 sm:pt-22 lg:px-5 lg:pb-5">
      <div
        ref={heroContainerRef}
        className="relative mx-auto min-h-[600px] lg:h-[calc(100vh-108px)] lg:min-h-[620px] max-h-[850px] w-full max-w-[1440px] overflow-hidden rounded-[26px] sm:rounded-[32px] bg-[#0F3828]"
      >
        {/* =================================================================== */}
        {/* 1. NATIVE 1080P DUAL-CODEC VIDEO + INSTANT LCP POSTER               */}
        {/* =================================================================== */}
        <div className="absolute inset-0 z-0">
          <img
            src="/videos/hero-poster.jpg"
            alt="Toàn cảnh tổ hợp sân thể thao đa môn từ trên cao"
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

          {/* Balanced editorial contrast overlays */}
          <div
            className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#081F17]/65 via-[#0B2B20]/30 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/10 to-[#071D15]/48"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/48 via-transparent to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* =================================================================== */}
        {/* 2. HERO HEADLINE + VIDEO CHAPTER PILLS + BOTTOM ACTION CARDS        */}
        {/* =================================================================== */}
        <div className="relative z-20 flex h-full flex-col justify-between px-6 pb-6 pt-7 sm:px-10 sm:pb-8 sm:pt-9 lg:pt-10">
          <div className="flex flex-col lg:items-end lg:pr-6">
            <div className="lg:w-[64%] xl:w-[60%]">
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.14, ease: EXPO_EASE }}
                role="tablist"
                aria-label="Chuyển cảnh video theo lĩnh vực thể thao"
                className="mb-4 flex flex-wrap items-center gap-1.5"
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
                      className={`inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1 text-xs font-medium backdrop-blur-md transition-colors ${
                        active
                          ? 'bg-white text-[#0F172A] font-semibold shadow-sm'
                          : 'bg-white/16 text-white/92 border border-white/24 hover:bg-white/26'
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
              </motion.div>

              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.2, ease: EXPO_EASE }}
                className="mt-5 sm:mt-6 select-none"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-[2px] w-8 rounded-full bg-[#E7F7D4]" aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#E7F7D4]">
                    ArenaPulse Sports Complex
                  </span>
                </div>

                <h1 className="text-[34px] sm:text-[48px] lg:text-[54px] xl:text-[62px] font-semibold tracking-[-0.03em] leading-[1.14] text-white drop-shadow-[0_6px_26px_rgba(0,0,0,0.45)]">
                  <span className="block sm:whitespace-nowrap">Chuẩn mực sân đấu,</span>
                  <span className="block sm:whitespace-nowrap">trọn vẹn từng trận cầu.</span>
                </h1>
              </motion.div>
            </div>
          </div>

          {/* Bottom Row: Sport Summary Card + Next Video Chapter Card */}
          <div className="mt-10 flex flex-col gap-4 sm:mt-0 sm:flex-row sm:items-end sm:justify-between sm:pl-14 lg:pl-16">
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.28, ease: EXPO_EASE }}
              className={`w-full sm:w-[308px] rounded-[24px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-colors duration-700 ${
                cardsCrystallized
                  ? 'bg-white text-[#111827]'
                  : 'bg-white/55 backdrop-blur-xl text-[#111827]/80'
              }`}
            >
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: cardsCrystallized ? 1 : 0.25, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex items-center"
              >
                <div className="flex -space-x-2.5">
                  {VIDEO_CHAPTERS.map((sp) => (
                    <img
                      key={sp.sportCode}
                      src={sp.thumb}
                      alt={sp.label}
                      title={sp.label}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
                    />
                  ))}
                </div>
                <span className="-ml-2 inline-flex h-10 px-3 items-center justify-center rounded-full bg-[#E7F7D4] tabular-nums text-xs font-semibold text-[#204E18] ring-2 ring-white">
                  +52
                </span>
              </motion.div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-[#111827]">
                    {sports.length} Lĩnh Vực Sân Thể Thao
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    Bóng đá, Pickleball, Cầu lông, Tennis, Bóng rổ
                  </div>
                </div>

                <CircleArrowButton
                  onClick={() => onBrowseSportPage('ALL')}
                  aria-label="Cuộn tới danh sách sân đa môn"
                />
              </div>
            </motion.div>

            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.78, delay: 0.36, ease: EXPO_EASE }}
              className={`w-full sm:w-[326px] self-end rounded-[26px] p-3.5 shadow-[0_22px_54px_rgba(0,0,0,0.24)] transition-colors duration-700 ${
                cardsCrystallized
                  ? 'bg-white text-[#111827]'
                  : 'bg-white/50 backdrop-blur-xl text-[#111827]/80'
              }`}
            >
              <motion.div
                animate={{ opacity: cardsCrystallized ? 1 : 0.2 }}
                transition={{ duration: 0.55 }}
                className="relative h-28 sm:h-32 w-full overflow-hidden rounded-[18px] bg-neutral-200"
              >
                <img
                  src={nextChapter.thumb}
                  alt={`Sân ${nextChapter.label}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                  Cảnh kế: {nextChapter.label}
                </span>
                <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 tabular-nums text-[11px] font-semibold text-[#16422C] shadow-xs">
                  {formatVnd(liveDisplayPrice)}/ca
                </span>
              </motion.div>

              <div className="mt-3.5 flex items-end justify-between gap-3 px-1 pb-0.5">
                <div>
                  <div className="text-[14.5px] font-semibold leading-snug text-[#111827]">
                    Chuyển sang {nextChapter.label.toLowerCase()}.
                  </div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
                    Tua nhanh phân cảnh video hoặc cuộn xuống chọn khung giờ trống.
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
