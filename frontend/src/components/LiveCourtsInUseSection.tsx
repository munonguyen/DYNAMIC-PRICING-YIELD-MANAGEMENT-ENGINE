import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  MapPin,
  Navigation,
  Package,
  QrCode,
  Search,
  Unlock,
  User,
} from 'lucide-react';
import type {
  CheckinVerificationMode,
  LessorBookingOrder,
  PublishedListing,
} from '../types/marketplace';
import { formatVnd } from '../api/marketplaceApi';
import { resolveCourtThumbnail } from '../data/courtServicesData';
import { PillSelect } from './FairwayControls';

type UnitOccupancyStatus = 'IN_USE' | 'RESERVED' | 'WALKIN_LOCKED' | 'AVAILABLE';

interface CourtUnitSlotState {
  unitNumber: string;
  unitIndex: number;
  zoneLabel: string;
  listing: PublishedListing;
  status: UnitOccupancyStatus;
  order: LessorBookingOrder | null;
}

interface LiveCourtsInUseSectionProps {
  listings: PublishedListing[];
  providerOrders: LessorBookingOrder[];
  walkInLocksByUnit: Record<string, string>;
  onToggleWalkInLock: (groupId: string, unitNumber: string, groupName: string) => void;
  onOpenOrderDetail: (orderId: string) => void;
  onStartCheckIn: (order: LessorBookingOrder, mode: CheckinVerificationMode) => void;
  onCompleteActiveOrder: (orderId: string) => void;
}

const WALKIN_LOCATIONS_DEFAULT_BAY_COUNT = 6;

function normalizeUnitNumber(rawUnit: string | undefined, fallbackIndex: number): string {
  const match = (rawUnit ?? '').match(/(\d+)/);
  if (match) {
    return `Sân ${match[1].padStart(2, '0')}`;
  }
  return `Sân ${String(fallbackIndex).padStart(2, '0')}`;
}

function buildZoneLocationLabel(unitIndex: number, totalUnits: number, sportCode: string): string {
  const half = Math.max(1, Math.ceil(totalUnits / 2));
  const wing = unitIndex <= half ? 'Khu A (Gần quầy lễ tân)' : 'Khu B (Khu vực phía trong)';
  const row = Math.ceil(unitIndex / 2);
  const surfaceTag =
    sportCode === 'BADMINTON'
      ? 'Thảm BWF'
      : sportCode === 'FOOTBALL'
        ? 'Sân cỏ nhân tạo'
        : sportCode === 'TENNIS'
          ? 'Mặt sân cứng'
          : sportCode === 'BASKETBALL'
            ? 'Sân gỗ FIBA'
            : 'Mặt sân chuẩn thi đấu';
  return `${wing} • Dãy ${row} • ${surfaceTag}`;
}

