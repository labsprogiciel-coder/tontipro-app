import { View, Text, StyleSheet } from 'react-native';

const MetricPill: React.FC<MetricPillProps> = ({ label, value, unit, trend }) => (
  <View style={styles.pill}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
    {unit && <Text style={styles.subText}>{unit}</Text>}
    {trend && <Text style={styles.subText}>{trend}</Text>}
  </View>
);

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(255,255,255,0.18)', // Glassmorphism style
    borderRadius: 12,
    padding: 10,
    flex: 1,
  },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 3 },
  value: { fontSize: 17, fontWeight: '500', color: 'white' },
  subText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
});