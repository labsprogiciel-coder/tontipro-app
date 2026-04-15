import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KAURIDORR_THEME } from '@/constants/colors';

const T = KAURIDORR_THEME;

interface StatusBadgeProps {
  status: 'completed' | 'pending' | 'failed' | 'active' | 'suspended';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case 'completed': case 'active':
        return { bg: T.greenLt, text: T.green, label: status === 'active' ? 'Actif' : 'Terminé' };
      case 'pending':
        return { bg: T.bgWarning, text: T.textWarning, label: 'En attente' };
      default:
        return { bg: '#fcebeb', text: '#a32d2d', label: 'Échec' };
    }
  };

  const config = getStyles();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  text: { fontSize: 10, fontWeight: '600' },
});


export default StatusBadge;