import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KAURIDORR_THEME } from '@/constants/colors';

const T = KAURIDORR_THEME;

interface ClientBarProps {
  name: string;
  balance: string;
  initials: string;
}

export const ClientBar: React.FC<ClientBarProps> = ({ name, balance, initials }) => (
  <View style={styles.container}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
    <View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.balance}>Solde actuel : {balance} FCFA</Text>
    </View>
    <Feather name="chevron-right" size={14} color={T.text3} style={styles.chevron} />
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, padding: 12, marginHorizontal: 18, borderRadius: 12, borderWidth: 0.5, borderColor: T.border },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.greenLt, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: T.green, fontWeight: '600', fontSize: 12 },
  name: { fontSize: 13, fontWeight: '500', color: T.text1 },
  balance: { fontSize: 11, color: T.text3 },
  chevron: { marginLeft: 'auto' }
});
export default ClientBar;
