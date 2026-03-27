import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";

export default function AuthSplash() {
  const router = useRouter();
  const { isAuthenticated, isLoadingClients } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      // ✅ Wait for clients to load after authentication
      if (isAuthenticated && !isLoadingClients) {
        router.replace("/dashboard");
      } else if (!isAuthenticated) {
        router.replace("/(auth)/login");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoadingClients, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
