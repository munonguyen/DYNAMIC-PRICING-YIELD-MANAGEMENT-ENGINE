import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AdminUserAccount, RoleCode } from '../types/marketplace';
import { ALL_LESSOR_PROVIDERS, marketplaceApi } from '../api/marketplaceApi';
import { ActionButton, PillSelect } from './FairwayControls';
import { EXPO_EASE } from './motionPrimitives';

interface AdminAccountManagerProps {
  accounts: AdminUserAccount[];
  liveFromDb: boolean;
  loading: boolean;
  currentUsername: string;
  isAdmin: boolean;
  onRefresh: () => Promise<void> | void;
  onFlashToast: (msg: string) => void;
}

const ROLE_BADGE_MAP: Record<RoleCode, { label: string; badge: string; avatar: string }> = {
  ADMIN: {
    label: 'Super Admin',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    avatar: 'bg-amber-600 text-white',
  },
  ACCOUNTANT: {
    label: 'Kế toán Sàn',
    badge: 'bg-sky-100 text-sky-900 border-sky-200',
    avatar: 'bg-[#0E4F7E] text-white',
  },
  MANAGER: {
    label: 'Chủ cụm sân',
    badge: 'bg-teal-100 text-teal-900 border-teal-200',
    avatar: 'bg-[#0F766E] text-white',
  },
  STAFF: {
    label: 'Nhân viên Sân',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    avatar: 'bg-indigo-600 text-white',
  },
  USER: {
    label: 'Người chơi',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    avatar: 'bg-slate-700 text-white',
  },
};

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return 'Chưa đăng nhập';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminAccountManager: React.FC<AdminAccountManagerProps> = ({
  accounts,
  liveFromDb,
  loading,
  currentUsername,
  isAdmin,
  onRefresh,
  onFlashToast,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleCode>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  // Create Account Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('123456');
  const [newRoleCode, setNewRoleCode] = useState<RoleCode>('MANAGER');
  const [newProviderId, setNewProviderId] = useState<string>(
    ALL_LESSOR_PROVIDERS[0]?.providerId ?? 'PROV_HN_01'
  );

  // Assign Role Modal
  const [roleModalUser, setRoleModalUser] = useState<AdminUserAccount | null>(null);
  const [grantRoleCode, setGrantRoleCode] = useState<RoleCode>('MANAGER');
  const [grantProviderId, setGrantProviderId] = useState<string>(
    ALL_LESSOR_PROVIDERS[0]?.providerId ?? 'PROV_HN_01'
  );

  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.status === 'ACTIVE').length;
    const inactive = accounts.filter((a) => a.status !== 'ACTIVE').length;
    const internalCount = accounts.filter((a) =>
      a.roles.some((r) => ['ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF'].includes(r.roleCode))
    ).length;
    return { total, active, inactive, internalCount };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (statusFilter !== 'ALL' && acc.status !== statusFilter) return false;
      if (roleFilter !== 'ALL' && !acc.roles.some((r) => r.roleCode === roleFilter)) return false;
      if (!q) return true;
      return (
        acc.username.toLowerCase().includes(q) ||
        acc.fullName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, roleFilter, statusFilter]);

  const handleToggleStatus = async (acc: AdminUserAccount) => {
    if (!isAdmin) return;
    const nextStatus = acc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setMutatingId(acc.id);
    try {
      const res = await marketplaceApi.toggleAdminAccountStatus(acc.id, nextStatus);
      await onRefresh();
      onFlashToast(
        `${nextStatus === 'INACTIVE' ? 'Đã khóa' : 'Đã kích hoạt'} tài khoản @${acc.username} (${
          res.live ? 'PostgreSQL DB' : 'Phiên cục bộ'
        }).`
      );
    } finally {
      setMutatingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await marketplaceApi.createAdminAccount({
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        roleCode: newRoleCode,
        providerId:
          newRoleCode === 'MANAGER' || newRoleCode === 'STAFF' ? newProviderId : null,
      });
      await onRefresh();
      onFlashToast(
        `✓ Đã cấp tài khoản @${res.account.username} (${newRoleCode}) thành công (${
          res.live ? 'PostgreSQL DB' : 'Lưu cục bộ'
        }).`
      );
      setCreateOpen(false);
      setFirstName('');
      setLastName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('123456');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Không thể tạo tài khoản.');
    } finally {
      setCreating(false);
    }
  };

  const handleAssignRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    setMutatingId(roleModalUser.id);
    try {
      const res = await marketplaceApi.assignAdminAccountRole(
        roleModalUser.id,
        grantRoleCode,
        grantRoleCode === 'MANAGER' || grantRoleCode === 'STAFF' ? undefined : null
      );
      await onRefresh();
      onFlashToast(
        `✓ Đã cấp thêm quyền ${grantRoleCode} cho @${roleModalUser.username} (${
          res.live ? 'PostgreSQL DB' : 'Lưu cục bộ'
        }).`
      );
      setRoleModalUser(null);
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">
            <span>Tổng Tài khoản Toàn Hệ thống</span>
            <Users className="h-4 w-4 text-[#0E4F7E]" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#0F172A] tabular-nums">
            {stats.total} tài khoản
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Bao gồm toàn bộ 5 vai trò trên sàn
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">
            <span>Đang Hoạt động (ACTIVE)</span>
            <UserCheck className="h-4 w-4 text-[#0F766E]" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#0F766E] tabular-nums">
            {stats.active}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Được phép đăng nhập &amp; giao dịch
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">
            <span>Tài khoản Vận hành Nội bộ</span>
            <Shield className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#0E4F7E] tabular-nums">
            {stats.internalCount}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Admin, Kế toán, Chủ sân &amp; Nhân viên
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">
            <span>Đã Khóa / Tạm ngưng</span>
            <Lock className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-rose-700 tabular-nums">
            {stats.inactive}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Tự động thu hồi toàn bộ phiên Redis
          </div>
        </div>
      </div>

      {/* Main Directory Card */}
      <div className="overflow-hidden rounded-[26px] border border-neutral-200/90 bg-white shadow-xs">
        <div className="flex flex-col gap-4 border-b border-neutral-100 p-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E4F7E]">
                Quản Trị Danh Tính &amp; Truy Cập (IAM)
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                  liveFromDb
                    ? 'bg-teal-50 text-[#0F766E] border border-[#0F766E]/20'
                    : 'bg-[#E6F1F8] text-[#0E4F7E]'
                }`}
              >
                {liveFromDb ? '✓ PostgreSQL Live' : 'Đồng bộ Phiên Cục bộ'}
              </span>
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#0F172A]">
              Danh sách Tài khoản Hệ thống ({filteredAccounts.length}/{accounts.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:border-[#0E4F7E] transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>

            {isAdmin && (
              <ActionButton
                variant="ink"
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Cấp Tài khoản Mới
                </span>
              </ActionButton>
            )}
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-[#FAFBFD] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm họ tên, @username hoặc email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-4 text-xs text-[#0F172A] focus:border-[#0E4F7E] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'USER'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[#0E4F7E] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#0F172A]'
                  }`}
                >
                  {r === 'ALL' ? 'Tất cả Role' : r}
                </button>
              ))}
            </div>

            <div className="w-36">
              <PillSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                ariaLabel="Lọc trạng thái tài khoản"
                variant="compact"
                options={[
                  { value: 'ALL', label: 'Mọi trạng thái' },
                  { value: 'ACTIVE', label: 'Đang mở (ACTIVE)' },
                  { value: 'INACTIVE', label: 'Đã khóa (INACTIVE)' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Người dùng &amp; Định danh</th>
                <th className="px-4 py-3.5 font-semibold">Vai trò &amp; Phạm vi</th>
                <th className="px-4 py-3.5 font-semibold">Hoạt động gần nhất</th>
                <th className="px-4 py-3.5 text-center font-semibold">Trạng thái</th>
                {isAdmin && <th className="px-6 py-3.5 text-right font-semibold">Điều phối</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-10 text-center text-neutral-500">
                    Không có tài khoản nào phù hợp với bộ lọc tìm kiếm hiện tại.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const primaryRole = acc.roles[0]?.roleCode ?? 'USER';
                  const styleMeta = ROLE_BADGE_MAP[primaryRole] ?? ROLE_BADGE_MAP.USER;
                  const isSelf = acc.username.toLowerCase() === currentUsername.toLowerCase();
                  return (
                    <tr key={acc.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${styleMeta.avatar}`}
                          >
                            {acc.fullName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0F172A] truncate">
                                {acc.fullName}
                              </span>
                              {isSelf && (
                                <span className="rounded-full bg-[#E6F1F8] px-2 py-0.5 text-[10px] font-bold text-[#0E4F7E]">
                                  Phiên của bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              <code className="font-mono text-[#0E4F7E]">@{acc.username}</code> •{' '}
                              {acc.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {acc.roles.map((r, i) => {
                            const rm = ROLE_BADGE_MAP[r.roleCode] ?? ROLE_BADGE_MAP.USER;
                            return (
                              <span
                                key={`${r.roleCode}-${i}`}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${rm.badge}`}
                              >
                                {r.roleCode}
                                <span className="opacity-70 font-normal">({r.scope})</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-[11px] text-neutral-500 tabular-nums">
                        {formatDateTimeShort(acc.lastLoginAt)}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                            acc.status === 'ACTIVE'
                              ? 'bg-teal-50 text-[#0F766E] border border-[#0F766E]/20'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {acc.status === 'ACTIVE' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                          {acc.status}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRoleModalUser(acc);
                                setGrantRoleCode(primaryRole);
                              }}
                              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-[#0E4F7E] hover:text-[#0E4F7E] transition cursor-pointer"
                            >
                              + Cấp quyền
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                disabled={mutatingId === acc.id}
                                onClick={() => void handleToggleStatus(acc)}
                                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                                  acc.status === 'ACTIVE'
                                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    : 'border-[#0F766E]/30 bg-teal-50 text-[#0F766E] hover:bg-teal-100'
                                }`}
                              >
                                {acc.status === 'ACTIVE' ? (
                                  <>
                                    <Lock className="h-3 w-3" /> Khóa TK
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="h-3 w-3" /> Mở khóa
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY MODAL: CREATE NEW PLATFORM / TENANT ACCOUNT */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: EXPO_EASE }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-account-modal-title"
              className="w-full max-w-lg rounded-[28px] border border-neutral-200 bg-white p-6 sm:p-7 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0E4F7E]">
                    <UserPlus className="h-3.5 w-3.5" />
                    Cấp Tài khoản Mới
                  </span>
                  <h3 id="create-account-modal-title" className="mt-1 text-lg font-bold text-[#0F172A]">
                    Tạo Tài khoản Đối tác, Nhân sự hoặc Khách hàng
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Đóng hộp thoại"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">Họ</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nguyễn"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">Tên</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Minh Anh"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Tên đăng nhập (Username)
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      placeholder="VD: chusan.danang"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="name@arenapulse.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">Số điện thoại</label>
                    <input
                      type="tel"
                      placeholder="090xxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">Mật khẩu ban đầu</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Vai trò (RBAC Role)
                    </label>
                    <PillSelect
                      value={newRoleCode}
                      onChange={(v) => setNewRoleCode(v as RoleCode)}
                      ariaLabel="Chọn vai trò cho tài khoản mới"
                      variant="field"
                      menuAlign="full"
                      options={[
                        { value: 'MANAGER', label: 'MANAGER • Chủ cụm sân' },
                        { value: 'STAFF', label: 'STAFF • Nhân viên Sân' },
                        { value: 'ACCOUNTANT', label: 'ACCOUNTANT • Kế toán Sàn' },
                        { value: 'ADMIN', label: 'ADMIN • Super Admin' },
                        { value: 'USER', label: 'USER • Khách đặt sân' },
                      ]}
                    />
                  </div>

                  {(newRoleCode === 'MANAGER' || newRoleCode === 'STAFF') && (
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Gắn Cơ sở / Đối tác
                      </label>
                      <PillSelect
                        value={newProviderId}
                        onChange={setNewProviderId}
                        ariaLabel="Chọn cơ sở cho thuê"
                        variant="field"
                        menuAlign="full"
                        options={ALL_LESSOR_PROVIDERS.map((p) => ({
                          value: p.providerId,
                          label: p.providerName,
                        }))}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 pt-4">
                  <ActionButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                    Hủy
                  </ActionButton>
                  <ActionButton type="submit" variant="ink" size="sm" disabled={creating}>
                    {creating ? 'Đang tạo tài khoản...' : '✓ Xác nhận Cấp Tài khoản'}
                  </ActionButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY MODAL: ASSIGN ADDITIONAL RBAC ROLE */}
      <AnimatePresence>
        {roleModalUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
            onClick={() => setRoleModalUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: EXPO_EASE }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-[26px] border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <span className="font-bold uppercase tracking-wider text-[#0E4F7E]">
                    Phân quyền RBAC
                  </span>
                  <h4 className="mt-0.5 text-base font-bold text-[#0F172A]">
                    Cấp vai trò cho @{roleModalUser.username}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAssignRoleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block font-semibold text-neutral-700">Chọn Vai trò</label>
                  <PillSelect
                    value={grantRoleCode}
                    onChange={(v) => setGrantRoleCode(v as RoleCode)}
                    ariaLabel="Chọn vai trò cấp thêm"
                    variant="field"
                    menuAlign="full"
                    options={[
                      { value: 'ADMIN', label: 'ADMIN (Platform)' },
                      { value: 'ACCOUNTANT', label: 'ACCOUNTANT (Platform)' },
                      { value: 'MANAGER', label: 'MANAGER (Tenant)' },
                      { value: 'STAFF', label: 'STAFF (Tenant)' },
                      { value: 'USER', label: 'USER (Platform)' },
                    ]}
                  />
                </div>

                {(grantRoleCode === 'MANAGER' || grantRoleCode === 'STAFF') && (
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Phạm vi Cơ sở (Tenant)
                    </label>
                    <PillSelect
                      value={grantProviderId}
                      onChange={setGrantProviderId}
                      ariaLabel="Chọn cơ sở áp dụng quyền"
                      variant="field"
                      menuAlign="full"
                      options={ALL_LESSOR_PROVIDERS.map((p) => ({
                        value: p.providerId,
                        label: p.providerName,
                      }))}
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <ActionButton type="button" variant="outline" size="sm" onClick={() => setRoleModalUser(null)}>
                    Đóng
                  </ActionButton>
                  <ActionButton type="submit" variant="ink" size="sm" disabled={mutatingId === roleModalUser.id}>
                    Lưu Quyền hạn
                  </ActionButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

