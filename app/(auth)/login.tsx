// app/(auth)/login.tsx
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ShieldCheck,
  Phone,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { useConvexAuth } from "convex/react";
import * as Device from "expo-device";
import { withAuthRetry } from "@/lib/withAuthRetry";
import { getOrCreateDeviceInstallId } from "@/utils/device-id";
import { isConnected } from "@/utils/network";
import { saveOfflineCredential, verifyOfflineCredential } from "@/utils/secure-storage";
import { PinEntry } from "@/app/components/ui/pin-entry";

import { SPACE } from "@/constants/spacing";
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

  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Two steps: the phone number first (system keyboard), then the code on
  // its own screen with the app's pad — never both fields on one screen.
  const [loginStep, setLoginStep] = useState<"phone" | "code">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authComplete, setAuthComplete] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const [deviceSerial, setDeviceSerial] = useState<string | null>(null);
  const [unlockCode, setUnlockCode] = useState("");
  const isActivation = !!token;
  const isUnlocked = useAppLockStore((s) => s.isUnlocked);
  const logout = useAuthStore((s) => s.logout);
  // signIn() résout avant que le token ne soit propagé au transport Convex
  // (voir withAuthRetry.ts) — appeler linkAccount juste après produisait
  // systématiquement un premier essai "Non authentifié" côté serveur (visible
  // dans les logs Convex) avant que la retry loop ne finisse par réussir. On
  // attend maintenant que `convexAuthed` (dérivé du token réellement propagé)
  // passe à true avant d'appeler linkAccount, ce qui évite cet essai voué à
  // l'échec dans l'immense majorité des cas.
  const [pendingLink, setPendingLink] = useState(false);

  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    (async () => {
      try {
        const modelName = Device.modelName || "Modèle inconnu";
        const brand = Device.brand || "Marque inconnue";
        const installId = await getOrCreateDeviceInstallId();

        const serial = `${brand}-${modelName}-${installId}`
          .toUpperCase()
          .slice(0, 50);

        setDeviceSerial(serial);
      } catch (err) {
        console.warn("Impossible de récupérer le serial du device:", err);
      }
    })();
  }, []);

  // Agent déjà connu (session persistée d'une ouverture précédente) mais pas
  // encore déverrouillé cette session (cold start) : on affiche un écran de
  // déverrouillage compact — juste le code à 4 chiffres — plutôt que le
  // formulaire complet. Ne s'applique pas à un lien d'activation (`token`),
  // qui doit toujours pouvoir enregistrer un nouvel agent sur cet appareil.
  const isUnlockMode = !isActivation && user !== null && !isUnlocked;

  // Dans le useEffect qui surveille authComplete, ajoute des logs :

useEffect(() => {
  console.log("🔍 useEffect déclenché:", {
    authComplete,
    convexAuthed,
    user: user ? "présent" : "null",
    mustChangePassword: user?.mustChangePassword,
    device: user?.device ? "présent" : "null",
  });

  if (!authComplete || !convexAuthed || !user) {
    console.log("⏳ En attente:", { authComplete, convexAuthed, user: !!user });
    return;
  }

  console.log("✅ Toutes les conditions remplies, vérification...");

  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    setError(`Compte verrouillé. Réessayez dans ${minutes} minutes.`);
    setIsLoading(false);
    setAuthComplete(false);
    return;
  }

  if (user.status === "suspended") {
    setError("Votre compte a été suspendu. Veuillez contacter votre gérant.");
    setIsLoading(false);
    setAuthComplete(false);
    return;
  }

  if (!user.branchId) {
    setError(
      "Ce compte n'est associé à aucune agence. Vérifiez votre lien d'invitation ou contactez votre gérant."
    );
    setIsLoading(false);
    setAuthComplete(false);
    return;
  }

  console.log("✅ Vérifications de base OK, vérification mustChangePassword...");

  // Identité confirmée pour cette ouverture de l'app (login complet ou
  // déverrouillage réussi) — ferme la porte locale de app-lock-store.
  useAppLockStore.getState().unlock();

  if (user.mustChangePassword) {
    router.replace({
      pathname: "/(auth)/welcome",
      params: {
        orgName: user.organization?.name ?? "Kauri",
        next: "change-password",
      },
    } as any);
    setIsLoading(false);
    return;
  }

  console.log("🔑 mustChangePassword = false, vérification expiration...");

  if (user.passwordSetAt) {
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - user.passwordSetAt > THREE_DAYS) {
      router.replace("/(auth)/change-password?reason=expired" as any);
      setIsLoading(false);
      return;
    }
  }

  if (user.device === null) {
    setError(
      "Aucun terminal n'est assigné à votre compte.\n" +
        "Veuillez contacter votre administrateur pour qu'il vous assigne un TPE."
    );
    setIsLoading(false);
    setAuthComplete(false);
    return;
  }

  console.log("✅ Tout OK, redirection vers welcome");
  router.replace({
    pathname: "/(auth)/welcome",
    params: { orgName: user.organization?.name ?? "Kauri" },
  } as any);
  setIsLoading(false);
}, [authComplete, convexAuthed, user, router]);

