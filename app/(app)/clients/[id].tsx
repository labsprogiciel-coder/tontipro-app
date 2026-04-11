import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  Phone,
  User,
  ShieldCheck,
  ShieldAlert,
  ScanLine,
  CreditCard,
} from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";

const ID_TYPE_LABELS: Record<string, string> = {
  cni: "CNI",
  passport: "Passeport",
  permis: "Permis",
  autre: "Autre",
};

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id, scannedId } = useLocalSearchParams<{ id: string; scannedId?: string }>();
  const { getClientById, updateClient } = useClientStore();
  const { getTransactionsByClientId } = useTransactionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (id) {
      const clientData = getClientById(id);
      if (clientData) {
        setClient(clientData);
        setTransactions(getTransactionsByClientId(id));
      } else {
        Alert.alert("Erreur", "Client introuvable");
        router.back();
      }
      setIsLoading(false);
    }
  }, [id, getClientById, getTransactionsByClientId, router]);

  useEffect(() => {
    if (scannedId && id && client) {
      updateClient(id, {
        idNumber: scannedId,
        kycVerified: true,
        kycDate: new Date().toISOString(),
      }).then((updated) => {
        setClient(updated);
        Alert.alert("KYC mis à jour", `Numéro d'identité enregistré : ${scannedId}`);
      });
    }
  }, [scannedId, id, client, updateClient]);

  const handleNewDeposit = () => {
    router.push({
      pathname: "/(app)/transactions/new",
      params: { clientId: id },
    });
  };

  const handleNewWithdrawal = () => {
    router.push({
      pathname: "/(app)/transactions/withdraw",
      params: { clientId: id },
    });
  };

  const handleScanKyc = () => {
    router.push({
      pathname: "/(app)/clients/scan",
      params: { clientId: id },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détails du client</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <User size={32} color={colors.primary} />
          </View>
          <Text style={styles.clientName}>{client?.name}</Text>
          <View style={styles.phoneContainer}>
            <Phone size={16} color={colors.textSecondary} />
            <Text style={styles.phoneNumber}>{client?.phone}</Text>
          </View>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Solde actuel</Text>
            <Text style={styles.balanceAmount}>
              {client?.balance != null ? new Intl.NumberFormat("fr-FR").format(client.balance) : "—"} FCFA
            </Text>
          </View>
        </View>

        <View style={styles.kycCard}>
          <View style={styles.kycHeaderRow}>
            {client?.kycVerified ? (
              <ShieldCheck size={22} color={colors.secondary} />
            ) : (
              <ShieldAlert size={22} color={colors.warning} />
            )}
            <Text style={styles.kycTitle}>Statut KYC</Text>
            {client?.kycVerified ? (
              <View style={styles.kycVerifiedBadge}>
                <Text style={styles.kycVerifiedText}>Vérifié</Text>
              </View>
            ) : (
              <View style={styles.kycPendingBadge}>
                <Text style={styles.kycPendingText}>En attente</Text>
              </View>
            )}
          </View>

          {client?.idNumber ? (
            <View style={styles.kycDetails}>
              <View style={styles.kycDetailRow}>
                <CreditCard size={16} color={colors.textSecondary} />
                <Text style={styles.kycDetailLabel}>Type :</Text>
                <Text style={styles.kycDetailValue}>
                  {ID_TYPE_LABELS[client.idType ?? ""] ?? "Non spécifié"}
                </Text>
              </View>
              <View style={styles.kycDetailRow}>
                <Text style={styles.kycIdNumber}>{client.idNumber}</Text>
              </View>
              {client.kycDate && (
                <Text style={styles.kycDate}>
                  Vérifié le {new Date(client.kycDate).toLocaleDateString("fr-FR")}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.kycEmpty}>
              <Text style={styles.kycEmptyText}>
                {"Aucune pièce d\u2019identité enregistrée"}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.kycScanBtn, pressed && { opacity: 0.8 }]}
                onPress={handleScanKyc}
              >
                <ScanLine size={18} color="#fff" />
                <Text style={styles.kycScanBtnText}>{"Scanner la pièce d\u2019identité"}</Text>
              </Pressable>
            </View>
          )}

          {client?.idNumber && (
            <Pressable
              style={({ pressed }) => [styles.kycRescanBtn, pressed && { opacity: 0.7 }]}
              onPress={handleScanKyc}
            >
              <ScanLine size={16} color={colors.primary} />
              <Text style={styles.kycRescanText}>Rescanner</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionButton} onPress={handleNewDeposit}>
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.secondaryLight },
              ]}
            >
              <ArrowDownCircle size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionText}>Nouveau dépôt</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleNewWithdrawal}>
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.error + "20" },
              ]}
            >
              <ArrowUpCircle size={24} color={colors.error} />
            </View>
            <Text style={styles.actionText}>Retrait</Text>
          </Pressable>
        </View>

        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Historique des transactions</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Aucune transaction pour le moment
              </Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor:
                        transaction.type === "deposit"
                          ? colors.secondaryLight
                          : colors.error + "20",
                    },
                  ]}
                >
                  {transaction.type === "deposit" ? (
                    <ArrowDownCircle size={20} color={colors.secondary} />
                  ) : (
                    <ArrowUpCircle size={20} color={colors.error} />
                  )}
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionType}>
                    {transaction.type === "deposit" ? "Dépôt" : "Retrait"}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Intl.DateTimeFormat("fr-FR").format(new Date(transaction.date))}
                  </Text>
                </View>
                <View style={styles.transactionAmount}>
                  <Text
                    style={[
                      styles.amountText,
                      {
                        color:
                          transaction.type === "deposit"
                            ? colors.secondary
                            : colors.error,
                      },
                    ]}
                  >
                    {transaction.type === "deposit" ? "+" : "-"}
                    {new Intl.NumberFormat("fr-FR").format(transaction.amount)} FCFA
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  clientName: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: colors.text,
    marginBottom: 8,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  phoneNumber: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  balanceContainer: {
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: colors.text,
  },
  kycCard: {
    margin: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kycHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  kycTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
  },
  kycVerifiedBadge: {
    backgroundColor: colors.secondary + "18",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycVerifiedText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.secondary,
  },
  kycPendingBadge: {
    backgroundColor: colors.warning + "18",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycPendingText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.warning,
  },
  kycDetails: {
    gap: 8,
  },
  kycDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kycDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  kycDetailValue: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.text,
  },
  kycIdNumber: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.5,
  },
  kycDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  kycEmpty: {
    alignItems: "center",
    gap: 14,
  },
  kycEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  kycScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  kycScanBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  kycRescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + "0A",
  },
  kycRescanText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "500" as const,
  },
  actionsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.text,
  },
  transactionsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
  },
  transactionDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
});
