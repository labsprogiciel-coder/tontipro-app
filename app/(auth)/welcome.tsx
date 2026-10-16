import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";

import { SPACE } from "@/constants/spacing";
// Durée d'affichage de l'écran de bienvenue avant l'enchaînement automatique
// vers le changement de mot de passe (première connexion) — assez long pour
// être lu, assez court pour ne pas ralentir l'agent.
const AUTO_ADVANCE_DELAY_MS = 2200;

const T = {
  orange: "#D85A30",
  orangeStrong: "#BB4721", // fills behind white text (5.2:1)
  orangeDark: "#993C1D",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f4f0",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
};

export default function WelcomeScreen() {
  const { orgName, next } = useLocalSearchParams<{
    orgName?: string;
    next?: "change-password" | "dashboard";
  }>();
  const { user } = useAuthStore();
  const router = useRouter();

  const isFirstLogin = next === "change-password";

  // Écran de bienvenue toujours transitoire : première connexion → change
  // de mot de passe, sinon (mustChangePassword déjà false, à chaque
  // lancement de l'app) → dashboard directement, sans action requise.
  useEffect(() => {
    const destination = isFirstLogin
      ? "/(auth)/change-password?reason=first_login"
      : "/dashboard";
    const timer = setTimeout(() => {
      router.replace(destination as any);
    }, AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isFirstLogin, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <ShieldCheck size={48} color="white" />
        </View>

        <Text style={styles.title}>Bienvenue dans la micro-finance</Text>
        <Text style={styles.orgName}>{orgName}</Text>

        <Text style={styles.agentName}>{user?.name}</Text>

        <View style={styles.redirectHint}>
          <ActivityIndicator color={T.orange} />
          <Text style={styles.redirectHintText}>
            {isFirstLogin
              ? "Configuration de votre mot de passe..."
              : "Préparation de votre tableau de bord..."}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  content: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: T.orangeStrong,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: T.textPrimary,
    textAlign: "center",
    marginBottom: SPACE.sm,
  },
  orgName: {
    fontSize: 18,
    fontWeight: "600",
    color: T.orangeDark,
    textAlign: "center",
    marginBottom: SPACE.xl,
  },
  agentName: {
    fontSize: 15,
    color: T.textSecondary,
    textAlign: "center",
    marginBottom: SPACE.xxl,
  },
  redirectHint: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  redirectHintText: { fontSize: 14, color: T.textSecondary },
});
