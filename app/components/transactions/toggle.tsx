import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

type TransactionToggleType = "deposit" | "withdraw";

interface TransactionToggleProps {
  activeType: TransactionToggleType;
  setType: (type: TransactionToggleType) => void;
}

const TransactionToggle = ({ activeType, setType }: TransactionToggleProps) => (
  <View style={styles.toggleContainer}>
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: activeType === "deposit" }}
      accessibilityLabel="Dépôt"
      onPress={() => setType("deposit")}
      style={[styles.opt, activeType === "deposit" && styles.optActiveDeposit]}
    >
      <Text
        style={[
          styles.optText,
          activeType === "deposit" && styles.optTextActive,
        ]}
      >
        ↓ Dépôt
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: activeType === "withdraw" }}
      accessibilityLabel="Retrait"
      onPress={() => setType("withdraw")}
      style={[
        styles.opt,
        activeType === "withdraw" && styles.optActiveWithdraw,
      ]}
    >
      <Text
        style={[
          styles.optText,
          activeType === "withdraw" && styles.optTextActive,
        ]}
      >
        ↑ Retrait
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: T.bg2,
    borderRadius: 12,
    padding: SPACE.xs,
    gap: SPACE.xxs,
    marginHorizontal: SPACE.lg,
    marginVertical: SPACE.md,
  },
  opt: {
    flex: 1,
    padding: SPACE.sm,
    borderRadius: 10,
    alignItems: "center",
  },
  optActiveDeposit: { backgroundColor: T.orangeStrong },
  optActiveWithdraw: { backgroundColor: T.greenDk },
  optText: { fontWeight: "500", color: T.text3, fontSize: 13 },
  optTextActive: { color: "#fff" },
});

export default TransactionToggle;
