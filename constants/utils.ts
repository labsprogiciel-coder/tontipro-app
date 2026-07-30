export type StatusVariant = "info" | "success" | "warning" | "danger";
export type TransactionType = "deposit" | "withdrawal";

export interface StatusBadgeProps {
  text: string; // e.g., "Actif"
  variant: "ok" | "warn" | "neu"; // Maps to CSS classes: badge-ok, badge-warn, etc.
}

export interface NavTabProps {
  label: string; // e.g., "Accueil"
  icon: React.ReactNode; // SVG icon
  isActive?: boolean; // Toggles the brand color (#D85A30)
  onClick: () => void;
}

// Mapping variants to the colors defined in your design
export const avatarColors = {
  info: { bg: "#e6f1fb", text: "#185fa5" },
  warning: { bg: "#faeeda", text: "#854f0b" },
  success: { bg: "#eaf3de", text: "#3b6d11" },
};

export const badgeColors = {
  Actif: { bg: "#eaf3de", text: "#3b6d11" },
  Retard: { bg: "#FAE8E0", text: "#993C1D" },
  Neutre: { bg: "#f5f4f0", text: "#5f5e5a" },
};
