import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { ArrowDown, ArrowUp, UserPlus } from 'lucide-react-native';
import ClientCard from '../clients/clients';
import SearchInput from '../quickactions/search-input';



const StartTransaction = () => {
    const [searchId, setSearchId] = useState('');
    const [foundClient, setFoundClient] = useState<any>(null);

    // Mock search logic - in production, this filters your ClientStore
    const handleSearch = (val: string) => {
        setSearchId(val);
        if (val === '123456') { // Example ID match
            setFoundClient({
                name: 'Ibrahim Traoré',
                phone: '+226 76 45 67 89',
                amount: '120 500 F',
                status: 'Actif',
                initials: 'IT'
            });
        } else {
            setFoundClient(null);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Nouvelle Opération</Text>
                <Text style={styles.subtitle}>Saisissez l'ID du client pour commencer</Text>
            </View>

            <View style={styles.body}>
                <SearchInput
                    placeholder="Entrez l'ID Client (ex: 123456)"
                    value={searchId}
                    onChangeText={handleSearch}
                />

                {foundClient ? (
                    <View style={styles.resultSection}>
                        <Text style={styles.sectionLabel}>Client trouvé</Text>
                        <ClientCard
                            {...foundClient}
                            avatarVariant="success"
                        />
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <UserPlus size={48} color="#888780" strokeWidth={1} />
                        <Text style={styles.emptyText}>Aucun client sélectionné</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#eeede8' },
    header: { padding: 20, paddingTop: 40, backgroundColor: '#D85A30' },
    title: { fontSize: 22, fontWeight: '700', color: '#fff' },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    body: { padding: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: '#888780', textTransform: 'uppercase', marginBottom: 12 },
    resultSection: { marginTop: 10 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
    emptyText: { marginTop: 12, color: '#888780', fontSize: 14 }
});

export default StartTransaction;