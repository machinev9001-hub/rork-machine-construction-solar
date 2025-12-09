export const Colors = {
  background: "#000000",
  text: "#FFFFFF",
  textSecondary: "#A0A0A0",
  accent: "#FFD600",
  surface: "#1A1A1A",
  border: "#333333",
  cardBg: "#FFFFFF",
  headerBg: "#000000",
  successBg: "#064E3B",
  successText: "#6EE7B7",
  warningBg: "#78350F",
  warningText: "#FCD34D",
  errorBg: "#7F1D1D",
  errorText: "#FCA5A5",
  infoBg: "#1E3A8A",
  infoText: "#93C5FD",
} as const;

export const BACKGROUND_COLOR = '#000000';

export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  accent: string;
  surface: string;
  border: string;
  cardBg: string;
  headerBg: string;
  headerBorder: string;
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;
  errorBg: string;
  errorText: string;
  infoBg: string;
  infoText: string;
};

export const AppTheme: ThemeColors = {
  background: '#000000',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  accent: '#FFD600',
  surface: '#1A1A1A',
  border: '#333333',
  cardBg: '#FFFFFF',
  headerBg: '#000000',
  headerBorder: '#FFD600',
  successBg: '#064E3B',
  successText: '#6EE7B7',
  warningBg: '#78350F',
  warningText: '#FCD34D',
  errorBg: '#7F1D1D',
  errorText: '#FCA5A5',
  infoBg: '#1E3A8A',
  infoText: '#93C5FD',
};

export const RoleAccentColors = {
  master: '#FFD600',
  Admin: '#3B82F6',
  Planner: '#10B981',
  Supervisor: '#F59E0B',
  QC: '#EF4444',
  Operator: '#8B5CF6',
  'Plant Manager': '#FF6B35',
  Surveyor: '#06B6D4',
  'Staff Manager': '#4ECDC4',
  'Logistics Manager': '#FF9F1C',
  HR: '#2EC4B6',
  'Onboarding & Inductions': '#9333EA',
  'General Worker': '#6B7280',
  HSE: '#F43F5E',
  Accounts: '#10B981',
} as const;

export const getRoleAccentColor = (role?: string): string => {
  if (!role) return RoleAccentColors.master;
  return RoleAccentColors[role as keyof typeof RoleAccentColors] || RoleAccentColors.master;
};

export const OFFLINE_CONFIG = {
  ENABLE_OFFLINE_SYNC: true,
  ENABLE_USER_CACHE: true,
  ENABLE_OFFLINE_QUEUE: true,
  ENABLE_FULL_DATA_CACHE: false,
} as const;
