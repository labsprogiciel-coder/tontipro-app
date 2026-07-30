// app/(app)/transactions/new.tsx
//
// Field mapping for the transaction entry screen:
//   client_id  → clientId  (unchanged — store maps to customerId internally)
//   type 'withdraw' is kept as the UI internal value; the store receives
//   'deposit' | 'withdrawal', so we translate at the call-site (unchanged).
//   No other field names changed in this screen.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import { KAURIDORR_THEME } from "@/constants/colors";
import { Numpad } from "@/app/components/ui/numpad";
import TransactionToggle from "@/app/components/transactions/toggle";
import SuccessReceipt from "@/app/components/transactions/receipt";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAuthStore } from "@/stores/auth-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";
import { usePermissions } from "@/hooks/usePermissions";
import SearchInput from "@/app/components/quickactions/search-input";
import StatusBadge from "@/app/components/ui/status-bar";

const T = KAURIDORR_THEME;

const DEPOSIT_CHIPS = ["2000", "5000", "15000", "25000", "50000"];
const WITHDRAW_CHIPS = ["5000", "10000", "20000", "30000", "50000"];

const HOLD_DURATION = 700; // ms to hold before confirming

// ─── HoldToConfirm ───────────────────────────────────────────────────────────

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
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const fired = useRef(false);

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
      style={[
        s.holdBtn,
        { backgroundColor: accentColor, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Animated.View
        style={[
          s.holdFill,
          { width: fillWidth, backgroundColor: "rgba(255,255,255,0.25)" },
        ]}
      />
      <Animated.Text style={[s.holdLabel, { opacity: labelOpacity }]}>
        {label}
      </Animated.Text>
      <Text style={s.holdHint}>Maintenez pour confirmer</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const TransactionEntryScreen = () => {
  const router = useRouter();
  const { clientId, type: typeParam } = useLocalSearchParams<{
    clientId?: string;
    type?: string;
  }>();

  const allClients = useClientStore((s) => s.clients);
  const loadClients = useClientStore((s) => s.loadClients);
  const selectedClient = useClientStore((s) =>
    clientId ? (s.clients.find((c) => c.id === clientId) ?? null) : null,
  );

  const { addTransaction } = useTransactionStore();
  const agentName = useAuthStore((s) => s.user?.name ?? "—");
  const perms = usePermissions();

  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"name" | "code">("name");
  const [isClientPickerVisible, setIsClientPickerVisible] = useState(false);
  const [currentSelectedClientId, setCurrentSelectedClientId] = useState<
    string | null
  >(selectedClient?.id ?? null);

  const currentSelectedClient = useMemo(
    () =>
      allClients.find((c) => c.id === currentSelectedClientId) ??
      selectedClient ??
      null,
    [allClients, currentSelectedClientId, selectedClient],
  );

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const phoneQ = searchQuery.replace(/\s/g, "");
    return allClients.filter((c) => {
      if (!q) return true;
      if (searchType === "name") {
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\s/g, "").includes(phoneQ)
        );
      }
      return c.accountNumber?.toLowerCase().includes(q) ?? false;
    });
  }, [allClients, searchQuery, searchType]);

  useEffect(() => {
    if (typeParam === "withdrawal") setType("withdraw");
  }, [typeParam]);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients]),
  );

  useEffect(() => {
    if (selectedClient?.id) setCurrentSelectedClientId(selectedClient.id);
  }, [selectedClient]);

  useEffect(() => {
    setSuccessTx(null);
  }, [currentSelectedClient]);

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

  const displayName = currentSelectedClient?.name ?? "Sélectionner un client";
  const displayInitials = currentSelectedClient
    ? currentSelectedClient.name
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "—";
  const displayBalance = currentSelectedClient?.balance ?? 0;

  const commitment = currentSelectedClient?.commitmentAmount;
  const chips =
    commitment && commitment > 0
      ? [1, 2, 3, 5, 10].map((m) => String(m * commitment))
      : isDeposit
        ? DEPOSIT_CHIPS
        : WITHDRAW_CHIPS;

  const numericAmount = parseInt(amount || "0", 10);
  const balanceAfterWithdraw = displayBalance - numericAmount;
  const showWarning = !isDeposit && numericAmount > 0;

  const formattedAmount = numericAmount.toLocaleString("fr-FR");
  const formattedBalance = displayBalance.toLocaleString("fr-FR");
  const formattedBalanceAfter = Math.max(
    0,
    balanceAfterWithdraw,
  ).toLocaleString("fr-FR");

  const handleNumpad = (digit: string) => {
    setAmount((prev) => (prev === "0" ? digit : prev + digit));
  };
  const handleDelete = () => {
    setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  };

  const handleAddTransaction = async () => {
    if (!currentSelectedClient) {
      Alert.alert("Erreur", "Veuillez sélectionner un client");
      return;
    }
    if (!amount || parseInt(amount, 10) <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide");
      return;
    }

    setIsLoading(true);
    try {
      // "withdraw" in the UI maps to "withdrawal" in the store / Convex schema.
      const result = await addTransaction({
        clientId: currentSelectedClient.id,
        amount: parseInt(amount, 10),
        type: type === "withdraw" ? "withdrawal" : "deposit",
        notes: undefined,
      });
      setSuccessTx(result);
    } catch {
      Alert.alert(
        "Erreur",
        "Impossible d'enregistrer la transaction. Veuillez réessayer.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back row */}
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.backLabel}>
            {currentSelectedClient?.name ?? "Nouvelle Transaction"}
          </Text>
        </View>

        {/* Type toggle */}
        <TransactionToggle activeType={type} setType={handleSetType} />

        {/* Client selector */}
        <TouchableOpacity
          style={styles.clientBar}
          activeOpacity={0.8}
          onPress={() => setIsClientPickerVisible(true)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayInitials}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{displayName}</Text>
            <Text style={styles.clientBalance}>
              {currentSelectedClient
                ? (isDeposit ? "Solde actuel" : "Solde disponible") + " : "
                : ""}
              {currentSelectedClient ? (
                <Text style={styles.clientBalanceStrong}>
                  {formattedBalance} FCFA
                </Text>
              ) : (
                <Text style={styles.clientBalanceStrong}>
                  Recherchez un client
                </Text>
              )}
            </Text>
          </View>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        {/* Amount */}
        <View style={styles.amountDisplay}>
          <Text style={styles.amountLabel}>
            Montant du {isDeposit ? "dépôt" : "retrait"}
          </Text>
          <Text style={[styles.amountValue, { color: accentColor }]}>
            {formattedAmount} <Text style={styles.currency}>FCFA</Text>
          </Text>
        </View>

        {/* Balance warning */}
        {showWarning && (
          <View style={styles.warningPill}>
            <Text style={styles.warningIcon}>⚠</Text>
            <Text style={styles.warningText}>
              Solde restant après retrait :{" "}
              <Text style={styles.warningBold}>
                {formattedBalanceAfter} FCFA
              </Text>
            </Text>
          </View>
        )}

        {/* Quick-amount chips */}
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
                    isActive && { color: isDeposit ? T.orangeDk : T.green },
                  ]}
                >
                  {parseInt(val, 10).toLocaleString("fr-FR")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
              🔒 Vous n&apos;avez pas la permission d&apos;effectuer des{" "}
              {isDeposit ? "dépôts" : "retraits"}.
            </Text>
          </View>
        )}

        {/* Hold-to-confirm */}
        <HoldToConfirm
          label={
            isDeposit ? "↓  Confirmer le dépôt" : "↑  Confirmer le retrait"
          }
          accentColor={accentColor}
          onConfirm={handleAddTransaction}
          disabled={
            isLoading ||
            !currentSelectedClient ||
            !amount ||
            parseInt(amount, 10) <= 0 ||
            !actionAllowed
          }
        />
      </ScrollView>

      {/* ── Client picker modal ─────────────────────────────────────────── */}
      <Modal visible={isClientPickerVisible} animationType="slide" transparent>
        <View style={styles.pickerBackdrop}>
          <SafeAreaView style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Sélectionner un client</Text>
              <TouchableOpacity onPress={() => setIsClientPickerVisible(false)}>
                <Text style={styles.pickerClose}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchTypeRow}>
              <TouchableOpacity
                style={[
                  styles.searchTypeBtn,
                  searchType === "name" && styles.searchTypeBtnActive,
                ]}
                onPress={() => {
                  setSearchType("name");
                  setSearchQuery("");
                }}
              >
                <Text
                  style={[
                    styles.searchTypeText,
                    searchType === "name" && styles.searchTypeTextActive,
                  ]}
                >
                  Par nom
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchTypeBtn,
                  searchType === "code" && styles.searchTypeBtnActive,
                ]}
                onPress={() => {
                  setSearchType("code");
                  setSearchQuery("");
                }}
              >
                <Text
                  style={[
                    styles.searchTypeText,
                    searchType === "code" && styles.searchTypeTextActive,
                  ]}
                >
                  Par code
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  searchType === "name"
                    ? "Rechercher par nom..."
                    : "Rechercher par code..."
                }
              />
            </View>

            <FlatList
              data={filteredClients}
              keyExtractor={(item: Client) => item.id}
              renderItem={({ item }: { item: Client }) => (
                <TouchableOpacity
                  style={styles.clientCard}
                  onPress={() => {
                    setCurrentSelectedClientId(item.id);
                    setSearchQuery("");
                    setIsClientPickerVisible(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.balance}>
                        {item.balance.toLocaleString("fr-FR")} F
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={styles.phone}>{item.phone}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    {item.accountNumber && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.code}>{item.accountNumber}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptySearchState}>
                  <Text style={styles.emptySearchText}>
                    Aucun client trouvé pour cette recherche
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Success receipt modal ───────────────────────────────────────── */}
      <Modal visible={!!successTx} animationType="slide" transparent>
        <View style={styles.overlayBackdrop}>
          <SafeAreaView style={styles.overlaySheet}>
            <ScrollView
              contentContainerStyle={styles.overlayContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.overlayTitle}>Transaction réussie</Text>
              {successTx && (
                <SuccessReceipt
                  amount={successTx.amount.toLocaleString("fr-FR")}
                  type={
                    successTx.type === "withdrawal" ? "withdraw" : "deposit"
                  }
                  reference={successTx.id}
                  clientName={successTx.clientName}
                  balanceAfter={(
                    currentSelectedClient?.balance ?? 0
                  ).toLocaleString("fr-FR")}
                  agentName={agentName}
                  date={new Date(successTx.date).toLocaleDateString("fr-FR")}
                />
              )}
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: accentColor }]}
                onPress={() => {
                  setSuccessTx(null);
                  router.back();
                }}
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

