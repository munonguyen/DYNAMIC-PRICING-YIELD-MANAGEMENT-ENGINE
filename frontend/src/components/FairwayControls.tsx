import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EXPO_EASE } from './motionPrimitives';

export type ActionButtonVariant = 'ink' | 'forest' | 'sky' | 'outline' | 'glass';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  fullWidth?: boolean;
  arrow?: 'none' | 'right' | 'up-right' | 'back';
  arrowBadge?: boolean;
}

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  ink: 'bg-[#0F172A] text-white shadow-[0_6px_18px_rgba(15,23,42,0.14)] hover:bg-[#16422C]',
  forest: 'bg-[#16422C] text-white shadow-[0_8px_22px_rgba(22,66,44,0.2)] hover:bg-[#0F172A]',
  sky: 'bg-[#0E4F7E] text-white shadow-[0_8px_22px_rgba(14,79,126,0.2)] hover:bg-[#0F172A]',
  outline:
    'border border-neutral-200/90 bg-white text-[#0F172A] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[#16422C] hover:bg-[#F7FAF7]',
  glass:
    'border border-white/25 bg-white/12 text-white backdrop-blur-md hover:bg-white hover:text-[#0F172A]',
};

const SIZE_CLASSES: Record<ActionButtonSize, string> = {
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-xs sm:text-[13px]',
  lg: 'px-6 py-3.5 text-sm',
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'ink',
  size = 'md',
  fullWidth = false,
  arrow = 'none',
  arrowBadge = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const badgePadding = arrowBadge ? 'pl-4 pr-1.5 py-1.5' : SIZE_CLASSES[size];

  return (
    <button
      type={type}
      className={`fairway-interactive group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold disabled:pointer-events-none disabled:opacity-55 ${
        VARIANT_CLASSES[variant]
      } ${badgePadding} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {arrow === 'back' && (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M10 3.5L5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      <span>{children}</span>

      {arrow === 'right' && !arrowBadge && (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M3.5 8h9M8.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {arrowBadge && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] text-[#0F172A] transition-transform duration-300 group-hover:rotate-45"
          aria-hidden="true"
        >
          {arrow === 'up-right' ? '↗' : '→'}
        </span>
      )}
    </button>
  );
};

interface CircleArrowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: 'right' | 'up-right';
}

export const CircleArrowButton: React.FC<CircleArrowButtonProps> = ({
  direction = 'right',
  className = '',
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`fairway-interactive group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-[#111827] hover:border-[#111827] hover:bg-[#111827] hover:text-white ${className}`}
    {...rest}
  >
    {direction === 'up-right' ? (
      <span className="text-sm transition-transform duration-300 group-hover:rotate-45" aria-hidden="true">
        ↗
      </span>
    ) : (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <path d="M3.5 8h9M8.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

export interface SelectOption {
  value: string;
  label: string;
}

interface PillSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  prefix?: string;
  ariaLabel?: string;
  id?: string;
  variant?: 'pill' | 'field' | 'soft' | 'compact' | 'hero' | 'dark';
  menuAlign?: 'left' | 'right' | 'full';
  disabled?: boolean;
  className?: string;
}

export const PillSelect: React.FC<PillSelectProps> = ({
  value,
  onChange,
  options,
  prefix,
  ariaLabel,
  id,
  variant = 'pill',
  menuAlign,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const triggerStyles =
    variant === 'dark'
      ? 'w-full justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/16'
      : variant === 'field'
        ? 'w-full justify-between rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F172A] hover:border-[#16422C]'
        : variant === 'soft'
          ? 'w-full justify-between rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] hover:border-[#16422C] hover:bg-white'
          : variant === 'compact'
            ? 'justify-between gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 hover:border-[#16422C]'
            : variant === 'hero'
              ? 'w-full justify-between gap-2 bg-transparent py-0.5 text-xs sm:text-[13px] font-semibold text-[#0F172A]'
              : 'justify-between gap-2.5 rounded-full border border-neutral-200/90 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:border-[#16422C]';

  const isFullWidth =
    variant === 'field' || variant === 'soft' || variant === 'dark' || variant === 'hero';
  const resolvedMenuAlign = menuAlign ?? (variant === 'pill' || variant === 'compact' ? 'right' : 'full');
  const menuAlignClass =
    resolvedMenuAlign === 'right'
      ? 'right-0'
      : resolvedMenuAlign === 'left'
        ? 'left-0'
        : 'inset-x-0';

  return (
    <div ref={rootRef} className={`relative inline-block ${isFullWidth ? 'w-full' : ''} ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={`fairway-interactive inline-flex items-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${triggerStyles}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {prefix && (
            <span className={variant === 'dark' ? 'text-white/65 font-normal' : 'text-neutral-400 font-normal'}>
              {prefix}
            </span>
          )}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          } ${variant === 'dark' ? 'text-white/75' : 'text-neutral-500'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EXPO_EASE }}
            className={`absolute z-[80] mt-2 min-w-[200px] max-h-64 overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white/98 p-1.5 text-left shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl ${menuAlignClass}`}
          >
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      selected
                        ? 'bg-[#F4F8F4] font-semibold text-[#16422C]'
                        : 'font-medium text-neutral-700 hover:bg-[#F6F7F8] hover:text-[#0F172A]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-3.5 w-3.5 shrink-0 text-[#16422C]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        aria-hidden="true"
                      >
                        <path d="M3.5 8.5L6.5 11.5L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

