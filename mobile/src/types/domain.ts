export type RoleCode = 'USER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT' | 'ADMIN';

export type MobileTabId = 'home' | 'courts' | 'lessors' | 'community' | 'account';

export type MobileModalScreenId =
  | 'courtDetail'
  | 'checkout'
  | 'chat'
  | 'pricingStudio'
  | 'governance'
  | 'login';

export type PaymentGatewayCode = 'VNPAY_ESCROW' | 'MOMO_WALLET' | 'VIETQR_NAPAS' | 'INTL_CARD';

export interface SportTypeItem {
  id: number;
  code: string;
  name: string;
  icon: string;
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
  commissionRatePct: number;
  followersCount: number;
  followingCount: number;
  onlineStatusLabel: string;
  joinedLabel: string;
  legalEntityType: string;
  voucherLabel: string;
  shopSlogan: string;
  platformGuarantee: string;
}

export interface SlotListingQuote {
  slotStart: string;
  slotEnd: string;
  totalCapacity: number;
  availableCourts: number;
  currentDynamicPrice: number;
  timePeriod: 'MORNING' | 'AFTERNOON' | 'EVENING';
  occupancyPct: number;
  demandTag: 'OFF_PEAK' | 'STANDARD' | 'PRIME_SURGE' | 'SOLD_OUT';
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
  rating: number;
  reviewCount: number;
  surface: string;
  lighting: string;
  amenities: string[];
  provider: VenueProviderInfo;
  upcomingSlots: SlotListingQuote[];
}

export interface PriceQuote {
  groupId: string;
  slotStart: string;
  slotEnd: string;
  currentPrice: number;
  priceLockToken: string;
  expiresAt: string;
}

export interface HoldSlotResult {
  reservationId: string;
  unitNumber: string;
  groupId: string;
  slotStart: string;
  lockedPrice: number;
  depositAmount: number;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED';
  qrToken?: string;
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
}

export interface ChatMessageItem {
  id: string;
  senderRole: RoleCode;
  senderName: string;
  body: string;
  createdAt: string;
  courtCard?: ChatAttachedCourtCard;
}

export interface VenueAnnouncement {
  id: string;
  venueName: string;
  city: string;
  audience: 'ALL_USERS' | 'USER' | 'VIP';
  category: 'WEATHER_OPS' | 'VIP_PERK' | 'MAINTENANCE' | 'SYSTEM_UPDATE';
  severity: 'IMPORTANT' | 'INFO' | 'POSITIVE';
  title: string;
  summary: string;
  effectiveWindow: string;
  publishedAt: string;
}

export interface PersonalUserNotification {
  id: string;
  kind: 'TICKET_QR' | 'PAYMENT' | 'HOLD_TIMER';
  title: string;
  body: string;
  timestampLabel: string;
  isNew: boolean;
}

export interface NewsArticleItem {
  id: string;
  categoryLabel: string;
  title: string;
  sapo: string;
  authorName: string;
  publishedDate: string;
  readMinutes: number;
  bodyParagraphs: string[];
}

export interface TopUserRankItem {
  rank: number;
  fullName: string;
  city: string;
  favoriteSport: string;
  tierLabel: 'Diamond' | 'Platinum' | 'Gold';
  points: number;
  onTimeCheckInRate: number;
}

export interface TopLessorRankItem {
  rank: number;
  providerId: string;
  venueName: string;
  city: string;
  rating: number;
  occupancyPct: number;
  completedSessions: number;
}

export interface AuthSession {
  userId: string;
  username: string;
  fullName: string;
  activeRole: RoleCode;
}

