import { Pressable, View, Text, StyleSheet } from 'react-native';

const ActionButton: React.FC<ActionButtonProps> = ({ label, icon, bgVariant, onClick }) => (
  <Pressable 
    onPress={onClick}
    style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
  >
    <View style={[styles.iconContainer, { backgroundColor: bgVariant }]}>
      {icon}
    </View>
    <Text style={styles.btnLabel}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#ffffff', // --color-background-primary
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    width: '23%', // Fit 4 in a row
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  btnLabel: { fontSize: 10, color: '#5f5e5a', textAlign: 'center' },
  pressed: { opacity: 0.7, backgroundColor: '#f5f4f0' },
});