export default TransactionEntryScreen;

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  contentScroll: { flex: 1 },
  contentScrollContainer: { paddingBottom: 16 },

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

  clientBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 18,
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

  amountDisplay: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  amountLabel: { fontSize: 12, color: T.text3, marginBottom: 6 },
  amountValue: {
    fontSize: 42,
    fontWeight: "600",
    letterSpacing: -1.3,
    lineHeight: 44,
  },
  currency: { fontSize: 18, fontWeight: "400", color: T.text3 },

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

  permDenied: {
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: "#fff3cd",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  permDeniedText: { fontSize: 12, color: "#856404" },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    minHeight: "58%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: "600", color: T.text1 },
  pickerClose: { fontSize: 13, color: T.orange, fontWeight: "500" },

  searchTypeRow: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: T.bg2,
    borderRadius: 10,
    padding: 4,
  },
  searchTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  searchTypeBtnActive: {
    backgroundColor: T.bg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchTypeText: { fontSize: 14, color: T.text3 },
  searchTypeTextActive: { color: T.text1, fontWeight: "500" },

  searchInputWrapper: { marginHorizontal: 18, marginBottom: 16 },
  listContainer: { paddingHorizontal: 18, paddingBottom: 10 },

  emptySearchState: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: T.bg2,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: T.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emptySearchText: { fontSize: 12, color: T.text3, textAlign: "center" },

  clientCard: {
    backgroundColor: T.bg,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: T.border,
  },
  name: { fontSize: 14, fontWeight: "500", color: T.text1 },
  phone: { fontSize: 12, color: T.text3 },
  balance: { fontSize: 12, fontWeight: "500", color: T.text1 },
  code: { fontSize: 11, color: T.text3, fontWeight: "500" },

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
  overlayContent: { padding: 20, paddingBottom: 32 },
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
