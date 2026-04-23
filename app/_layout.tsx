import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import ErrorBoundary from "@/app/error-boundary";
import { useNavigationStore } from "@/stores/navigation-store";
import { supabase } from "@/lib/supabase";
import { useAuthStore, getUserDisplayName } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAgentStore } from "@/stores/agent-store";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({});
  const [isNavigationReady, setIsNavigationReady] = useState(Platform.OS === "web");

  const clearNavigationState = useCallback(() => {
    useNavigationStore.getState().clearNavigationState();
  }, []);

  useEffect(() => {
    if (error) {
      console.error(error);
      clearNavigationState();
      throw error;
    }
  }, [error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded && isNavigationReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isNavigationReady]);

  if (!loaded || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary onError={clearNavigationState}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
            translucent={Platform.OS === "android"}
          />
          <RootLayoutNav />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  // ✅ Tâche 4 : Restaurer la session au démarrage une seule fois
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, agent_code, role, phone")
            .eq("id", session.user.id)
            .single();

          (useAuthStore as any).setState({
            isAuthenticated: true,
            isInitialized: true,
            user: {
              id: session.user.id,
              name: getUserDisplayName(profile, session.user),
              phone: profile?.phone ?? session.user.phone,
              role: profile?.role ?? "agent",
            },
          });

          try {
            await useClientStore.getState().loadClientsFromSupabase();
            await useTransactionStore.getState().loadTransactionsFromSupabase();
          } catch (e) {
            console.error("Chargement données après restauration session:", e);
          }
        } else {
          (useAuthStore as any).setState({ isAuthenticated: false, isInitialized: true, user: null });
          // ✅ Charger les mocks en mode développement si pas de session
          if (DEV_MOCKS_ENABLED) {
            try {
              await useClientStore.getState().loadDevMocks();
            } catch (e) {
              console.warn("Chargement mocks échoué:", e);
            }
          } else {
            useClientStore.getState().clearAll();
            useTransactionStore.getState().clearAll();
            useAgentStore.getState().clearAll();
          }
        }
      } catch (e) {
        console.error("Erreur restauration session:", e);
        (useAuthStore as any).setState({ isAuthenticated: false, isInitialized: true, user: null });
        // ✅ Charger les mocks en mode développement en cas d'erreur
        if (DEV_MOCKS_ENABLED) {
          try {
            await useClientStore.getState().loadDevMocks();
          } catch (e) {
            console.warn("Chargement mocks échoué:", e);
          }
        } else {
          useClientStore.getState().clearAll();
          useTransactionStore.getState().clearAll();
          useAgentStore.getState().clearAll();
        }
      }
    };

    restoreSession();

    // ✅ Tâche 5 : Écouter uniquement SIGNED_OUT pour forcer le retour au login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        (useAuthStore as any).setState({ isAuthenticated: false, isInitialized: true, user: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Tâche 8 : Redirection basée sur isInitialized + isAuthenticated
  useEffect(() => {
    if (!isInitialized) return; // Attend que la session soit vérifiée

    const inAuthGroup = segments[0] === "(auth)";

    if (isAuthenticated && inAuthGroup) {
      // Connecté mais sur une page auth → dashboard
      // @ts-ignore
      router.replace("/dashboard");
    } else if (!isAuthenticated && !inAuthGroup) {
      // Non connecté mais sur une page protégée → login
      // @ts-ignore
      router.replace("/login");
    }
  }, [isAuthenticated, isInitialized, segments]);

  // Loader pendant la vérification de session
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});