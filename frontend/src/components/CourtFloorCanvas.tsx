import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Grid2X2, Maximize, Minus, Move, Plus } from 'lucide-react';
import type { CourtFloorDraft, CourtFloorPlacement, CourtFloorUnit, VenueCourt } from '../types/marketplace';
import { CourtMarkings } from './CourtMarkings';
import './CourtFloorCanvas.css';

export const floorStatuses = {
  AVAILABLE: { label: 'Trống lúc này', short: 'Trống', tile: 'border-[#67A582] bg-[#E5F4E8] text-[#163F2D]', dot: 'bg-[#29734D]' },
  AWAITING_CHECK_IN: { label: 'Đã đặt · Chờ nhận sân', short: 'Đã đặt', tile: 'border-[#DCA953] bg-[#FFF1D4] text-[#55360D]', dot: 'bg-[#9B5B0B]' },
  RENTED: { label: 'Đang sử dụng', short: 'Đang dùng', tile: 'border-[#396A62] bg-[#1C554D] text-white', dot: 'bg-[#9DD7BB]' },
  PAYMENT_HOLD: { label: 'Giữ chỗ · Chờ thanh toán', short: 'Giữ chỗ', tile: 'border-[#78A3C1] bg-[#E5F1FA] text-[#143E5D]', dot: 'bg-[#35739E]' },
  UNAVAILABLE: { label: 'Tạm ngừng', short: 'Tạm ngừng', tile: 'border-[#ABB5B7] bg-[#E8ECEC] text-[#38464A]', dot: 'bg-[#68797E]' },
} satisfies Record<VenueCourt['status'], { label: string; short: string; tile: string; dot: string }>;

const metres = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
export function asMetres(cm: number) {
  return metres.format(cm / 100);
}

export function courtDisplayName(unitNumber: string) {
  return unitNumber.replace(/^SAN[_ -]?(\d+)$/i, 'Sân $1');
}

export function arrangeCourts(units: CourtFloorUnit[], widthCm: number, lengthCm: number, columns: number): CourtFloorPlacement[] {
  const rows = Math.max(1, Math.ceil(units.length / columns));
  const cellWidth = Math.floor(widthCm / columns);
  const cellLength = Math.floor(lengthCm / rows);
  const spacing = Math.min(100, Math.floor(Math.min(cellWidth, cellLength) / 8));
  return units.map((unit, index) => ({
    unitId: unit.id,
    label: courtDisplayName(unit.unitNumber),
    xCm: (index % columns) * cellWidth + spacing,
    yCm: Math.floor(index / columns) * cellLength + spacing,
    widthCm: cellWidth - 2 * spacing,
    lengthCm: cellLength - 2 * spacing,
  }));
}

export function suggestedColumns(courtCount: number) {
  return Math.max(1, Math.min(courtCount, Math.ceil(Math.sqrt(courtCount * 1.45))));
}

export function suggestedFloor(units: CourtFloorUnit[]): CourtFloorDraft {
  const columns = suggestedColumns(units.length);
  const rows = Math.max(1, Math.ceil(units.length / columns));
  const widthCm = Math.min(50_000, columns * 900);
  const lengthCm = Math.min(50_000, rows * 1500);
  return { widthCm, lengthCm, version: 0, placements: arrangeCourts(units, widthCm, lengthCm, columns) };
}

interface CourtFloorCanvasProps {
  draft: CourtFloorDraft;
  selectedId: string | null;
  onSelect: (id: string) => void;
  statuses?: Map<string, VenueCourt['status']>;
  dimmedIds?: Set<string>;
  schematic?: boolean;
  sportCode?: string;
  sportName?: string;
  onMove?: (id: string, xCm: number, yCm: number) => void;
}

const zoomLevels = [1, 1.25, 1.6, 2, 2.5];
const toolbarButton = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#E6F6EE] hover:bg-white/15 focus-visible:outline-[#81CDB2] disabled:opacity-35';

function drawingStep(range: number) {
  const target = range / 4.5;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const steps = [1, 2, 5, 10].map(step => step * magnitude);
  return steps.reduce((closest, step) => Math.abs(step - target) < Math.abs(closest - target) ? step : closest);
}

