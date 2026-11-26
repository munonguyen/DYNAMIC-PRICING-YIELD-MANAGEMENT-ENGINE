import { Platform } from 'react-native';

export const COLORS = {
  forest: '#16422C',
  forestDark: '#0B2217',
  mint: '#E7F7D4',
  mintInk: '#204E18',
  ink: '#0F172A',
  muted: '#64748B',
  subtleText: '#94A3B8',
  sky: '#0E4F7E',
  skySoft: '#F4F8FB',
  white: '#FFFFFF',
  canvas: '#F5F6F7',
  surfaceSoft: '#F8F9FA',
  forestSoft: '#F4F8F4',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  coral: '#D9532F',
  amberBg: '#FFFBEB',
  amberBorder: '#F5D67B',
  amberText: '#92400E',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  success: '#16A34A',
  successBg: '#ECFDF5',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const TYPOGRAPHY = {
  heroTitle: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.4 },
  screenTitle: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24, letterSpacing: -0.3 },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, lineHeight: 21 },
  cardTitle: { fontSize: 13.5, fontWeight: '600' as const, lineHeight: 19 },
  body: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11.5, fontWeight: '500' as const, lineHeight: 16 },
  micro: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
} as const;

export const SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    android: { elevation: 3 },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#16422C',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

