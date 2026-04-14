import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { PlusCircle, TrendingUp, Users, RefreshCw, Wifi, WifiOff, FileText, MinusCircle, PlusIcon, ArrowDown, ArrowUp } from "lucide-react-native";

import { colors, KAURIDORR_THEME } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import SectionHeader from "../components/ui/section-header";
import { mergeTransactionsSorted, useTransactionStore } from "@/stores/transaction-store";
import { isConnected, subscribeToNetworkChanges } from "@/utils/network";
import OfflineStatus from '../components/header/offline-status';
import MetricPill from '../components/stats/cards';
import NotificationBell from '../components/header/bell';
import HeaderAvatar from '../components/header/avatar';
import OfflineIcon from '../components/header/offline-status';
import ActionButton from '../components/quickactions/quick-action';
import TransactionItem from '../components/transactions/transaction-items';
import ClientCard from '../components/clients/clients';
import SearchInput from '../components/quickactions/search-input';

interface TransactionItem {
  id: string;
  name: string;
  type: 'deposit' | 'withdrawal';
  time: string;
  amount: string;
}

const mockTx: TransactionItem[] = [
  {
    id: '1',
    name: 'John Doe',
    type: 'deposit',
    time: '2 hours ago',
    amount: '1000',
  },
  {
    id: '2',
    name: 'Jane Doe',
    type: 'withdrawal',
    time: '3 hours ago',
    amount: '2000',
  },
  {
    id: '3',
    name: 'John Doe',
    type: 'deposit',
    time: '2 hours ago',
    amount: '1000',
  },
  {
    id: '4',
    name: 'Jane Doe',
    type: 'withdrawal',
    time: '3 hours ago',
    amount: '2000',
  },

]

// Mock data following your design tokens
const MOCK_CLIENTS = [
  { id: '1', initials: 'AK', name: 'Awa Konaté', phone: '+226 70 11 22 33', amount: '85 000 F', status: 'Actif', variant: 'info' },
  { id: '2', initials: 'IT', name: 'Ibrahim Traoré', phone: '+226 76 45 67 89', amount: '120 500 F', status: 'Retard', variant: 'warning' },
  { id: '3', initials: 'MD', name: 'Moussa Diallo', phone: '+226 65 12 34 56', amount: '50 000 F', status: 'Actif', variant: 'success' },
];

const AgentDashboard: React.FC = () => {

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D85A30" />

      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.agentName}>{"Admin"}</Text>
            </View>

            <View style={styles.topUtilityRow}>
              {/* Connectivity Icon */}
              <OfflineIcon isOffline={true} />

              {/* Notification Icon */}
              <NotificationBell hasNotifications={true} />

              {/* Profile Avatar */}
              <HeaderAvatar initials={"KD"} />
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Using the MetricPill logic */}
            <MetricPill
              label="Épargne gérée"
              value="1 240 000"
              unit="FCFA"
              icon={TrendingUp}
            />
            <MetricPill
              label="Clients actifs"
              value="38"
              trend="↑ 3"
              icon={Users}
            />
          </View>
        </View>
        {/* Content Body */}
        <View style={styles.body}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFilterPress={() => setShowFilters(true)}
          />
          {/* Quick Actions */}
          <Text style={styles.sectionLabel}>Actions rapides</Text>
          <View style={styles.actionGrid}>
            <ActionButton
              label="Client"
              icon={PlusIcon}
              bgVariant="#e6f1fb"
              iconColor="#185fa5"
              onClick={() => { }}
            />
            <ActionButton
              label="Depot"
              icon={ArrowDown}
              bgVariant="#eaf3de"
              iconColor="#3b6d11"
              onClick={() => { }}
            />
            <ActionButton
              label="Retrait"
              icon={ArrowUp}
              bgVariant="#FAE8E0"
              iconColor="#993C1D"
              onClick={() => { }}
            />
            <ActionButton
              label="Rapport"
              icon={FileText}
              bgVariant="#f5f4f0"
              iconColor="#5f5e5a"
              onClick={() => { }}
            />
          </View>
          <SectionHeader title="Mes clients" linkText="Voir tous" />

          {MOCK_CLIENTS.slice(0, 3).map((item) => (
            <ClientCard
              key={item.id}
              initials={item.initials}
              name={item.name}
              phone={item.phone}
              amount={item.amount}
              status={item.status as 'Actif' | 'Retard' | 'Neutre'}
              avatarVariant={item.variant as 'info' | 'warning' | 'success'}
            />
          ))
          }

          {/* Insert ClientCard components here */}

          {/* Transactions List Section */}
          < SectionHeader title="Transactions Recentes" linkText="Voir tous" />
          {
            <View style={styles.transactionContainer}>
              {mockTx.map((item) => (
                <TransactionItem
                  key={item.id}
                  name={item.name}
                  type={item.type}
                  time={item.time}
                  amount={item.amount}
                />
              ))}

              {/* Insert TransactionCard components here */}
            </View>
          }
        </View>
      </ScrollView>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  transactionContainer: {
    backgroundColor: '#ffffff', // --color-background-primary
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)', // --color-border-tertiary
    overflow: 'hidden', // Ensures items don't bleed over rounded corners
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff', // --color-background-primary
    borderRadius: 14,
    marginBottom: 8,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)', // --color-border-tertiary
  },
  container: {
    flex: 1,
    backgroundColor: '#d0cfc8', // --color-background-tertiary
  },
  header: {
    backgroundColor: '#D85A30', // Brand color
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    padding: 10,
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '500',
    color: 'white',
  },
  metricSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888780', // --color-text-tertiary
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: '22%', // Roughly 4 columns
  },
  topUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // Sufficient tap target spacing
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10,
    color: '#5f5e5a',
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: '#f5f4f0',
  }
});

export default AgentDashboard;