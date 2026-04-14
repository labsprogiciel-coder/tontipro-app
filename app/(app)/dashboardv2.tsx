import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';

const AgentDashboard: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D85A30" />
      
      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.agentName}>Konaté Djibril</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>KD</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Using the MetricPill logic */}
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Épargne gérée</Text>
              <Text style={styles.metricValue}>1 240 000</Text>
              <Text style={styles.metricSub}>FCFA</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Clients actifs</Text>
              <Text style={styles.metricValue}>38</Text>
              <Text style={styles.metricSub}>↑ 3 ce mois</Text>
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Quick Actions */}
          <Text style={styles.sectionLabel}>Actions rapides</Text>
          <View style={styles.actionGrid}>
            <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
              <View style={[styles.actionIcon, { backgroundColor: '#FAE8E0' }]}>
                {/* SVG/Icon would go here */}
              </View>
              <Text style={styles.actionLabel}>Nouveau</Text>
            </Pressable>
            {/* Repeat for Deposit, Withdrawal, etc. */}
          </View>

          {/* Client List Section */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Mes clients</Text>
            <Pressable><Text style={styles.seeAll}>Voir tous →</Text></Pressable>
          </View>
          {/* Insert ClientCard components here */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d0cfc8', // --color-background-tertiary
  },
  header: {
    backgroundColor: '#D85A30', // Brand color
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  agentName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    padding: 10,
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '500',
    color: 'white',
  },
  metricSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888780', // --color-text-tertiary
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: '22%', // Roughly 4 columns
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10,
    color: '#5f5e5a',
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: '#f5f4f0',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    fontSize: 11,
    color: '#D85A30',
  }
});

export default AgentDashboard;