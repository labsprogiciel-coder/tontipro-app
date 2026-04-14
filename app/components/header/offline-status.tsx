import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Wifi, WifiOff } from "lucide-react-native";

interface OfflineIconProps {
    isOffline: boolean;
    onPress?: () => void;
}

const OfflineIcon: React.FC<OfflineIconProps> = ({ isOffline, onPress }) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
            // Subtle background shift if offline to draw attention
            isOffline && { backgroundColor: 'rgba(153, 60, 29, 0.4)' }
        ]}
    >
        {isOffline ? (
            <WifiOff size={18} color="#ffffff" strokeWidth={2} />
        ) : (
            <Wifi size={18} color="rgba(255,255,255,0.9)" strokeWidth={2} />
        )}

        {/* Status Dot */}
        <View style={[
            styles.statusDot,
            { backgroundColor: isOffline ? '#FAE8E0' : '#eaf3de' } // logic from original design
        ]} />
    </Pressable>
);

const styles = StyleSheet.create({
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.25)', // Matches Avatar/Bell
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    statusDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#D85A30', // Matches header background
    },
    pressed: {
        opacity: 0.7,
    }
});

export default OfflineIcon;