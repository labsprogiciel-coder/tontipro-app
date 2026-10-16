// app/_layout.tsx
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
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
import { useAppLockStore } from "@/stores/app-lock-store";
import * as adminApi from "@/lib/admin-api";

/**
 * Where ConvexAuthProvider keeps the session tokens (`__convexAuthJWT_*`,
 * `__convexAuthRefreshToken_*`). Its `storage` prop accepts async reads, so
 * this goes straight to AsyncStorage: the earlier synchronous cache only
 * reloaded keys starting with "convex", missed these, and every cold start
 * came back signed out of the server while the PIN still unlocked the app.
 */
const storageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const unstable_settings = {
  initialRouteName: "(auth)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({});
  const [isNavigationReady, setIsNavigationReady] = useState(
    Platform.OS === "web",
  );

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

/** Synchronizes the staff profile and routes around sign-in, PIN unlock, and required password changes. */
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated: convexAuthed, isLoading: convexLoading } =
    useConvexAuth();
  const convexUser = useQuery(adminApi.me);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const setConvexUser = useAuthStore((s) => s.setConvexUser);
  const isUnlocked = useAppLockStore((s) => s.isUnlocked);

  // Sync Convex auth state → Zustand store
  useEffect(() => {
    if (convexLoading) return; // still checking

    if (convexAuthed && convexUser) {
      // Convex session active → populate store (a suspended account,
      // `active: false`, is signed out locally by setConvexUser)
      setConvexUser(convexUser);
    } else if (convexAuthed && convexUser === undefined) {
      // Authenticated but users:me hasn't resolved yet — wait
    } else if (convexAuthed && convexUser === null) {
      // Authenticated via Convex but no matching user profile (e.g. record
      // deleted server-side). Don't leave the app in limbo — mark
      // initialized so the navigation guard can route to login.
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        isInitialized: true,
      });
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

  // Navigation guard — only runs after Stack is mounted.
  // Only fires from the auth *entry* screens (login/register/splash) — the
  // other (auth) screens (bind-device, verify-device, change-password,
  // welcome) manage their own transitions once the user is authenticated,
  // and redirecting to bind-device from bind-device itself (or similar)
  // would re-trigger this effect every time `segments` changes reference,
  // causing an infinite "Maximum update depth exceeded" loop.
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)";
    const currentAuthScreen = segments[1];
    const isAuthEntryScreen =
      !currentAuthScreen || ["login", "splash"].includes(currentAuthScreen);
    const user = useAuthStore.getState().user;

    // Verrou dur : tant que mustChangePassword est true côté serveur, aucun
    // écran de (app) n'est accessible — même via un état de navigation
    // persisté ou une redirection qui aurait mal tourné (voir le bug de
    // boucle change-password ↔ verify-device corrigé récemment). L'agent
    // n'obtient l'accès qu'une fois confirmPasswordChange (convex/users.ts)
    // effectivement passé mustChangePassword à false.
    if (isAuthenticated && user?.mustChangePassword && inAppGroup) {
      // @ts-ignore
      router.replace({
        pathname: "/(auth)/welcome",
        params: {
          orgName: user.organization?.name ?? "Mizo",
          next: "change-password",
        },
      });
      return;
    }

    // Porte de déverrouillage : redemandée à chaque cold start (voir
    // stores/app-lock-store.ts, non persisté — `isUnlocked` repart toujours
    // à `false` au démarrage du process JS). Une session Convex/Zustand déjà
    // valide ne suffit plus à elle seule pour accéder à (app)/* ; l'agent
    // doit retaper son code (en ligne ou hors-ligne) via login.tsx. Filet de
    // sécurité pour un accès direct à (app)/* (deep link, état de navigation
    // restauré) — le cas normal (cold start atterrissant sur /login) est
    // couvert par le `else` plus bas, qui évite simplement de forwarder.
    if (isAuthenticated && !isUnlocked && inAppGroup) {
      // @ts-ignore
      router.replace("/login");
      return;
    }

    if (isAuthenticated && inAuthGroup && isAuthEntryScreen) {
      // Doit rester en phase avec la logique de login.tsx : sinon
      // ce guard global route vers /dashboard une fraction de seconde avant
      // que l'écran de login n'ait eu le temps de rediriger vers welcome →
      // change-password, et gagne la course (welcome/change-password ne
      // s'affichent jamais).
      if (user?.mustChangePassword) {
        // @ts-ignore
        router.replace({
          pathname: "/(auth)/welcome",
          params: {
            orgName: user.organization?.name ?? "Mizo",
            next: "change-password",
          },
        });
      } else if (isUnlocked && user && user.device === null && user.branchId) {
        // Seulement une fois déverrouillé : avant, login.tsx doit encore
        // faire choisir le code PIN local (set-pin.tsx) ou le faire saisir.
        // @ts-ignore
        router.replace("/(auth)/bind-device");
      } else if (isUnlocked) {
        // Mot de passe déjà changé, device présent : écran de bienvenue
        // (nom de l'agence + agent) puis enchaînement automatique vers le
        // dashboard — voir welcome.tsx.
        // @ts-ignore
        router.replace({
          pathname: "/(auth)/welcome",
          params: { orgName: user?.organization?.name ?? "Mizo" },
        });
      } else if (currentAuthScreen === "splash") {
        // !isUnlocked et aucune des conditions ci-dessus : il faut l'UI de
        // déverrouillage, que seul login.tsx affiche — splash.tsx n'est
        // qu'un spinner sans UI propre (voir son commentaire). Un agent déjà
        // authentifié (session persistée) qui redémarre l'app atterrit sur
        // splash avec isUnlocked toujours à false (non persisté) ; sans cette
        // branche, aucune redirection ne se déclenche et l'app reste bloquée
        // indéfiniment sur le spinner de splash.
        // @ts-ignore
        router.replace("/login");
      }
      // else : déjà sur login, !isUnlocked — on ne forwarde pas, login.tsx
      // affiche son mode déverrouillage (isUnlockMode) tant qu'on y reste.
    } else if (
      !isAuthenticated &&
      (!inAuthGroup || currentAuthScreen === "splash")
    ) {
      // splash.tsx n'a aucune logique de redirection propre (voir son
      // commentaire) : sans cette branche, un utilisateur non authentifié qui
      // atterrit sur la route initiale "(auth)/splash" reste bloqué
      // indéfiniment (aucune des conditions ci-dessus ne matche puisque
      // inAuthGroup est vrai), et l'app ne démarre jamais.
      // @ts-ignore
      router.replace("/login");
    }
  }, [isAuthenticated, isInitialized, isUnlocked, segments]);

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
