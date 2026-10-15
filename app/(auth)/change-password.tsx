import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction } from "convex/react";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { saveOfflineCredential } from "@/utils/secure-storage";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyRound, ArrowLeft } from "lucide-react-native";
import { PinEntry } from "@/app/components/ui/pin-entry";
import { api } from "@/convex/_generated/api";

import { SPACE } from "@/constants/spacing";
const T = {
  orange: "#D85A30",
  orangeDark: "#993C1D",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f4f0",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
  border: "rgba(0,0,0,0.1)",
};

type Reason = "first_login" | "expired" | "manual";

type Step = "current" | "next" | "confirm";

const STEPS: Step[] = ["current", "next", "confirm"];

export default function ChangePasswordScreen() {
  const { reason } = useLocalSearchParams<{ reason?: Reason }>();
  const router = useRouter();
  const changePassword = useAction(api.users.changePassword);
  const phoneNumber = useAuthStore((s) => s.user?.phone);

  // One code per step, entered on the app's own pad and auto-advancing.
  const [step, setStep] = useState<Step>("current");
  const [codes, setCodes] = useState<Record<Step, string>>({
    current: "",
    next: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messages: Record<Reason, string> = {
    first_login:
      "Pour sécuriser votre compte, veuillez choisir un nouveau mot de passe.",
    expired:
      "Votre mot de passe a expiré (3 jours). Veuillez en choisir un nouveau.",
    manual: "Changez votre mot de passe à tout moment.",
  };

  const stepLabels: Record<Step, string> = {
    current:
      reason === "first_login"
        ? "Code reçu par WhatsApp/SMS"
        : "Code actuel",
    next: "Nouveau code à 4 chiffres",
    confirm: "Confirmez le nouveau code",
  };

  const handleSubmit = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    setIsLoading(true);

    try {
      // Vérifie l'ancien mot de passe puis applique le nouveau, et met à
      // jour les flags Convex — tout côté serveur en un seul appel.
      await changePassword({ oldPassword: currentPassword, newPassword });

      // Le store local (Zustand) garde encore mustChangePassword: true tant
      // qu'on ne le corrige pas — sinon le verrou dur de _layout.tsx (qui lit
      // le store, pas Convex directement) nous détecte encore comme "doit
      // changer son mot de passe" en arrivant sur /(app)/dashboard et nous
      // renvoie en boucle vers cet écran. On avait auparavant un
      // fetchCurrentUser() ici pour resynchroniser depuis Convex, mais cette
      // fonction avale silencieusement ses erreurs (voir auth-store.ts) — un
      // échec ou un retard de cette requête laissait mustChangePassword à
      // true et déclenchait la boucle même après un changement réussi. Comme
      // l'action ci-dessus a déjà confirmé le succès côté serveur, on met à
      // jour le flag localement, sans dépendre d'un aller-retour réseau qui
      // peut échouer.
      useAuthStore.setState((state) =>
        state.user
          ? {
              user: {
                ...state.user,
                mustChangePassword: false,
                passwordSetAt: Date.now(),
              },
            }
          : state,
      );

      // Ce nouveau code sert aussi de secret de déverrouillage hors-ligne
      // (voir utils/secure-storage.ts) — l'agent vient de le confirmer en
      // ligne, donc pas besoin de le redemander tout de suite.
      if (phoneNumber) {
        await saveOfflineCredential(phoneNumber, newPassword);
      }
      useAppLockStore.getState().unlock();

      // Le TPE est déjà lié à l'agent côté admin (dashboard kauri) avant
      // même sa première connexion — pas d'étape de vérification du device
      // à faire ici, première connexion ou pas. Direction dashboard.
      router.replace("/(app)/dashboard" as any);
    } catch (e: any) {
      // Le plus souvent : code actuel refusé — on repart de la 1re étape.
      setError(e.message ?? "Code actuel incorrect");
      setCodes({ current: "", next: "", confirm: "" });
      setStep("current");
    } finally {
      setIsLoading(false);
    }
  };

  const onComplete = (value: string) => {
    if (step === "current") {
      setStep("next");
      return;
    }
    if (step === "next") {
      setStep("confirm");
      return;
    }
    if (value !== codes.next) {
      setError("Les codes ne correspondent pas");
      setCodes((c) => ({ ...c, next: "", confirm: "" }));
      setStep("next");
      return;
    }
    handleSubmit(codes.current, codes.next);
  };

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i === 0) return;
    setError("");
    setCodes((c) => ({ ...c, [step]: "", [STEPS[i - 1]]: "" }));
    setStep(STEPS[i - 1]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <KeyRound size={32} color="white" />
          </View>
          <Text style={styles.title}>Mot de passe</Text>
          <Text style={styles.subtitle}>{messages[reason ?? "manual"]}</Text>
        </View>

        <View style={styles.steps}>
          {STEPS.map((st, i) => (
            <View
              key={st}
              style={[
                styles.stepDot,
                STEPS.indexOf(step) >= i && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>{stepLabels[step]}</Text>

        <PinEntry
          key={step}
          length={4}
          value={codes[step]}
          onChange={(v) => {
            setCodes((c) => ({ ...c, [step]: v }));
            if (error) setError("");
          }}
          onComplete={onComplete}
          disabled={isLoading}
          error={error}
          accessibilityLabel={stepLabels[step]}
        />

        <View style={styles.status}>
          {isLoading ? (
            <ActivityIndicator color={T.orange} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : step !== "current" ? (
            <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
              <ArrowLeft size={16} color={T.textSecondary} />
              <Text style={styles.backText}>Étape précédente</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  screen: { flex: 1, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xxl },
  header: { alignItems: "center", marginBottom: SPACE.xl, gap: SPACE.sm },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.md,
  },
  title: { fontSize: 24, fontWeight: "700", color: T.textPrimary },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.md,
  },
  stepDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
  },
  stepDotDone: { backgroundColor: T.orange },
  stepLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: T.textPrimary,
    textAlign: "center",
    marginBottom: SPACE.lg,
  },
  status: { minHeight: 36, justifyContent: "center", marginTop: SPACE.md },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
  },
  backText: { fontSize: 14, color: T.textSecondary, fontWeight: "500" },
  errorText: { color: T.orangeDark, fontSize: 13, textAlign: "center" },
});
