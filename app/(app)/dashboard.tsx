import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import * as adminApi from "@/lib/admin-api";
import {
  TrendingUp,
  Users,
  FileText,
  ArrowDown,
  ArrowUp,
  PlusIcon,
  DownloadCloudIcon,
  BadgeDollarSign,
  ScanEye,
  LucideBedDouble,
  Camera,
  ImportIcon,
  DollarSignIcon,
} from "lucide-react-native";

import { KAURIDORR_THEME } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { customerToClient, useClientStore } from "@/stores/client-store";
import { isLocalClient } from "@/stores/sync-bridge";
import {
  convexRowToTransaction,
  mergeTransactionsSorted,
  useTransactionStore,
} from "@/stores/transaction-store";
import { isConnected, subscribeToNetworkChanges } from "@/utils/network";
import { Client } from "@/types/client";

import SectionHeader from "../components/ui/section-header";
import OfflineIcon from "../components/header/offline-status";
import MetricPill from "../components/stats/cards";
import NotificationBell from "../components/header/bell";
import HeaderAvatar from "../components/header/avatar";
import ActionButton from "../components/quickactions/quick-action";
import TransactionItem from "../components/transactions/transaction-items";
import ClientCard from "../components/clients/clients";
import SearchInput from "../components/quickactions/search-input";
import { usePermissions } from "@/hooks/usePermissions";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function clientStatus(client: Client): "Actif" | "Retard" | "Neutre" {
  if (client.status === "active") return "Actif";
  if (client.status === "inactive") return "Neutre";
  return "Retard";
}

function clientVariant(client: Client): "success" | "warning" | "info" {
  if (client.status === "active") return "success";
  if (client.status === "inactive") return "info";
  return "warning";
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return `Il y a ${Math.floor(diff / 86_400_000)} j`;
}

function formatBalance(amount: number): string {
  return amount.toLocaleString("fr-FR") + " F";
}

function formatMetric(amount: number): string {
  if (amount >= 1_000_000)
    return (amount / 1_000_000).toFixed(1).replace(".", ",") + " M";
  if (amount >= 1_000) return new Intl.NumberFormat().format(amount);
  return String(amount);
}

// ── Component ─────────────────────────────────────────────────────────────────

