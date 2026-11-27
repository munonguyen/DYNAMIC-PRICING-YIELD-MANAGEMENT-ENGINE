import { useState } from 'react';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import type { PublishedListing, VenueCourt, VenueCourtSnapshot } from '../types/marketplace';
import { asMetres, courtDisplayName, floorStatuses } from './CourtFloorCanvas';
import { CourtMarkings } from './CourtMarkings';
import { PillSelect } from './FairwayControls';

export function CourtUnitInventory({ snapshot, listings, onSelectCourt, onCreateGroup }: {
  snapshot: VenueCourtSnapshot | null;
  listings: PublishedListing[];
  onSelectCourt: (court: VenueCourt) => void;
  onCreateGroup?: () => void;
}) {
  const [group, setGroup] = useState('ALL');
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const groupNames = new Map(snapshot?.courts.map(court => [court.groupId, court.groupName]));
  const sportCodes = new Map(listings.map(listing => [listing.groupId, listing.sportCode]));
  const positions = new Map(snapshot?.layouts.flatMap(layout => layout.placements).map(position => [position.unitId, position]));
  const query = search.trim().toLocaleLowerCase('vi');
  const courts = snapshot?.courts.filter(court => (group === 'ALL' || court.groupId === group)
    && (filter === 'ALL' || court.status === filter)
    && `${court.unitNumber} ${court.groupName} ${positions.get(court.id)?.label ?? courtDisplayName(court.unitNumber)}`.toLocaleLowerCase('vi').includes(query)) ?? [];

  return (
    <section id="danh-sach-cum-san" tabIndex={-1} aria-label="Danh sách sân cho thuê"
      className="scroll-mt-24 rounded-[24px] border border-[#DEE9E1] bg-white p-4 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#15382A] sm:text-xl">Danh sách sân cho thuê</h2>
          {snapshot && <p className="mt-0.5 text-xs text-[#476458]">{courts.length}/{snapshot.courts.length} sân vật lý</p>}
        </div>
        {onCreateGroup && <button type="button" onClick={onCreateGroup}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#16422C] px-3 text-xs font-semibold text-white hover:bg-[#23563C]">
          <Plus size={15} aria-hidden="true" /> Thêm cụm sân
        </button>}
      </header>
      {snapshot && (
        <div className="mt-4 grid gap-2 border-t border-[#E6EEE8] pt-3 sm:grid-cols-3">
          <label className="relative">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-[#476458]" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              aria-label="Tìm sân theo tên hoặc mã" placeholder="Tên hoặc mã sân"
              className="min-h-10 w-full rounded-xl border border-[#DDE8E1] bg-[#F8FBF9] pl-9 pr-3 text-xs text-slate-900" />
          </label>
          <PillSelect variant="soft" ariaLabel="Lọc sân theo cụm" value={group} onChange={setGroup}
            options={[{ value: 'ALL', label: 'Tất cả cụm sân' }, ...[...groupNames].map(([value, label]) => ({ value, label }))]} />
          <PillSelect variant="soft" ariaLabel="Lọc theo trạng thái sân" value={filter} onChange={setFilter}
            options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, ...Object.entries(floorStatuses).map(([value, item]) => ({ value, label: item.label }))]} />
        </div>
      )}
      {snapshot && courts.length === 0 && <p className="mt-5 text-sm text-[#476458]">Không có sân phù hợp.</p>}
      {courts.length > 0 && (
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
          {courts.map(court => {
            const position = positions.get(court.id);
            const status = floorStatuses[court.status];
            return (
              <li key={court.id} className="flex min-w-0 items-stretch gap-3 rounded-xl border border-[#E2EBE4] p-2.5">
                <div aria-hidden="true" className="grid w-[76px] shrink-0 place-items-center rounded-lg bg-[#132A26]">
                  <div data-state={court.status}
                    className={`court-drawing-tile relative ${position && position.widthCm > position.lengthCm ? 'h-10 w-[62px]' : 'h-[70px] w-10'}`}>
                    <CourtMarkings sportCode={sportCodes.get(court.groupId)} landscape={Boolean(position && position.widthCm > position.lengthCm)} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-bold text-[#15382A]">{position?.label ?? courtDisplayName(court.unitNumber)}</h3>
                  <p className="line-clamp-2 text-xs text-[#476458]">{court.unitNumber} · {court.groupName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.tile}`}>{status.label}</span>
                    {position && <span className="self-center text-[11px] text-[#476458]">{asMetres(position.widthCm)} × {asMetres(position.lengthCm)} m</span>}
                  </div>
                  <a href="#so-do-cum-san" onClick={() => onSelectCourt(court)}
                    aria-label={`Xem ${position?.label ?? courtDisplayName(court.unitNumber)} trên sơ đồ`}
                    className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[#16422C] hover:underline">
                    <LayoutGrid size={13} aria-hidden="true" /> Xem trên sơ đồ
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
