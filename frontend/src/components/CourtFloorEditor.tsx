import { useEffect, useRef, useState } from 'react';
import { Grid2X2, PencilRuler, RotateCcw, X } from 'lucide-react';
import { marketplaceApi } from '../api/marketplaceApi';
import type { CourtFloorDraft, CourtFloorPlacement, CourtFloorUnit } from '../types/marketplace';
import { arrangeCourts, CourtFloorCanvas, courtDisplayName, suggestedColumns, suggestedFloor } from './CourtFloorCanvas';

const fieldStyle = 'min-h-10 w-full rounded-xl border border-[#DAE5DD] bg-white px-3 text-sm font-semibold tabular-nums text-[#163D2D] focus-visible:outline-[#398563]';
const actionStyle = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DAE5DD] px-3 text-xs font-semibold text-[#16422C] hover:bg-[#EDF5EF] disabled:opacity-50';

function MeterField({ label, cm, onChange, min = 0 }: { label: string; cm: number; onChange: (cm: number) => void; min?: number }) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-[#40564A]">{label}</span>
      <div className="relative">
        <input type="number" min={min} max={500} step="0.01" inputMode="decimal"
          value={cm || min === 0 ? cm / 100 : ''}
          onChange={event => onChange(Math.round(Number(event.target.value) * 100))}
          className={`${fieldStyle} pr-7`} />
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-3 text-xs text-[#537064]">m</span>
      </div>
    </label>
  );
}

function layoutProblem(draft: CourtFloorDraft, unitCount: number) {
  if ([draft.widthCm, draft.lengthCm].some(value => value < 100 || value > 50_000)) {
    return 'Chiều rộng và chiều dài mặt bằng phải trong khoảng 1–500 m.';
  }
  if (draft.placements.length !== unitCount) return 'Hãy bố trí tất cả sân vật lý trước khi lưu.';
  const names = new Set<string>();
  for (const [index, court] of draft.placements.entries()) {
    const label = court.label.trim();
    if (!label) return 'Hãy nhập tên hiển thị cho mỗi sân.';
    const name = label.toLocaleLowerCase('vi');
    if (names.has(name)) return 'Tên hiển thị phải khác nhau trong cùng một cụm sân.';
    names.add(name);
    if (court.widthCm < 25 || court.lengthCm < 25) return `${label} cần rộng và dài tối thiểu 0,25 m.`;
    if (court.xCm < 0 || court.yCm < 0 || court.xCm + court.widthCm > draft.widthCm || court.yCm + court.lengthCm > draft.lengthCm) {
      return `${label} nằm ngoài mặt bằng.`;
    }
    for (const other of draft.placements.slice(0, index)) {
      if (court.xCm < other.xCm + other.widthCm && other.xCm < court.xCm + court.widthCm
          && court.yCm < other.yCm + other.lengthCm && other.yCm < court.yCm + court.lengthCm) {
        return `${label} đang chồng lên ${other.label}.`;
      }
    }
  }
  return null;
}

interface CourtFloorEditorProps {
  tenantId: string;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CourtFloorEditor({ tenantId, groupId, groupName, onClose, onSaved }: CourtFloorEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [units, setUnits] = useState<CourtFloorUnit[]>([]);
  const [draft, setDraft] = useState<CourtFloorDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [columns, setColumns] = useState(1);
  const [request, setRequest] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setDraft(null);
    void marketplaceApi.getCourtFloor(tenantId, groupId, controller.signal).then(({ layout, units }) => {
      if (controller.signal.aborted) return;
      const active = new Set(units.map(unit => unit.id));
      setUnits(units);
      setSelectedId(units[0]?.id ?? null);
      setColumns(suggestedColumns(units.length));
      setDraft(layout ? { ...layout, placements: layout.placements.filter(court => active.has(court.unitId)) } : suggestedFloor(units));
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được sơ đồ.');
    });
    return () => controller.abort();
  }, [tenantId, groupId, request]);

  const selected = draft?.placements.find(item => item.unitId === selectedId);
  const selectedUnit = units.find(unit => unit.id === selectedId);
  const issue = draft ? layoutProblem(draft, units.length) : null;
  const validSurface = draft && draft.widthCm >= 100 && draft.lengthCm >= 100 && draft.widthCm <= 50_000 && draft.lengthCm <= 50_000;

  const editPlacement = (id: string, change: Partial<CourtFloorPlacement>) => {
    if (saving) return;
    setDraft(current => current && ({ ...current, placements: current.placements.map(court => court.unitId === id ? { ...court, ...change } : court) }));
  };

  const arrange = () => {
    if (!draft || !validSurface) return;
    const existingNames = new Map(draft.placements.map(court => [court.unitId, court.label]));
    const placements = arrangeCourts(units, draft.widthCm, draft.lengthCm, columns)
      .map(court => ({ ...court, label: existingNames.get(court.unitId) ?? court.label }));
    setDraft({ ...draft, placements });
  };

  const addPlacement = () => {
    if (!draft || !selectedUnit || selected) return;
    const court = { unitId: selectedUnit.id, label: courtDisplayName(selectedUnit.unitNumber), xCm: 0, yCm: 0,
      widthCm: Math.min(700, draft.widthCm), lengthCm: Math.min(1300, draft.lengthCm) };
    setDraft({ ...draft, placements: [...draft.placements, court] });
  };

  const save = async () => {
    if (!draft || issue || saving || units.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await marketplaceApi.saveCourtFloor(tenantId, groupId, {
        widthCm: draft.widthCm, lengthCm: draft.lengthCm, version: draft.version, placements: draft.placements,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được sơ đồ.');
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="court-floor-editor-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[1130px] overflow-auto rounded-[24px] border border-[#D7E4DB] bg-white text-[#163D2D] shadow-2xl backdrop:bg-[#0C211B]/65 sm:max-h-[calc(100dvh-3rem)]">
      <header className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-[#E0E9E2] bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E3F0E7]"><PencilRuler aria-hidden="true" size={19} /></span>
          <div>
            <h2 id="court-floor-editor-title" className="text-lg font-bold tracking-tight sm:text-xl">Thiết lập sơ đồ sân</h2>
            <p className="text-xs text-[#537064]">{groupName}</p>
          </div>
        </div>
        <button type="button" aria-label="Đóng thiết lập" onClick={onClose} disabled={saving} className={`${actionStyle} px-2.5`}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">{error}</p>}
        {!draft && !error && <p role="status" className="py-5 text-sm">Đang tải mặt bằng và các sân vật lý…</p>}
        {draft && units.length === 0 && <p className="py-5 text-sm">Cụm sân chưa có sân vật lý để bố trí.</p>}
        {draft && units.length > 0 && (
          <fieldset disabled={saving} className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-3">
              {validSurface ? <CourtFloorCanvas draft={draft} selectedId={selectedId} onSelect={setSelectedId}
                onMove={(id, xCm, yCm) => editPlacement(id, { xCm, yCm })} /> : (
                <p className="rounded-xl border border-[#DAE5DD] bg-[#F4F8F5] p-5 text-sm">Nhập kích thước hợp lệ để xem mặt bằng.</p>
              )}
              <p className="text-xs text-[#537064]">Kéo sân trên sơ đồ hoặc nhập tọa độ. Góc trên bên trái là điểm 0 m.</p>
            </div>
            <div className="space-y-4">
              <section aria-label="Kích thước mặt bằng" className="space-y-3 rounded-2xl border border-[#DAE5DD] p-4">
                <h3 className="text-sm font-bold">Kích thước mặt bằng</h3>
                <div className="grid grid-cols-2 gap-2">
                  <MeterField label="Rộng mặt bằng" cm={draft.widthCm} min={1} onChange={widthCm => setDraft({ ...draft, widthCm })} />
                  <MeterField label="Dài mặt bằng" cm={draft.lengthCm} min={1} onChange={lengthCm => setDraft({ ...draft, lengthCm })} />
                </div>
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1.5">
                    <span className="block text-xs font-semibold text-[#40564A]">Số cột</span>
                    <select value={columns} onChange={event => setColumns(Number(event.target.value))} className={fieldStyle}>
                      {Array.from({ length: units.length }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={arrange} disabled={!validSurface} className={actionStyle}><Grid2X2 aria-hidden="true" size={15} /> Chia đều</button>
                </div>
              </section>
              <section aria-label="Chi tiết sân con" className="space-y-3 rounded-2xl border border-[#DAE5DD] p-4">
                <h3 className="text-sm font-bold">Sân con <span className="ml-1 text-xs font-medium text-[#537064]">{draft.placements.length}/{units.length}</span></h3>
                <label className="block space-y-1.5">
                  <span className="block text-xs font-semibold text-[#40564A]">Chọn sân để chỉnh</span>
                  <select value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value)} className={fieldStyle}>
                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
                  </select>
                </label>
                {selected ? (
                  <>
                    <label className="block space-y-1.5">
                      <span className="block text-xs font-semibold text-[#40564A]">Tên trên sơ đồ</span>
                      <input value={selected.label} maxLength={48} className={fieldStyle}
                        onChange={event => editPlacement(selected.unitId, { label: event.target.value })} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <MeterField label="Cách mép trái" cm={selected.xCm} onChange={xCm => editPlacement(selected.unitId, { xCm })} />
                      <MeterField label="Cách mép trên" cm={selected.yCm} onChange={yCm => editPlacement(selected.unitId, { yCm })} />
                      <MeterField label="Rộng sân" cm={selected.widthCm} min={0.25} onChange={widthCm => editPlacement(selected.unitId, { widthCm })} />
                      <MeterField label="Dài sân" cm={selected.lengthCm} min={0.25} onChange={lengthCm => editPlacement(selected.unitId, { lengthCm })} />
                    </div>
                  </>
                ) : <button type="button" onClick={addPlacement} className={actionStyle}>Đặt sân lên mặt bằng</button>}
              </section>
            </div>
          </fieldset>
        )}
      </div>
      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t border-[#E0E9E2] bg-white px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 text-xs text-[#626048]">{issue ?? (draft?.version ? `Bản đã lưu #${draft.version}` : '')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setRequest(current => current + 1)} disabled={saving || (!draft && !error)} className={actionStyle}>
            <RotateCcw aria-hidden="true" size={14} /> Tải lại
          </button>
          <button type="button" onClick={save} disabled={saving || !draft || Boolean(issue) || !units.length}
            className="min-h-10 rounded-xl bg-[#16422C] px-4 text-xs font-bold text-white hover:bg-[#23563C] disabled:opacity-50">
            {saving ? 'Đang lưu…' : 'Lưu sơ đồ'}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
