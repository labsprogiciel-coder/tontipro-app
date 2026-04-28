import React, { useMemo, useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useClientStore } from '@/stores/client-store';
import { useRouter } from 'expo-router';
import { ArrowUp, ArrowDown, ChevronLeft } from 'lucide-react-native';
import StatusBadge from '../../components/ui/status-bar';
import { KAURIDORR_THEME } from '@/constants/colors';
import SearchInput from '../../components/quickactions/search-input';

const T = KAURIDORR_THEME;

type SortOrder = 'desc' | 'asc';
type SearchType = 'name' | 'code';

export const ClientsScreen: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchType, setSearchType] = useState<SearchType>('name');
  const clients = useClientStore((state) => state.clients);
  const loadClients = useClientStore((state) => state.loadClientsFromSupabase);

  // Reload clients when page comes into focus
  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const result = clients.filter((c) => {
      if (searchType === 'name') {
        return c.name.toLowerCase().includes(q) || c.phone.includes(searchQuery);
      } else if (searchType === 'code') {
        return c.accountNumber?.toLowerCase().includes(q) || false;
      }
      return false;
    });
    result.sort((a, b) => {
      const diff = new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
      return sortOrder === 'desc' ? -diff : diff;
    });
    return result;
  }, [clients, searchQuery, sortOrder, searchType]);

  const renderClient = ({ item }: any) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => router.push(`/(app)/clients/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.balance}>{item.balance.toLocaleString('fr-FR')} F</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.phone}>{item.phone}</Text>
          <StatusBadge status={item.status} />
        </View>
        {item.accountNumber && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.code}>{item.accountNumber}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={18} color={T.text2} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Mes Clients</Text>
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
          {sortOrder === 'desc'
            ? <ArrowDown size={13} color={T.orange} strokeWidth={2} />
            : <ArrowUp size={13} color={T.orange} strokeWidth={2} />}
          <Text style={styles.sortLabel}>{sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchTypeRow}>
        <TouchableOpacity
          style={[styles.searchTypeBtn, searchType === 'name' && styles.searchTypeBtnActive]}
          onPress={() => { setSearchType('name'); setSearchQuery(''); }}
        >
          <Text style={[styles.searchTypeText, searchType === 'name' && styles.searchTypeTextActive]}>Par nom</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.searchTypeBtn, searchType === 'code' && styles.searchTypeBtnActive]}
          onPress={() => { setSearchType('code'); setSearchQuery(''); }}
        >
          <Text style={[styles.searchTypeText, searchType === 'code' && styles.searchTypeTextActive]}>Par code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchInputWrapper}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilterPress={() => {}}
        />
      </View>

      {/* Message et bouton d'ajout si aucun client trouvé */}
      {searchQuery.length > 0 && filteredClients.length === 0 && (
        <View style={styles.noResultContainer}>
          <Text style={styles.noResultText}>Ce client n'existe pas, voulez-vous l'ajouter&nbsp;?</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (searchType === 'code') {
                router.push({ pathname: '/(app)/clients/add', params: { code: searchQuery } });
              } else {
                router.push({ pathname: '/(app)/clients/add', params: { name: searchQuery } });
              }
            }}
          >
            <Text style={styles.addBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      )}

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
    noResultContainer: {
      alignItems: 'center',
      marginVertical: 24,
      marginHorizontal: 24,
      padding: 18,
      backgroundColor: T.bg2,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: T.border,
    },
    noResultText: {
      fontSize: 15,
      color: T.text3,
      marginBottom: 12,
      textAlign: 'center',
    },
    addBtn: {
      backgroundColor: T.orange,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 8,
    },
    addBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
  container: { flex: 1, backgroundColor: T.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border },
  title: { fontSize: 22, fontWeight: '700' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.orangeLt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sortLabel: { fontSize: 11, fontWeight: '500', color: T.orange },
  
  searchTypeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 8 },
  searchTypeBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, alignItems: 'center' },
  searchTypeBtnActive: { borderColor: T.orange, backgroundColor: T.orangeLt },
  searchTypeText: { fontSize: 12, fontWeight: '600', color: T.text3 },
  searchTypeTextActive: { color: T.orange },
  
  clientCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
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
    marginRight: 12,
    marginTop: 2
  },
  avatarText: { color: T.orange, fontWeight: '700', fontSize: 14 },
  name: { fontSize: 15, fontWeight: '600', color: T.text1, flex: 1 },
  code: { fontSize: 11, fontWeight: '600', color: T.orange, backgroundColor: T.orangeLt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  phone: { fontSize: 12, color: T.text3, flex: 1 },
  balance: { fontSize: 14, fontWeight: '700', color: T.text1 }
});