import React from "react";
import { Pressable, View, Text, StyleSheet, ViewStyle } from "react-native";
import { LucideIcon } from "lucide-react-native";

import { SPACE } from "@/constants/spacing";
interface ActionButtonProps {
  label: string;
  icon: LucideIcon;
  bgVariant: string;
  iconColor: string;
  buttonBg?: string;
  style?: ViewStyle;
  disabled?: boolean;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon: Icon,
  bgVariant,
  iconColor,
  buttonBg,
  style,
  disabled,
  onClick,
}) => (
  <Pressable
    onPress={disabled ? undefined : onClick}
    style={({ pressed }) => [
      styles.btn,
      buttonBg ? { backgroundColor: buttonBg } : null,
      style,
      pressed && !disabled && styles.pressed,
      disabled && styles.disabledBtn,
    ]}
  >
    <View style={[styles.iconContainer, { backgroundColor: bgVariant }]}>
      <Icon size={18} color={iconColor} strokeWidth={2.5} />
    </View>
    <Text style={styles.btnLabel}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#ffffff", // Default: --color-background-primary
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 12,
    paddingVertical: SPACE.md,
    alignItems: "center",
    width: "23%", // 4-column layout
    // Add a very subtle shadow to match the card feel
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.xs,
  },
  btnLabel: {
    fontSize: 10,
    color: "#5f5e5a", // --color-text-secondary
    textAlign: "center",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: "#f5f4f0",
  },
  disabledBtn: {
    opacity: 0.4,
  },
});

export default ActionButton;
