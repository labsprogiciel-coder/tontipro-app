import { Tabs, useRouter } from "expo-router";
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
  reports:     "reports",
};

const TAB_TO_ROUTE: Record<TabKey, string> = {
  home:     "dashboard",
  clients:  "clients",
  history:  "transactions",
  reports:  "reports",
};

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const activeRoute = state.routes[state.index]?.name ?? "";
  const activeTab = ROUTE_TO_TAB[activeRoute];

  // Hide nav on detail / modal screens
  if (!activeTab) return null;

  return (
    <BottomNavBar
      activeTab={activeTab}
      onTabPress={(tab) => navigation.navigate(TAB_TO_ROUTE[tab])}
      onAddPress={() => router.push("/(app)/transactions/new")}
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
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="profile-edit" />
      <Tabs.Screen name="agents" />
      <Tabs.Screen name="data" />
    </Tabs>
  );
}
