// components/TypeToggle.tsx
import { TransactionType } from "@/constants/utils";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

interface TypeToggleProps {
  type: TransactionType;
  onTypeChange: (newType: TransactionType) => void;
}

export const TypeToggle: React.FC<TypeToggleProps> = ({
  type,
  onTypeChange,
}) => (
  <View style={styles.container}>
    <TouchableOpacity
      onPress={() => onTypeChange("deposit")}
      style={[styles.opt, type === "deposit" && { backgroundColor: T.orangeStrong }]}
    >
      <Text style={[styles.text, type === "deposit" && styles.activeText]}>
        ↓ Dépôt
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => onTypeChange("withdrawal")}
      style={[
        styles.opt,
        type === "withdrawal" && { backgroundColor: T.green },
      ]}
    >
      <Text style={[styles.text, type === "withdrawal" && styles.activeText]}>
        ↑ Retrait
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: T.bg2,
    borderRadius: 12,
    padding: SPACE.xs,
    margin: SPACE.lg,
  },
  opt: { flex: 1, padding: SPACE.sm, borderRadius: 10, alignItems: "center" },
  text: { fontSize: 13, fontWeight: "500", color: T.text3 },
  activeText: { color: "#fff" },
});
export default TypeToggle;
