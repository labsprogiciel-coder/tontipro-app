import { Tabs } from "expo-router";
import { Home, Users, Wallet, BarChart3, Settings } from "lucide-react-native";
import { colors } from "@/constants/colors";
import { useNetworkSync } from "@/hooks/useNetworkSync";

export default function AppLayout() {
  useNetworkSync(); // ✅ Sync automatique en arrière-plan
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontWeight: "600",
          color: colors.text,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: "Accueil",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          href: "/(app)/clients",
        }}
      />
      <Tabs.Screen
        name="clients/add"
        options={{
          href: null,
          title: "Ajouter un client",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="clients/[id]"
        options={{
          href: null,
          title: "Détails du client",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="clients/scan"
        options={{
          href: null,
          title: "Scanner ID",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => <Wallet size={24} color={color} />,
          href: "/(app)/transactions",
        }}
      />
      <Tabs.Screen
        name="transactions/new"
        options={{
          href: null,
          title: "Nouvelle transaction",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="transactions/withdraw"
        options={{
          href: null,
          title: "Retrait",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="transactions/[id]"
        options={{
          href: null,
          title: "Détails de la transaction",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Rapports",
          tabBarIcon: ({ color }) => <BarChart3 size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}