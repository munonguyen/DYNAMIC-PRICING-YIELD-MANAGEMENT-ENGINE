import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { formatVnd } from '../api/marketplaceApi';
import type { LessorBookingOrder } from '../types/marketplace';

export const weeklyBookingStatus: Record<LessorBookingOrder['status'], { title: string; card: string; marker: string }> = {
  HELD: { title: 'Chờ thanh toán', card: 'border-[#E9DAB6] bg-[#FCF7EB] text-[#604721]', marker: 'bg-[#B08536]' },
  CONFIRMED: { title: 'Chờ nhận sân', card: 'border-[#B9D6C5] bg-[#EAF4ED] text-[#174733]', marker: 'bg-[#34815C]' },
  COMPLETED: { title: 'Đã nhận sân', card: 'border-[#B6CFCA] bg-[#E7F1EF] text-[#17493F]', marker: 'bg-[#276960]' },
  CANCELLED: { title: 'Đã hủy', card: 'border-neutral-200 bg-neutral-50 text-neutral-700', marker: 'bg-neutral-400' },
  NO_SHOW: { title: 'Bỏ lịch', card: 'border-neutral-200 bg-neutral-50 text-neutral-700', marker: 'bg-neutral-400' },
};

interface WeeklyBookingCardProps {
  order: LessorBookingOrder;
  dateLabel: string;
  timeLabel: string;
  onOpen: () => void;
  preview?: boolean;
  roomy?: boolean;
}

export function WeeklyBookingCard({ order, dateLabel, timeLabel, onOpen, preview = false, roomy = false }: WeeklyBookingCardProps) {
  const status = weeklyBookingStatus[order.status];
  const [showPreview, setShowPreview] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const previewId = useId();

  const show = () => {
    if (!preview) return;
    window.clearTimeout(timer.current);
    setShowPreview(true);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setShowPreview(false);
  };
  const scheduleHide = () => {
    if (!preview) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(hide, 160);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!showPreview || !trigger.current || !panel.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = panel.current;
    const gap = 10;
    const toRight = rect.right + gap + width <= window.innerWidth - gap;
    const fitsSide = toRight || rect.left - gap - width >= gap;
    const x = fitsSide
      ? (toRight ? rect.right + gap : rect.left - gap - width)
      : Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap));
    const attachedTop = fitsSide ? rect.top
      : rect.bottom + gap + height <= window.innerHeight - gap ? rect.bottom + gap : rect.top - height - gap;
    const y = Math.max(gap, Math.min(attachedTop, window.innerHeight - height - gap));
    panel.current.style.transform = `translate(${x}px, ${y}px)`;
  }, [showPreview, dateLabel, timeLabel, order]);

  useEffect(() => {
    if (!showPreview) return;
    const dismiss = () => {
      window.clearTimeout(timer.current);
      setShowPreview(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', handleKey);
    };
  }, [showPreview]);

  return (
    <>
      <button type="button" ref={trigger} aria-describedby={showPreview ? previewId : undefined}
        onPointerEnter={event => { if (event.pointerType === 'mouse') show(); }}
        onPointerLeave={scheduleHide}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) show(); }}
        onBlur={scheduleHide}
        onClick={() => { hide(); onOpen(); }}
        className={`group flex w-full min-w-0 gap-2 rounded-xl border text-left outline-offset-2 transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-[#2A7350]
          ${roomy ? 'min-h-[82px] px-2.5 py-2.5 xl:px-3.5' : 'px-2.5 py-2 sm:px-3'}
          ${showPreview && roomy ? 'shadow-sm ring-1 ring-[#448365]/35' : ''} ${status.card}`}>
        <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${status.marker}`} />
        <span className="min-w-0 flex-1">
          <span className={`block font-bold tabular-nums ${roomy ? 'text-xs' : 'text-[11px]'}`}>{timeLabel}</span>
          <span className={`mt-0.5 font-semibold ${roomy ? 'line-clamp-2 break-words text-sm leading-snug' : 'block truncate text-xs'}`}>{order.customerName}</span>
          <span className={`mt-1 block truncate font-medium opacity-85 ${roomy ? 'text-[11px]' : 'text-[10px]'}`}>
            {order.unitNumber}{roomy || !preview ? ` · ${order.groupName}` : ''}
          </span>
          <span className="sr-only">{status.title} · {order.orderId}</span>
        </span>
        {!preview && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 self-center opacity-70" />}
      </button>

      {showPreview && createPortal(
        <div id={previewId} role="tooltip" ref={panel}
          onPointerEnter={show} onPointerLeave={scheduleHide}
          className={`fixed left-0 top-0 z-[70] max-w-[calc(100vw-20px)] rounded-2xl border border-[#D3E2D8] bg-white text-[#183B2D] shadow-[0_12px_42px_rgba(13,43,31,0.22)]
            ${roomy ? 'w-[334px] p-4' : 'w-[302px] p-3.5'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-bold">{order.customerName}</p>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${status.card}`}>{status.title}</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold tabular-nums">
            <CalendarClock aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" /> {timeLabel} · {dateLabel}
          </p>
          <p className="mt-1 break-words text-xs text-[#465B50]">{order.groupName} · {order.unitNumber}</p>
          <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[#E5EEE8] pt-2.5 text-xs">
            <div><dt className="text-[#465B50]">Đã thu online</dt><dd className="font-bold tabular-nums">{formatVnd(order.paidEscrow)}</dd></div>
            <div><dt className="text-[#465B50]">Còn lại</dt><dd className="font-bold tabular-nums">{formatVnd(order.remainingAtVenue)}</dd></div>
          </dl>
          <p className="mt-2 text-[10px] font-medium text-[#465B50]">Mã đơn <span className="font-mono font-semibold">{order.orderId}</span></p>
        </div>,
        document.body,
      )}
    </>
  );
}
