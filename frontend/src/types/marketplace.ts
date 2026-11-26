export type RoleCode = 'USER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT' | 'ADMIN';

export interface SportTypeItem {
  id: number;
  code: string;
  name: string;
  status: string;
}

export interface SlotListingQuote {
  slotStart: string;
  slotEnd: string;
  totalCapacity: number;
  availableCourts: number;
  currentDynamicPrice: number;
  timeLabel?: string;
  timePeriod?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  occupancyPct?: number;
  demandTag?: 'OFF_PEAK' | 'STANDARD' | 'PRIME_SURGE' | 'SOLD_OUT';
}

export interface VenueProviderInfo {
  providerId: string;
  providerName: string;
  badge: string;
  city: string;
  district: string;
  verified: boolean;
  yearsPartner: number;
  responseRatePct: number;
  responseTimeLabel: string;
  totalManagedCourts: number;
  commissionRatePct: number; // Hoa hồng sàn thu từ đối tác (%)
  platformGuarantee: string;
  followersCount?: number;
  followingCount?: number;
  onlineStatusLabel?: string;
  joinedLabel?: string;
  legalEntityType?: string;
  coverImageUrl?: string;
  shopSlogan?: string;
  voucherLabel?: string;
}

export interface CourtSpecsInfo {
  surface: string;
  lighting: string;
  dimensions: string;
  amenities: string[];
}

export type CourtServiceCategory = 'DRINKS' | 'EQUIPMENT' | 'SUPPORT' | 'FACILITY';

export interface CourtServiceOption {
  id: string;
  sportCode: string;
  category: CourtServiceCategory;
  name: string;
  description: string;
  unitLabel: string;
  unitPrice: number;
  maxQty: number;
  imageUrl: string;
  popular?: boolean;
  enabled?: boolean;
}

export interface SelectedCourtServiceItem {
  service: CourtServiceOption;
  quantity: number;
}

export interface CourtMediaItem {
  mediaId: string;
  groupId: string;
  url: string;
  fileName?: string;
  contentType?: string;
  fileSizeBytes?: number;
  caption?: string;
  sourceType?: 'LOCAL_DISK' | 'STATIC_ASSET' | 'CLIENT_PREVIEW' | string;
  isCover: boolean;
  displayOrder?: number;
  createdAt?: string;
}

export interface PublishedListing {
  groupId: string;
  groupCode: string;
  groupName: string;
  tenantId: string;
  venueName: string;
  venueAddress: string;
  city: string;
  district: string;
  sportCode: string;
  sportName: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  depositPercent: number;
  slotMinutes: number;
  checkinMode: 'QR_STAFF' | 'MANUAL';
  imageUrl?: string;
  galleryImages?: string[];
  galleryCaptions?: string[];
  galleryMedia?: CourtMediaItem[];
  architecturalBadge?: string;
  rating?: number;
  reviewCount?: number;
  provider?: VenueProviderInfo;
  specs?: CourtSpecsInfo;
  addOnServices?: CourtServiceOption[];
  published?: boolean;
  upcomingSlots: SlotListingQuote[];
}

export interface PricingAudit {
  basePrice: number;
  timeMultiplier: number;
  matrixMultiplier: number;
  contextMultiplier: number;
  rawPrice: number;
  clampedPrice: number;
  occupancyPercentage: number;
  leadHours: number;
  calculatedAt: string;
}

export interface PriceQuote {
  groupId: string;
  slotStart: string;
  slotEnd: string;
  currentPrice: number;
  priceLockToken: string;
  tokenJti: string;
  kid: string;
  expiresAt: string;
  audit: PricingAudit;
}

export interface HoldSlotResult {
  bookingId: string;
  reservationId: string;
  unitId: string;
  unitNumber: string;
  groupId: string;
  slotStart: string;
  userId: string;
  lockedPrice: number;
  depositAmount: number;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'EXPIRED';
  holdExpiresAt: string;
  qrToken?: string;
}

export interface CancelBookingResult {
  reservationId: string;
  status: string;
  depositAmount: number;
  refundAmount: number;
  forfeitedAmount: number;
  appliedRefundPercent: number;
  venueInitiated: boolean;
  cancelledAt: string;
}

export interface QrCodeTicket {
  reservationId: string;
  qrJti: string;
  qrToken: string;
  expiresAt: string;
}

export interface MyTicketRecord {
  reservationId: string;
  venueName: string;
  venueAddress: string;
  groupName: string;
  unitNumber: string;
  slotStart: string;
  slotEnd: string;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'EXPIRED';
  lockedPrice: number;
  depositAmount: number;
  paidOnlineAmount: number;
  remainingAtVenue: number;
  contactEmail?: string | null;
  qrJti?: string | null;
  qrToken?: string | null;
  qrExpiresAt?: string | null;
}

