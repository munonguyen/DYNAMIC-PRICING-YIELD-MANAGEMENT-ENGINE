import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { AuthSession, RoleCode } from '../types/marketplace';
import { marketplaceApi } from '../api/marketplaceApi';
import { ArenaPulseLogo } from './ArenaPulseLogo';
import { EXPO_EASE } from './motionPrimitives';
import { ActionButton } from './FairwayControls';

interface LoginPageProps {
  session: AuthSession | null;
  onAuthenticated: (session: AuthSession, preferredRole?: RoleCode) => void;
  onLogout: () => void;
  onBack: () => void;
}

function shouldSkipAutoVideo(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

export const LoginPage: React.FC<LoginPageProps> = ({
  session,
  onAuthenticated,
  onLogout,
  onBack,
}) => {
  const prefersReduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [enableVideo, setEnableVideo] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);

  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberSession, setRememberSession] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (prefersReduced || shouldSkipAutoVideo()) {
      setEnableVideo(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEnableVideo(true));
    return () => window.cancelAnimationFrame(raf);
  }, [prefersReduced]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enableVideo) return;
    const sync = () => {
      if (!document.hidden) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, [enableVideo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const auth = await marketplaceApi.loginOrRegisterDemo(
        username.trim(),
        password,
        authTab
      );
      const enrichedAuth: AuthSession = {
        ...auth,
        fullName:
          authTab === 'REGISTER' && fullName.trim()
            ? fullName.trim()
            : auth.fullName,
        email:
          authTab === 'REGISTER' && email.trim()
            ? email.trim()
            : auth.email,
      };
      const primaryRole = enrichedAuth.roles?.[0]?.roleCode ?? 'USER';
      onAuthenticated(enrichedAuth, primaryRole);
    } catch {
      setErrorMsg('Không thể khởi tạo phiên đăng nhập. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#061710] text-white flex flex-col">
      {/* 1. Dedicated Fullscreen 1080p Ambient Sports Video */}
      <div className="absolute inset-0 z-0">
        <img
          src="/videos/login-poster.jpg"
          alt="Không gian sân thể thao chuyên nghiệp"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />

        {enableVideo && (
          <video
            ref={videoRef}
            poster="/videos/login-poster.jpg"
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <source src="/videos/login-ambient.webm" type="video/webm" />
            <source src="/videos/login-ambient.mp4" type="video/mp4" />
          </video>
        )}

        {/* Executive Dark Emerald Editorial Scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#061710]/84 via-[#0A2419]/62 to-[#071522]/86"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(22,66,44,0.38),transparent_58%)]"
          aria-hidden="true"
        />
      </div>

      {/* 2. Top Navigation Return Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-[1360px] items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-left focus:outline-none rounded-lg"
        >
          <ArenaPulseLogo variant="light" size="md" />
        </button>

        <ActionButton variant="glass" size="sm" arrow="back" onClick={onBack}>
          Quay lại trang chủ
        </ActionButton>
      </header>

      {/* 3. Centered Auth Card Stage */}
      <main className="relative z-20 flex-1 flex items-center justify-center px-5 pb-12 pt-2">
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: EXPO_EASE }}
          className="w-full max-w-[440px]"
        >
          <div className="w-full rounded-[28px] border border-white/35 bg-white/96 p-7 sm:p-8 text-[#0F172A] shadow-[0_32px_85px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {session ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div>
                    <span className="inline-flex rounded-full bg-[#E7F7D4] px-2.5 py-0.5 text-[11px] font-semibold text-[#204E18]">
                      Đang đăng nhập
                    </span>
                    <h2 className="mt-2 text-xl font-semibold text-[#0F172A]">
                      {session.fullName}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      @{session.username} • {session.email}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8F9FA] p-4 border border-neutral-200/70 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Mã phiên Redis</span>
                    <span className="tabular-nums font-semibold text-[#16422C]">
                      {session.accessToken.slice(0, 18)}…
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Quyền truy cập</span>
                    <span className="font-semibold text-[#0F172A]">
                      {session.roles.map((r) => r.roleCode).join(', ')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onBack}
                    className="fairway-interactive w-full rounded-full bg-[#16422C] py-3 text-sm font-semibold text-white hover:bg-[#0F172A]"
                  >
                    Tiếp tục vào hệ thống →
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full rounded-full border border-neutral-200 bg-white py-2.5 text-xs font-semibold text-neutral-600 hover:border-neutral-400 hover:text-[#0F172A]"
                  >
                    Đăng xuất tài khoản hiện tại
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
                      {authTab === 'LOGIN' ? 'Đăng nhập ArenaPulse' : 'Tạo tài khoản mới'}
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      Truy cập đặt lịch sân thể thao và bảng điều khiển theo vai trò.
                    </p>
                  </div>
                </div>

                {/* Mode Switcher */}
                <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-[#F3F4F6] p-1 border border-neutral-200/70">
                  <button
                    type="button"
                    onClick={() => setAuthTab('LOGIN')}
                    className={`rounded-full py-2 text-xs font-semibold transition-colors ${
                      authTab === 'LOGIN'
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-[#0F172A]'
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('REGISTER')}
                    className={`rounded-full py-2 text-xs font-semibold transition-colors ${
                      authTab === 'REGISTER'
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-[#0F172A]'
                    }`}
                  >
                    Đăng ký nhanh
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                  {authTab === 'REGISTER' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="login-fullname"
                          className="mb-1 block text-xs font-medium text-neutral-700"
                        >
                          Họ và tên
                        </label>
                        <input
                          id="login-fullname"
                          type="text"
                          required
                          placeholder="Nguyễn Văn A"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="login-email"
                          className="mb-1 block text-xs font-medium text-neutral-700"
                        >
                          Email
                        </label>
                        <input
                          id="login-email"
                          type="email"
                          required
                          placeholder="email@arenapulse.vn"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="login-username"
                      className="mb-1 block text-xs font-medium text-neutral-700"
                    >
                      Tên đăng nhập
                    </label>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="Nhập tên đăng nhập tài khoản…"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <label htmlFor="login-password" className="font-medium text-neutral-700">
                        Mật khẩu
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="font-medium text-[#0E4F7E] hover:underline"
                      >
                        {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      </button>
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authTab === 'LOGIN' ? 'current-password' : 'new-password'}
                      required
                      placeholder="Nhập mật khẩu…"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-[#F8F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-neutral-400 focus:border-[#16422C] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <label className="inline-flex items-center gap-2 text-neutral-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(e) => setRememberSession(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#16422C]"
                      />
                      <span>Duy trì phiên làm việc 8 giờ</span>
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Phân quyền tự động theo tài khoản
                    </span>
                  </div>

                  {errorMsg && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
                      {errorMsg}
                    </div>
                  )}

                  <ActionButton
                    type="submit"
                    variant="forest"
                    size="lg"
                    fullWidth
                    arrow="right"
                    disabled={submitting}
                    className="mt-1"
                  >
                    {submitting
                      ? 'Đang xác thực phiên Redis…'
                      : authTab === 'LOGIN'
                        ? 'Đăng nhập vào ArenaPulse'
                        : 'Tạo tài khoản & Đăng nhập'}
                  </ActionButton>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

