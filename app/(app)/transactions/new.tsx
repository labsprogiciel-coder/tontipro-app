import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { KAURIDORR_THEME } from "@/constants/colors";
import { Numpad } from "@/app/components/ui/numpad";
import TransactionToggle from "@/app/components/transactions/toggle";
import SuccessReceipt from "@/app/components/transactions/receipt";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Transaction } from "@/types/transaction";
import { usePermissions } from "@/hooks/usePermissions";
  
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
  
const HOLD_DURATION = 700; // ms to hold before confirming

function HoldToConfirm({
  label,
  accentColor,
  onConfirm,
  disabled,
}: {
  label: string;
  accentColor: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim     = useRef<Animated.CompositeAnimation | null>(null);
  const fired    = useRef(false);

  const startHold = () => {
    if (disabled) return;
    fired.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished && !fired.current) {
        fired.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm();
      }
    });
  };

  const cancelHold = () => {
    anim.current?.stop();
    Animated.spring(progress, { toValue: 0, useNativeDriver: false }).start();
  };

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const labelOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [1, 0.5, 0],
  });

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      style={[s.holdBtn, { backgroundColor: accentColor, opacity: disabled ? 0.5 : 1 }]}
    >
      {/* Fill bar */}
      <Animated.View style={[s.holdFill, { width: fillWidth, backgroundColor: "rgba(255,255,255,0.25)" }]} />
      {/* Label */}
      <Animated.Text style={[s.holdLabel, { opacity: labelOpacity }]}>{label}</Animated.Text>
      <Text style={s.holdHint}>Maintenez pour confirmer</Text>
    </Pressable>
  );
}

  const TransactionEntryScreen = ({
    clientName = "Awa Konaté",
    clientInitials = "AK",
    clientBalance = 85000,
    onBack,
    onContinue,
  }: TransactionEntryProps) => {
    const router = useRouter();
    const { clientId, type: typeParam } = useLocalSearchParams<{ clientId?: string; type?: string }>();
    const selectedClient = useClientStore(
      (s) => (clientId ? s.clients.find((c) => c.id === clientId) ?? null : null)
    );
    const { addTransaction } = useTransactionStore();

    const agentName = useAuthStore((s) => s.user?.name ?? "—");
    const perms = usePermissions();

    const [type, setType] = useState<"deposit" | "withdraw">("deposit");
    const [amount, setAmount] = useState("0");
    const [notes] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [successTx, setSuccessTx] = useState<Transaction | null>(null);

    useEffect(() => {
      if (typeParam === "withdrawal") setType("withdraw");
    }, [typeParam]);

    // Clear any previous success state when switching client
    useEffect(() => {
      setSuccessTx(null);
    }, [clientId]);

    const isDeposit = type === "deposit";
    const accentColor = isDeposit ? T.orange : T.greenDk;
    const accentLt = isDeposit ? T.orangeLt : T.greenLt;

    const canDeposit = perms.deposit;
    const canWithdraw = perms.withdrawal;
    const actionAllowed = isDeposit ? canDeposit : canWithdraw;
    const handleSetType = (t: "deposit" | "withdraw") => {
      if (t === "deposit" && !canDeposit) return;
      if (t === "withdraw" && !canWithdraw) return;
      setType(t);
    };

    const displayName     = selectedClient?.name ?? clientName;
    const displayInitials = selectedClient
      ? selectedClient.name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)
      : clientInitials;
    const displayBalance  = selectedClient?.balance ?? clientBalance;

    const commitment = selectedClient?.commitmentAmount;
    const chips = commitment && commitment > 0
      ? [1, 2, 3, 5, 10].map((m) => String(m * commitment))
      : isDeposit ? DEPOSIT_CHIPS : WITHDRAW_CHIPS;

    const numericAmount = parseInt(amount || "0", 10);
    const balanceAfterWithdraw = displayBalance - numericAmount;
    const showWarning = !isDeposit && numericAmount > 0;

    const formattedAmount = numericAmount.toLocaleString("fr-FR");
    const formattedBalance = displayBalance.toLocaleString("fr-FR");
    const formattedBalanceAfter = Math.max(0, balanceAfterWithdraw).toLocaleString("fr-FR");

    const handleNumpad = (digit: string) => {
      setAmount((prev) => (prev === "0" ? digit : prev + digit));
    };

    const handleDelete = () => {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    };
  
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
        const result = await addTransaction({
          clientId: selectedClient.id,
          amount: parseInt(amount, 10),
          type: type === "withdraw" ? "withdrawal" : "deposit",
          notes,
        });
        setSuccessTx(result);
      } catch (error) {
        Alert.alert("Erreur", "Impossible d'enregistrer la transaction. Veuillez réessayer.");
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
        <TransactionToggle activeType={type} setType={handleSetType} />
  
        {/* Client bar */}
        <View style={styles.clientBar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayInitials}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{displayName}</Text>
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
  
        {/* Permission denied notice */}
        {!actionAllowed && (
          <View style={styles.permDenied}>
            <Text style={styles.permDeniedText}>
              🔒 Vous n'avez pas la permission d'effectuer des {isDeposit ? "dépôts" : "retraits"}.
            </Text>
          </View>
        )}

        {/* Hold-to-confirm */}
        <HoldToConfirm
          label={isDeposit ? `↓  Confirmer le dépôt` : `↑  Confirmer le retrait`}
          accentColor={accentColor}
          onConfirm={handleAddTransaction}
          disabled={isLoading || !selectedClient || !amount || parseInt(amount, 10) <= 0 || !actionAllowed}
        />

        {/* Success overlay */}
        <Modal visible={!!successTx} animationType="slide" transparent>
          <View style={styles.overlayBackdrop}>
            <SafeAreaView style={styles.overlaySheet}>
              <ScrollView contentContainerStyle={styles.overlayContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.overlayTitle}>Transaction réussie</Text>
                {successTx && (
                  <SuccessReceipt
                    amount={successTx.amount.toLocaleString("fr-FR")}
                    type={successTx.type === "withdrawal" ? "withdraw" : "deposit"}
                    reference={successTx.id}
                    clientName={successTx.clientName}
                    balanceAfter={(selectedClient?.balance ?? 0).toLocaleString("fr-FR")}
                    agentName={agentName}
                    date={new Date(successTx.date).toLocaleDateString("fr-FR")}
                  />
                )}
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: accentColor }]}
                  onPress={() => { setSuccessTx(null); router.back(); }}
                >
                  <Text style={styles.doneBtnText}>Terminer</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
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
      marginBottom: 0,
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
      paddingVertical: 20,
      paddingHorizontal: 18,
      marginBottom: 0
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
  
    // Hold-to-confirm button
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
    btnText:  { color: "#fff", fontSize: 14, fontWeight: "500" },

    // Success overlay
    overlayBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    overlaySheet: {
      backgroundColor: T.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "85%",
    },
    overlayContent: {
      padding: 20,
      paddingBottom: 32,
    },
    overlayTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: T.text1,
      textAlign: "center",
      marginBottom: 16,
    },
    doneBtn: {
      marginTop: 4,
      padding: 15,
      borderRadius: 13,
      alignItems: "center",
    },
    doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

    permDenied: {
      marginHorizontal: 18,
      marginBottom: 8,
      backgroundColor: "#fff3cd",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    permDeniedText: { fontSize: 12, color: "#856404" },
  });
  
const s = StyleSheet.create({
  holdBtn: {
    marginHorizontal: 18,
    marginBottom: Platform.OS === "ios" ? 0 : 24,
    height: 52,
    borderRadius: 13,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 13,
  },
  holdLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
    position: "absolute",
  },
  holdHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    position: "absolute",
    bottom: 8,
  },
});

  export default TransactionEntryScreen;
  