export type PaymentGatewayCode = 'VIETQR_NAPAS' | 'VNPAY_ESCROW' | 'MOMO_WALLET' | 'INTL_CARD';

export interface MoMoPaymentSession {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  payUrl: string;
  qrCodeUrl: string;
  deeplink?: string;
  resultCode: number;
  message: string;
  liveGatewayResponse: boolean;
  signature: string;
}

export interface VnPayPaymentUrlResult {
  code: string;
  message: string;
  paymentUrl: string;
  txnRef: string;
  reservationId: string;
  amountVnd: number;
  vnpAmount: number;
  createDate: string;
  expireDate: string;
  status: string;
}

export interface VnPayReturnResult {
  code: string;
  message: string;
  signatureValid: boolean;
  paymentSucceeded: boolean;
  txnRef?: string | null;
  reservationId?: string | null;
  reservationStatus?: string | null;
  transactionNo?: string | null;
  bankCode?: string | null;
  cardType?: string | null;
  payDate?: string | null;
  responseCode?: string | null;
  transactionStatus?: string | null;
  amountVnd: number;
}

export type PaymentPlanMode = 'DEPOSIT_ESCROW' | 'FULL_ONLINE';

export interface PaymentReceiptInfo {
  provider: PaymentGatewayCode;
  providerLabel: string;
  providerRef: string;
  paymentType: 'DEPOSIT' | 'FULL_SETTLEMENT';
  paidAmount: number;
  remainingAtVenue: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  needVatInvoice?: boolean;
  vatCompanyName?: string;
  vatTaxCode?: string;
  note?: string;
  paidAt: string;
}

export interface CheckInResult {
  checkInId: string;
  reservationId: string;
  tenantId: string;
  method: string;
  reservationStatus: string;
  scannedAt: string;
}

export interface SimulationMetrics {
  modelName: string;
  totalBookings: number;
  occupancyRate: number;
  totalRevenue: number;
  revPar: number;
}

export interface SimulationResult {
  totalSimulatedUsers: number;
  simulationDays: number;
  totalCourts: number;
  totalSlotHours: number;
  fixedPricing: SimulationMetrics;
  dynamicPricing: SimulationMetrics;
  revenueUpliftPct: number;
  revParUpliftPct: number;
  summaryMessage: string;
}

export interface ReconciliationSummary {
  tenantId: string | null;
  fromTime: string;
  toTime: string;
  totalGatewayDebits: number;
  totalEscrowCredits: number;
  totalPlatformCommission: number;
  totalVenuePayable: number;
  totalCustomerRefunds: number;
  totalForfeitedDeposits: number;
  doubleEntryBalanced: boolean;
}

export interface QrInspectResult {
  valid: boolean;
  verdictCode:
    | 'VALID_READY'
    | 'INVALID_SIGNATURE'
    | 'EXPIRED'
    | 'WRONG_VENUE'
    | 'ALREADY_USED'
    | 'CANCELLED_OR_NO_SHOW'
    | 'NOT_FOUND';
  verdictMessage: string;
  signatureValid: boolean;
  notExpired: boolean;
  venueMatched: boolean;
  unusedAntiReplay: boolean;
  reservationId?: string | null;
  qrJti?: string | null;
  orderId?: string | null;
  unitNumber?: string | null;
  groupName?: string | null;
  slotLabel?: string | null;
  customerName?: string | null;
  customerPhoneMasked?: string | null;
  customerPhoneLast4?: string | null;
  customerEmail?: string | null;
  totalPrice?: number;
  paidAmount?: number;
  remainingAtVenue?: number;
  status?: string | null;
  previousScannedAt?: string | null;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  managedProviderId?: string | null;
  roles: { roleCode: RoleCode; scope: 'PLATFORM' | 'TENANT'; tenantId?: string | null }[];
}

export interface ProvisionedAccountHint {
  username: string;
  passwordHint: string;
  fullName: string;
  roleCode: RoleCode;
  roleLabel: string;
  providerId?: string;
  providerName?: string;
  badgeColor: 'forest' | 'ocean' | 'amber' | 'slate';
}

export interface LessorBookingOrder {
  orderId: string;
  reservationId: string;
  providerId: string;
  groupId: string;
  groupName: string;
  venueName: string;
  sportName: string;
  unitNumber: string;
  slotLabel: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  courtPrice: number;
  addOnSummary?: string;
  addOnTotal: number;
  paidEscrow: number;
  remainingAtVenue: number;
  paymentGateway: string;
  qrCode: string;
  qrToken?: string;
  qrJti?: string;
  status: 'CONFIRMED' | 'HELD' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  createdAtLabel: string;
  dateIso?: string;
  slotHour?: number;
}

