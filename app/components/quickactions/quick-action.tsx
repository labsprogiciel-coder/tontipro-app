import React from 'react';
import { Pressable, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface ActionButtonProps {
  label: string;
  icon: LucideIcon;
  bgVariant: string;    // Background of the ICON square (e.g., #eaf3de)
  iconColor: string;    // Color of the ICON itself (e.g., #3b6d11)
  buttonBg?: string;    // Optional: Background of the whole button
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon: Icon,
  bgVariant,
  iconColor,
  buttonBg,
  onClick
}) => (
  <Pressable
    onPress={onClick}
    // Correctly merging dynamic background with base styles
    style={({ pressed }) => [
      styles.btn,
      buttonBg ? { backgroundColor: buttonBg } : null,
      pressed && styles.pressed
    ]}
  >
    <View style={[styles.iconContainer, { backgroundColor: bgVariant }]}>
      <Icon
        size={18}
        color={iconColor}
        strokeWidth={2.5}
      />
    </View>
    <Text style={styles.btnLabel}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#ffffff', // Default: --color-background-primary
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    width: '23%', // 4-column layout
    // Add a very subtle shadow to match the card feel
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  btnLabel: {
    fontSize: 10,
    color: '#5f5e5a', // --color-text-secondary
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: '#f5f4f0', // --color-background-secondary
  },
});

export default ActionButton;