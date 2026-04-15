import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { TrendingUp, Users, FileText, ArrowDown, ArrowUp, PlusIcon } from "lucide-react-native";

import { KAURIDORR_THEME } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import { mergeTransactionsSorted, useTransactionStore } from "@/stores/transaction-store";
import { isConnected, subscribeToNetworkChanges } from "@/utils/network";
import { Client } from "@/types/client";

import SectionHeader from "../components/ui/section-header";
import OfflineIcon from '../components/header/offline-status';
import MetricPill from '../components/stats/cards';
import NotificationBell from '../components/header/bell';
import HeaderAvatar from '../components/header/avatar';
import ActionButton from '../components/quickactions/quick-action';
import TransactionItem from '../components/transactions/transaction-items';
import ClientCard from '../components/clients/clients';
import SearchInput from '../components/quickactions/search-input';

const T = KAURIDORR_THEME;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function clientStatus(client: Client): 'Actif' | 'Retard' | 'Neutre' {
  if (client.status === 'active') return 'Actif';
  if (client.status === 'inactive') return 'Neutre';
  return 'Retard';
}

function clientVariant(client: Client): 'success' | 'warning' | 'info' {
  if (client.status === 'active') return 'success';
  if (client.status === 'inactive') return 'info';
  return 'warning';
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return `Il y a ${Math.floor(diff / 86_400_000)} j`;
}

function formatBalance(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

function formatMetric(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1).replace('.', ',') + ' M';
  if (amount >= 1_000) return Math.round(amount / 1_000) + ' K';
  return String(amount);
}

// ── Component ─────────────────────────────────────────────────────────────────

const AgentDashboard: React.FC = () => {
  const router = useRouter();

  // Auth
  const user = useAuthStore((s) => s.user);

  // Clients
  const clients = useClientStore((s) => s.clients);
  const isLoadingClients = useClientStore((s) => s.isLoadingClients);
  const loadClientsFromSupabase = useClientStore((s) => s.loadClientsFromSupabase);
  const loadClientMocks = useClientStore((s) => s.loadDevMocks);

  // Transactions
  const transactions = useTransactionStore((s) => s.transactions);
  const pendingTxList = useTransactionStore((s) => s.pendingTransactions);
  const loadTransactionMocks = useTransactionStore((s) => s.loadDevMocks);
  const loadTransactionsFromSupabase = useTransactionStore((s) => s.loadTransactionsFromSupabase);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [online, setOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // ── Network monitoring ──────────────────────────────────────────────────────
  useEffect(() => {
    isConnected().then(setOnline);
    return subscribeToNetworkChanges(setOnline);
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (__DEV__) {
        // loadDevMocks is idempotent — no need to clearAll first
        await loadClientMocks();
        await loadTransactionMocks();
      } else if (user && !isLoadingClients) {
        try {
          await loadClientsFromSupabase();
          await loadTransactionsFromSupabase();
        } catch (err) {
          console.error('Dashboard data load failed:', err);
        }
      }
      setIsLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const mergedTransactions = useMemo(
    () => mergeTransactionsSorted(transactions, pendingTxList),
    [transactions, pendingTxList]
  );

  const totalSavings = useMemo(
    () => clients.reduce((sum, c) => sum + (c.balance ?? 0), 0),
    [clients]
  );

  const activeClientCount = useMemo(
    () => clients.filter((c) => c.status === 'active').length,
    [clients]
  );

  const pendingCount =
    pendingTxList.length + clients.filter((c) => c.syncStatus === 'pending').length;

  const isOffline = !online;

  // ── Search filter ───────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [clients, searchQuery]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mergedTransactions;
    return mergedTransactions.filter((t) =>
      t.clientName?.toLowerCase().includes(q)
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

      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.agentName}>{user?.name ?? 'Agent'}</Text>
            </View>

            <View style={styles.topUtilityRow}>
              <OfflineIcon isOffline={isOffline} />
              <NotificationBell hasNotifications={pendingCount > 0} />
              <HeaderAvatar initials={getInitials(user?.name ?? 'AG')} />
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
              trend={pendingCount > 0 ? `${pendingCount} en attente` : undefined}
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
              onClick={() => router.push('/(app)/clients/add')}
            />
            <ActionButton
              label="Dépôt"
              icon={ArrowDown}
              bgVariant="#eaf3de"
              iconColor="#3b6d11"
              onClick={() => router.push('/(app)/transactions/new')}
            />
            <ActionButton
              label="Retrait"
              icon={ArrowUp}
              bgVariant="#FAE8E0"
              iconColor="#993C1D"
              onClick={() => router.push({ pathname: '/(app)/transactions/new', params: { type: 'withdrawal' } })}
            />
            <ActionButton
              label="Rapport"
              icon={FileText}
              bgVariant="#f5f4f0"
              iconColor="#5f5e5a"
              onClick={() => router.push('/(app)/reports')}
            />
          </View>

          {/* Clients */}
          <SectionHeader
            title="Mes clients"
            linkText="Voir tous"
            onLinkClick={() => router.push('/(app)/clients')}
          />

          {filteredClients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucun client trouvé</Text>
            </View>
          ) : (
            filteredClients.slice(0, 3).map((client) => (
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
            onLinkClick={() => router.push('/(app)/transactions')}
          />

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : (
            <View style={styles.transactionContainer}>
              {filteredTransactions.slice(0, 5).map((tx, i) => (
                <TransactionItem
                  key={tx.id}
                  name={tx.clientName ?? '—'}
                  type={tx.type === 'withdrawal' ? 'withdrawal' : 'deposit'}
                  time={relativeTime(tx.date)}
                  amount={tx.amount.toLocaleString('fr-FR')}
                  isLast={i === Math.min(filteredTransactions.length, 5) - 1}
                  onPress={() => router.push(`/(app)/transactions/${tx.id}`)}
                />
              ))}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
  container: {
    flex: 1,
    backgroundColor: '#d0cfc8',
  },
  header: {
    backgroundColor: T.orange,
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  agentName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  topUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: T.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.06 * 11,
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  transactionContainer: {
    backgroundColor: T.bg,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    color: T.text3,
  },
});

export default AgentDashboard;