export interface LessorStaffMember {
  id: string;
  providerId: string;
  username: string;
  passwordPlain: string;
  fullName: string;
  phone: string;
  shiftLabel: string;
  active: boolean;
  createdAt: string;
}

export interface LessorPayoutRecord {
  payoutId: string;
  providerId: string;
  requestedAt: string;
  grossAmount: number;
  commissionAmount: number;
  netReceived: number;
  bankLabel: string;
  status: 'SETTLED' | 'PROCESSING';
}

export interface DailyRevenuePoint {
  dateIso: string;
  dayLabel: string;
  fullDateLabel: string;
  courtRevenue: number;
  serviceRevenue: number;
  bookingsCount: number;
  occupancyPct: number;
}

export interface HourlyOccupancyPoint {
  hourLabel: string;
  occupancyPct: number;
  avgPrice: number;
  tier: 'THẤP ĐIỂM' | 'TIÊU CHUẨN' | 'GIỜ VÀNG' | string;
}

export interface ChannelBreakdownItem {
  label: string;
  pct: number;
  amount: number;
  color: string;
}

export interface CourtPerformanceItem {
  groupId: string;
  groupName: string;
  sportCode: string;
  sportName: string;
  basePrice: number;
  bookingsCount: number;
  occupancyPct: number;
  totalRevenue: number;
}

export interface AnalyticsDashboardData {
  scope: 'LESSOR' | 'PLATFORM' | string;
  tenantId: string | null;
  dataSource: 'ELASTICSEARCH_CQRS' | 'POSTGRESQL_DB' | 'LOCAL_SESSION_DB' | string;
  queryLatencyMs: number;
  indexedDocuments: number;
  grossRevenue: number;
  escrowHeld: number;
  commissionAmount: number;
  withdrawableBalance: number;
  totalBookings: number;
  pendingCheckins: number;
  avgOccupancyPct: number;
  dailyRevenue: DailyRevenuePoint[];
  hourlyOccupancy: HourlyOccupancyPoint[];
  channelBreakdown: ChannelBreakdownItem[];
  courtPerformance: CourtPerformanceItem[];
  recentOrders: LessorBookingOrder[];
}

export interface CourtSearchResponseData {
  dataSource: 'ELASTICSEARCH_CQRS' | 'POSTGRESQL_DB' | 'LOCAL_FILTER' | string;
  queryLatencyMs: number;
  totalHits: number;
  hits: { groupId: string; score: number }[];
}

export interface ReindexResultData {
  elasticsearchReachable: boolean;
  indexedBookings: number;
  indexedCourts: number;
  durationMs: number;
  message: string;
}

export type AppPageId =
  | 'home'
  | 'courts'
  | 'lessors'
  | 'news'
  | 'announcements'
  | 'rankings'
  | 'checkout'
  | 'pricing'
  | 'governance'
  | 'login';

export type AnnouncementAudience = 'ALL_USERS' | 'USER' | 'VIP';

export type AnnouncementCategory =
  | 'ARTICLE'
  | 'ACCOUNT_PAYMENT'
  | 'VIP_PERK'
  | 'WEATHER_OPS'
  | 'MAINTENANCE'
  | 'PROMOTION'
  | 'TOURNAMENT'
  | 'SYSTEM_UPDATE';

export type AnnouncementSeverity = 'IMPORTANT' | 'INFO' | 'POSITIVE';

export interface VenueLocationInfo {
  locationId: string;
  venueName: string;
  city: string;
  district: string;
  address: string;
  openHours: string;
  parkingNote: string;
  operationalStatus: 'NORMAL' | 'WEATHER_WATCH' | 'PARTIAL_MAINTENANCE';
  imageUrl: string;
}

export interface VenueAnnouncement {
  id: string;
  locationId: string; // 'ALL' for system-wide or specific locationId
  venueName: string;
  city: string;
  audience?: AnnouncementAudience;
  category: AnnouncementCategory;
  severity: AnnouncementSeverity;
  pinned?: boolean;
  title: string;
  summary: string;
  articleContent?: string[];
  articleSections?: { heading: string; paragraphs: string[] }[];
  keyTakeaways?: string[];
  pullQuote?: string;
  authorName?: string;
  readMinutes?: number;
  coverImageUrl?: string;
  imageCaption?: string;
  effectiveWindow: string;
  publishedAt: string;
  relatedSportCode?: string;
  vipCode?: string;
  actionLabel?: string;
  actionTargetPage?: AppPageId;
}

