
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ClientCardProps {
    name: string;              // e.g., "Ibrahim Traoré"
    phone: string;             // e.g., "+226 76 45 67 89"
    amount: number;            // Total savings, e.g., 120500
    status: 'Actif' | 'Retard'; // Labels used in the UI badges
    initials: string;          // e.g., "IT"
    avatarVariant: StatusVariant; // Maps to background colors like '--color-background-warning'
  }
  
  const ClientCard: React.FC<ClientCardProps> = ({ 
    initials, 
    name, 
    phone, 
    amount, 
    status, 
    variant 
  }) => {

  
    return (
      <View style={styles.card}>
        {/* Avatar Section */}
        <View style={[styles.avatar, { backgroundColor: avatarColors[variant].bg }]}>
          <Text style={[styles.avatarText, { color: avatarColors[variant].text }]}>
            {initials}
          </Text>
        </View>
  
        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.phoneText}>{phone}</Text>
        </View>
  
        {/* Right-side Data */}
        <View style={styles.rightContainer}>
          <Text style={styles.amountText}>{amount}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColors[status].bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors[status].text }]}>
              {status}
            </Text>
          </View>
        </View>
      </View>
    );
  };
  
  const styles = StyleSheet.create({
    card: {
      backgroundColor: '#ffffff', // --color-background-primary
      borderRadius: 14,
      padding: 13,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: 'rgba(0,0,0,0.1)', // --color-border-tertiary
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '500',
    },
    infoContainer: {
      marginLeft: 12,
      flex: 1,
    },
    nameText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#1a1a18', // --color-text-primary
    },
    phoneText: {
      fontSize: 11,
      color: '#5f5e5a', // --color-text-secondary
      marginTop: 1,
    },
    rightContainer: {
      alignItems: 'flex-end',
    },
    amountText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#1a1a18',
    },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      marginTop: 3,
    },
    badgeText: {
      fontSize: 10,
    },
  });
  
  export default ClientCard;