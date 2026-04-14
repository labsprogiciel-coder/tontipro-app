import { Pressable, View, Text, StyleSheet } from 'react-native';

interface SectionHeaderProps {
  title: string;
  linkText?: string;
  onLinkClick?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, linkText, onLinkClick }) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {linkText && (
      <Pressable onPress={onLinkClick}>
        <Text style={styles.link}>{linkText} →</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 11, fontWeight: '500', color: '#888780', textTransform: 'uppercase' },
  link: { fontSize: 11, color: '#D85A30' },
});

export default SectionHeader;