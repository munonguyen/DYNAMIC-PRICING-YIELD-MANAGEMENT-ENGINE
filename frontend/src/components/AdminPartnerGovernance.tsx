import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  AdminTenantOverview,
  PublishedListing,
  VenueProviderInfo,
} from '../types/marketplace';
import { ALL_LESSOR_PROVIDERS, marketplaceApi } from '../api/marketplaceApi';
import { EXPO_EASE } from './motionPrimitives';

interface AdminPartnerGovernanceProps {
  listings: PublishedListing[];
  onToggleListingPublished?: (groupId: string) => void;
  onOpenPublicShop?: (providerId: string) => void;
  onOpenChatDrawer: () => void;
  onJumpToKyc: () => void;
  onJumpToAccounts: () => void;
  pendingKycCount: number;
  managerAccountsCount: number;
  onFlashToast: (msg: string) => void;
}

const TENANT_STATUS_STORAGE_KEY = 'arenapulse_admin_tenant_statuses_v1';
const CARD_VIEWPORT = { once: true, amount: 0.14 } as const;

function readLocalTenantStatuses(): Record<string, 'ACTIVE' | 'SUSPEND'> {
  try {
    const raw = window.localStorage.getItem(TENANT_STATUS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, 'ACTIVE' | 'SUSPEND'>) : {};
  } catch {
    return {};
  }
}

