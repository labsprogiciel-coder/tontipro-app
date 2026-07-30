import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction } from "convex/react";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { saveOfflineCredential } from "@/utils/secure-storage";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyRound, ArrowRight, Eye, EyeOff } from "lucide-react-native";
import { api } from "@/convex/_generated/api";

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

export default function ChangePasswordScreen() {
  const { reason } = useLocalSearchParams<{ reason?: Reason }>();
  const router = useRouter();
  const changePassword = useAction(api.users.changePassword);
  const phoneNumber = useAuthStore((s) => s.user?.phone);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messages: Record<Reason, string> = {
    first_login:
      "Pour sécuriser votre compte, veuillez choisir un nouveau mot de passe.",
    expired:
      "Votre mot de passe a expiré (3 jours). Veuillez en choisir un nouveau.",
    manual: "Changez votre mot de passe à tout moment.",
  };

  const handleSubmit = async () => {
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    if (!/^\d{4}$/.test(newPassword)) {
      setError("Le nouveau mot de passe doit être un code à 4 chiffres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

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
      setError(e.message ?? "Mot de passe actuel incorrect");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <KeyRound size={32} color="white" />
            </View>
            <Text style={styles.title}>Mot de passe</Text>
            <Text style={styles.subtitle}>{messages[reason ?? "manual"]}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoComplete="current-password"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={T.textTertiary}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowCurrentPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} color={T.textTertiary} />
                  ) : (
                    <Eye size={18} color={T.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoComplete="password-new"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={T.textTertiary}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowNewPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  {showNewPassword ? (
                    <EyeOff size={18} color={T.textTertiary} />
                  ) : (
                    <Eye size={18} color={T.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Confirmer le mot de passe
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password-new"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={T.textTertiary}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={T.textTertiary} />
                  ) : (
                    <Eye size={18} color={T.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.submitBtn,
                isLoading && styles.btnDisabled,
                pressed && !isLoading && styles.btnPressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Continuer</Text>
                  <ArrowRight size={18} color="white" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  keyboard: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 28, paddingTop: 48 },
  header: { alignItems: "center", marginBottom: 36, gap: 8 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "700", color: T.textPrimary },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: T.textSecondary,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: T.textPrimary,
  },
  eyeBtn: { padding: 4, marginLeft: 4 },
  errorText: { color: T.orangeDark, fontSize: 13, textAlign: "center" },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: T.orange,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
