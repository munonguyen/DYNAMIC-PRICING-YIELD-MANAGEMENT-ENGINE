import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, PencilRuler } from 'lucide-react';
import type { CourtFloorLayout, LessorBookingOrder, VenueCourt } from '../types/marketplace';
import { asMetres, CourtFloorCanvas, courtDisplayName, floorStatuses, suggestedFloor } from './CourtFloorCanvas';
import { PillSelect } from './FairwayControls';

interface LiveCourtFloorProps {
  courts: VenueCourt[];
  layout?: CourtFloorLayout;
  sportCode?: string;
  sportName?: string;
  selectedId: string | null;
  onSelectCourt: (id: string) => void;
  bookings: Map<string, LessorBookingOrder>;
  onEdit?: () => void;
  onOpenOrder: (reservationId: string) => void;
  bookingTime: (order: LessorBookingOrder) => string;
}

const states = Object.keys(floorStatuses) as VenueCourt['status'][];

export function LiveCourtFloor({ courts, layout, sportCode, sportName, selectedId, onSelectCourt, bookings, onEdit, onOpenOrder, bookingTime }: LiveCourtFloorProps) {
  const [filter, setFilter] = useState<VenueCourt['status'] | null>(null);
  const { byId, statuses, counts, dimmed } = useMemo(() => {
    const byId = new Map(courts.map(court => [court.id, court]));
    const statuses = new Map(courts.map(court => [court.id, court.status]));
    const counts = { RENTED: 0, AWAITING_CHECK_IN: 0, PAYMENT_HOLD: 0, AVAILABLE: 0, UNAVAILABLE: 0 };
    for (const court of courts) counts[court.status]++;
    const dimmed = new Set(filter ? courts.filter(court => court.status !== filter).map(court => court.id) : []);
    return { byId, statuses, counts, dimmed };
  }, [courts, filter]);
  const draft = useMemo(() => layout
    ? { ...layout, placements: layout.placements.filter(court => byId.has(court.unitId)) }
    : suggestedFloor(courts), [layout, courts, byId]);
  const placements = new Map(draft.placements.map(placement => [placement.unitId, placement]));
  const current = selectedId ? byId.get(selectedId) : undefined;
  const selected = current ?? courts.find(court => court.status === 'RENTED') ?? courts[0];
  const placement = selected ? placements.get(selected.id) : undefined;
  const order = selected?.reservationId ? bookings.get(selected.reservationId) : undefined;
  const remaining = courts.length - placements.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#476458]">
          {courts.length} sân vật lý
          {!layout && ' · Bố trí tham khảo'}
        </p>
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#C7DCCD] bg-[#EAF4EC] px-3 text-xs font-bold text-[#16422C] hover:bg-[#DDEFE2]">
            <PencilRuler aria-hidden="true" size={15} /> {layout ? 'Chỉnh sơ đồ' : 'Thiết lập sơ đồ'}
          </button>
        )}
      </div>
      {courts.length === 0 ? <p className="rounded-xl border border-dashed border-[#D8E5DC] p-4 text-sm text-[#476458]">Cụm này chưa có sân vật lý.</p> : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-label="Lọc trạng thái trên sơ đồ">
            {states.map(state => {
              const style = floorStatuses[state];
              return (
                <button key={state} type="button" aria-pressed={filter === state}
                  onClick={() => {
                    setFilter(current => current === state ? null : state);
                    const match = courts.find(court => court.status === state);
                    if (filter !== state && match) onSelectCourt(match.id);
                  }}
                  className={`flex min-h-12 items-center justify-between gap-2 rounded-[10px] border px-2 py-1.5 text-left text-[11px] font-semibold hover:brightness-[0.96] sm:px-2.5
                    ${state === 'RENTED' ? 'border-[#B2D1C5] bg-[#DDEDE6] text-[#15473B]' : style.tile}
                    ${filter === state ? 'ring-2 ring-[#376853] ring-offset-1' : ''}`}>
                  <span className="flex items-start gap-1.5 leading-tight">
                    <span aria-hidden="true" className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${state === 'RENTED' ? 'bg-[#1C554D]' : style.dot}`} />
                    {style.label}
                  </span>
                  <span className="text-base font-bold tabular-nums">{counts[state]}</span>
                </button>
              );
            })}
          </div>
          {remaining > 0 && <p className="text-xs font-medium text-amber-900">{remaining} sân chưa có vị trí trên sơ đồ. Có thể chọn sân trong danh sách bên cạnh.</p>}
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <CourtFloorCanvas draft={draft} selectedId={selected?.id ?? null} onSelect={onSelectCourt}
              statuses={statuses} dimmedIds={dimmed} schematic={!layout} sportCode={sportCode} sportName={sportName} />
            {selected && (
              <aside aria-label="Chi tiết sân đang chọn" className="min-w-0 space-y-3 self-start rounded-[20px] border border-[#D8E5DC] bg-[#FAFCFA] p-3.5 sm:p-4">
                <PillSelect variant="soft" ariaLabel="Chọn sân trên mặt bằng" value={selected.id} onChange={onSelectCourt}
                  options={courts.map(court => ({ value: court.id, label: placements.get(court.id)?.label ?? courtDisplayName(court.unitNumber) }))} />
                <div className="space-y-2 border-t border-[#E5EDE7] pt-3">
                  <p className="flex items-start gap-1.5 break-words text-base font-bold text-[#15382A]"><MapPin aria-hidden="true" size={15} className="mt-1 shrink-0" />
                    {placement?.label ?? courtDisplayName(selected.unitNumber)}
                  </p>
                  <p className="text-xs tabular-nums text-[#476458]">{selected.unitNumber}
                    {placement && layout ? ` · ${asMetres(placement.widthCm)} × ${asMetres(placement.lengthCm)} m` : ''}
                  </p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${floorStatuses[selected.status].tile}`}>
                    {floorStatuses[selected.status].label}
                  </span>
                  {order && (
                    <div className="space-y-1 rounded-xl bg-[#F4F8F5] p-2.5 text-xs text-[#40564A]">
                      <p className="break-words text-sm font-bold text-[#15382A]">{order.customerName}</p>
                      <p className="tabular-nums">{bookingTime(order)}</p>
                      <button type="button" onClick={() => onOpenOrder(order.reservationId)}
                        className="inline-flex min-h-9 items-center gap-1 font-bold text-[#16422C] hover:underline">
                        Chi tiết đơn <ChevronRight aria-hidden="true" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
