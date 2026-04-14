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
  primary: "#D85A30",
  bgTertiary: "#eeede8",
  bgPrimary: "#ffffff",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
  danger: "#a32d2d",
  border: "rgba(0,0,0,0.1)",
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