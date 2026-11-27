import type {
  AdminAuditLogEntry,
  AdminCommissionRule,
  AdminLedgerEntry,
  AdminRbacMatrix,
  AdminTenantOverview,
  AdminUserAccount,
  AdminVenueGroup,
  AnalyticsDashboardData,
  AuthSession,
  CancelBookingResult,
  CheckInResult,
  CourtMediaItem,
  CourtFloorDraft,
  CourtFloorEditorData,
  CourtFloorLayout,
  CourtSearchResponseData,
  CustomerSchedule,
  HoldSlotResult,
  LessorApplicationPayload,
  LessorApplicationReceipt,
  LessorApplicationRecord,
  LessorBookingOrder,
  MyTicketRecord,
  VnPayReturnResult,
  OtpChallengeResult,
  PriceQuote,
  ProvisionedAccountHint,
  PublishedListing,
  QrCodeTicket,
  ReconciliationSummary,
  ReindexResultData,
  RoleCode,
  SimulationResult,
  SlotListingQuote,
  SportTypeItem,
  VenueCourtSnapshot,
  VenueProviderInfo,
} from '../types/marketplace';

const venueBookingDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});
const venueBookingHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23',
});

export function applyGalleryMediaToListing(
  listing: PublishedListing,
  mediaItems: CourtMediaItem[]
): PublishedListing {
  if (!mediaItems || mediaItems.length === 0) {
    return listing;
  }
  const sorted = [...mediaItems].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  const urls = sorted.map((m) => m.url);
  const captions = sorted.map(
    (m) => m.caption || 'Ảnh thực tế tại sân • Chủ cơ sở đăng tải'
  );
  return {
    ...listing,
    imageUrl: urls[0],
    galleryImages: urls,
    galleryCaptions: captions,
    galleryMedia: sorted,
  };
}

function buildBaselineMediaItems(listing: PublishedListing): CourtMediaItem[] {
  if (listing.galleryMedia && listing.galleryMedia.length > 0) {
    return listing.galleryMedia;
  }
  const imgs =
    listing.galleryImages && listing.galleryImages.length > 0
      ? listing.galleryImages
      : listing.imageUrl
        ? [listing.imageUrl]
        : [];
  return imgs.map((url, idx) => ({
    mediaId: `static-${listing.groupId}-${idx}`,
    groupId: listing.groupId,
    url,
    caption:
      listing.galleryCaptions?.[idx] ||
      'Ảnh chủ sân chụp trực tiếp • Góc nhìn thực tế tại cơ sở',
    sourceType: 'STATIC_ASSET',
    isCover: idx === 0,
    displayOrder: idx,
  }));
}

