import { View, Text, StyleSheet } from 'react-native';

const HeaderAvatar: React.FC<{ initials: string }> = ({ initials }) => (
    <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
    </View>
);

const styles = StyleSheet.create({
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.25)', // Semi-transparent overlay
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '500',
    },
});

export default HeaderAvatar;