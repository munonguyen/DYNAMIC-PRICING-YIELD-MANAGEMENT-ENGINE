import { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/marketplaceApi';
import type { BookingCourtAvailability, CourtUnitChoice, PublishedListing, VenueCourt } from '../types/marketplace';
import { CourtFloorCanvas, courtDisplayName, suggestedFloor } from './CourtFloorCanvas';

const choiceLabels = {
  AVAILABLE: { label: 'Còn trống', short: 'Còn trống', color: 'AVAILABLE' },
  TAKEN: { label: 'Không còn trống', short: 'Không trống', color: 'AWAITING_CHECK_IN' },
  UNAVAILABLE: { label: 'Không thể đặt', short: 'Không mở', color: 'UNAVAILABLE' },
} satisfies Record<BookingCourtAvailability['courts'][number]['status'], { label: string; short: string; color: VenueCourt['status'] }>;

export interface BookingCourtPickerControls {
  selection: CourtUnitChoice | null;
  onSelect: (choice: CourtUnitChoice | null) => void;
  revision: number;
}

export function BookingCourtPicker({ listing, slotStart, controls, disabled = false }: {
  listing: PublishedListing;
  slotStart: string;
  controls: BookingCourtPickerControls;
  disabled?: boolean;
}) {
  const { selection, onSelect, revision } = controls;
  const [data, setData] = useState<BookingCourtAvailability | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await marketplaceApi.getBookingCourtAvailability(listing.groupId, slotStart, controller.signal);
        if (!controller.signal.aborted) { setData(response); setError(false); }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 15_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [listing.groupId, slotStart, refresh, revision]);

  const courts = data?.courts ?? [];
  const availableCount = courts.filter(court => court.status === 'AVAILABLE').length;
  const courtsById = new Map(courts.map(court => [court.id, court]));
  const draft = data?.layout
    ? { ...data.layout, placements: data.layout.placements.filter(court => courtsById.has(court.unitId)) }
    : suggestedFloor(courts);
  const labels = new Map(draft.placements.map(court => [court.unitId, court.label]));
  const statuses = new Map(courts.map(court => [court.id, choiceLabels[court.status].color]));
  const statusLabels = new Map(courts.map(court => [court.id, choiceLabels[court.status]]));
  const disabledIds = new Set(courts.filter(court => disabled || error || court.status !== 'AVAILABLE').map(court => court.id));
  const selectedUnavailable = Boolean(selection && data && courtsById.get(selection.id)?.status !== 'AVAILABLE');
  const choose = (id: string) => {
    const court = courtsById.get(id);
    if (court && !disabledIds.has(id)) onSelect({ id, label: labels.get(id) ?? courtDisplayName(court.unitNumber) });
  };
  const unplaced = courts.filter(court => !labels.has(court.id));

  return (
    <section aria-label="Chọn vị trí sân" className="min-w-0 space-y-3 rounded-2xl border border-[#DDE8E1] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#15382A] sm:text-base">Chọn vị trí sân</h3>
          <p className="mt-0.5 text-xs text-[#476458]">{selection ? `Bạn chọn ${selection.label}` : 'Chọn trên sơ đồ hoặc để hệ thống tự xếp sân.'}</p>
        </div>
        {selection && <button type="button" disabled={disabled} onClick={() => onSelect(null)}
          className="min-h-9 rounded-xl border border-[#DDE8E1] px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF] disabled:opacity-50">
          Tự xếp sân
        </button>}
      </div>
      {error && <p role="status" className="text-xs text-amber-900">Chưa tải được trạng thái sân. <button type="button"
        onClick={() => setRefresh(current => current + 1)} className="font-semibold underline">Thử lại</button></p>}
      {!data && !error && <p role="status" className="text-xs text-[#476458]">Đang tải sơ đồ và tình trạng sân…</p>}
      {selectedUnavailable && <p role="status" className="rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-950">
        Sân đã chọn hiện không còn trống. Hãy chọn sân khác hoặc dùng tự xếp sân.
      </p>}
      {data && availableCount === 0 && <p className="text-xs font-semibold text-[#476458]">Khung giờ này không còn sân trống.</p>}
      {draft.placements.length > 0 && (
        <>
          <p className="text-xs text-[#476458]">{availableCount}/{courts.length} sân trống{!data?.layout && ' · Bố trí tham khảo'}</p>
          <CourtFloorCanvas draft={draft} selectedId={selection?.id ?? null} onSelect={choose} statuses={statuses} statusLabels={statusLabels}
            disabledIds={disabledIds} schematic={!data?.layout} sportCode={listing.sportCode} sportName={listing.sportName} />
        </>
      )}
      {unplaced.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-[#476458]">Sân chưa có vị trí trên sơ đồ</h4>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map(court => <button key={court.id} type="button" aria-pressed={selection?.id === court.id}
              onClick={() => choose(court.id)} disabled={disabledIds.has(court.id)}
              className="rounded-xl border border-[#DDE8E1] px-2.5 py-2 text-xs font-semibold text-[#16422C] aria-pressed:bg-[#E3F0E7] disabled:opacity-50">
              {courtDisplayName(court.unitNumber)} · {choiceLabels[court.status].label}
            </button>)}
          </div>
        </div>
      )}
    </section>
  );
}
