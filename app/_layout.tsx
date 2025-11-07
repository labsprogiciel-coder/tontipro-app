import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { ErrorBoundary } from "./error-boundary";
import { useNavigationStore } from "@/stores/navigation-store";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // We'll use system fonts for now
  });
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
    // Set navigation as ready after a short delay to allow state restoration
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
    <ErrorBoundary
      onError={() => {
        // Clear navigation state if there's an error in the app
        clearNavigationState();
      }}
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar 
            barStyle="dark-content" 
            backgroundColor={colors.background}
            translucent={Platform.OS === 'android'}
          />
          <RootLayoutNav />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
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