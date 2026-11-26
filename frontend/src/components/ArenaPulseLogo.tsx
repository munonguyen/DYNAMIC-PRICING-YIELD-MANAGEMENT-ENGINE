import React, { useId } from 'react';

interface ArenaPulseLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  showDomain?: boolean;
  className?: string;
}

/**
 * ArenaPulse (arenapulse.vn) signature brand mark combining an architectural
 * stadium apex ('A') with an electric-lime dynamic yield & heartbeat pulse wave.
 */
export const ArenaPulseLogo: React.FC<ArenaPulseLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showTagline = false,
  showDomain = true,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `ap-bg-${uid}`;
  const pulseId = `ap-pulse-${uid}`;
  const ringId = `ap-ring-${uid}`;

  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-9 w-9',
  };

  const textSizes = {
    sm: 'text-[17px]',
    md: 'text-[19px]',
    lg: 'text-[22px] sm:text-[24px]',
  };

  const isLight = variant === 'light';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0 drop-shadow-[0_4px_12px_rgba(11,34,23,0.22)]`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={bgId} x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isLight ? '#236E4A' : '#1E5D3F'} />
            <stop offset="55%" stopColor="#16422C" />
            <stop offset="100%" stopColor="#091D13" />
          </linearGradient>
          <linearGradient id={pulseId} x1="12" y1="36" x2="52" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E7F7D4" />
            <stop offset="55%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#4ADE80" />
          </linearGradient>
          <linearGradient id={ringId} x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#E7F7D4" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Shield Squircle */}
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgId})`} />
        <rect
          x="2.75"
          y="2.75"
          width="58.5"
          height="58.5"
          rx="15.25"
          stroke={isLight ? '#FFFFFF' : '#E7F7D4'}
          strokeOpacity={isLight ? 0.34 : 0.22}
          strokeWidth="1.5"
        />

        {/* Stadium Bowl Perimeter Arcs */}
        <rect
          x="12"
          y="13"
          width="40"
          height="38"
          rx="19"
          stroke={`url(#${ringId})`}
          strokeWidth="1.6"
        />

        {/* Architectural 'A' Arena Apex */}
        <path
          d="M20 45L30.4 18.6C31.05 16.95 32.95 16.95 33.6 18.6L44 45"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dynamic Yield Heartbeat Pulse Slicing the Apex */}
        <path
          d="M12.5 34.5H23.5L28 26.5L34.5 40.5L40 29L43.5 34.5H51.5"
          stroke={`url(#${pulseId})`}
          strokeWidth="3.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Precision Price-Lock Signal Node */}
        <circle cx="51.5" cy="34.5" r="3" fill="#E7F7D4" />
        <circle cx="51.5" cy="34.5" r="5.5" stroke="#86EFAC" strokeOpacity="0.35" strokeWidth="1.2" />
      </svg>

      <span className="flex flex-col leading-none">
        <span className="inline-flex items-baseline gap-0.5">
          <span
            className={`${textSizes[size]} tracking-[-0.03em] ${
              isLight ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            <span className="font-semibold">Arena</span>
            <span className={`font-semibold ${isLight ? 'text-[#86EFAC]' : 'text-[#16422C]'}`}>
              Pulse
            </span>
          </span>
          {showDomain && (
            <span
              className={`text-[11px] font-semibold tracking-tight ${
                isLight ? 'text-white/65' : 'text-neutral-400'
              }`}
            >
              .vn
            </span>
          )}
        </span>

        {showTagline && (
          <span
            className={`mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] ${
              isLight ? 'text-white/70' : 'text-neutral-400'
            }`}
          >
            Sports Yield Platform
          </span>
        )}
      </span>
    </span>
  );
};