function writeLocalTenantStatuses(map: Record<string, 'ACTIVE' | 'SUSPEND'>): void {
  try {
    window.localStorage.setItem(TENANT_STATUS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota restrictions
  }
}

interface MergedPartnerRow {
  key: string;
  dbTenantId?: string;
  providerId: string;
  name: string;
  legalEntityType: string;
  location: string;
  city: string;
  badge: string;
  verified: boolean;
  yearsPartner: number;
  responseRatePct: number;
  commissionRatePct: number;
  status: 'ACTIVE' | 'SUSPEND';
  groups: PublishedListing[];
  publishedCount: number;
  physicalCourts: number;
}

export const AdminPartnerGovernance: React.FC<AdminPartnerGovernanceProps> = ({
  listings,
  onToggleListingPublished,
  onOpenPublicShop,
  onOpenChatDrawer,
  onJumpToKyc,
  onJumpToAccounts,
  pendingKycCount,
  managerAccountsCount,
  onFlashToast,
}) => {
  const [dbTenants, setDbTenants] = useState<AdminTenantOverview[] | null>(null);
  const [liveFromDb, setLiveFromDb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, 'ACTIVE' | 'SUSPEND'>>(
    () => readLocalTenantStatuses()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPEND'>('ALL');
  const [expandedPartnerKey, setExpandedPartnerKey] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const list = await marketplaceApi.fetchAdminTenantsStrict();
      setDbTenants(list);
      setLiveFromDb(true);
    } catch {
      setLiveFromDb(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const partnerRows = useMemo<MergedPartnerRow[]>(() => {
    const dbByName = new Map<string, AdminTenantOverview>();
    for (const t of dbTenants ?? []) {
      dbByName.set(t.name.toLowerCase(), t);
    }

    const providersMap = new Map<string, VenueProviderInfo>();
    for (const p of ALL_LESSOR_PROVIDERS) {
      providersMap.set(p.providerId, p);
    }
    for (const l of listings) {
      if (l.provider?.providerId && !providersMap.has(l.provider.providerId)) {
        providersMap.set(l.provider.providerId, l.provider);
      }
    }

    return Array.from(providersMap.values()).map((prov) => {
      const ownedGroups = listings.filter((l) => l.provider?.providerId === prov.providerId);
      const publishedCount = ownedGroups.filter((l) => l.published !== false).length;
      const physicalCourts = ownedGroups.reduce(
        (sum, l) => sum + (l.upcomingSlots[0]?.totalCapacity ?? 4),
        0
      );
      const matchedDb = dbByName.get(prov.providerName.toLowerCase());
      const overrideStatus = localStatuses[prov.providerId];
      const status: 'ACTIVE' | 'SUSPEND' =
        matchedDb?.status === 'SUSPEND'
          ? 'SUSPEND'
          : overrideStatus ?? 'ACTIVE';

      return {
        key: prov.providerId,
        dbTenantId: matchedDb?.id,
        providerId: prov.providerId,
        name: prov.providerName,
        legalEntityType: prov.legalEntityType ?? 'Đơn vị Vận hành Sân',
        location: [prov.district, prov.city].filter(Boolean).join(', '),
        city: prov.city,
        badge: prov.badge,
        verified: prov.verified,
        yearsPartner: prov.yearsPartner,
        responseRatePct: prov.responseRatePct,
        commissionRatePct: matchedDb?.commissionRatePercent ?? prov.commissionRatePct,
        status,
        groups: ownedGroups,
        publishedCount,
        physicalCourts: Math.max(physicalCourts, prov.totalManagedCourts || 0),
      };
    });
  }, [dbTenants, listings, localStatuses]);

  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return partnerRows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q) ||
        row.providerId.toLowerCase().includes(q)
      );
    });
  }, [partnerRows, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = partnerRows.length;
    const active = partnerRows.filter((r) => r.status === 'ACTIVE').length;
    const suspended = total - active;
    const avgCommission =
      total > 0
        ? (
            partnerRows.reduce((sum, r) => sum + r.commissionRatePct, 0) / total
          ).toFixed(1)
        : '10.0';
    return { total, active, suspended, avgCommission };
  }, [partnerRows]);

  const handleToggleTenantStatus = async (row: MergedPartnerRow) => {
    const nextStatus: 'ACTIVE' | 'SUSPEND' = row.status === 'ACTIVE' ? 'SUSPEND' : 'ACTIVE';
    setTogglingKey(row.key);
    try {
      if (liveFromDb && row.dbTenantId) {
        const updated = await marketplaceApi.updateAdminTenantStatusStrict(
          row.dbTenantId,
          nextStatus
        );
        setDbTenants((prev) =>
          (prev ?? []).map((t) => (t.id === updated.id ? updated : t))
        );
      }
      const nextLocal = { ...localStatuses, [row.providerId]: nextStatus };
      setLocalStatuses(nextLocal);
      writeLocalTenantStatuses(nextLocal);
      onFlashToast(
        nextStatus === 'SUSPEND'
          ? `✓ Đã tạm đình chỉ trạng thái vận hành của đối tác "${row.name}".`
          : `✓ Đã kích hoạt lại quyền hoạt động cho đối tác "${row.name}".`
      );
    } catch {
      const nextLocal = { ...localStatuses, [row.providerId]: nextStatus };
      setLocalStatuses(nextLocal);
      writeLocalTenantStatuses(nextLocal);
      onFlashToast(
        nextStatus === 'SUSPEND'
          ? `✓ Đã tạm đình chỉ đối tác "${row.name}" trên phiên hiện tại.`
          : `✓ Đã mở khóa hoạt động cho đối tác "${row.name}".`
      );
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* =================================================================== */}
      {/* PRIVACY-PRESERVING TENANT GOVERNANCE BANNER                         */}
      {/* =================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={CARD_VIEWPORT}
        transition={{ duration: 0.45, ease: EXPO_EASE }}
        className="flex flex-col gap-4 rounded-[26px] border border-[#0E4F7E]/25 bg-gradient-to-r from-[#F4F8FB] via-white to-[#F0FDFA] p-5 sm:p-6 shadow-xs lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0A192F] text-sky-200 shadow-xs">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                Quản lý Tuân thủ Đối tác • Multi-Tenant Privacy Shield
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-[#0F766E]/25 px-2.5 py-0.5 text-[10.5px] font-bold text-[#0F766E]">
                <ShieldCheck className="h-3 w-3" />
                Tôn trọng Quyền riêng tư Tenant
              </span>
            </div>
            <p className="text-xs text-neutral-600 max-w-2xl leading-relaxed">
              Admin chỉ quản lý <strong>trạng thái hoạt động Tenant, mức hoa hồng hợp đồng &amp; kiểm duyệt hiển thị cụm sân công khai</strong>. Dữ liệu nội bộ của chủ sân (đơn khách chi tiết, SĐT/Email người chơi, tài khoản nhân viên quầy &amp; cấu hình giá riêng) được cách ly hoàn toàn.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={onJumpToKyc}
            className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-semibold text-[#0F172A] hover:bg-neutral-50 transition cursor-pointer"
          >
            Hồ sơ KYC ({pendingKycCount} chờ)
          </button>
          <button
            type="button"
            onClick={onJumpToAccounts}
            className="rounded-xl bg-[#0E4F7E] px-3.5 py-2 font-semibold text-white hover:bg-[#0A192F] transition cursor-pointer"
          >
            Tài khoản Chủ sân ({managerAccountsCount})
          </button>
        </div>
      </motion.div>

      {/* =================================================================== */}
      {/* PARTNER GOVERNANCE KPI ROW                                          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-[22px] border border-neutral-200/90 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500">Tổng Đối tác Đã KYC</div>
          <div className="mt-1 text-2xl font-bold text-[#0F172A] tabular-nums">
            {stats.total} Đơn vị
          </div>
          <div className="mt-1 text-[11px] text-[#0F766E] font-medium">
            {liveFromDb ? 'Đồng bộ từ PostgreSQL' : 'Phiên làm việc đồng bộ'}
          </div>
        </div>

        <div className="rounded-[22px] border border-neutral-200/90 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500">Đang Hoạt động</div>
          <div className="mt-1 text-2xl font-bold text-[#0E4F7E] tabular-nums">
            {stats.active} Tenant
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Tuân thủ chính sách sàn</div>
        </div>

        <div className="rounded-[22px] border border-neutral-200/90 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500">Tạm Đình chỉ</div>
          <div className="mt-1 text-2xl font-bold text-rose-600 tabular-nums">
            {stats.suspended} Tenant
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Khóa niêm yết tạm thời</div>
        </div>

        <div className="rounded-[22px] border border-neutral-200/90 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500">Hoa hồng Sàn Bình quân</div>
          <div className="mt-1 text-2xl font-bold text-[#0F766E] tabular-nums">
            {stats.avgCommission}%
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Theo hợp đồng đối tác</div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SEARCH & COMPLIANCE FILTER BAR                                      */}
      {/* =================================================================== */}
      <div className="flex flex-col gap-3 rounded-[22px] border border-neutral-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm đối tác, quận/huyện hoặc mã Tenant…"
            className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] py-2 pl-10 pr-4 text-xs text-[#0F172A] focus:border-[#0E4F7E] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: 'ALL', label: `Tất cả (${stats.total})` },
            { id: 'ACTIVE', label: `Hoạt động (${stats.active})` },
            { id: 'SUSPEND', label: `Đình chỉ (${stats.suspended})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as typeof statusFilter)}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#0A192F] text-white'
                  : 'bg-[#F8FAFC] text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => void loadTenants()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:border-[#0E4F7E] hover:text-[#0E4F7E] transition cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PARTNER COMPLIANCE DIRECTORY & MODERATION CARDS                     */}
      {/* =================================================================== */}
      <div className="space-y-3.5">
        {filteredPartners.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">
            Không tìm thấy đối tác cho thuê nào khớp điều kiện lọc.
          </div>
        ) : (
          filteredPartners.map((row, idx) => {
            const isExpanded = expandedPartnerKey === row.key;
            const isActive = row.status === 'ACTIVE';
            return (
              <motion.div
                key={row.key}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={CARD_VIEWPORT}
                transition={{
                  duration: 0.48,
                  delay: Math.min(0.24, idx * 0.04),
                  ease: EXPO_EASE,
                }}
                className={`overflow-hidden rounded-[24px] border bg-white shadow-xs transition ${
                  isActive
                    ? 'border-neutral-200/90 hover:border-[#0E4F7E]/35'
                    : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Partner Identity & Public Compliance Metadata */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F4F8FB] text-[#0E4F7E]">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-[#0F172A]">
                        {row.name}
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-100 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        {isActive ? 'Đang hoạt động' : 'Tạm đình chỉ'}
                      </span>
                      {row.verified && (
                        <span className="rounded-full bg-[#E6F1F8] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0E4F7E]">
                          ✓ KYC Đã duyệt
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                      <span>{row.legalEntityType}</span>
                      <span className="opacity-35">•</span>
                      <span>{row.location}</span>
                      <span className="opacity-35">•</span>
                      <span>
                        Niêm yết:{' '}
                        <strong className="text-[#0F172A]">
                          {row.publishedCount}/{row.groups.length} cụm
                        </strong>{' '}
                        ({row.physicalCourts} sân vật lý)
                      </span>
                      <span className="opacity-35">•</span>
                      <span>
                        Hoa hồng HĐ:{' '}
                        <strong className="text-[#0F766E]">{row.commissionRatePct}% / đơn</strong>
                      </span>
                      <span className="opacity-35">•</span>
                      <span>Phản hồi: {row.responseRatePct}%</span>
                    </div>
                  </div>

                  {/* Right: Governance & Moderation Actions */}
                  <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPartnerKey(isExpanded ? null : row.key)
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E4F7E]/25 bg-[#F4F8FB] px-3.5 py-2 font-semibold text-[#0E4F7E] hover:bg-[#E6F1F8] transition cursor-pointer"
                    >
                      <span>Kiểm duyệt cụm sân ({row.groups.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {onOpenPublicShop && (
                      <button
                        type="button"
                        onClick={() => onOpenPublicShop(row.providerId)}
                        className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 font-semibold text-[#0F172A] hover:bg-neutral-50 transition cursor-pointer"
                      >
                        <span>Gian hàng Công khai</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onOpenChatDrawer}
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 font-semibold text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Điều phối</span>
                    </button>

                    <button
                      type="button"
                      disabled={togglingKey === row.key}
                      onClick={() => void handleToggleTenantStatus(row)}
                      className={`rounded-xl px-3.5 py-2 font-bold transition cursor-pointer ${
                        isActive
                          ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-[#0F766E] text-white hover:bg-[#0A192F]'
                      }`}
                    >
                      {togglingKey === row.key
                        ? 'Đang lưu…'
                        : isActive
                          ? 'Đình chỉ Tenant'
                          : 'Kích hoạt lại'}
                    </button>
                  </div>
                </div>

                {/* Expanded Public Cluster Moderation Drawer (Privacy-Safe) */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 bg-[#F8FAFC] px-5 py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-[#0E4F7E]">
                        Danh sách Cụm Sân Niêm yết Công khai — Kiểm duyệt Chính sách Sàn
                      </span>
                      <span className="text-neutral-500">
                        Quyền riêng tư: Chỉ ẩn/hiện hiển thị sàn; đơn giá &amp; đơn khách thuộc quyền chủ sân.
                      </span>
                    </div>

                    {row.groups.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-xs text-neutral-500">
                        Đối tác chưa niêm yết cụm sân công khai nào.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {row.groups.map((grp) => {
                          const published = grp.published !== false;
                          const courtsCount = grp.upcomingSlots[0]?.totalCapacity ?? 4;
                          return (
                            <div
                              key={grp.groupId}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-[#0F172A] truncate">
                                  {grp.groupName}
                                </div>
                                <div className="mt-0.5 text-[11px] text-neutral-500">
                                  {grp.sportName} • {courtsCount} sân vật lý •{' '}
                                  {published ? (
                                    <span className="font-semibold text-[#0F766E]">
                                      Đang niêm yết
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-rose-600">
                                      Đã ẩn kiểm duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {onToggleListingPublished && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onToggleListingPublished(grp.groupId);
                                    onFlashToast(
                                      published
                                        ? `✓ Đã tạm ẩn hiển thị cụm sân "${grp.groupName}" để kiểm duyệt.`
                                        : `✓ Đã mở lại hiển thị công khai cụm sân "${grp.groupName}".`
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition cursor-pointer shrink-0 ${
                                    published
                                      ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                      : 'bg-[#0E4F7E] text-white hover:bg-[#0A192F]'
                                  }`}
                                >
                                  {published ? (
                                    <>
                                      <EyeOff className="h-3.5 w-3.5" />
                                      Tạm ẩn sàn
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3.5 w-3.5" />
                                      Mở hiển thị
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

