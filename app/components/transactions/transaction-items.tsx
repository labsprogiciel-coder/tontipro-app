import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export interface TransactionProps {
  name: string;
  type: 'deposit' | 'withdrawal';
  time: string;
  amount: string;
  balance?: string;
  isLast?: boolean;
  onPress?: () => void;
}

const TransactionItem: React.FC<TransactionProps> = ({ name, type, time, amount, balance, isLast, onPress }) => {
  const isDeposit = type === 'deposit';

  return (
    <TouchableOpacity style={[styles.item, isLast && styles.itemLast]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: isDeposit ? '#eaf3de' : '#FAE8E0' }]} />
      <View style={styles.textContainer}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{time}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.val, { color: isDeposit ? '#3b6d11' : '#993C1D' }]}>
          {isDeposit ? `+${amount}` : `−${amount}`}
        </Text>
        {balance && <Text style={styles.bal}>Solde : {balance}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  itemLast: { borderBottomWidth: 0 },
  dot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 11, flex: 1 },
  name: { fontSize: 13, fontWeight: '500', color: '#1a1a18' },
  meta: { fontSize: 11, color: '#888780' },
  right: { alignItems: 'flex-end' },
  val: { fontSize: 13, fontWeight: '500' },
  bal: { fontSize: 10, color: '#888780', marginTop: 1 },
});

export default TransactionItem;