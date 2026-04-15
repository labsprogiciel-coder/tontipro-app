// components/ReceiptCard.tsx
import { TransactionType } from '@/constants/utils';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KAURIDORR_THEME } from '@/constants/colors';

const T = KAURIDORR_THEME;

interface ReceiptCardProps {
  amount: string;
  type: TransactionType;
  client: string;
  reference: string;
  date?: string;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({ 
  amount, 
  type, 
  client, 
  reference,
  date = '15 avr. 2026 à 10:23'
}) => {
  const isDep = type === 'deposit';
  const color = isDep ? T.orange : T.green;

  return (
    <View style={styles.card}>
      <View style={[styles.header, { backgroundColor: color }]}>
        <Text style={styles.amount}>{isDep ? '+' : '-'}{amount} FCFA</Text>
        <Text style={styles.sub}>{isDep ? 'Dépôt' : 'Retrait'} · {date}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Client</Text>
        <Text style={styles.value}>{client}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Commission</Text>
        <Text style={styles.value}>150 FCFA</Text>
      </View>
      <Text style={styles.ref}>Réf. {reference}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: T.bg2, borderRadius: 16, overflow: 'hidden', marginVertical: 20 },
  header: { padding: 16, alignItems: 'center' },
  amount: { fontSize: 28, fontWeight: '600', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 0.5, borderColor: T.border },
  label: { color: T.text3, fontSize: 12 },
  value: { color: T.text1, fontWeight: '500', fontSize: 13 },
  ref: { textAlign: 'center', padding: 8, fontSize: 10, color: T.text3 }
});
export default ReceiptCard;
