import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClientStore } from '@/stores/client-store';
import { useRouter } from 'expo-router';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import StatusBadge from '../../components/ui/status-bar';
import { KAURIDORR_THEME } from '@/constants/colors';
import SearchInput from '../../components/quickactions/search-input';

const T = KAURIDORR_THEME;

type SortOrder = 'desc' | 'asc';

export const ClientsScreen: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const clients = useClientStore((state) => state.clients);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const result = clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(searchQuery)
    );
    result.sort((a, b) => {
      const diff = new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
      return sortOrder === 'desc' ? -diff : diff;
    });
    return result;
  }, [clients, searchQuery, sortOrder]);

  const renderClient = ({ item }: any) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => router.push(`/(app)/clients/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{item.accountNumber ?? item.phone}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.balance}>{item.balance.toLocaleString('fr-FR')} F</Text>
        <StatusBadge status={item.status} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Mes Clients</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
          {sortOrder === 'desc'
            ? <ArrowDown size={13} color={T.orange} strokeWidth={2} />
            : <ArrowUp size={13} color={T.orange} strokeWidth={2} />}
          <Text style={styles.sortLabel}>{sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchInputWrapper}>
      <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFilterPress={() => {}}
      />
      </View>
      <FlatList
        data={filteredClients}
        renderItem={renderClient}
        keyExtractor={item => item.id}
      />
    </SafeAreaView>
  );
};

export default ClientsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.orangeLt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sortLabel: { fontSize: 11, fontWeight: '500', color: T.orange },
  clientCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    marginHorizontal: 18, 
    marginBottom: 8,
    backgroundColor: T.bg2,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: T.border 
  },
  searchInputWrapper: { paddingHorizontal: 20},

  avatar: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: T.orangeLt, 
    justifyContent: 'center', alignItems: 'center', 
    marginRight: 12 
  },
  avatarText: { color: T.orange, fontWeight: '700', fontSize: 14 },
  name: { fontSize: 15, fontWeight: '600', color: T.text1 },
  phone: { fontSize: 12, color: T.text3 },
  balance: { fontSize: 14, fontWeight: '700', color: T.text1, marginBottom: 4 }
});