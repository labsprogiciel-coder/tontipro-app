// app/(auth)/login.tsx
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, Mail, Lock, ArrowRight, Smartphone, Eye, EyeOff } from "lucide-react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/stores/auth-store";
import { useConvexAuth } from "convex/react";

const T = {
  orange: "#D85A30",
  orangeDark: "#993C1D",
  orangeLight: "#FAE8E0",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f4f0",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
  border: "rgba(0,0,0,0.1)",
  borderStrong: "rgba(0,0,0,0.2)",
};

export default function LoginScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { signIn } = useAuthActions();
  const linkAccount = useMutation(api.users.linkAgentAccount);
  const { isAuthenticated: convexAuthed } = useConvexAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authComplete, setAuthComplete] = useState(false);

  const isActivation = !!token;

  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const user = useAuthStore((s) => s.user);

  // Watch for Convex user to populate after signIn
  useEffect(() => {
    if (!authComplete || !convexAuthed || !user) return;

    // Check suspended status
    if (user.status === "suspended") {
      setError("Votre compte a été suspendu. Veuillez contacter votre gérant.");
      setIsLoading(false);
      setAuthComplete(false);
      return;
    }

    // Account authenticated but never linked to a branch (e.g. invalid/expired
    // invite token, or a signUp that completed without a successful link step).
    // Per the ticket, branchId is required for all subsequent Convex queries,
    // so we must not let an unlinked account through to the app.
    if (!user.branchId) {
      setError(
        "Ce compte n'est associé à aucune agence. Vérifiez votre lien d'invitation ou contactez votre gérant."
      );
      setIsLoading(false);
      setAuthComplete(false);
      return;
    }

    // Check device binding
    if (user.device === null) {
      router.replace("/(auth)/bind-device");
    } else {
      router.replace("/dashboard");
    }
    setIsLoading(false);
  }, [authComplete, convexAuthed, user, router]);

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (isActivation && !token) {
      setError("Lien d'invitation invalide ou manquant. Demandez un nouveau lien à votre gérant.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isActivation) {
        // Step 1: Create account
        await signIn("password", {
          flow: "signUp",
          email: email.toLowerCase().trim(),
          password,
        });
        // Step 2: Link invite token (immediately after signIn resolves)
        await linkAccount({ inviteToken: token });
      } else {
        // Returning agent sign-in
        await signIn("password", {
          flow: "signIn",
          email: email.toLowerCase().trim(),
          password,
        });
        // Always call linkAccount post-login (no-op for already linked accounts)
        await linkAccount({});
      }

      // Signal that auth is done, useEffect will watch for user data
      setAuthComplete(true);
    } catch (e: any) {
      console.error("Auth error:", e);
      setError(e.message || "Une erreur est survenue lors de l'authentification");
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.bindBtn} onPress={() => router.push("/(auth)/bind-device")}>
          <Smartphone size={20} color={T.textTertiary} />
        </Pressable>

        <View style={styles.screen}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <ShieldCheck size={32} color="white" />
            </View>
            <Text style={styles.appName}>Kauridorr</Text>
            <Text style={styles.title}>
              {isActivation ? "Activation de compte" : "Connexion Agent"}
            </Text>
            <Text style={styles.subtitle}>
              {isActivation 
                ? "Créez vos identifiants pour rejoindre votre agence."
                : "Accédez à votre espace de travail mobile."}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email professionnel</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={T.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="agent@kauridorr.com"
                  placeholderTextColor={T.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={T.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={T.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={T.textTertiary} />
                  ) : (
                    <Eye size={18} color={T.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleAuth}
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
                  <Text style={styles.submitBtnText}>
                    {isActivation ? "Activer mon compte" : "Se connecter"}
                  </Text>
                  <ArrowRight size={18} color="white" />
                </>
              )}
            </Pressable>
          </View>

          {!isActivation && (
            <Pressable onPress={() => router.push("/(auth)/register")} style={styles.footerLink}>
              <Text style={styles.footerText}>
                Pas encore invité ? <Text style={styles.footerLinkText}>Contacter un gérant</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  screen: { flex: 1, paddingHorizontal: 28, paddingTop: 40 },

  // Header
  header: { alignItems: "center", marginBottom: 40, gap: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center", alignItems: "center",
    marginBottom: 12,
  },
  appName: { fontSize: 18, fontWeight: "600", color: T.textTertiary, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: "700", color: T.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: T.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  // Form
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: T.textSecondary, marginLeft: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  eyeBtn: { padding: 4, marginLeft: 4 },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: T.textPrimary,
  },
  errorText: { color: T.orangeDark, fontSize: 13, textAlign: "center" },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: T.orange,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    shadowColor: T.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // Footer
  footerLink: { marginTop: 32, alignItems: "center" },
  footerText: { fontSize: 14, color: T.textSecondary },
  footerLinkText: { color: T.orange, fontWeight: "600" },

  // Bind device icon (top-right)
  bindBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: T.bgSecondary,
  },
  
});
