import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface AmbientVideoLayerProps {
  posterSrc: string;
  alt: string;
  webmSrc: string;
  mp4Src: string;
  startSec?: number;
  endSec?: number;
  paused?: boolean;
  className?: string;
  videoOpacityClass?: string;
}

function shouldSkipAutoVideo(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

/**
 * Renders an instant poster image and lazily streams/loops a muted ambient video
 * (or specific chapter slice) only when the section enters the viewport.
 */
export const AmbientVideoLayer: React.FC<AmbientVideoLayerProps> = ({
  posterSrc,
  alt,
  webmSrc,
  mp4Src,
  startSec,
  endSec,
  paused = false,
  className = '',
  videoOpacityClass = 'opacity-100',
}) => {
  const prefersReduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [inViewport, setInViewport] = useState(false);
  const [ready, setReady] = useState(false);

  const allowVideo = !prefersReduced && !shouldSkipAutoVideo();

  useEffect(() => {
    setReady(false);
  }, [mp4Src, webmSrc]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !allowVideo) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        setInViewport(visible);
      },
      { threshold: 0.08, rootMargin: '120px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allowVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !allowVideo) return;

    const syncPlayback = () => {
      if (inViewport && !paused && !document.hidden) {
        if (typeof startSec === 'number' && video.currentTime < startSec) {
          video.currentTime = startSec;
        }
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => document.removeEventListener('visibilitychange', syncPlayback);
  }, [inViewport, paused, allowVideo, startSec]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && typeof startSec === 'number') {
      video.currentTime = startSec;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (typeof startSec === 'number' && typeof endSec === 'number' && endSec > startSec) {
      if (video.currentTime >= endSec || video.currentTime < startSec) {
        video.currentTime = startSec;
      }
    }
  };

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <img
        src={posterSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {allowVideo && inViewport && (
        <video
          key={`${mp4Src}|${webmSrc}`}
          ref={videoRef}
          poster={posterSrc}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setReady(true)}
          onTimeUpdate={handleTimeUpdate}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            ready ? videoOpacityClass : 'opacity-0'
          }`}
        >
          <source src={webmSrc} type="video/webm" />
          <source src={mp4Src} type="video/mp4" />
        </video>
      )}
    </div>
  );
};

