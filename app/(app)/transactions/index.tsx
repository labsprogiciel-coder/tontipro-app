import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import StatusBadge from '../../components/ui/status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KAURIDORR_THEME } from '@/constants/colors';
import { useTransactionStore, mergeTransactionsSorted } from '@/stores/transaction-store';
import { useClientStore } from '@/stores/client-store';
import { useRouter } from 'expo-router';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import SearchInput from '../../components/quickactions/search-input';

const T = KAURIDORR_THEME;
type SortOrder = 'desc' | 'asc';
type SearchType = 'client' | 'code';

export const HistoryScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchType, setSearchType] = useState<SearchType>('client');
  const transactions = useTransactionStore((state) => state.transactions);
  const pendingTransactions = useTransactionStore((state) => state.pendingTransactions);
  const clients = useClientStore((state) => state.clients);

  const mergedTransactions = useMemo(
    () => mergeTransactionsSorted(transactions, pendingTransactions),
    [transactions, pendingTransactions]
  );

  const filteredTransactions = useMemo(() => {
    const result = mergedTransactions.filter((t) => {
      if (filter === "deposits") {
        if (t.type !== "deposit") return false;
      } else if (filter === "withdrawals") {
        if (t.type !== "withdrawal") return false;
      }

      // Search filtering
      const q = search.toLowerCase();
      if (searchType === 'client') {
        // Search by client name or phone
        return (t.clientName?.toLowerCase().includes(q) || false);
      } else if (searchType === 'code') {
        // Search by client code
        const client = clients.find((c) => c.id === t.clientId);
        return client?.accountNumber?.toLowerCase().includes(q) || false;
      }
      return true;
    });
    result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === 'desc' ? -diff : diff;
    });
    return result;
  }, [mergedTransactions, filter, sortOrder, search, searchType, clients]);

  const getMultiplier = (clientId: string, amount: number): number | undefined => {
    const commitment = clients.find((c) => c.id === clientId)?.commitmentAmount;
    if (!commitment || commitment <= 0) return undefined;
    const m = Math.round(amount / commitment);
    return m >= 1 ? m : undefined;
  };

  const renderTransaction = ({ item }: any) => {
    const multiplier = getMultiplier(item.clientId, item.amount);
    const client = clients.find((c) => c.id === item.clientId);
    return (
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.name}>{item.clientName ?? '—'}</Text>
          {client?.accountNumber && (
            <Text style={styles.code}>{client.accountNumber}</Text>
          )}
          <Text style={styles.sub}>{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={styles.right}>
          <View style={styles.amountRow}>
            {multiplier != null && (
              <View style={[styles.multiplierBadge, { backgroundColor: item.type === 'deposit' ? T.bgSuccess : T.orangeLt }]}>
                <Text style={[styles.multiplierText, { color: item.type === 'deposit' ? T.textSuccess : T.orangeDk }]}>×{multiplier}</Text>
              </View>
            )}
            <Text style={[styles.amount, { color: item.type === 'deposit' ? T.greenMid : T.orangeDk }]}>
              {item.type === 'deposit' ? '+' : '−'}{item.amount.toLocaleString('fr-FR')} F
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Historique</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
          {sortOrder === 'desc'
            ? <ArrowDown size={13} color={T.orange} strokeWidth={2} />
            : <ArrowUp size={13} color={T.orange} strokeWidth={2} />}
          <Text style={styles.sortLabel}>{sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchTypeRow}>
        <TouchableOpacity
          style={[styles.searchTypeBtn, searchType === 'client' && styles.searchTypeBtnActive]}
          onPress={() => { setSearchType('client'); setSearch(''); }}
        >
          <Text style={[styles.searchTypeText, searchType === 'client' && styles.searchTypeTextActive]}>Par client</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.searchTypeBtn, searchType === 'code' && styles.searchTypeBtnActive]}
          onPress={() => { setSearchType('code'); setSearch(''); }}
        >
          <Text style={[styles.searchTypeText, searchType === 'code' && styles.searchTypeTextActive]}>Par code</Text>
        </TouchableOpacity>
      </View>

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
  searchInputWrapper: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700', color: T.text1 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.orangeLt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sortLabel: { fontSize: 11, fontWeight: '500', color: T.orange },
  
  searchTypeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 8 },
  searchTypeBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, alignItems: 'center' },
  searchTypeBtnActive: { borderColor: T.orange, backgroundColor: T.orangeLt },
  searchTypeText: { fontSize: 12, fontWeight: '600', color: T.text3 },
  searchTypeTextActive: { color: T.orange },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 18, borderBottomWidth: 0.5, borderColor: T.border },
  left: { gap: 4, flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  multiplierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  multiplierText: { fontSize: 10, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', color: T.text1 },
  code: { fontSize: 11, color: T.orange, backgroundColor: T.orangeLt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', fontWeight: '500' },
  sub: { fontSize: 12, color: T.text3 },
  amount: { fontSize: 15, fontWeight: '700' },
});