function enrichListingVisuals(listing: PublishedListing, index: number): PublishedListing {
  const sportImageMap: Record<string, string> = {
    PICKLEBALL: '/images/real-pickleball-outdoor.jpg',
    FOOTBALL: '/images/real-football-turf.jpg',
    BADMINTON: '/images/real-badminton-indoor.jpg',
    TENNIS: '/images/sport-tennis-sunny.jpg',
    BASKETBALL: '/images/real-basketball-indoor.jpg',
  };
  const fallbackImages = [
    '/images/real-pickleball-outdoor.jpg',
    '/images/real-football-turf.jpg',
    '/images/real-badminton-indoor.jpg',
    '/images/sport-tennis-sunny.jpg',
    '/images/real-basketball-indoor.jpg',
  ];
  const slots: SlotListingQuote[] =
    listing.upcomingSlots && listing.upcomingSlots.length > 0
      ? listing.upcomingSlots.map((slot) => {
          const occ =
            slot.totalCapacity > 0
              ? Math.round(((slot.totalCapacity - slot.availableCourts) / slot.totalCapacity) * 100)
              : 0;
          const demandTag: SlotListingQuote['demandTag'] =
            slot.availableCourts <= 0
              ? 'SOLD_OUT'
              : occ >= 65
                ? 'PRIME_SURGE'
                : occ <= 25
                  ? 'OFF_PEAK'
                  : 'STANDARD';
          const h = new Date(slot.slotStart).getHours();
          const timePeriod: SlotListingQuote['timePeriod'] =
            h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : 'EVENING';
          return { ...slot, occupancyPct: occ, demandTag, timePeriod };
        })
      : [];

  const backendMedia = listing.galleryMedia && listing.galleryMedia.length > 0 ? listing.galleryMedia : null;
  const coverFromMedia = backendMedia?.find((m) => m.isCover)?.url ?? backendMedia?.[0]?.url;

  const mainImg =
    coverFromMedia ||
    listing.imageUrl ||
    sportImageMap[listing.sportCode] ||
    fallbackImages[index % fallbackImages.length];

  const baseEnriched: PublishedListing = {
    ...listing,
    city: listing.city || '',
    district: listing.district || '',
    imageUrl: mainImg,
    galleryImages:
      backendMedia
        ? backendMedia.map((m) => m.url)
        : listing.galleryImages && listing.galleryImages.length > 0
          ? listing.galleryImages
          : [mainImg],
    galleryCaptions:
      backendMedia
        ? backendMedia.map((m) => m.caption || 'Ảnh chủ sân đăng tải')
        : listing.galleryCaptions,
    galleryMedia: backendMedia ?? undefined,
    provider: listing.provider ?? {
      providerId: listing.tenantId, providerName: listing.venueName, badge: '', city: listing.city || '',
      district: listing.district || '', verified: false, yearsPartner: 0, responseRatePct: 0,
      responseTimeLabel: 'Chưa có dữ liệu', totalManagedCourts: 0, commissionRatePct: 0, platformGuarantee: '',
    },
    architecturalBadge:
      listing.architecturalBadge ||
      (listing.checkinMode === 'QR_STAFF' ? 'Soát Vé QR Ký Số 1 Lần' : 'Check-in Tự Vận Hành'),
    upcomingSlots: slots,
  };
  return applyGalleryMediaToListing(baseEnriched, buildBaselineMediaItems(baseEnriched));
}

