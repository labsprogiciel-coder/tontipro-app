import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { PlusCircle, TrendingUp, Users, RefreshCw, Wifi, WifiOff, Wallet } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import { mergeTransactionsSorted, useTransactionStore } from "@/stores/transaction-store";
import { isConnected, subscribeToNetworkChanges } from "@/utils/network";

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loadClientMocks = useClientStore((state) => state.loadDevMocks);
  const loadClientsFromSupabase = useClientStore((state) => state.loadClientsFromSupabase);
  const isLoadingClients = useClientStore((state) => state.isLoadingClients);
  const clients = useClientStore((state) => state.clients);
  const loadTransactionMocks = useTransactionStore((state) => state.loadDevMocks);
  const transactions = useTransactionStore((state) => state.transactions);
  const pendingTxList = useTransactionStore((state) => state.pendingTransactions);
  const transactionSyncFailures = useTransactionStore(
    (state) => state.transactionSyncFailures
  );

  const [isLoading, setIsLoading] = useState(true);
  const [online, setOnline] = useState(true);

  // ✅ Vérifie la connectivité au montage et écoute les changements
  useEffect(() => {
    isConnected().then(setOnline);
    const unsubscribe = subscribeToNetworkChanges(setOnline);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const init = async () => {
      // ✅ Si en mode dev avec mocks, charger les mocks
      if (process.env.EXPO_PUBLIC_DEV_LOAD_MOCKS === "true") {
        useClientStore.getState().clearAll();
        useTransactionStore.getState().clearAll();
        await loadClientMocks();
        await loadTransactionMocks();
      } else if (user && !isLoadingClients) {
        // ✅ Données déjà chargées à la connexion / restauration session ; rafraîchir au besoin
        try {
          await loadClientsFromSupabase();
        } catch (error) {
          console.error("Failed to load clients from Supabase:", error);
        }
      }
      setIsLoading(false);
    };

    init();
  }, [user, loadClientMocks, loadTransactionMocks, isLoadingClients, loadClientsFromSupabase]);

  const mergedTransactions = useMemo(
    () => mergeTransactionsSorted(transactions, pendingTxList),
    [transactions, pendingTxList]
  );

  const totalCollected = mergedTransactions.reduce((sum, tx) => {
    if (tx.type === "deposit") return sum + tx.amount;
    if (tx.type === "withdrawal") return sum - tx.amount;
    return sum;
  }, 0);

  const pendingTransactionsCount = pendingTxList.length;
  const pendingClientsCount = clients.filter((c) => c.syncStatus === "pending").length;
  const totalPending = pendingTransactionsCount + pendingClientsCount;
  const clientCount = clients.length;
  const MONTHLY_CLIENT_TARGET = 50;
  const targetCompletion = clientCount === 0 ? 0 : Math.min(100, Math.round((clientCount / MONTHLY_CLIENT_TARGET) * 100));

  // ✅ Calcul du statut de synchronisation
  const getSyncStatus = () => {
    if (!online) return { color: "#9CA3AF", label: "Hors ligne", icon: "offline" };
    const syncFailSuffix =
      transactionSyncFailures > 0 ? ` (${transactionSyncFailures} erreur(s) sync)` : "";
    if (totalPending > 0 || transactionSyncFailures > 0) {
      return {
        color: "#F59E0B",
        label: `${totalPending} en attente${syncFailSuffix}`,
        icon: "pending" as const,
      };
    }
    return { color: "#10B981", label: "Synchronisé", icon: "synced" as const };
  };

  const syncStatus = getSyncStatus();

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
          <View style={styles.headerTop}>
            <View>
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

            {/* ✅ Indicateur de statut de synchronisation */}
            <View style={[styles.syncBadge, { borderColor: syncStatus.color }]}>
              {syncStatus.icon === "offline" && (
                <WifiOff size={12} color={syncStatus.color} />
              )}
              {syncStatus.icon === "pending" && (
                <RefreshCw size={12} color={syncStatus.color} />
              )}
              {syncStatus.icon === "synced" && (
                <Wifi size={12} color={syncStatus.color} />
              )}
              <Text style={[styles.syncLabel, { color: syncStatus.color }]}>
                {syncStatus.label}
              </Text>
            </View>
          </View>
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
              <RefreshCw size={20} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{pendingTransactionsCount}</Text>
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    marginTop: 4,
  },
  syncLabel: {
    fontSize: 11,
    fontWeight: "600",
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