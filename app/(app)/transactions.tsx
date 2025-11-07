import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { mockTransactions } from "@/mocks/transactions";

export default function TransactionsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // all, deposits, withdrawals

  const filteredTransactions = mockTransactions.filter((transaction) => {
    if (filter === "all") return true;
    if (filter === "deposits") return transaction.type === "deposit";
    if (filter === "withdrawals") return transaction.type === "withdrawal";
    return true;
  });

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.filterContainer}>
          <Pressable
            style={[
              styles.filterButton,
              filter === "all" && styles.filterButtonActive,
            ]}
            onPress={() => setFilter("all")}
          >
            <Text
              style={[
                styles.filterText,
                filter === "all" && styles.filterTextActive,
              ]}
            >
              Tous
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              filter === "deposits" && styles.filterButtonActive,
            ]}
            onPress={() => setFilter("deposits")}
          >
            <Text
              style={[
                styles.filterText,
                filter === "deposits" && styles.filterTextActive,
              ]}
            >
              Dépôts
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              filter === "withdrawals" && styles.filterButtonActive,
            ]}
            onPress={() => setFilter("withdrawals")}
          >
            <Text
              style={[
                styles.filterText,
                filter === "withdrawals" && styles.filterTextActive,
              ]}
            >
              Retraits
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/(app)/transactions/new")}
        >
          <Plus size={24} color="white" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.transactionCard}
              onPress={() => router.push(`/(app)/transactions/${item.id}`)}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      item.type === "deposit"
                        ? colors.secondaryLight
                        : colors.error + "20",
                  },
                ]}
              >
                {item.type === "deposit" ? (
                  <ArrowDownCircle size={24} color={colors.secondary} />
                ) : (
                  <ArrowUpCircle size={24} color={colors.error} />
                )}
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.clientName}>{item.clientName}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.amountContainer}>
                <Text
                  style={[
                    styles.amount,
                    {
                      color:
                        item.type === "deposit"
                          ? colors.secondary
                          : colors.error,
                    },
                  ]}
                >
                  {item.type === "deposit" ? "+" : "-"}
                  {item.amount.toLocaleString()} FCFA
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "completed"
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
                          item.status === "completed"
                            ? colors.success
                            : colors.warning,
                      },
                    ]}
                  >
                    {item.status === "completed" ? "Synchronisé" : "En attente"}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune transaction trouvée</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  filterContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 8,
    height: 44,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: "white",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  transactionCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
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
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  transactionDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});