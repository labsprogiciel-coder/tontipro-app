import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, Phone, PlusCircle, User } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { Transaction } from "@/types/transaction";

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClientById } = useClientStore();
  const { getTransactionsByClientId } = useTransactionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (id) {
      const clientData = getClientById(id);
      if (clientData) {
        setClient(clientData);
        setTransactions(getTransactionsByClientId(id));
      } else {
        Alert.alert("Error", "Client not found");
        router.back();
      }
      setIsLoading(false);
    }
  }, [id, getClientById, getTransactionsByClientId, router]);

  const handleNewDeposit = () => {
    router.push({
      pathname: "/(app)/transactions/new",
      params: { clientId: id }
    });
  };

  const handleNewWithdrawal = () => {
    router.push({
      pathname: "/(app)/transactions/withdraw",
      params: { clientId: id }
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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Client Details</Text>
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
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>
              {client?.balance?.toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionButton} onPress={handleNewDeposit}>
            <View style={[styles.actionIcon, { backgroundColor: colors.secondaryLight }]}>
              <ArrowDownCircle size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionText}>New Deposit</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleNewWithdrawal}>
            <View style={[styles.actionIcon, { backgroundColor: colors.error + "20" }]}>
              <ArrowUpCircle size={24} color={colors.error} />
            </View>
            <Text style={styles.actionText}>Withdrawal</Text>
          </Pressable>
        </View>

        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          
          {transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions yet</Text>
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
                    {transaction.type === "deposit" ? "Deposit" : "Withdrawal"}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.date).toLocaleDateString()}
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
                    {transaction.amount.toLocaleString()} FCFA
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
    fontWeight: "600",
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: colors.text,
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
    fontWeight: "500",
    color: colors.text,
  },
  transactionsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
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
    fontWeight: "600",
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
    fontWeight: "600",
  },
});