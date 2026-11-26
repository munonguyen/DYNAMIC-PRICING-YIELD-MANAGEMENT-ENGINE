import type { MobileTabId } from '@/types/domain';

export interface MobileTabConfig {
  id: MobileTabId;
  label: string;
  icon: string;
}

export const MOBILE_TABS: MobileTabConfig[] = [
  { id: 'home', label: 'Trang chủ', icon: '⌂' },
  { id: 'courts', label: 'Thuê sân', icon: '◫' },
  { id: 'lessors', label: 'Gian hàng', icon: '⊞' },
  { id: 'community', label: 'Bảng tin', icon: '★' },
  { id: 'account', label: 'Nội bộ', icon: '⚙' },
];

