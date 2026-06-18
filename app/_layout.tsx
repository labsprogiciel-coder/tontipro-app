// app/_layout.tsx
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConvexAuthProvider, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";

import { convex } from "@/lib/convex";
import { colors } from "@/constants/colors";
import ErrorBoundary from "@/app/error-boundary";
import { useNavigationStore } from "@/stores/navigation-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/convex/_generated/api";

/**
 * Adapter to make AsyncStorage compatible with ConvexAuthProvider's `storage` prop.
 * Convex expects a Web Storage-like interface (synchronous getItem/setItem).
 * Since AsyncStorage is async, we use a synchronous cache that hydrates on init.
 */
const storageAdapter = {
  getItem: (key: string) => {
    // Sync read from cache (Convex calls this synchronously)
    return _storageCache.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    _storageCache.set(key, value);
    AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    _storageCache.delete(key);
    AsyncStorage.removeItem(key);
  },
};

const _storageCache = new Map<string, string>();

// Hydrate cache on module load
AsyncStorage.getAllKeys().then((keys) => {
  const convexKeys = keys.filter((k) => k.startsWith("convex"));
  return Promise.all(
    convexKeys.map((k) => AsyncStorage.getItem(k).then((v) => { if (v) _storageCache.set(k, v); }))
  );
});

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
    <ConvexAuthProvider client={convex} storage={storageAdapter}>
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
    </ConvexAuthProvider>
  );
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated: convexAuthed, isLoading: convexLoading } = useConvexAuth();
  const convexUser = useQuery(api.users.currentUser);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const setConvexUser = useAuthStore((s) => s.setConvexUser);

  // Sync Convex auth state → Zustand store
  useEffect(() => {
    if (convexLoading) return; // still checking

    if (convexAuthed && convexUser) {
      // Convex session active → populate store
      setConvexUser(convexUser);
    } else if (convexAuthed && convexUser === undefined) {
      // Authenticated but currentUser hasn't resolved yet — wait
    } else if (convexAuthed && convexUser === null) {
      // Authenticated via Convex but no matching user profile (e.g. record
      // deleted server-side). Don't leave the app in limbo — mark
      // initialized so the navigation guard can route to login.
      useAuthStore.setState({ isAuthenticated: false, user: null, isInitialized: true });
    } else if (!convexAuthed) {
      // Not authenticated via Convex — check local PIN for offline fallback
      // Keep existing state if already authenticated via PIN
      if (!isAuthenticated) {
        useAuthStore.setState({ isInitialized: true });
      }
    }
  }, [convexAuthed, convexLoading, convexUser]);

  // Mark initialized when Convex finishes checking
  useEffect(() => {
    if (!convexLoading && !isInitialized) {
      useAuthStore.setState({ isInitialized: true });
    }
  }, [convexLoading, isInitialized]);

  // Navigation guard — only runs after Stack is mounted
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isAuthenticated && inAuthGroup) {
      // Check if device binding is needed
      const user = useAuthStore.getState().user;
      if (user && user.device === null && user.branchId) {
        // @ts-ignore
        router.replace("/(auth)/bind-device");
      } else {
        // @ts-ignore
        router.replace("/dashboard");
      }
    } else if (!isAuthenticated && !inAuthGroup) {

      // @ts-ignore
      router.replace("/login");
    }
  }, [isAuthenticated, isInitialized, segments]);

  

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
