import { StatusVariant } from "@/constants/utils";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { SPACE } from "@/constants/spacing";
// 1. Add 'as const' so TS knows the exact values
export const avatarColors = {
  info: { bg: "#e6f1fb", text: "#185fa5" },
  warning: { bg: "#faeeda", text: "#854f0b" },
  success: { bg: "#eaf3de", text: "#3b6d11" },
} as const;

export const badgeColors = {
  Actif: { bg: "#eaf3de", text: "#3b6d11" },
  Retard: { bg: "#FAE8E0", text: "#993C1D" },
  Neutre: { bg: "#f5f4f0", text: "#5f5e5a" },
} as const;

interface ClientCardProps {
  name: string;
  phone: string;
  amount: number | string;
  status: keyof typeof badgeColors;
  initials: string;
  avatarVariant: keyof typeof avatarColors;
  onPress?: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({
  initials,
  name,
  phone,
  amount,
  status,
  avatarVariant,
  onPress,
}) => {
  const avatarStyle = avatarColors[avatarVariant];
  const badgeStyle = badgeColors[status];

  return (
    <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar Section */}
      <View style={[styles.avatar, { backgroundColor: avatarStyle.bg }]}>
        <Text style={[styles.avatarText, { color: avatarStyle.text }]}>
          {initials}
        </Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{name}</Text>
        <Text style={styles.phoneText}>{phone}</Text>
      </View>

      {/* Right-side Data */}
      <View style={styles.rightContainer}>
        <Text style={styles.amountText}>{amount}</Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
            {status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff", // --color-background-primary
    borderRadius: 14,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)", // --color-border-tertiary
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "500",
  },
  infoContainer: {
    marginLeft: SPACE.md,
    flex: 1,
  },
  nameText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a18", // --color-text-primary
  },
  phoneText: {
    fontSize: 11,
    color: "#5f5e5a", // --color-text-secondary
    marginTop: SPACE.xxs,
  },
  rightContainer: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a18",
  },
  badge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: 5,
    marginTop: SPACE.xxs,
  },
  badgeText: {
    fontSize: 10,
  },
});

export default ClientCard;
