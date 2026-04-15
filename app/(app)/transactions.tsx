import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import StatusBadge from '../components/ui/status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KAURIDORR_THEME } from '@/constants/colors';

const T = KAURIDORR_THEME;
import { useTransactionStore, mergeTransactionsSorted } from '@/stores/transaction-store';
import { useRouter } from 'expo-router';
import SearchInput from '../components/quickactions/search-input';

export const HistoryScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const [filter, setFilter] = useState("all"); // all, deposits, withdrawals
  const transactions = useTransactionStore((state) => state.transactions);
  const pendingTransactions = useTransactionStore((state) => state.pendingTransactions);

  const mergedTransactions = useMemo(
    () => mergeTransactionsSorted(transactions, pendingTransactions),
    [transactions, pendingTransactions]
  );

  const filteredTransactions = mergedTransactions.filter((transaction) => {
    if (filter === "all") return true;
    if (filter === "deposits") return transaction.type === "deposit";
    if (filter === "withdrawals") return transaction.type === "withdrawal";
    return true;
  });

  const renderTransaction = ({ item }: any) => (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.name}>{item.clientName ?? '—'}</Text>
        <Text style={styles.sub}>{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: item.type === 'deposit' ? T.orange : T.green }]}>
          {item.type === 'deposit' ? '+' : '-'}{item.amount.toLocaleString('fr-FR')} F
        </Text>
        <StatusBadge status={item.status} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Historique</Text>
      <View style={styles.searchInputWrapper}>
      <SearchInput
            value={search}
            onChangeText={setSearch}
            onFilterPress={() => {}}
      />
          </View>
      <FlatList 
        data={filteredTransactions} 
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  searchInputWrapper: { paddingHorizontal: 20},
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 18, paddingVertical: 12, color: T.text1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, marginHorizontal: 18, borderBottomWidth: 0.5, borderColor: T.border },
  left: { gap: 4 },
  right: { alignItems: 'flex-end', gap: 6 },
  name: { fontSize: 14, fontWeight: '600', color: T.text1 },
  sub: { fontSize: 12, color: T.text3 },
  amount: { fontSize: 15, fontWeight: '700' },
});