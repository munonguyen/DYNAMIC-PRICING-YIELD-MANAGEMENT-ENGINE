import { useRef, type PointerEvent } from 'react';
import { Move } from 'lucide-react';
import type { CourtFloorDraft, CourtFloorPlacement, CourtFloorUnit, VenueCourt } from '../types/marketplace';

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
  onMove?: (id: string, xCm: number, yCm: number) => void;
}

export function CourtFloorCanvas({ draft, selectedId, onSelect, statuses, dimmedIds, schematic, onMove }: CourtFloorCanvasProps) {
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; pointerId: number; x: number; y: number; initial: CourtFloorPlacement } | null>(null);
  const aspect = draft.widthCm / draft.lengthCm;
  const dense = draft.placements.length > 16;

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
    <div className="min-w-0 overflow-x-auto rounded-[20px] border border-[#D8E5DC] bg-[#F4F8F5] px-3 py-4 sm:px-5">
      {dense && <p className="mb-2 text-xs text-[#4B6255] sm:hidden">Vuốt ngang để xem toàn bộ sơ đồ.</p>}
      <div className="mx-auto" style={{
        width: `min(100%, ${Math.min(1400, 520 * aspect)}px)`,
        minWidth: dense ? Math.min(390, 370 * aspect) : undefined,
      }}>
        {!schematic && (
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tabular-nums text-[#4B6255]">
            <span className="h-px flex-1 bg-[#AFC0B5]" /> {asMetres(draft.widthCm)} m rộng <span className="h-px flex-1 bg-[#AFC0B5]" />
          </div>
        )}
        <div ref={board} role="group" aria-label="Mặt bằng các sân" style={{
          aspectRatio: aspect,
          backgroundImage: 'linear-gradient(#dce7de 1px, transparent 1px), linear-gradient(90deg, #dce7de 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }} className="relative isolate overflow-hidden rounded-[13px] border-2 border-[#A0B6A8] bg-[#EDF3EE]">
          {draft.placements.map(court => {
            const state = statuses?.get(court.unitId);
            const style = state ? floorStatuses[state] : undefined;
            const selected = selectedId === court.unitId;
            return (
              <button key={court.unitId} type="button" aria-pressed={selected}
                aria-label={style ? `${court.label} · ${style.label}` : court.label}
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
                className={`group absolute flex min-w-0 items-center justify-center overflow-hidden rounded-[7px] border text-center shadow-xs
                  hover:brightness-[0.96] focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-[-4px]
                  ${style?.tile ?? 'border-[#79AD91] bg-[#DCEEE3] text-[#184531]'}
                  ${onMove ? 'touch-none cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                  ${selected ? 'z-10 ring-2 ring-[#122F25] ring-offset-1' : ''}
                  ${dimmedIds?.has(court.unitId) && !selected ? 'opacity-40' : ''}`}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-[9%] rounded-[3px] border border-current opacity-15">
                  <span className="absolute inset-x-0 top-1/2 border-t border-current" />
                </span>
                <span className="relative min-w-0 px-1">
                  <span className={`line-clamp-2 break-words font-bold leading-tight ${dense ? 'text-[9px] sm:text-xs' : 'text-[10px] sm:text-sm'}`}>{court.label}</span>
                  {style && <span className="mt-0.5 line-clamp-2 text-[9px] font-semibold leading-tight sm:text-[11px]">{style.short}</span>}
                </span>
                {onMove && selected && <Move aria-hidden="true" className="absolute right-1 top-1 hidden h-3 w-3 opacity-70 sm:block" />}
              </button>
            );
          })}
        </div>
        {!schematic && <p className="mt-2 text-right text-[11px] font-semibold tabular-nums text-[#4B6255]">{asMetres(draft.lengthCm)} m dài</p>}
      </div>
    </div>
  );
}
