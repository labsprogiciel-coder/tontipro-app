// components/KButton.tsx
import { TransactionType } from "@/constants/utils";
import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

interface KButtonProps {
  title: string;
  onPress: () => void;
  type?: TransactionType;
  disabled?: boolean;
  style?: ViewStyle;
}

export const KButton: React.FC<KButtonProps> = ({
  title,
  onPress,
  type = "deposit",
  disabled = false,
  style,
}) => {
  const bgColor = type === "deposit" ? T.orangeStrong : T.green;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        { backgroundColor: bgColor },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    marginHorizontal: SPACE.lg,
    padding: SPACE.lg,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "500" },
});
export default KButton;
