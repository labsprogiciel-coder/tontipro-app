const TransactionItem: React.FC<TransactionProps> = ({ name, type, time, amount }) => {
  const isDeposit = type === 'deposit';

  return (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: isDeposit ? '#eaf3de' : '#FAE8E0' }]}>
        {/* Render SVG Icon here */}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{isDeposit ? 'Dépôt' : 'Retrait'} · {time}</Text>
      </View>
      <Text style={[styles.val, { color: isDeposit ? '#3b6d11' : '#993C1D' }]}>
        {isDeposit ? `+${amount}` : `−${amount}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 11, flex: 1 },
  name: { fontSize: 13, fontWeight: '500', color: '#1a1a18' },
  meta: { fontSize: 11, color: '#888780' },
  val: { fontSize: 13, fontWeight: '500' },
});