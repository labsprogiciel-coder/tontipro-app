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
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, Clock, FileText, User } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useTransactionStore } from "@/stores/transaction-store";
import { useClientStore } from "@/stores/client-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTransactionById } = useTransactionStore();
  const { getClientById } = useClientStore();
  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (id) {
      const transactionData = getTransactionById(id);
      if (transactionData) {
        setTransaction(transactionData);
        const clientData = getClientById(transactionData.clientId);
        if (clientData) {
          setClient(clientData);
        }
      } else {
        Alert.alert("Error", "Transaction not found");
        router.back();
      }
      setIsLoading(false);
    }
  }, [id, getTransactionById, getClientById, router]);

  if (isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.transactionHeader}>
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
              <ArrowDownCircle size={32} color={colors.secondary} />
            ) : (
              <ArrowUpCircle size={32} color={colors.error} />
            )}
          </View>
          <Text style={styles.transactionType}>
            {transaction.type === "deposit" ? "Deposit" : "Withdrawal"}
          </Text>
          <Text
            style={[
              styles.transactionAmount,
              {
                color:
                  transaction.type === "deposit" ? colors.secondary : colors.error,
              },
            ]}
          >
            {transaction.type === "deposit" ? "+" : "-"}
            {transaction.amount.toLocaleString()} FCFA
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <Clock size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>
                {new Date(transaction.date).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <User size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Client</Text>
              <Text style={styles.detailValue}>{client?.name}</Text>
              <Text style={styles.detailSubvalue}>{client?.phone}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <FileText size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Status</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      transaction.status === "completed"
                        ? colors.success + "20"
                        : colors.warning + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        transaction.status === "completed"
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                >
                  {transaction.status === "completed" ? "Synced" : "Pending"}
                </Text>
              </View>
            </View>
          </View>

          {transaction.notes && (
            <>
              <View style={styles.divider} />
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{transaction.notes}</Text>
              </View>
            </>
          )}
        </View>

        {transaction.status === "pending" && (
          <View style={styles.actionContainer}>
            <Text style={styles.syncInfo}>
              This transaction is pending synchronization with the server.
              It will be automatically synced when you have an internet connection.
            </Text>
            <Pressable style={styles.syncButton}>
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </Pressable>
          </View>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  transactionHeader: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  transactionType: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  transactionAmount: {
    fontSize: 32,
    fontWeight: "bold",
  },
  detailsCard: {
    margin: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    padding: 16,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + "40",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  detailSubvalue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  notesContainer: {
    padding: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: "center",
  },
  syncInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  syncButtonText: {
    color: "white",
    fontWeight: "600",
  },
});