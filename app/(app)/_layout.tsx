import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNetworkSync } from "@/hooks/useNetworkSync";
import { useTransactionRealtimeSubscribe } from "@/hooks/useTransactionRealtime";
import { useAuthStore } from "@/stores/auth-store";
import BottomNavBar, { TabKey } from "@/app/components/ui/BottomNavBar";

// Routes that have a corresponding tab key
const ROUTE_TO_TAB: Record<string, TabKey> = {
  dashboard:    "home",
  clients:      "clients",
  transactions: "history",
  settings:     "profile",
};

const TAB_TO_ROUTE: Record<TabKey, string> = {
  home:     "dashboard",
  clients:  "clients",
  history:  "transactions",
  profile:  "settings",
};

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index]?.name ?? "";
  const activeTab = ROUTE_TO_TAB[activeRoute];

  // Hide nav on detail / modal screens
  if (!activeTab) return null;

  return (
    <BottomNavBar
      activeTab={activeTab}
      onTabPress={(tab) => navigation.navigate(TAB_TO_ROUTE[tab])}
      onAddPress={() => navigation.navigate("transactions/new")}
    />
  );
}

export default function AppLayout() {
  const userId = useAuthStore((s) => s.user?.id);
  useNetworkSync();
  useTransactionRealtimeSubscribe(userId);

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="clients/add" />
      <Tabs.Screen name="clients/[id]" />
      <Tabs.Screen name="clients/scan" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="transactions/new" />
      <Tabs.Screen name="transactions/[id]" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="agents" />
      <Tabs.Screen name="agents/[id]" />
      <Tabs.Screen name="agents/add" />
    </Tabs>
  );
}
