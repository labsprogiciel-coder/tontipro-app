import { View, Text, StyleSheet } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

const T = KAURIDORR_THEME;

interface SuccessReceiptProps {
  amount: string;
  type: "deposit" | "withdraw";
  reference: string;
  clientName?: string;
  balanceAfter?: string;
  commission?: string;
  agentName?: string;
  date?: string;
}

const SuccessReceipt = ({
  amount,
  type,
  reference,
  clientName = "—",
  balanceAfter,
  commission = "—",
  agentName = "—",
  date,
}: SuccessReceiptProps) => {
  const isDep = type === "deposit";
  const headerBg = isDep ? T.orange : T.greenDk;
  const prefix = isDep ? "+" : "−";
  const label = isDep ? "Dépôt" : "Retrait";

  return (
    <View style={styles.receipt}>
      <View style={[styles.receiptHeader, { backgroundColor: headerBg }]}>
        <Text style={styles.receiptAmount}>
          {prefix}{amount} <Text style={styles.receiptCurrency}>FCFA</Text>
        </Text>
        <Text style={styles.receiptSubtext}>
          {label} · {date ?? "—"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Client</Text>
        <Text style={styles.rowValue}>{clientName}</Text>
      </View>
      {balanceAfter ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Solde après</Text>
          <Text style={[styles.rowValue, { color: isDep ? T.green : T.orange }]}>
            {balanceAfter} FCFA
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Commission</Text>
        <Text style={styles.rowValue}>{commission} FCFA</Text>
      </View>
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        <Text style={styles.rowLabel}>Agent</Text>
        <Text style={styles.rowValue}>{agentName}</Text>
      </View>

      <Text style={styles.refText}>Réf. {reference}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  receipt: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  receiptHeader: { padding: 16, alignItems: "center" },
  receiptAmount: { color: "#fff", fontSize: 28, fontWeight: "600", letterSpacing: -0.02 * 28 },
  receiptCurrency: { fontSize: 14, fontWeight: "400", opacity: 0.75 },
  receiptSubtext: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderColor: T.border,
  },
  rowLabel: { fontSize: 12, color: T.text2 },
  rowValue: { fontSize: 13, fontWeight: "500", color: T.text1 },
  refText: {
    textAlign: "center",
    padding: 8,
    fontSize: 10,
    color: T.text3,
    borderTopWidth: 0.5,
    borderColor: T.border,
  },
});

export default SuccessReceipt;
