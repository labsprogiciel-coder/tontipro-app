import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { useNavigationStore } from "@/stores/navigation-store";

/**
 * Hook to persist and restore navigation state
 * This is particularly useful during development to stay on the same screen after refresh
 */
export function useNavigationPersistence() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const currentRoute = useNavigationStore((state) => state.currentRoute);
  const storedParams = useNavigationStore((state) => state.params);
  const setCurrentRoute = useNavigationStore((state) => state.setCurrentRoute);
  const hasRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Restore navigation state on app start (only once)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (Platform.OS === "web") {
      hasRestoredRef.current = true;
      return;
    }

    const shouldRestore = 
      currentRoute && 
      currentRoute !== "/" && 
      currentRoute !== "/(auth)/splash" &&
      !currentRoute.startsWith("/(auth)") &&
      pathname !== currentRoute;

    if (shouldRestore) {
      try {
        isRestoringRef.current = true;
        router.replace({
          pathname: currentRoute,
          params: storedParams,
        });
      } catch (error) {
        console.error("Failed to restore navigation state:", error);
        useNavigationStore.getState().clearNavigationState();
      }
    }
    
    hasRestoredRef.current = true;
  }, []);

  // Save current route when it changes (but not during restoration)
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    if (pathname && pathname !== "/(auth)/splash") {
      setCurrentRoute(pathname, params as Record<string, any>);
    }
  }, [pathname, params, setCurrentRoute]);

  const clearNavigationState = useCallback(() => {
    useNavigationStore.getState().clearNavigationState();
  }, []);

  return {
    currentRoute,
    clearNavigationState,
  };
}