export interface VenueStaffAccount {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export interface VenueConversation {
  id: string;
  tenantId: string;
  userId: string;
}

export interface VenueMessage {
  id: { id: string; createdAt: string };
  senderUserId: string;
  senderRole: string;
  body: string;
}

class MarketplaceApiClient {
  private accessToken: string | null = null;
  public backendConnected = false;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra || {}),
    };
    if (this.accessToken) {
      base.Authorization = `Bearer ${this.accessToken}`;
    }
    return base;
  }

  async checkBackendAndLoadCatalogue(): Promise<{ live: boolean; sports: SportTypeItem[]; listings: PublishedListing[] }> {
    try {
      const [sports, listings] = await Promise.all([
        this.checkoutRequest<SportTypeItem[]>('/sport-types'), this.checkoutRequest<PublishedListing[]>('/listings'),
      ]);
      this.backendConnected = true;
      return { live: true, sports, listings: listings.map(enrichListingVisuals) };
    } catch {
      this.backendConnected = false;
      return { live: false, sports: [], listings: [] };
    }
  }

  async uploadCourtPhoto(groupId: string, file: File, caption: string, isCover: boolean):
    Promise<{ item: CourtMediaItem; persistedToBackend: boolean }> {
    const form = new FormData();
    form.append('file', file);
    if (caption.trim()) form.append('caption', caption.trim());
    form.append('isCover', String(isCover));
    const item = await this.uploadForm<CourtMediaItem>(`/listings/${groupId}/media`, form);
    return { item, persistedToBackend: true };
  }

  async setCoverCourtPhoto(groupId: string, mediaId: string): Promise<boolean> {
    await this.checkoutRequest(`/listings/${groupId}/media/${mediaId}/cover`, undefined, undefined, 'PATCH');
    return true;
  }

  async deleteCourtPhoto(groupId: string, mediaId: string): Promise<boolean> {
    await this.checkoutRequest(`/listings/${groupId}/media/${mediaId}`, undefined, undefined, 'DELETE');
    return true;
  }

  private async uploadForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
      method: 'POST', headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : undefined, body: form,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.message || 'Tải dữ liệu lên chưa thành công.');
    }
    return res.json();
  }

  async getPriceQuote(
    listing: PublishedListing,
    slotStart: string
  ): Promise<{ quote: PriceQuote; live: boolean }> {
    const params = new URLSearchParams({ groupId: listing.groupId, slotStart });
    const quote = await this.checkoutRequest<PriceQuote>(`/pricing/quote?${params}`);
    return { quote, live: true };
  }

  async holdCourtSlot(
    listing: PublishedListing,
    quote: PriceQuote,
    userId: string
  ): Promise<{ hold: HoldSlotResult; live: boolean; idempotencyKey: string }> {
    const idempotencyKey = `idem-${quote.tokenJti}`;
    const hold = await this.checkoutRequest<HoldSlotResult>('/bookings/hold', {
      groupId: listing.groupId, slotStart: quote.slotStart, userId, priceLockToken: quote.priceLockToken, idempotencyKey,
    });
    return { hold, live: true, idempotencyKey };
  }

  private async checkoutRequest<T>(
    path: string, body?: object, signal?: AbortSignal, method = body ? 'POST' : 'GET'
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/v1${path}`, {
        method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined, signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Không kết nối được với hệ thống. Vui lòng thử lại.');
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new Error(typeof problem?.message === 'string' && problem.message
        ? problem.message
        : 'Hệ thống chưa xác nhận được thao tác.');
    }
    if (response.status === 204) return undefined as T;
    try {
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Hệ thống trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
    }
  }

  async getCheckoutProviders(signal?: AbortSignal): Promise<import('../types/marketplace').CheckoutProvider[]> {
    const providers = await this.checkoutRequest<import('../types/marketplace').CheckoutProvider[]>(
      '/payments/providers', undefined, signal,
    );
    if (!Array.isArray(providers)) throw new Error('Danh sách cổng thanh toán không hợp lệ.');
    return providers;
  }

  getBookingPaymentStatus(reservationId: string, signal?: AbortSignal): Promise<import('../types/marketplace').BookingPaymentStatus> {
    return this.checkoutRequest(`/bookings/${reservationId}/payment-status`, undefined, signal);
  }

  createVietQrBalance(reservationId: string, signal?: AbortSignal): Promise<import('../types/marketplace').BookingPaymentStatus> {
    return this.checkoutRequest(`/payments/vietqr/balance/${encodeURIComponent(reservationId)}`, {}, signal);
  }

  resendQrTicketEmail(reservationId: string, recipientEmail: string):
    Promise<{ sentOverSmtp: boolean; detailMessage: string }> {
    return this.checkoutRequest(`/bookings/${reservationId}/resend-qr-email`, { recipientEmail });
  }

  async createInlineQrPayment(
    provider: 'MOMO_WALLET' | 'VIETQR_NAPAS' | 'VNPAY_ESCROW',
    hold: HoldSlotResult,
    options: {
      amount: number;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      needVatInvoice?: boolean;
      vatCompanyName?: string;
      vatTaxCode?: string;
      bookingNote?: string;
    }
  ): Promise<void> {
    const path = provider === 'VIETQR_NAPAS' ? '/payments/vietqr/create'
      : provider === 'VNPAY_ESCROW' ? '/payments/vnpay/create-payment' : '/payments/momo/create';
    const session = await this.checkoutRequest<{ paymentUrl?: string }>(path, { reservationId: hold.reservationId, ...options });
    if (provider === 'VNPAY_ESCROW' && session.paymentUrl) window.location.assign(session.paymentUrl);
  }

  getVietQrReviewQueue(signal?: AbortSignal): Promise<import('../types/marketplace').VietQrReviewItem[]> {
    return this.checkoutRequest('/payments/vietqr/review', undefined, signal);
  }

  async closeVietQrReview(id: string, note: string): Promise<void> {
    const response = await fetch(`/api/v1/payments/vietqr/review/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ note }),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new Error(problem?.message || 'Chưa lưu được kết quả đối soát.');
    }
  }

  async verifyVnPayReturnParams(rawQueryString: string): Promise<VnPayReturnResult> {
    const cleanQuery = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
    const res = await fetch(`/api/v1/payments/vnpay/return?${cleanQuery}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Xác thực kết quả VNPAY thất bại.' }));
      throw new Error(err.message || 'Xác thực kết quả VNPAY thất bại.');
    }
    return (await res.json()) as VnPayReturnResult;
  }

  getMySchedule(weekStart: string, signal?: AbortSignal): Promise<CustomerSchedule> {
    const query = new URLSearchParams({ weekStart });
    return this.checkoutRequest(`/bookings/my-schedule?${query}`, undefined, signal);
  }

  async getMyTicket(reservationId: string, signal?: AbortSignal): Promise<MyTicketRecord | null> {
    const query = new URLSearchParams({ reservationId });
    const tickets = await this.checkoutRequest<MyTicketRecord[]>(`/bookings/my-tickets?${query}`, undefined, signal);
    return tickets[0] ?? null;
  }

  getPaymentHistory(page: number, size: number, signal?: AbortSignal): Promise<MyTicketRecord[]> {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    return this.checkoutRequest(`/payments/history?${query}`, undefined, signal);
  }

  async inspectQrTicket(rawInput: string, providerOrders: LessorBookingOrder[]): Promise<import('../types/marketplace').QrInspectResult> {
    const inspected = await this.checkoutRequest<import('../types/marketplace').QrInspectResult & {
      slotStart?: string; slotEnd?: string;
    }>('/checkins/inspect', { qrToken: rawInput.trim() });
    return {
      ...inspected,
      orderId: providerOrders.find(order => order.reservationId === inspected.reservationId)?.orderId ?? inspected.reservationId,
      slotLabel: inspected.slotStart ? formatSlotWindow(inspected.slotStart, inspected.slotEnd) : undefined,
    };
  }

  async confirmQrCheckInWithPhoneChallenge(
    qrToken: string, phoneLast4: string
  ): Promise<{ ok: boolean; message: string }> {
    try {
      await this.checkoutRequest<CheckInResult>('/checkins/scan', { qrToken: qrToken.trim(), phoneLast4: phoneLast4.trim() || undefined });
      return { ok: true, message: 'Đã xác nhận nhận sân.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Chưa xác nhận được vé.' };
    }
  }

  async verifyPinAtVenue(order: LessorBookingOrder, pinCode: string, phoneLast4?: string):
    Promise<{ ok: boolean; message: string; remainingAttempts?: number; locked?: boolean }> {
    try {
      await this.checkoutRequest<CheckInResult>('/checkins/verify-pin', {
        reservationId: order.reservationId, pinCode, phoneLast4: phoneLast4?.trim() || undefined,
      });
      return { ok: true, message: 'Đã xác nhận nhận sân.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Chưa xác nhận được PIN.' };
    }
  }

  cancelReservation(hold: HoldSlotResult, venueInitiated: boolean): Promise<CancelBookingResult> {
    return this.checkoutRequest(`/bookings/${hold.reservationId}/cancel`, {
      slotStart: hold.slotStart,
      reason: venueInitiated ? 'Mưa lớn / Bảo trì mặt sân' : 'Người chơi thay đổi lịch trình',
    });
  }

  async runMonteCarloSimulation(
    totalCustomers = 1500,
    simulationDays = 7
  ): Promise<{ result: SimulationResult; live: boolean }> {
    try {
      const res = await fetch('/api/v1/simulations/run', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          totalCustomers,
          simulationDays,
          courtsCount: 10,
          basePrice: 200000,
          minPrice: 120000,
          maxPrice: 350000,
        }),
      });
      if (res.ok) {
        const result: SimulationResult = await res.json();
        return { result, live: true };
      }
    } catch {
      // Fallback simulation
    }

    const totalSlotHours = simulationDays * 10 * 14;
    const fixedBookings = Math.round(totalSlotHours * 0.56);
    const dynamicBookings = Math.round(totalSlotHours * 0.74);
    const fixedRev = fixedBookings * 200_000;
    const dynamicRev = Math.round(dynamicBookings * 218_500);
    const uplift = Number((((dynamicRev - fixedRev) / fixedRev) * 100).toFixed(2));

    return {
      live: false,
      result: {
        totalSimulatedUsers: totalCustomers,
        simulationDays,
        totalCourts: 10,
        totalSlotHours,
        fixedPricing: {
          modelName: 'Fixed Static Tariff (200,000₫/h)',
          totalBookings: fixedBookings,
          occupancyRate: Number(((fixedBookings / totalSlotHours) * 100).toFixed(1)),
          totalRevenue: fixedRev,
          revPar: Math.round(fixedRev / totalSlotHours),
        },
        dynamicPricing: {
          modelName: 'Multi-Factor Yield Engine V3',
          totalBookings: dynamicBookings,
          occupancyRate: Number(((dynamicBookings / totalSlotHours) * 100).toFixed(1)),
          totalRevenue: dynamicRev,
          revPar: Math.round(dynamicRev / totalSlotHours),
        },
        revenueUpliftPct: uplift,
        revParUpliftPct: uplift,
        summaryMessage: `Mô phỏng ${totalCustomers.toLocaleString('vi-VN')} lượt cầu trong ${simulationDays} ngày giúp dịch chuyển nhu cầu giờ thấp điểm và tối ưu biên độ giờ vàng (+${uplift}% RevPAR).`,
      },
    };
  }

  async authenticate(username: string, password: string, mode: 'LOGIN' | 'REGISTER' = 'LOGIN'): Promise<AuthSession> {
    const cleanUser = username.trim();
    if (mode === 'REGISTER') {
      await this.checkoutRequest('/auth/register', {
        username: cleanUser, password, email: `${cleanUser}@arenapulse.vn`, firstName: 'Khách', lastName: cleanUser,
      });
    }
    const session = await this.checkoutRequest<AuthSession>('/auth/login', { username: cleanUser, password });
    this.setAccessToken(session.accessToken);
    return session;
  }

  logout(): Promise<void> {
    return this.checkoutRequest('/auth/logout', {}, undefined, 'POST');
  }

  requestLessorOtp(contactPhone: string, contactEmail: string): Promise<OtpChallengeResult> {
    return this.checkoutRequest('/lessor-applications/otp/request', { contactPhone, contactEmail });
  }

  verifyLessorOtp(challengeId: string, otpCode: string): Promise<{ verified: boolean; verificationToken: string }> {
    return this.checkoutRequest('/lessor-applications/otp/verify', { challengeId, otpCode });
  }

  async submitLessorApplication(
    payload: LessorApplicationPayload,
    files: { cccdFront: File; cccdBack: File; businessDoc: File; courtPhoto: File }
  ): Promise<{ receipt: LessorApplicationReceipt; live: boolean }> {
    const form = new FormData();
    form.append('payload', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    for (const [key, file] of Object.entries(files)) form.append(key, file);
    const receipt = await this.uploadForm<LessorApplicationReceipt>('/lessor-applications', form);
    return { receipt, live: true };
  }

  listLessorApplicationsInternal(): Promise<LessorApplicationRecord[]> {
    return this.checkoutRequest('/internal/lessor-applications');
  }

  reviewLessorApplicationInternal(
    id: string, decision: 'APPROVED' | 'REJECTED', reviewNote: string
  ): Promise<LessorApplicationRecord> {
    return this.checkoutRequest(`/internal/lessor-applications/${id}/review`, { decision, reviewNote });
  }

  getReconciliation(signal?: AbortSignal): Promise<ReconciliationSummary> {
    return this.checkoutRequest('/finance/reconciliation', undefined, signal);
  }

  fetchLessorAnalytics(days: number, tenantId: string): Promise<AnalyticsDashboardData> {
    const params = new URLSearchParams({ days: String(days), tenantId });
    return this.checkoutRequest(`/analytics/lessor?${params}`);
  }

  fetchPlatformAnalytics(days: number, _listings?: PublishedListing[]): Promise<AnalyticsDashboardData> {
    return this.checkoutRequest(`/analytics/platform?days=${days}`);
  }

  async searchCourtsFast(
    query: string,
    sportCode: string
  ): Promise<CourtSearchResponseData | null> {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (sportCode && sportCode !== 'ALL') params.set('sport', sportCode);
      const res = await fetch(`/api/v1/search/courts?${params.toString()}`, {
        headers: this.headers(),
      });
      if (res.ok) {
        this.backendConnected = true;
        return await res.json();
      }
    } catch {
      // Backend offline -> client index filter will apply
    }
    return null;
  }

  async triggerElasticsearchReindex(): Promise<ReindexResultData> {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/v1/analytics/reindex', {
        method: 'POST',
        headers: this.headers(),
      });
      if (res.ok) {
        this.backendConnected = true;
        return await res.json();
      }
    } catch {
      // Backend unreachable
    }
    return {
      elasticsearchReachable: false,
      indexedBookings: 0,
      indexedCourts: 0,
      durationMs: Math.max(1, Math.round(performance.now() - t0)),
      message:
        'Dữ liệu đang đồng bộ ở chế độ ngoại tuyến. Kết nối máy chủ hệ thống để cập nhật báo cáo thời gian thực.',
    };
  }

  private async fetchStrictJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: this.headers(init?.headers as Record<string, string> | undefined),
      });
    } catch {
      throw new Error(
        'Không thể kết nối tới Backend Spring Boot / PostgreSQL DB. Vui lòng khởi động máy chủ API.'
      );
    }

    if (res.status === 401) {
      throw new Error(
        'Phiên làm việc hiện tại chưa xác thực trên Backend DB (401). Vui lòng đăng nhập lại bằng tài khoản Admin khi Backend đã chạy.'
      );
    }
    if (res.status === 403) {
      throw new Error('Tài khoản hiện tại không đủ quyền PLATFORM ADMIN/ACCOUNTANT trên Backend (403).');
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        (errBody as { message?: string }).message ||
          `Lỗi truy vấn dữ liệu từ PostgreSQL (${res.status}).`
      );
    }
    this.backendConnected = true;
    return (await res.json()) as T;
  }

  async fetchPlatformAnalyticsStrict(days: number): Promise<AnalyticsDashboardData> {
    return this.fetchStrictJson<AnalyticsDashboardData>(`/api/v1/analytics/platform?days=${days}`);
  }

  async getReconciliationStrict(tenantId?: string): Promise<ReconciliationSummary> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.fetchStrictJson<ReconciliationSummary>(`/api/v1/finance/reconciliation${qs}`);
  }

  async listLessorApplicationsStrict(): Promise<LessorApplicationRecord[]> {
    return this.fetchStrictJson<LessorApplicationRecord[]>('/api/v1/internal/lessor-applications');
  }

  async reviewLessorApplicationStrict(
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNote: string
  ): Promise<LessorApplicationRecord> {
    return this.fetchStrictJson<LessorApplicationRecord>(
      `/api/v1/internal/lessor-applications/${encodeURIComponent(applicationId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, reviewNote }),
      }
    );
  }

  async fetchAdminTenantsStrict(): Promise<AdminTenantOverview[]> {
    return this.fetchStrictJson<AdminTenantOverview[]>('/api/v1/admin/tenants');
  }

  async updateAdminTenantStatusStrict(
    tenantId: string,
    status: 'ACTIVE' | 'SUSPEND'
  ): Promise<AdminTenantOverview> {
    return this.fetchStrictJson<AdminTenantOverview>(
      `/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  }

  async fetchAdminVenueGroupsStrict(tenantId?: string): Promise<AdminVenueGroup[]> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.fetchStrictJson<AdminVenueGroup[]>(`/api/v1/admin/resource-groups${qs}`);
  }

  async fetchAdminUsersStrict(q?: string, status?: string): Promise<AdminUserAccount[]> {
    const params = new URLSearchParams();
    if (q?.trim()) params.set('q', q.trim());
    if (status && status !== 'ALL') params.set('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchStrictJson<AdminUserAccount[]>(`/api/v1/admin/users${qs}`);
  }

  async updateAdminUserStatusStrict(
    userId: string,
    status: 'ACTIVE' | 'INACTIVE'
  ): Promise<void> {
    await this.fetchStrictJson(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async assignAdminUserRoleStrict(
    userId: string,
    roleCode: string,
    tenantId?: string | null
  ): Promise<void> {
    await this.fetchStrictJson(`/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode, tenantId: tenantId || null }),
    });
  }

  async fetchAdminRbacMatrixStrict(): Promise<AdminRbacMatrix> {
    return this.fetchStrictJson<AdminRbacMatrix>('/api/v1/admin/rbac-matrix');
  }

  async fetchAdminCommissionRulesStrict(): Promise<AdminCommissionRule[]> {
    return this.fetchStrictJson<AdminCommissionRule[]>('/api/v1/admin/commission-rules');
  }

  async createCommissionRuleStrict(payload: {
    tenantId?: string | null;
    sportTypeId?: number | null;
    ratePercent: number;
    appliesToForfeit?: boolean;
    effectiveFrom: string;
    effectiveTo: string;
  }): Promise<void> {
    await this.fetchStrictJson('/api/v1/finance/commission-rules', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: payload.tenantId || null,
        sportTypeId: payload.sportTypeId || null,
        ratePercent: payload.ratePercent,
        commissionBasis: 'COLLECTED_DEPOSIT',
        appliesToForfeit: payload.appliesToForfeit ?? true,
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
      }),
    });
  }

  async fetchAdminLedgerEntriesStrict(
    tenantId?: string,
    limit = 80
  ): Promise<AdminLedgerEntry[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (tenantId) params.set('tenantId', tenantId);
    return this.fetchStrictJson<AdminLedgerEntry[]>(
      `/api/v1/admin/ledger-entries?${params.toString()}`
    );
  }

  async fetchAdminAuditLogsStrict(
    action?: string,
    tenantId?: string,
    limit = 80
  ): Promise<AdminAuditLogEntry[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (action && action !== 'ALL') params.set('action', action);
    if (tenantId) params.set('tenantId', tenantId);
    return this.fetchStrictJson<AdminAuditLogEntry[]>(
      `/api/v1/admin/audit-logs?${params.toString()}`
    );
  }

  async createSportTypeStrict(code: string, name: string): Promise<SportTypeItem> {
    return this.fetchStrictJson<SportTypeItem>('/api/v1/sport-types', {
      method: 'POST',
      body: JSON.stringify({ code, name }),
    });
  }

  async listAdminAccounts(): Promise<{ live: boolean; accounts: AdminUserAccount[] }> {
    const accounts = await this.fetchAdminUsersStrict();
    return { live: true, accounts };
  }

  async createAdminAccount(payload: {
    username: string; email: string; password: string; firstName: string; lastName: string;
    phone?: string; roleCode: RoleCode; tenantId?: string | null;
  }): Promise<{ live: boolean; account: { username: string } }> {
    const account = await this.checkoutRequest<{ username: string }>('/admin/users', payload);
    return { live: true, account };
  }

  async toggleAdminAccountStatus(userId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ live: boolean }> {
    await this.checkoutRequest(`/admin/users/${userId}/status`, { status }, undefined, 'PATCH');
    return { live: true };
  }

  async assignAdminAccountRole(userId: string, roleCode: RoleCode, tenantId?: string | null): Promise<{ live: boolean }> {
    await this.checkoutRequest(`/admin/users/${userId}/roles`, { roleCode, tenantId });
    return { live: true };
  }

  async getManagedListings(tenantId: string): Promise<PublishedListing[]> {
    const listings = await this.checkoutRequest<PublishedListing[]>(`/inventory/groups?tenantId=${tenantId}`);
    return listings.map(enrichListingVisuals);
  }

  updateGroupSettings(groupId: string, patch: object): Promise<void> {
    return this.checkoutRequest(`/inventory/groups/${groupId}/settings`, patch, undefined, 'PATCH');
  }

  publishGroup(groupId: string, publish: boolean): Promise<void> {
    return this.checkoutRequest(`/inventory/groups/${groupId}/${publish ? 'publish' : 'unpublish'}`, {});
  }

  async createManagedCourt(listing: PublishedListing, tenantId: string): Promise<string> {
    const policies = await this.checkoutRequest<{ id: string; status: string }[]>(`/cancellation-policies?tenantId=${tenantId}`);
    const { id } = await this.checkoutRequest<{ id: string }>('/inventory/groups', {
      tenantId, code: listing.groupCode, name: listing.groupName, sportCode: listing.sportCode,
      totalUnits: listing.totalUnits ?? 1, basePrice: listing.basePrice,
      minPrice: listing.minPrice, maxPrice: listing.maxPrice, depositPercent: listing.depositPercent,
      cancellationPolicyId: listing.depositPercent > 0 ? policies.find(policy => policy.status === 'ACTIVE')?.id : undefined,
      slotMinutes: listing.slotMinutes, checkinMode: listing.checkinMode,
    });
    return id;
  }

  createBusinessSlot(groupId: string, slotStart: string, slotEnd: string): Promise<void> {
    return this.checkoutRequest('/inventory/slots', { groupId, slotStart, slotEnd });
  }

  updateVenue(tenantId: string, patch: object): Promise<void> {
    return this.checkoutRequest(`/tenants/${tenantId}/settings`, patch, undefined, 'PATCH');
  }

  getVenueStaff(tenantId: string): Promise<VenueStaffAccount[]> {
    return this.checkoutRequest(`/tenants/${tenantId}/staff`);
  }

  createVenueStaff(tenantId: string, payload: object): Promise<VenueStaffAccount> {
    return this.checkoutRequest(`/tenants/${tenantId}/staff`, payload);
  }

  getVenueOperationsDashboard(tenantId: string, signal?: AbortSignal): Promise<import('../types/marketplace').VenueOperationsSnapshot> {
    const query = new URLSearchParams({ tenantId });
    return this.checkoutRequest(`/checkins/dashboard?${query}`, undefined, signal);
  }

  async getVenueOrders(tenantId: string): Promise<LessorBookingOrder[]> {
    const query = new URLSearchParams({ tenantId });
    const rows = await this.checkoutRequest<LessorBookingOrder[]>(`/checkins/orders?${query}`);
    return rows.map((order) => this.normalizeVenueOrder(order, tenantId));
  }

  async getVenueCourtStatus(tenantId: string, signal: AbortSignal): Promise<VenueCourtSnapshot> {
    const query = new URLSearchParams({ tenantId });
    const snapshot = await this.checkoutRequest<VenueCourtSnapshot>(`/checkins/court-status?${query}`, undefined, signal);
    return { ...snapshot, bookings: snapshot.bookings.map((order) => this.normalizeVenueOrder(order, tenantId)) };
  }

  getCourtFloor(tenantId: string, groupId: string, signal: AbortSignal): Promise<CourtFloorEditorData> {
    const query = new URLSearchParams({ tenantId });
    return this.checkoutRequest(`/inventory/groups/${groupId}/floor-plan?${query}`, undefined, signal);
  }

  saveCourtFloor(tenantId: string, groupId: string, draft: CourtFloorDraft): Promise<CourtFloorLayout> {
    const query = new URLSearchParams({ tenantId });
    return this.checkoutRequest(`/inventory/groups/${groupId}/floor-plan?${query}`, draft, undefined, 'PUT');
  }

  private normalizeVenueOrder(order: LessorBookingOrder, tenantId: string): LessorBookingOrder {
    const baseOrder = { ...order, providerId: tenantId, qrCode: '', addOnTotal: order.addOnTotal ?? 0 };
    if (!order.slotStart) return baseOrder;
    const date = new Date(order.slotStart);
    const parts = venueBookingDate.formatToParts(date);
    const field = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return {
      ...baseOrder,
      dateIso: `${field('year')}-${field('month')}-${field('day')}`,
      slotHour: Number(venueBookingHour.format(date)),
    };
  }

  listConversations(tenantId?: string): Promise<VenueConversation[]> {
    return this.checkoutRequest(tenantId ? `/conversations?tenantId=${tenantId}` : '/conversations');
  }

  openConversation(tenantId: string): Promise<VenueConversation> {
    return this.checkoutRequest('/conversations', { tenantId });
  }

  listMessages(id: string): Promise<VenueMessage[]> {
    return this.checkoutRequest(`/conversations/${id}/messages`);
  }

  sendMessage(id: string, body: string): Promise<VenueMessage> {
    return this.checkoutRequest(`/conversations/${id}/messages`, { body });
  }

  markNoShow(reservationId: string): Promise<void> {
    return this.checkoutRequest(`/checkins/${reservationId}/no-show`, {});
  }

  getCurrentProfile(): Promise<{ id: string; roles: AuthSession['roles'] }> {
    return this.checkoutRequest('/users/me');
  }

}

const SAVED_SESSION_STORAGE_KEY = 'arenapulse_auth_session_v1';

export function readSavedAuthSession(): { session: AuthSession; activeRole: RoleCode } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SAVED_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { session: AuthSession; activeRole: RoleCode };
    if (!parsed?.session?.accessToken) return null;
    if (parsed.session.expiresAt && new Date(parsed.session.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(SAVED_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthSessionToStorage(session: AuthSession | null, activeRole: RoleCode): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(SAVED_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      SAVED_SESSION_STORAGE_KEY,
      JSON.stringify({ session, activeRole })
    );
  } catch {
    // ignore storage quota errors
  }
}

export const marketplaceApi = new MarketplaceApiClient();

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`;
}

export function formatSlotWindow(startIso: string, endIso?: string): string {
  const s = new Date(startIso);
  const hhmm = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLabel = s.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  if (!endIso) return `${hhmm(s)} • ${dayLabel}`;
  return `${hhmm(s)}–${hhmm(new Date(endIso))} • ${dayLabel}`;
}
