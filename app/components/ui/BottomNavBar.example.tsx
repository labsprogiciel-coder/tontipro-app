/**
 * BottomNavBar — Integration example
 *
 * This shows how to wire BottomNavBar with React Navigation v6
 * using a custom tab bar renderer.
 *
 * Install dependencies:
 *   npx expo install @react-navigation/native @react-navigation/bottom-tabs
 *   npx expo install react-native-safe-area-context react-native-screens
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNavBar, { TabKey } from './BottomNavBar';

// ─── Placeholder screens ─────────────────────────────────────────────────────
const placeholder = (label: string) => () => (
  <View style={s.screen}>
    <Text style={s.screenText}>{label}</Text>
  </View>
);

const HomeScreen     = placeholder('Tableau de bord');
const ClientsScreen  = placeholder('Liste des clients');
const HistoryScreen  = placeholder('Historique');
const ProfileScreen  = placeholder('Profil agent');

// ─── Tab navigator ───────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

// Maps React Navigation route names → our TabKey type
const ROUTE_TO_TAB: Record<string, TabKey> = {
  Home:    'home',
  Clients: 'clients',
  History: 'history',
  Profile: 'profile',
};

const TAB_TO_ROUTE: Record<TabKey, string> = {
  home:    'Home',
  clients: 'Clients',
  history: 'History',
  profile: 'Profile',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => {
            // Derive active tab key from current route name
            const routeName = props.state.routes[props.state.index].name;
            const activeTab = ROUTE_TO_TAB[routeName] ?? 'home';

            return (
              <BottomNavBar
                activeTab={activeTab}
                onTabPress={(tab) => {
                  props.navigation.navigate(TAB_TO_ROUTE[tab]);
                }}
                onAddPress={() => {
                  // Navigate to new-client flow (modal or stack screen)
                  props.navigation.navigate('NewClient' as never);
                }}
              />
            );
          }}
        >
          <Tab.Screen name="Home"    component={HomeScreen}    />
          <Tab.Screen name="Clients" component={ClientsScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Standalone usage (without React Navigation) ────────────────────────────
// If you manage navigation yourself, just keep local state:
//
// function MyLayout() {
//   const [activeTab, setActiveTab] = useState<TabKey>('home');
//
//   return (
//     <View style={{ flex: 1 }}>
//       {activeTab === 'home'    && <HomeScreen />}
//       {activeTab === 'clients' && <ClientsScreen />}
//       {activeTab === 'history' && <HistoryScreen />}
//       {activeTab === 'profile' && <ProfileScreen />}
//
//       <BottomNavBar
//         activeTab={activeTab}
//         onTabPress={setActiveTab}
//         onAddPress={() => setShowNewClientModal(true)}
//       />
//     </View>
//   );
// }

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f4f0',
  },
  screenText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a18',
  },
});