export interface PersonalUserNotification {
  id: string;
  kind: 'TICKET_QR' | 'PAYMENT' | 'HOLD_TIMER' | 'SCHEDULE_REMINDER' | 'SECURITY';
  title: string;
  body: string;
  timestampLabel: string;
  isNew: boolean;
  actionLabel?: string;
  actionTargetPage?: AppPageId;
}

export type NewsCategory = 'YIELD_TECH' | 'COURT_GUIDE' | 'COMMUNITY' | 'FINANCE_LAW';

export interface NewsArticleSection {
  heading: string;
  paragraphs: string[];
}

export interface NewsArticleItem {
  id: string;
  slug: string;
  category: NewsCategory;
  categoryLabel: string;
  title: string;
  sapo: string;
  authorName: string;
  authorRole: string;
  publishedDate: string;
  readMinutes: number;
  coverImageUrl: string;
  imageCaption: string;
  featured?: boolean;
  pullQuote: string;
  keyTakeaways: string[];
  sections: NewsArticleSection[];
  ctaLabel?: string;
  ctaTargetPage?: AppPageId;
}

export interface TopUserRankItem {
  rank: number;
  userId: string;
  fullName: string;
  handle: string;
  city: string;
  favoriteSport: string;
  tierLabel: 'Diamond' | 'Platinum' | 'Gold';
  totalHoursPlayed: number;
  confirmedBookings: number;
  onTimeCheckInRate: number;
  points: number;
}

export interface TopLessorRankItem {
  rank: number;
  locationId: string;
  venueName: string;
  ownerEntity: string;
  city: string;
  rating: number;
  occupancyPct: number;
  completedSessions: number;
  escrowVolumeLabel: string;
  badges: string[];
  coverImageUrl: string;
}

export interface ChatAttachedCourtCard {
  groupId: string;
  groupName: string;
  venueName: string;
  sportName: string;
  minPrice: number;
  maxPrice: number;
  depositPercent: number;
  availableCourts: number;
  imageUrl?: string;
}

export interface ChatMessageItem {
  id: string;
  senderRole: string;
  senderName: string;
  body: string;
  createdAt: string;
  courtCard?: ChatAttachedCourtCard;
}

export type LessorBusinessType = 'ENTERPRISE' | 'HOUSEHOLD_BUSINESS';

export type PropertyRightType = 'OWNERSHIP_CERT' | 'LEASE_WITH_SUBLEASE' | 'PPP_CONCESSION';

export interface OtpChallengeResult {
  challengeId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  sandboxOtpHint?: string | null;
}

export interface LessorApplicationPayload {
  otpVerificationToken: string;
  businessType: LessorBusinessType;
  legalEntityName: string;
  representativeFullName: string;
  representativeDob: string;
  representativeGender: 'MALE' | 'FEMALE';
  cccdNumber: string;
  cccdIssueDate: string;
  cccdIssuePlace: string;
  contactPhone: string;
  contactEmail: string;
  taxCode: string;
  businessLicenseNumber: string;
  businessLicenseIssuedDate: string;
  venueName: string;
  venueAddress: string;
  city: string;
  district: string;
  sportCodes: string[];
  totalCourts: number;
  propertyRightType: PropertyRightType;
  propertyDocumentNumber: string;
  propertyExpiryDate: string;
  pcccCertificateNumber: string;
  fireSafetyConfirmed: boolean;
  sportSafetyConfirmed: boolean;
  bankCode: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  proposedDepositPercent: number;
  acceptedCommissionRate: number;
  legalCommitmentsAccepted: boolean;
}

export interface LegalValidationCheckResult {
  ruleCode: string;
  legalBasis: string;
  passed: boolean;
  detail: string;
}

export interface LegalValidationPreview {
  valid: boolean;
  cccdProvinceName: string | null;
  checks: LegalValidationCheckResult[];
}

export interface LessorApplicationReceipt {
  id: string;
  referenceCode: string;
  venueName: string;
  legalEntityName: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface LessorApplicationRecord {
  id: string;
  referenceCode: string;
  businessType: LessorBusinessType;
  legalEntityName: string;
  representativeFullName: string;
  maskedCccdNumber: string;
  taxCode: string;
  businessLicenseNumber: string;
  venueName: string;
  venueAddress: string;
  city: string;
  district: string;
  sportCodes: string;
  totalCourts: number;
  propertyRightType: PropertyRightType;
  propertyDocumentNumber: string;
  propertyExpiryDate?: string | null;
  pcccCertificateNumber: string;
  bankCode: string;
  maskedBankAccountNumber: string;
  bankAccountHolder: string;
  proposedDepositPercent: number;
  acceptedCommissionRate: number;
  otpVerified: boolean;
  riskScore: number;
  internalRiskFlags?: string | null;
  validationSummary: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  provisionedTenantId?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

