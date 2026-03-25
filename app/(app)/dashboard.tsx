import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { PlusCircle, TrendingUp, Users, Wallet } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loadClientMocks = useClientStore((state) => state.loadDevMocks);
  const clients = useClientStore((state) => state.clients);
  const loadTransactionMocks = useTransactionStore((state) => state.loadDevMocks);
  const transactions = useTransactionStore((state) => state.transactions);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // ✅ Si on est en prod (false), nettoyer les vieilles données de mocks
      if (process.env.EXPO_PUBLIC_DEV_LOAD_MOCKS !== "true") {
        useClientStore.getState().clearAll();
        useTransactionStore.getState().clearAll();
      } else {
        // ✅ Sinon charger les mocks
        await loadClientMocks();
        await loadTransactionMocks();
      }
      setIsLoading(false);
    };

    init();
  }, [loadClientMocks, loadTransactionMocks]);

  const totalCollected = transactions.reduce((sum, tx) => {
    if (tx.type === "deposit") return sum + tx.amount;
    if (tx.type === "withdrawal") return sum - tx.amount;
    return sum;
  }, 0);

  const pendingTransactions = transactions.filter((tx) => tx.status === "pending").length;
  const clientCount = clients.length;
  const targetCompletion = clientCount === 0 ? 0 : Math.min(100, Math.round((clientCount / 100) * 100));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Bonjour, {user?.name || "Agent"}
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/(app)/clients/add")}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
              <Users size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionText}>Nouveau Client</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/(app)/transactions/new")}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.secondaryLight }]}>
              <PlusCircle size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionText}>Nouveau Dépôt</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Aperçu</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Total collecté</Text>
              <Wallet size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>
              {totalCollected.toLocaleString()} FCFA
            </Text>
            <Text style={styles.statSubtext}>Ce mois-ci</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Clients actifs</Text>
              <Users size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{clientCount}</Text>
            <Text style={styles.statSubtext}>Total inscrits</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Synchro en attente</Text>
              <Wallet size={20} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{pendingTransactions}</Text>
            <Text style={styles.statSubtext}>Transactions hors ligne</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Objectif</Text>
              <TrendingUp size={20} color={colors.secondary} />
            </View>
            <Text style={styles.statValue}>{targetCompletion}%</Text>
            <Text style={styles.statSubtext}>Objectif mensuel</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activité récente</Text>

        <View style={styles.activityContainer}>
          <Text style={styles.emptyText}>Aucune activité récente à afficher</Text>
        </View>
      </ScrollView>
    </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    padding: 20,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activityContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});