// Ne tente linkAccount qu'une fois le token réellement propagé au
  // transport Convex (convexAuthed === true) — voir commentaire sur
  // `pendingLink` plus haut.
  useEffect(() => {
    if (!pendingLink || !convexAuthed) return;
    setPendingLink(false);
    (async () => {
      try {
        await withAuthRetry(() => linkAccount({}));
        setAuthComplete(true);
      } catch (e: any) {
        console.error("Link account error:", e);
        setError(
          e?.message || "Une erreur est survenue lors de la liaison du compte",
        );
        setIsLoading(false);
      }
    })();
  }, [pendingLink, convexAuthed]);

  const goToCodeStep = () => {
    // Spaces, dots and dashes are formatting only; the rest must be digits
    // (with an optional leading +) — at least 8 of them.
    const digits = phoneNumber.replace(/[\s.-]/g, "");
    if (!/^\+?\d{8,15}$/.test(digits)) {
      setError("Entrez un numéro de téléphone valide.");
      return;
    }
    setError("");
    setPassword("");
    Keyboard.dismiss();
    setLoginStep("code");
  };

  const handleAuth = async (code: string = password) => {
    if (!phoneNumber || !code) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);
    setError("");

    const phone = phoneNumber.trim();

    try {
      // ÉTAPE 1 : le serveur nous dit si c'est une première connexion
      // ("invited" → code d'activation à vérifier) ou une connexion normale
      // ("active" → mot de passe permanent). Cette valeur, fiable, remplace
      // l'ancienne détection basée sur le texte d'une erreur d'auth.
      const eligibility = await convex.query(api.users.checkLoginEligibility, {
        phoneNumber: phone,
      });

      if (!eligibility.valid) {
        setError(eligibility.message ?? "Erreur de vérification");
        setIsLoading(false);
        return;
      }

      if (eligibility.status === "invited") {
        const check = await convex.action(api.otp.checkActivationCode, {
          phoneNumber: phone,
          code,
        });
        if (!check.valid) {
          setError(check.message ?? "Code incorrect ou expiré.");
          setPassword("");
          setIsLoading(false);
          return;
        }

        try {
          await signIn("password", {
            flow: "signUp",
            phoneNumber: phone,
            password: code,
          });
        } catch (signUpError: any) {
          // Reliquat d'une activation précédente restée bloquée (signUp
          // réussi mais linkAccount jamais abouti) — on nettoie le compte
          // orphelin et on retente une seule fois.
          if (!String(signUpError?.message ?? "").includes("already exists")) {
            throw signUpError;
          }
          await convex.mutation(api.users.clearStaleActivationAccount, {
            phoneNumber: phone,
          });
          await signIn("password", {
            flow: "signUp",
            phoneNumber: phone,
            password: code,
          });
        }
        setPendingLink(true);
        return;
      } else {
        // Vérifie le mot de passe AVANT signIn — c'est ce qui permet un
        // suivi fiable des tentatives ratées côté serveur (voir
        // verifyLoginPassword dans convex/users.ts) : le provider Password
        // lui-même n'incrémente aucun compteur en cas d'échec.
        const check = await convex.action(api.users.verifyLoginPassword, {
          phoneNumber: phone,
          password: code,
        });
        if (!check.valid) {
          setError(check.message ?? "Mot de passe incorrect.");
          setPassword("");
          setIsLoading(false);
          return;
        }
        await signIn("password", {
          flow: "signIn",
          phoneNumber: phone,
          password: code,
        });
        // Ce mot de passe vient d'être confirmé en ligne — on rafraîchit le
        // secret de déverrouillage hors-ligne (utils/secure-storage.ts) pour
        // qu'il fonctionne aussi sur cet appareil sans réseau.
        await saveOfflineCredential(phone, code);
      }

      setAuthComplete(true);
    } catch (e: any) {
      console.error("Auth error:", e);

      let errorMessage = "Une erreur est survenue lors de l'authentification";

      if (typeof e?.message === "string") {
        if (e.message.includes("Invalid password")) {
          errorMessage = "Mot de passe incorrect. Veuillez réessayer.";
        } else if (e.message.includes("Aucun compte trouvé")) {
          errorMessage =
            "Aucun compte trouvé pour ce numéro. Contactez votre administrateur.";
        } else if (e.message.length > 0) {
          errorMessage = e.message;
        }
      }

      setError(errorMessage);
      setPassword("");
      setIsLoading(false);
    }
  };

  /**
   * Déverrouillage local : ne recrée pas de session, juste une porte devant
   * la session déjà persistée (voir stores/app-lock-store.ts). En ligne, le
   * mot de passe est revérifié auprès de Convex (avec suivi anti-brute-force)
   * et le `signIn` n'est refait que si le JWT local n'est plus attaché. Hors
   * ligne, la vérification se fait entièrement en local (SecureStore), sans
   * appel réseau — c'est le coeur du besoin "agent sur le terrain".
   */
  const handleUnlock = async (code: string) => {
    if (!user?.phone) {
      // Saved session without a phone number: nothing to check the code
      // against — don't leave a full, silent PIN on screen.
      setUnlockCode("");
      setError("Session incomplète. Déconnectez-vous puis reconnectez-vous.");
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      setError("Entrez votre code à 4 chiffres.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const online = await isConnected();
      if (online) {
        const check = await convex.action(api.users.verifyLoginPassword, {
          phoneNumber: user.phone,
          password: code,
        });
        if (!check.valid) {
          setError(check.message ?? "Code incorrect.");
          setUnlockCode("");
          setIsLoading(false);
          return;
        }
        if (!convexAuthed) {
          await signIn("password", {
            flow: "signIn",
            phoneNumber: user.phone,
            password: code,
          });
        }
        await saveOfflineCredential(user.phone, code);
      } else {
        const check = await verifyOfflineCredential(user.phone, code);
        if (!check.valid) {
          setError(check.message ?? "Code incorrect.");
          setUnlockCode("");
          setIsLoading(false);
          return;
        }
      }
      setAuthComplete(true);
    } catch (e: any) {
      setError(e?.message ?? "Une erreur est survenue lors du déverrouillage.");
      setUnlockCode("");
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!phoneNumber || resendState === "sending") return;
    setResendState("sending");
    setError("");
    try {
      await convex.action(api.otp.resendActivationCode, {
        phoneNumber: phoneNumber.trim(),
      });
      setResendState("sent");
    } catch (e: any) {
      setError(e?.message ?? "Impossible de renvoyer le code.");
      setResendState("idle");
    }
  };

  if (isUnlockMode) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.screen, styles.pinScreen]}>
          <View style={[styles.header, styles.pinHeader]}>
            <View style={styles.logoCircle}>
              <ShieldCheck size={32} color="white" />
            </View>
            <Text style={styles.appName}>Kauridorr</Text>
            <Text style={styles.title}>{user?.name ?? "Bienvenue"}</Text>
            <Text style={styles.subtitle}>
              Entrez votre code à 4 chiffres pour continuer.
            </Text>
          </View>

          <PinEntry
            length={4}
            value={unlockCode}
            onChange={(v) => {
              setUnlockCode(v);
              if (error) setError("");
            }}
            onComplete={handleUnlock}
            disabled={isLoading}
            error={error}
            accessibilityLabel="Code de déverrouillage"
          />

          <View style={styles.pinStatus}>
            {isLoading ? (
              <ActivityIndicator color={T.orange} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              logout();
              setUnlockCode("");
              setError("");
            }}
            style={styles.pinFooterLink}
          >
            <Text style={styles.footerText}>
              Ce n&apos;est pas vous ?{" "}
              <Text style={styles.footerLinkText}>Se déconnecter</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loginStep === "code") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.screen, styles.pinScreen]}>
          <Pressable
            onPress={() => {
              setLoginStep("phone");
              setPassword("");
              setError("");
            }}
            hitSlop={8}
            style={styles.backLink}
          >
            <ArrowLeft size={18} color={T.textSecondary} />
            <Text style={styles.backLinkText}>Changer de numéro</Text>
          </Pressable>

          <View style={[styles.header, styles.pinHeader]}>
            <Text style={styles.title}>
              {isActivation ? "Code d'activation" : "Entrez votre code"}
            </Text>
            <Text style={styles.subtitle}>
              Code à 4 chiffres pour le{" "}
              <Text style={styles.phoneStrong}>{phoneNumber.trim()}</Text>
              {"\n"}(première connexion : code reçu par WhatsApp/SMS)
            </Text>
          </View>

          <PinEntry
            length={4}
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (error) setError("");
            }}
            onComplete={(code) => handleAuth(code)}
            masked={!showPassword}
            disabled={isLoading}
            error={error}
            accessibilityLabel="Code"
          />

          <View style={styles.pinStatus}>
            {isLoading ? (
              <ActivityIndicator color={T.orange} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          <View style={styles.codeLinks}>
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              style={styles.revealBtn}
            >
              {showPassword ? (
                <EyeOff size={16} color={T.textSecondary} />
              ) : (
                <Eye size={16} color={T.textSecondary} />
              )}
              <Text style={styles.footerText}>
                {showPassword ? "Masquer" : "Afficher"}
              </Text>
            </Pressable>
            <Pressable onPress={handleResendCode} hitSlop={8}>
              <Text style={styles.footerLinkText}>
                {resendState === "sending"
                  ? "Envoi en cours..."
                  : resendState === "sent"
                    ? "Code renvoyé ✓"
                    : "Code non reçu ? Renvoyer"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.screen}>
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

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
              <View style={styles.inputWrapper}>
                <Phone
                  size={18}
                  color={T.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="+226 70 00 00 00"
                  placeholderTextColor={T.textTertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoFocus
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={goToCodeStep}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.submitBtnText}>Continuer</Text>
              <ArrowRight size={18} color="white" />
            </Pressable>
          </View>

          {!isActivation && (
            <Pressable
              onPress={() => router.push("/(auth)/register")}
              style={styles.footerLink}
            >
              <Text style={styles.footerText}>
                Pas encore invité ?{" "}
                <Text style={styles.footerLinkText}>Contacter un gérant</Text>
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
  screen: { flex: 1, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xxxl },

  header: { alignItems: "center", marginBottom: SPACE.xxl, gap: SPACE.sm },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginBottom: SPACE.xl,
  },
  backLinkText: { fontSize: 14, color: T.textSecondary, fontWeight: "500" },
  phoneStrong: { fontWeight: "700", color: T.textPrimary },
  codeLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACE.xs,
  },
  revealBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  pinScreen: { paddingTop: SPACE.xl },
  pinHeader: { marginBottom: SPACE.xl },
  pinStatus: { minHeight: 36, justifyContent: "center", marginTop: SPACE.md },
  pinFooterLink: { marginTop: SPACE.sm, alignItems: "center" },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.md,
  },
  appName: {
    fontSize: 18,
    fontWeight: "600",
    color: T.textTertiary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: T.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACE.lg,
  },

  form: { gap: SPACE.lg },
  fieldGroup: { gap: SPACE.sm },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: T.textSecondary,
    marginLeft: SPACE.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: SPACE.md,
  },
  inputIcon: { marginRight: SPACE.sm },
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
    gap: SPACE.sm,
    marginTop: SPACE.sm,
    shadowColor: T.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  footerLink: { marginTop: SPACE.xxl, alignItems: "center" },
  footerText: { fontSize: 14, color: T.textSecondary },
  footerLinkText: { color: T.orange, fontWeight: "600" },

  bindBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: SPACE.sm,
    borderRadius: 10,
    backgroundColor: T.bgSecondary,
  },
  bindBtnDisabled: {
    opacity: 0.5,
    backgroundColor: T.bgSecondary,
  },
  deviceStatusBadge: {
    position: "absolute",
    top: 56,
    right: 16,
    zIndex: 10,
    backgroundColor: T.bgSecondary,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  deviceStatusText: {
    fontSize: 11,
    color: T.textSecondary,
    fontWeight: "500",
  },
});
