import type { RoleCode } from '@/types/domain';

export interface RoleCapabilityRule {
  role: RoleCode;
  displayName: string;
  badgeColor: string;
  canViewPublicMarketplace: boolean;
  canAccessPricingStudio: boolean;
  canPublishSystemAnnouncements: boolean;
  canManageVenueKycAndLedger: boolean;
  canConfigureSurgeCeiling: boolean;
}

export const ROLE_MATRIX: Record<RoleCode, RoleCapabilityRule> = {
  USER: {
    role: 'USER',
    displayName: 'Người thuê sân',
    badgeColor: '#0E4F7E',
    canViewPublicMarketplace: true,
    canAccessPricingStudio: false,
    canPublishSystemAnnouncements: false,
    canManageVenueKycAndLedger: false,
    canConfigureSurgeCeiling: false,
  },
  MANAGER: {
    role: 'MANAGER',
    displayName: 'Chủ sân (Lessor)',
    badgeColor: '#16422C',
    canViewPublicMarketplace: true,
    canAccessPricingStudio: true,
    canPublishSystemAnnouncements: false,
    canManageVenueKycAndLedger: false,
    canConfigureSurgeCeiling: false,
  },
  STAFF: {
    role: 'STAFF',
    displayName: 'Nhân viên Trực Sân',
    badgeColor: '#475569',
    canViewPublicMarketplace: true,
    canAccessPricingStudio: false,
    canPublishSystemAnnouncements: false,
    canManageVenueKycAndLedger: false,
    canConfigureSurgeCeiling: false,
  },
  ACCOUNTANT: {
    role: 'ACCOUNTANT',
    displayName: 'Kế toán Đối soát',
    badgeColor: '#0E4F7E',
    canViewPublicMarketplace: true,
    canAccessPricingStudio: false,
    canPublishSystemAnnouncements: false,
    canManageVenueKycAndLedger: true,
    canConfigureSurgeCeiling: false,
  },
  ADMIN: {
    role: 'ADMIN',
    displayName: 'Quản trị viên Sàn',
    badgeColor: '#D9532F',
    canViewPublicMarketplace: true,
    canAccessPricingStudio: true,
    canPublishSystemAnnouncements: true,
    canManageVenueKycAndLedger: true,
    canConfigureSurgeCeiling: true,
  },
};

export function hasPricingAccess(role: RoleCode, isAuthenticated: boolean): boolean {
  if (!isAuthenticated) return false;
  return ROLE_MATRIX[role].canAccessPricingStudio;
}

