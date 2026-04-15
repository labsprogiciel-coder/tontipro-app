import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KAURIDORR_THEME } from "@/constants/colors";
import { Numpad } from "@/app/components/ui/numpad";
import { Client } from "@/types/client";
import TransactionToggle from "@/app/components/transactions/toggle";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useRouter, useLocalSearchParams } from "expo-router";
  
  const T = KAURIDORR_THEME;
  
  const DEPOSIT_CHIPS = ["2000", "5000", "15000", "25000", "50000"];
  const WITHDRAW_CHIPS = ["5000", "10000", "20000", "30000", "50000"];
  
  interface TransactionEntryProps {
    clientName?: string;
    clientInitials?: string;
    clientBalance?: number;
    onBack?: () => void;
    onContinue?: (type: string, amount: string) => void;
  }
  
  const TransactionEntryScreen = ({
    clientName = "Awa Konaté",
    clientInitials = "AK",
    clientBalance = 85000,
    onBack,
    onContinue,
  }: TransactionEntryProps) => {
    const [type, setType] = useState<"deposit" | "withdraw">("deposit");
    const [amount, setAmount] = useState("15000");
  
    const isDeposit = type === "deposit";
    const accentColor = isDeposit ? T.orange : T.greenDk;
    const accentLt = isDeposit ? T.orangeLt : T.greenLt;
    const chips = isDeposit ? DEPOSIT_CHIPS : WITHDRAW_CHIPS;
  
    const numericAmount = parseInt(amount || "0", 10);
    const balanceAfterWithdraw = clientBalance - numericAmount;
    const showWarning = !isDeposit && numericAmount > 0;
  
    const formattedAmount = numericAmount.toLocaleString("fr-FR");
    const formattedBalance = clientBalance.toLocaleString("fr-FR");
    const formattedBalanceAfter = Math.max(0, balanceAfterWithdraw).toLocaleString("fr-FR");
  
    const handleNumpad = (digit: string) => {
      setAmount((prev) => (prev === "0" ? digit : prev + digit));
    };
  
    const handleDelete = () => {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    };

    const router = useRouter();
    const { clientId, type: typeParam } = useLocalSearchParams<{ clientId?: string; type?: string }>();
    const { clients, getClientById } = useClientStore();
    const { addTransaction } = useTransactionStore();
    
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showClientPicker, setShowClientPicker] = useState(false);
    const [notes, setNotes] = useState("");
    const [isLoading, setIsLoading] = useState(false);
  
    useEffect(() => {
      if (clientId) {
        const client = getClientById(clientId);
        if (client) setSelectedClient(client);
      }
    }, [clientId, getClientById]);

    useEffect(() => {
      if (typeParam === "withdrawal") setType("withdraw");
    }, [typeParam]);
  
    const handleAddTransaction = async () => {
      if (!selectedClient) {
        Alert.alert("Erreur", "Veuillez sélectionner un client");
        return;
      }
  
      if (!amount || parseInt(amount, 10) <= 0) {
        Alert.alert("Erreur", "Veuillez entrer un montant valide");
        return;
      }
  
      setIsLoading(true);
  
      try {
        await addTransaction({
          clientId: selectedClient.id,
          amount: parseInt(amount, 10),
          type: type === "withdraw" ? "withdrawal" : "deposit",
          notes,
        });
  
        Alert.alert(
          "Succès",
          `Dépôt de ${parseInt(amount, 10).toLocaleString()} FCFA enregistré pour ${selectedClient.name}`,
          [{ text: "OK", onPress: () => router.back() }]
        );
      } catch (error) {
        Alert.alert("Erreur", "Impossible d'enregistrer le dépôt. Veuillez réessayer.");
      } finally {
        setIsLoading(false);
      }
    };
  
  
    return (
      <SafeAreaView style={styles.screen}>
        {/* Back row */}
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.backLabel}>{selectedClient?.name ?? clientName}</Text>
        </View>
  
        {/* Toggle */}
        <TransactionToggle activeType={type} setType={setType} />
  
        {/* Client bar */}
        <View style={styles.clientBar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{clientInitials}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.clientBalance}>
              {isDeposit ? "Solde actuel" : "Solde disponible"} :{" "}
              <Text style={styles.clientBalanceStrong}>{formattedBalance} FCFA</Text>
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
  
        {/* Amount display */}
        <View style={styles.amountDisplay}>
          <Text style={styles.amountLabel}>
            Montant du {isDeposit ? "dépôt" : "retrait"}
          </Text>
          <Text style={[styles.amountValue, { color: accentColor }]}>
            {formattedAmount}{" "}
            <Text style={styles.currency}>FCFA</Text>
          </Text>
        </View>
  
        {/* Balance warning (withdraw only) */}
        {showWarning && (
          <View style={styles.warningPill}>
            <Text style={styles.warningIcon}>⚠</Text>
            <Text style={styles.warningText}>
              Solde restant après retrait :{" "}
              <Text style={styles.warningBold}>{formattedBalanceAfter} FCFA</Text>
            </Text>
          </View>
        )}
  
        {/* Quick amount chips */}
        <View style={styles.chipRow}>
          {chips.map((val) => {
            const isActive = amount === val;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.chip,
                  isActive && {
                    borderColor: accentColor,
                    backgroundColor: accentLt,
                  },
                ]}
                onPress={() => setAmount(val)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive && {
                      color: isDeposit ? T.orangeDk : T.green,
                    },
                  ]}
                >
                  {parseInt(val, 10).toLocaleString("fr-FR")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
  
        <View style={{ flex: 1 }} />
  
        {/* Numpad */}
        <Numpad
          onPress={handleNumpad}
          onDelete={handleDelete}
          accentColor={accentColor}
        />
  
        {/* Continue button */}
        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: accentColor }]}
          onPress={() => onContinue?.(type, amount)}
        >
          <Text style={styles.btnArrow}>{isDeposit ? "↓" : "↑"}</Text>
          <Text style={styles.btnText}>Continuer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  };
  
  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: T.bg,
    },
  
    // Back row
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 10,
      gap: 5,
    },
    backBtn: { padding: 2 },
    backChevron: { fontSize: 22, color: T.text3, lineHeight: 24 },
    backLabel: { fontSize: 13, color: T.text3 },
  
    // Client bar
    clientBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 18,
      marginTop: 0,
      marginBottom: 16,
      backgroundColor: T.bg2,
      borderWidth: 0.5,
      borderColor: T.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 13,
      gap: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: T.bgSuccess,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 12, fontWeight: "500", color: T.textSuccess },
    clientInfo: { flex: 1 },
    clientName: { fontSize: 13, fontWeight: "500", color: T.text1 },
    clientBalance: { fontSize: 11, color: T.text3 },
    clientBalanceStrong: { color: T.text1, fontWeight: "500" },
    chevron: { fontSize: 18, color: T.text3 },
  
    // Amount display
    amountDisplay: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 18,
      marginBottom: 4,
    },
    amountLabel: { fontSize: 12, color: T.text3, marginBottom: 6 },
    amountValue: {
      fontSize: 42,
      fontWeight: "600",
      letterSpacing: -1.3,
      lineHeight: 44,
    },
    currency: { fontSize: 18, fontWeight: "400", color: T.text3 },
  
    // Balance warning
    warningPill: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 18,
      marginBottom: 12,
      backgroundColor: T.bgWarning,
      borderWidth: 0.5,
      borderColor: "rgba(133,79,11,0.2)",
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
      gap: 8,
    },
    warningIcon: { fontSize: 12, color: T.textWarning },
    warningText: { fontSize: 11, color: T.textWarning, flex: 1 },
    warningBold: { fontWeight: "600", color: T.textWarning },
  
    // Quick chips
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      paddingHorizontal: 18,
      paddingBottom: 16,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: T.border2,
      backgroundColor: T.bg2,
    },
    chipText: { fontSize: 12, fontWeight: "500", color: T.text2 },
  
    // Continue button
    mainBtn: {
      marginHorizontal: 18,
      marginBottom: Platform.OS === "ios" ? 0 : 24,
      padding: 14,
      borderRadius: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    btnArrow: { color: "#fff", fontSize: 16 },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  });
  
  export default TransactionEntryScreen;
  