function DrawingRuler({ range, step, axis }: { range: number; step: number; axis: 'x' | 'y' }) {
  const steps = Array.from({ length: Math.floor(range / step) + 1 }, (_, index) => index * step);
  return (
    <div aria-hidden="true" className={`pointer-events-none relative select-none text-[9px] font-semibold tabular-nums text-[#BFDBCE]
      ${axis === 'x' ? 'mb-1.5 h-5 border-b border-[#799D8B]/55' : 'mr-1.5 w-7 border-r border-[#799D8B]/55'}`}>
      {steps.map(value => (
        <span key={value} style={axis === 'x' ? { left: `${value / range * 100}%` } : { top: `${value / range * 100}%` }}
          className={`absolute ${axis === 'x' ? 'bottom-0 -translate-x-1/2 pb-1' : 'right-0 -translate-y-1/2 pr-1.5'}`}>
          {asMetres(value)}
          <span className={`absolute bg-[#799D8B] ${axis === 'x' ? 'bottom-0 left-1/2 h-[3px] w-px' : 'right-0 top-1/2 h-px w-[3px]'}`} />
        </span>
      ))}
    </div>
  );
}

export function CourtFloorCanvas({ draft, selectedId, onSelect, statuses, dimmedIds, schematic, sportCode, sportName, onMove }: CourtFloorCanvasProps) {
  const board = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; pointerId: number; x: number; y: number; initial: CourtFloorPlacement } | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = zoomLevels[zoomIndex];
  const aspect = draft.widthCm / draft.lengthCm;
  const xStep = drawingStep(draft.widthCm);
  const yStep = drawingStep(draft.lengthCm);
  const scaleCm = Math.min(xStep, yStep);

  const changeZoom = (next: number) => {
    if (next === zoomIndex || !viewport.current || !board.current) return;
    const frame = viewport.current.getBoundingClientRect();
    const bounds = board.current.getBoundingClientRect();
    zoomAnchor.current = {
      x: Math.max(0, Math.min(1, (frame.left + frame.width / 2 - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (frame.top + frame.height / 2 - bounds.top) / bounds.height)),
    };
    setZoomIndex(next);
  };

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const frame = viewport.current;
    const bounds = board.current?.getBoundingClientRect();
    if (!anchor || !frame || !bounds) return;
    if (zoomIndex === 0) {
      frame.scrollTo(0, 0);
    } else {
      const rect = frame.getBoundingClientRect();
      frame.scrollLeft += bounds.left + bounds.width * anchor.x - rect.left - frame.clientWidth / 2;
      frame.scrollTop += bounds.top + bounds.height * anchor.y - rect.top - frame.clientHeight / 2;
    }
    zoomAnchor.current = null;
  }, [zoomIndex]);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = drag.current;
    const rect = board.current?.getBoundingClientRect();
    if (!onMove || !origin || !rect || event.pointerId !== origin.pointerId) return;
    const dx = Math.round((event.clientX - origin.x) / rect.width * draft.widthCm / 10) * 10;
    const dy = Math.round((event.clientY - origin.y) / rect.height * draft.lengthCm / 10) * 10;
    onMove(origin.id,
      Math.max(0, Math.min(draft.widthCm - origin.initial.widthCm, origin.initial.xCm + dx)),
      Math.max(0, Math.min(draft.lengthCm - origin.initial.lengthCm, origin.initial.yCm + dy)));
  };

  return (
    <div className="court-drawing min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/15 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold">
          <Grid2X2 size={14} aria-hidden="true" className="shrink-0 text-[#9DCEBA]" />
          <span>Mặt bằng</span>
          {sportName && <span className="truncate border-l border-white/20 pl-2 font-medium text-[#A9CABB]">{sportName}</span>}
        </div>
        <div role="group" aria-label="Điều chỉnh độ phóng sơ đồ" className="flex items-center gap-0.5 rounded-lg border border-white/14 bg-[#0C211D] p-0.5">
          <button type="button" aria-label="Thu nhỏ sơ đồ" title="Thu nhỏ" disabled={zoomIndex === 0}
            className={toolbarButton} onClick={() => changeZoom(zoomIndex - 1)}><Minus aria-hidden="true" size={15} /></button>
          <output aria-label="Độ phóng sơ đồ" className="min-w-9 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label="Phóng to sơ đồ" title="Phóng to" disabled={zoomIndex === zoomLevels.length - 1}
            className={toolbarButton} onClick={() => changeZoom(zoomIndex + 1)}><Plus aria-hidden="true" size={15} /></button>
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/16" />
          <button type="button" aria-label="Vừa khung sơ đồ" title="Vừa khung" disabled={zoomIndex === 0}
            className={toolbarButton} onClick={() => changeZoom(0)}><Maximize aria-hidden="true" size={14} /></button>
        </div>
      </div>
      <div ref={viewport} role="region" aria-label="Khung cuộn sơ đồ" data-zoomed={zoomIndex > 0} tabIndex={zoomIndex > 0 ? 0 : undefined}
        className="court-drawing-viewport max-h-[min(52vh,500px)] overflow-auto px-3 py-4 focus-visible:outline-[#81CDB2] sm:max-h-[min(64vh,615px)] sm:px-5 sm:py-5">
        <div className="mx-auto grid grid-cols-[auto_minmax(0,1fr)]" style={{
          width: `min(${100 * zoom}%, calc(var(--drawing-fit-height) * ${aspect * zoom} + ${schematic ? 0 : 34 * zoom}px))`,
        }}>
          {!schematic && <>
            <span aria-hidden="true" className="text-[9px] font-bold text-[#9AB9AA]">m</span>
            <DrawingRuler range={draft.widthCm} step={xStep} axis="x" />
            <DrawingRuler range={draft.lengthCm} step={yStep} axis="y" />
          </>}
          <div ref={board} role="group" aria-label="Mặt bằng các sân" style={{
            aspectRatio: aspect,
            backgroundSize: `${xStep / draft.widthCm * 100}% 100%, 100% ${yStep / draft.lengthCm * 100}%, ${xStep / draft.widthCm * 20}% 100%, 100% ${yStep / draft.lengthCm * 20}%`,
          }} className={`court-drawing-board ${schematic ? 'col-span-2' : ''}`}>
            {draft.placements.map(court => {
              const state = statuses?.get(court.unitId);
              const style = state ? floorStatuses[state] : undefined;
              const selected = selectedId === court.unitId;
              return (
                <button key={court.unitId} type="button" aria-pressed={selected}
                  aria-label={style ? `${court.label} · ${style.label}` : court.label}
                  data-state={state}
                  title={style ? `${court.label} · ${style.label}` : court.label}
                  onClick={() => onSelect(court.unitId)}
                  onPointerDown={event => {
                    if (!onMove || event.button !== 0) return;
                    onSelect(court.unitId);
                    drag.current = { id: court.unitId, pointerId: event.pointerId, x: event.clientX, y: event.clientY, initial: court };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={move}
                  onPointerUp={() => { drag.current = null; }}
                  onLostPointerCapture={() => { drag.current = null; }}
                  style={{
                    left: `${court.xCm / draft.widthCm * 100}%`, top: `${court.yCm / draft.lengthCm * 100}%`,
                    width: `${court.widthCm / draft.widthCm * 100}%`, height: `${court.lengthCm / draft.lengthCm * 100}%`,
                  }}
                  className={`court-drawing-tile absolute min-w-0 overflow-hidden
                    transition-[filter,opacity] hover:z-10 hover:brightness-115 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                    ${onMove ? 'touch-none cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    ${selected ? 'z-20' : ''}
                    ${dimmedIds?.has(court.unitId) && !selected ? 'opacity-35' : ''}`}>
                  <CourtMarkings sportCode={sportCode} landscape={court.widthCm > court.lengthCm} />
                  <span className="court-drawing-caption pointer-events-none">
                    <span className="court-drawing-name">{court.label}</span>
                    {style && <span className="court-drawing-status">{style.short}</span>}
                  </span>
                  {onMove && selected && <Move aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1.5 hidden h-3 w-3 text-[#D5F5E6] sm:block" />}
                </button>
              );
            })}
          </div>
          {!schematic && (
            <div className="col-start-2 mt-3 flex items-center gap-2 text-[10px] font-semibold tabular-nums text-[#BCD7CB]">
              <span aria-hidden="true" className="h-1.5 shrink-0 border-x border-b border-[#CBE3D8]" style={{ width: `${scaleCm / draft.widthCm * 100}%` }} />
              <span className="shrink-0">{asMetres(scaleCm)} m</span>
              <span className="ml-auto text-right">{asMetres(draft.widthCm)} × {asMetres(draft.lengthCm)} m</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
