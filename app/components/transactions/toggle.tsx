import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

const T = KAURIDORR_THEME;

const TransactionToggle = ({ activeType, setType }) => (
  <View style={styles.toggleContainer}>
    <TouchableOpacity
      onPress={() => setType("deposit")}
      style={[styles.opt, activeType === "deposit" && styles.optActiveDeposit]}
    >
      <Text style={[styles.optText, activeType === "deposit" && styles.optTextActive]}>
        ↓ Dépôt
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => setType("withdraw")}
      style={[styles.opt, activeType === "withdraw" && styles.optActiveWithdraw]}
    >
      <Text style={[styles.optText, activeType === "withdraw" && styles.optTextActive]}>
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
    padding: 3,
    gap: 3,
    marginHorizontal: 18,
    marginVertical: 14,
  },
  opt: {
    flex: 1,
    padding: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  optActiveDeposit: { backgroundColor: T.orange },
  optActiveWithdraw: { backgroundColor: T.greenDk },
  optText: { fontWeight: "500", color: T.text3, fontSize: 13 },
  optTextActive: { color: "#fff" },
});

export default TransactionToggle;
