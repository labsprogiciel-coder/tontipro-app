// App color scheme
export const colors = {
  primary: '#4F46E5', // Indigo
  primaryLight: '#818CF8',
  secondary: '#10B981', // Emerald
  secondaryLight: '#6EE7B7',
  background: '#FFFFFF',
  card: '#F9FAFB',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  notification: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  inactive: '#9CA3AF',
};

// Color tokens derived from your HTML :root
export const KAURIDORR_THEME = {
  // Backgrounds
  bg: "#ffffff",
  bg2: "#f5f4f0",
  bg3: "#eeede8",
  bgSuccess: "#eaf3de",
  bgWarning: "#faeeda",
  bgDanger: "#fcebeb",

  // Orange (deposit)
  orange: "#D85A30",
  orangeDk: "#993C1D",
  orangeLt: "#FAE8E0",
  orangeMd: "#F0997B",

  // Green (withdraw)
  green: "#3b6d11",
  greenDk: "#2a5c0f",
  greenLt: "#eaf3de",

  // Text
  text1: "#1a1a18",
  text2: "#5f5e5a",
  text3: "#888780",
  textSuccess: "#3b6d11",
  textWarning: "#854f0b",
  textDanger: "#a32d2d",

  // Borders
  border: "rgba(0,0,0,0.09)",
  border2: "rgba(0,0,0,0.18)",

  // Legacy aliases (kept for backward compat)
  primary: "#D85A30",
  bgPrimary: "#ffffff",
  bgTertiary: "#eeede8",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
  danger: "#a32d2d",
};

// Theme configuration
export const theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.notification,
  },
};