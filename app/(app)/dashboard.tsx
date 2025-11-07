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

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalCollected: 0,
    clientCount: 0,
    pendingTransactions: 0,
    targetCompletion: 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDashboardData({
        totalCollected: 125000,
        clientCount: 42,
        pendingTransactions: 3,
        targetCompletion: 68,
      });
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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
            Hello, {user?.name || "Agent"}
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("en-US", {
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
            <Text style={styles.actionText}>New Client</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/(app)/transactions/new")}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.secondaryLight }]}>
              <PlusCircle size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionText}>New Deposit</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Total Collected</Text>
              <Wallet size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>
              {dashboardData.totalCollected.toLocaleString()} FCFA
            </Text>
            <Text style={styles.statSubtext}>This month</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Active Clients</Text>
              <Users size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{dashboardData.clientCount}</Text>
            <Text style={styles.statSubtext}>Total registered</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Pending Sync</Text>
              <Wallet size={20} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{dashboardData.pendingTransactions}</Text>
            <Text style={styles.statSubtext}>Offline transactions</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Target</Text>
              <TrendingUp size={20} color={colors.secondary} />
            </View>
            <Text style={styles.statValue}>{dashboardData.targetCompletion}%</Text>
            <Text style={styles.statSubtext}>Monthly goal</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        
        <View style={styles.activityContainer}>
          <Text style={styles.emptyText}>No recent activity to display</Text>
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