export const LiveCourtsInUseSection: React.FC<LiveCourtsInUseSectionProps> = ({
  listings,
  providerOrders,
  walkInLocksByUnit,
  onToggleWalkInLock,
  onOpenOrderDetail,
  onStartCheckIn,
  onCompleteActiveOrder,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'OCCUPIED' | 'ALL' | UnitOccupancyStatus>('OCCUPIED');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { allUnits, inUseCount, reservedCount, walkInCount, availableCount } = useMemo(() => {
    const units: CourtUnitSlotState[] = [];

    for (const listing of listings) {
      const totalUnits = Math.max(
        1,
        Math.min(20, listing.upcomingSlots[0]?.totalCapacity ?? WALKIN_LOCATIONS_DEFAULT_BAY_COUNT)
      );
      const ordersForGroup = providerOrders.filter(
        (o) =>
          (o.groupId === listing.groupId || o.groupName === listing.groupName) &&
          (o.status === 'COMPLETED' || o.status === 'CONFIRMED')
      );

      // Priority order: COMPLETED (actively playing now) overrides CONFIRMED on the same unit
      const orderByUnit = new Map<string, LessorBookingOrder>();
      for (const ord of ordersForGroup) {
        const key = normalizeUnitNumber(ord.unitNumber, 1);
        const existing = orderByUnit.get(key);
        if (!existing || (existing.status !== 'COMPLETED' && ord.status === 'COMPLETED')) {
          orderByUnit.set(key, ord);
        }
      }

      for (let i = 1; i <= totalUnits; i++) {
        const unitNumber = `Sân ${String(i).padStart(2, '0')}`;
        const lockKey = `${listing.groupId}__${unitNumber}`;
        const matchedOrder = orderByUnit.get(unitNumber) ?? null;

        let status: UnitOccupancyStatus = 'AVAILABLE';
        if (matchedOrder?.status === 'COMPLETED') {
          status = 'IN_USE';
        } else if (matchedOrder?.status === 'CONFIRMED') {
          status = 'RESERVED';
        } else if (walkInLocksByUnit[lockKey]) {
          status = 'WALKIN_LOCKED';
        }

        units.push({
          unitNumber,
          unitIndex: i,
          zoneLabel: buildZoneLocationLabel(i, totalUnits, listing.sportCode),
          listing,
          status,
          order: matchedOrder,
        });
      }
    }

    return {
      allUnits: units,
      inUseCount: units.filter((u) => u.status === 'IN_USE').length,
      reservedCount: units.filter((u) => u.status === 'RESERVED').length,
      walkInCount: units.filter((u) => u.status === 'WALKIN_LOCKED').length,
      availableCount: units.filter((u) => u.status === 'AVAILABLE').length,
    };
  }, [listings, providerOrders, walkInLocksByUnit]);

  const occupiedUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUnits.filter((u) => {
      if (groupFilter !== 'ALL' && u.listing.groupId !== groupFilter) return false;
      if (statusFilter === 'OCCUPIED') {
        if (u.status === 'AVAILABLE') return false;
      } else if (statusFilter !== 'ALL' && u.status !== statusFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          u.unitNumber,
          u.zoneLabel,
          u.listing.groupName,
          u.listing.venueAddress,
          u.order?.customerName ?? '',
          u.order?.orderId ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allUnits, groupFilter, statusFilter, searchQuery]);

  const scopedListings = useMemo(
    () =>
      groupFilter === 'ALL'
        ? listings
        : listings.filter((l) => l.groupId === groupFilter),
    [listings, groupFilter]
  );

  return (
    <div className="space-y-6">
      {/* TOP SUMMARY & CONTROLS */}
      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7D4] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#16422C]">
              <Navigation className="h-3 w-3" />
              Giám sát Mặt bằng &amp; Vị trí Sân
            </span>
            <h3 className="mt-1.5 text-xl font-bold text-[#0F172A]">
              Danh sách Sân Đang Sử Dụng &amp; Sơ đồ Vị trí Sân
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Xem chính xác vị trí từng ô sân đang có khách chơi, khách sắp nhận sân hoặc khóa nhanh sân cho khách vãng lai tại quầy.
            </p>
          </div>
        </div>

        {/* 4 Clickable Status Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              id: 'IN_USE' as const,
              label: 'Đang có khách chơi',
              count: inUseCount,
              tone: 'border-[#16422C]/30 bg-[#F4F8F4] text-[#16422C]',
            },
            {
              id: 'RESERVED' as const,
              label: 'Sắp vào ca (Chờ nhận)',
              count: reservedCount,
              tone: 'border-amber-200 bg-amber-50/70 text-amber-900',
            },
            {
              id: 'WALKIN_LOCKED' as const,
              label: 'Khách vãng lai tại quầy',
              count: walkInCount,
              tone: 'border-[#0E4F7E]/25 bg-[#E6F1F8]/70 text-[#0E4F7E]',
            },
            {
              id: 'AVAILABLE' as const,
              label: 'Ô sân đang trống',
              count: availableCount,
              tone: 'border-neutral-200 bg-[#F8FAFC] text-[#0F172A]',
            },
          ].map((stat) => {
            const active = statusFilter === stat.id;
            return (
              <button
                key={stat.id}
                type="button"
                onClick={() =>
                  setStatusFilter((prev) => (prev === stat.id ? 'OCCUPIED' : stat.id))
                }
                className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${stat.tone} ${
                  active ? 'ring-2 ring-[#16422C]/40' : 'hover:shadow-2xs'
                }`}
              >
                <div className="text-[11px] font-semibold opacity-80">{stat.label}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{stat.count} sân</div>
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 gap-2.5 border-t border-neutral-100 pt-4 md:grid-cols-12">
          <div className="md:col-span-5 relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm số sân (Sân 01), khu vực, địa chỉ hoặc tên khách..."
              className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] py-2 pl-8 pr-3.5 text-xs text-[#0F172A] focus:border-[#16422C] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <PillSelect
              variant="soft"
              ariaLabel="Chọn cụm sân"
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { value: 'ALL', label: `Tất cả cụm sân (${listings.length})` },
                ...listings.map((l) => ({ value: l.groupId, label: l.groupName })),
              ]}
            />
          </div>

          <div className="md:col-span-3">
            <PillSelect
              variant="soft"
              ariaLabel="Lọc trạng thái sân"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                {
                  value: 'OCCUPIED',
                  label: `Đang sử dụng (${inUseCount + reservedCount + walkInCount})`,
                },
                { value: 'ALL', label: `Tất cả ô sân (${allUnits.length})` },
                { value: 'IN_USE', label: `Đang chơi (${inUseCount})` },
                { value: 'RESERVED', label: `Chờ nhận sân (${reservedCount})` },
                { value: 'WALKIN_LOCKED', label: `Vãng lai (${walkInCount})` },
                { value: 'AVAILABLE', label: `Đang trống (${availableCount})` },
              ]}
            />
          </div>
        </div>
      </div>

      {/* SECTION 1: DEDICATED LIST OF COURTS IN USE WITH EXACT LOCATION */}
      <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-6 py-4">
          <div>
            <h4 className="text-base font-bold text-[#0F172A]">
              Danh sách Sân Đang Hoạt Động ({occupiedUnits.length} vị trí sân)
            </h4>
            <p className="text-xs text-neutral-500">
              Hiển thị rõ vị trí từng ô sân theo địa chỉ cơ sở, khu/dãy sân và khách đang sử dụng.
            </p>
          </div>
        </div>

        {occupiedUnits.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            Không có ô sân nào khớp với điều kiện lọc hiện tại.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {occupiedUnits.map((unit) => {
              const ord = unit.order;
              const thumbUrl = resolveCourtThumbnail(
                unit.listing.imageUrl,
                unit.listing.sportName
              );
              const mode: CheckinVerificationMode =
                unit.listing.checkinMode ?? ord?.checkinMode ?? 'QR_STAFF';
              const usesPin = mode === 'PIN_COUNTER' || mode === 'MANUAL';

              return (
                <div
                  key={`${unit.listing.groupId}__${unit.unitNumber}`}
                  className="p-4 sm:px-6 sm:py-4 transition hover:bg-[#F8FAFC]"
                >
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                    {/* COL 1 (6/12): IMAGE + EXACT COURT LOCATION */}
                    <div className="lg:col-span-6 flex items-start gap-3.5 min-w-0">
                      <div className="relative h-16 w-20 sm:h-[74px] sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                        <img
                          src={thumbUrl}
                          alt={unit.listing.groupName}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded-md bg-[#0F172A]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unit.unitNumber}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-lg bg-[#0F172A] px-2 py-0.5 text-[11px] font-bold text-white">
                            {unit.unitNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                              unit.status === 'IN_USE'
                                ? 'bg-[#E7F7D4] text-[#16422C]'
                                : unit.status === 'RESERVED'
                                  ? 'bg-amber-100 text-amber-900'
                                  : unit.status === 'WALKIN_LOCKED'
                                    ? 'bg-[#E6F1F8] text-[#0E4F7E]'
                                    : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                unit.status === 'IN_USE'
                                  ? 'bg-[#16422C] animate-pulse'
                                  : unit.status === 'RESERVED'
                                    ? 'bg-amber-600'
                                    : unit.status === 'WALKIN_LOCKED'
                                      ? 'bg-[#0E4F7E]'
                                      : 'bg-neutral-400'
                              }`}
                            />
                            {unit.status === 'IN_USE'
                              ? 'Đang có khách chơi'
                              : unit.status === 'RESERVED'
                                ? 'Đã đặt • Sắp vào sân'
                                : unit.status === 'WALKIN_LOCKED'
                                  ? 'Khách vãng lai tại quầy'
                                  : 'Đang trống'}
                          </span>
                          <span className="text-[11px] font-medium text-neutral-500">
                            {unit.listing.sportName}
                          </span>
                        </div>

                        <div className="truncate text-sm font-bold text-[#0F172A]">
                          {unit.listing.groupName}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-neutral-600">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#16422C]">
                            <Navigation className="h-3 w-3 shrink-0" />
                            {unit.zoneLabel}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                          <MapPin className="h-3 w-3 shrink-0 text-neutral-400" />
                          <span>
                            {unit.listing.venueAddress} ({unit.listing.district}, {unit.listing.city})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* COL 2 (3/12): ACTIVE CUSTOMER & SERVICES */}
                    <div className="lg:col-span-3 min-w-0 space-y-1 text-xs">
                      {ord ? (
                        <>
                          <div className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A]">
                            <User className="h-3.5 w-3.5 text-[#16422C]" />
                            <span className="truncate">{ord.customerName}</span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
                            <Clock className="h-3 w-3 text-neutral-400" />
                            <span>
                              {ord.orderId} • {ord.slotLabel}
                            </span>
                          </div>
                          {ord.addOnSummary && (
                            <div className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#E7F7D4]/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#16422C]">
                              <Package className="h-3 w-3 shrink-0" />
                              <span className="truncate">{ord.addOnSummary}</span>
                            </div>
                          )}
                        </>
                      ) : unit.status === 'WALKIN_LOCKED' ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#0E4F7E]">Khách chơi trực tiếp tại quầy</div>
                          <div className="text-[11px] text-neutral-500">
                            Đánh dấu khóa lúc {walkInLocksByUnit[`${unit.listing.groupId}__${unit.unitNumber}`]}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-500">Sẵn sàng đón khách đặt ca mới</span>
                      )}
                    </div>

                    {/* COL 3 (3/12): ACTIONS */}
                    <div className="lg:col-span-3 flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      {ord ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenOrderDetail(ord.orderId)}
                            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#16422C] hover:text-[#16422C] cursor-pointer"
                          >
                            Chi tiết đơn
                          </button>

                          {unit.status === 'RESERVED' ? (
                            <button
                              type="button"
                              onClick={() => onStartCheckIn(ord, mode)}
                              className="inline-flex items-center gap-1 rounded-full bg-[#16422C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0F172A] cursor-pointer"
                            >
                              {usesPin ? (
                                <>
                                  <KeyRound className="h-3.5 w-3.5" /> Nhập PIN
                                </>
                              ) : (
                                <>
                                  <QrCode className="h-3.5 w-3.5" /> Quét QR
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCompleteActiveOrder(ord.orderId)}
                              className="inline-flex items-center gap-1 rounded-full border border-[#16422C]/25 bg-[#F4F8F4] px-3 py-1.5 text-xs font-semibold text-[#16422C] hover:bg-[#E7F7D4] cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Thu {formatVnd(ord.remainingAtVenue)}
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleWalkInLock(
                              unit.listing.groupId,
                              unit.unitNumber,
                              unit.listing.groupName
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            unit.status === 'WALKIN_LOCKED'
                              ? 'border border-[#0E4F7E]/30 bg-[#E6F1F8] text-[#0E4F7E] hover:bg-white'
                              : 'border border-neutral-200 bg-white text-[#0F172A] hover:border-[#16422C]'
                          }`}
                        >
                          {unit.status === 'WALKIN_LOCKED' ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" /> Mở trống sân
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" /> Khóa khách lẻ
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: VISUAL COURT FLOOR PLAN BY LOCATION */}
      <div className="space-y-4">
        {scopedListings.map((listing) => {
          const groupUnits = allUnits.filter((u) => u.listing.groupId === listing.groupId);
          const groupBusy = groupUnits.filter((u) => u.status !== 'AVAILABLE').length;

          return (
            <div
              key={listing.groupId}
              className="rounded-[26px] border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3.5">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#F4F8F4] px-2.5 py-0.5 text-[11px] font-bold text-[#16422C]">
                      {listing.sportName}
                    </span>
                    <span className="text-xs font-semibold text-neutral-600 tabular-nums">
                      Đang hoạt động: {groupBusy}/{groupUnits.length} ô sân
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#0F172A]">{listing.groupName}</h4>
                  <p className="inline-flex items-center gap-1 text-xs text-neutral-500">
                    <MapPin className="h-3.5 w-3.5 text-[#16422C]" />
                    <span>
                      Vị trí cơ sở: {listing.venueAddress} • {listing.district}, {listing.city}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#16422C]" /> Đang chơi
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Chờ nhận
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0E4F7E]" /> Khách lẻ
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full border border-neutral-300 bg-white" /> Trống
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {groupUnits.map((u) => {
                  const cardTone =
                    u.status === 'IN_USE'
                      ? 'border-[#16422C]/40 bg-[#F4F8F4] hover:border-[#16422C]'
                      : u.status === 'RESERVED'
                        ? 'border-amber-300 bg-amber-50/70 hover:border-amber-500'
                        : u.status === 'WALKIN_LOCKED'
                          ? 'border-[#0E4F7E]/35 bg-[#E6F1F8]/70 hover:border-[#0E4F7E]'
                          : 'border-dashed border-neutral-300 bg-[#F8FAFC] hover:border-[#16422C] hover:bg-white';

                  return (
                    <button
                      key={u.unitNumber}
                      type="button"
                      onClick={() => {
                        if (u.order) {
                          onOpenOrderDetail(u.order.orderId);
                        } else {
                          onToggleWalkInLock(
                            u.listing.groupId,
                            u.unitNumber,
                            u.listing.groupName
                          );
                        }
                      }}
                      className={`rounded-2xl border p-3 text-left transition cursor-pointer space-y-1.5 ${cardTone}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#0F172A]">{u.unitNumber}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            u.status === 'IN_USE'
                              ? 'bg-[#16422C]'
                              : u.status === 'RESERVED'
                                ? 'bg-amber-500'
                                : u.status === 'WALKIN_LOCKED'
                                  ? 'bg-[#0E4F7E]'
                                  : 'bg-neutral-300'
                          }`}
                        />
                      </div>
                      <div className="text-[10.5px] font-medium text-neutral-500 line-clamp-1">
                        {u.zoneLabel.split('•')[0]?.trim()}
                      </div>
                      {u.order ? (
                        <>
                          <div className="truncate text-[11px] font-bold text-[#0F172A]">
                            {u.order.customerName}
                          </div>
                          <div className="text-[10.5px] text-neutral-600 truncate">
                            {u.order.slotLabel}
                          </div>
                        </>
                      ) : u.status === 'WALKIN_LOCKED' ? (
                        <div className="text-[11px] font-semibold text-[#0E4F7E]">
                          Đang có khách lẻ (Bấm để mở)
                        </div>
                      ) : (
                        <div className="text-[11px] font-medium text-neutral-500">
                          Đang trống • Bấm giữ sân
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