const AgentDashboard: React.FC = () => {
  const router = useRouter();

  // Auth
  const user = useAuthStore((s) => s.user);

  // Clients / Transactions — read directly via useQuery rather than through
  // an imperative convex.query() + manual retry. Convex's client caches
  // *query results by (function, args)*, including error results — retrying
  // the exact same imperative call after a failure just replays that cached
  // error instead of hitting the server again (see ConvexReactClient.query()
  // in node_modules/convex/dist/esm/react/client.js). Reactive `useQuery`
  // hooks don't have that problem: they resubscribe correctly and update on
  // their own once auth is ready, which is why `users:me` in
  // app/_layout.tsx already worked reliably while the imperative loads here
  // kept failing forever after the first race.
  const customersData = useQuery(adminApi.listCustomers);
  const transactionsData = useQuery(adminApi.listMyTransactions, {});

  // Clients ajoutés hors-ligne restent en local (syncStatus "pending") tant
  // qu'ils n'ont pas été synchronisés — pas encore dans `customersData`, donc
  // on les fusionne manuellement, comme pendingTxList pour les transactions.
  const localClients = useClientStore((s) => s.clients);
  const pendingLocalClients = useMemo(
    // Only clients not yet created on the server — a server client with
    // pending edits is already in `customersData` (it would appear twice).
    () => localClients.filter(isLocalClient),
    [localClients],
  );
  const clients = useMemo(
    () => [
      ...pendingLocalClients,
      ...(customersData ?? []).map(customerToClient),
    ],
    [customersData, pendingLocalClients],
  );

  const pendingTxList = useTransactionStore((s) => s.pendingTransactions);

  const transactions = useMemo(() => {
    const clientNameResolver = (id: string) =>
      clients.find((c) => c.id === id)?.name;
    return (transactionsData ?? []).map((row) =>
      convexRowToTransaction(row, clientNameResolver),
    );
  }, [transactionsData, clients]);

  // Local UI state
  const perms = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [online, setOnline] = useState(true);

  const isLoading = customersData === undefined || transactionsData === undefined;

  // ── Network monitoring ──────────────────────────────────────────────────────
  useEffect(() => {
    isConnected().then(setOnline);
    return subscribeToNetworkChanges(setOnline);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const mergedTransactions = useMemo(
    () => mergeTransactionsSorted(transactions, pendingTxList),
    [transactions, pendingTxList],
  );

  const totalSavings = useMemo(
    () => clients.reduce((sum, c) => sum + (c.balance ?? 0), 0),
    [clients],
  );

  const activeClientCount = useMemo(
    () => clients.filter((c) => c.status === "active").length,
    [clients],
  );

  const pendingCount =
    pendingTxList.length +
    clients.filter((c) => c.syncStatus === "pending").length;

  const isOffline = !online;

  // ── Search filter ───────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [clients, searchQuery]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mergedTransactions;
    return mergedTransactions.filter((t) =>
      t.clientName?.toLowerCase().includes(q),
    );
  }, [mergedTransactions, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={T.orange} />

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.agentName}>{user?.name ?? "Agent"}</Text>
            </View>

            <View style={styles.topUtilityRow}>
              <OfflineIcon isOffline={isOffline} />
              <NotificationBell hasNotifications={pendingCount > 0} />
              <HeaderAvatar
                initials={getInitials(user?.name ?? "AG")}
                onPress={() => router.push("/(app)/settings")}
              />
            </View>
          </View>

          <View style={styles.metricRow}>
            <MetricPill
              label="Épargne gérée"
              value={formatMetric(totalSavings)}
              unit="FCFA"
              icon={TrendingUp}
            />
            <MetricPill
              label="Clients actifs"
              value={String(activeClientCount)}
              trend={
                pendingCount > 0 ? `${pendingCount} en attente` : undefined
              }
              icon={Users}
            />
          </View>
        </View>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Quick actions */}
          <Text style={styles.sectionLabel}>Actions rapides</Text>
          <View style={styles.actionGrid}>
            <ActionButton
              label="Client"
              icon={PlusIcon}
              bgVariant="#e6f1fb"
              iconColor="#185fa5"
              style={styles.actionBtn}
              disabled={!perms.addClient}
              onClick={() => router.push("/(app)/clients/add")}
            />
            <ActionButton
              label="Rechercher"
              icon={Camera}
              bgVariant="#eaf3de"
              iconColor="#3b6d11"
              style={styles.actionBtn}
              onClick={() => router.push("/(app)/clients")}
            />
            <ActionButton
              label="Paiement"
              icon={DollarSignIcon}
              bgVariant="#FAE8E0"
              iconColor="#993C1D"
              style={styles.actionBtn}
              disabled={!perms.withdrawal}
              onClick={() =>
                router.push({
                  pathname: "/(app)/transactions/new",
                  params: { type: "withdrawal" },
                })
              }
            />
            <ActionButton
              label="Exporter"
              icon={DownloadCloudIcon}
              bgVariant="#EEEDFE"
              iconColor="#534AB7"
              style={styles.actionBtn}
              onClick={() => router.push("/(app)/data")}
            />
          </View>

          {/* Clients */}
          <SectionHeader
            title="Mes clients"
            linkText="Voir tous"
            onLinkClick={() => router.push("/(app)/clients")}
          />

          {filteredClients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucun client trouvé</Text>
            </View>
          ) : (
            filteredClients
              .slice(0, 3)
              .map((client) => (
                <ClientCard
                  key={client.id}
                  initials={getInitials(client.name)}
                  name={client.name}
                  phone={client.phone}
                  amount={formatBalance(client.balance ?? 0)}
                  status={clientStatus(client)}
                  avatarVariant={clientVariant(client)}
                  onPress={() => router.push(`/(app)/clients/${client.id}`)}
                />
              ))
          )}

          {/* Transactions */}
          <SectionHeader
            title="Transactions récentes"
            linkText="Voir tous"
            onLinkClick={() => router.push("/(app)/transactions")}
          />

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : (
            <View style={styles.transactionContainer}>
              {filteredTransactions.slice(0, 5).map((tx, i) => {
                const commitment = clients.find(
                  (c) => c.id === tx.clientId,
                )?.commitmentAmount;
                const multiplier =
                  commitment && commitment > 0
                    ? (() => {
                        const m = Math.round(tx.amount / commitment);
                        return m >= 1 ? m : undefined;
                      })()
                    : undefined;
                return (
                  <TransactionItem
                    key={tx.id}
                    name={tx.clientName ?? "—"}
                    type={tx.type === "withdrawal" ? "withdrawal" : "deposit"}
                    time={relativeTime(tx.date)}
                    amount={tx.amount.toLocaleString("fr-FR")}
                    multiplier={multiplier}
                    isLast={i === Math.min(filteredTransactions.length, 5) - 1}
                    onPress={() => router.push(`/(app)/transactions/${tx.id}`)}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.bg,
  },
  container: {
    flex: 1,
    backgroundColor: "#d0cfc8",
  },
  header: {
    backgroundColor: T.orange,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xl,
    paddingTop: SPACE.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.md,
  },
  greeting: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  agentName: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  topUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  metricRow: {
    flexDirection: "row",
    gap: SPACE.sm,
  },
  body: {
    padding: SPACE.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.06 * 11,
    marginBottom: SPACE.sm,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  actionBtn: {
    // Two equal columns that exactly fill the row with the grid's gap
    // (a fixed 48% width left a sliver on the right).
    flexGrow: 1,
    flexBasis: "40%",
  },
  transactionContainer: {
    backgroundColor: T.bg,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: T.border,
    overflow: "hidden",
    marginBottom: SPACE.lg,
  },
  emptyBox: {
    paddingVertical: SPACE.xl,
    alignItems: "center",
    marginBottom: SPACE.lg,
  },
  emptyText: {
    fontSize: 13,
    color: T.text3,
  },
});

export default AgentDashboard;
