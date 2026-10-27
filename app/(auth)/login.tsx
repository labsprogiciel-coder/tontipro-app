// app/(auth)/login.tsx
//
// Staff sign-in on the admin backend (TontiPro-Admin, convex/auth.ts):
// - "signIn": phone + password, through the "phone" provider;
// - "activate" ("Première connexion"): phone + the one-time code an IT admin
//   issued + a new password (provider flow "signUp");
// - "reset" ("Mot de passe oublié"): phone + an IT-issued reset code + a new
//   password (passwordReset:resetPassword), then sign-in.
// Once signed in on this device, the agent picks a 4-digit PIN
// (set-pin.tsx). Each later launch only asks for that PIN, checked on the
// device (utils/secure-storage.ts), which also works offline. The PIN never
// signs anyone in to the server.
// On a shared TPE, agents who handed the phone over ("Changer d'agent") are
// listed here: picking one and typing their PIN brings back their session
// (lib/agent-switch.ts). The password is only needed for a new agent on the
// phone, after "Déconnexion", or once a saved session has expired.
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Eye, EyeOff, KeyRound, Lock, Phone, Users } from "lucide-react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth } from "convex/react";
import * as adminApi from "@/lib/admin-api";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { hasOfflineCredential, verifyOfflineCredential } from "@/utils/secure-storage";
import { PinEntry } from "@/app/components/ui/pin-entry";
import { forgetAgent, listSavedAgents, type SavedAgent } from "@/lib/agent-sessions";
import {
  forgetCurrentAgent,
  handOverDevice,
  switchToAgent,
  type SwitchResult,
} from "@/lib/agent-switch";
import { MizoMark, MizoWordmark } from "@/app/components/ui/MizoLogo";

import { SPACE } from "@/constants/spacing";
import { LiveText } from "@/app/components/ui/live-text";
const T = {
  orange: "#D85A30",
  orangeStrong: "#BB4721", // fills behind white text (5.2:1)
  orangeDark: "#993C1D",
  orangeLight: "#FAE8E0",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f4f0",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#6c6b65",
  border: "rgba(0,0,0,0.1)",
  borderStrong: "rgba(0,0,0,0.2)",
};

const MIN_PASSWORD_LENGTH = 8;

type Mode = "signIn" | "activate" | "reset";

const MODES: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signIn: {
    title: "Connexion Agent",
    subtitle: "Accédez à votre espace de travail mobile.",
    submit: "Se connecter",
  },
  activate: {
    title: "Première connexion",
    subtitle: "Entrez le code reçu de votre administrateur et choisissez votre mot de passe.",
    submit: "Activer mon compte",
  },
  reset: {
    title: "Mot de passe oublié",
    subtitle: "Entrez le code de réinitialisation reçu de votre administrateur.",
    submit: "Changer mon mot de passe",
  },
};

// The server answers every refusal the same way (it doesn't say whether the
// phone is known), so each mode has one message.
const REFUSED: Record<Mode, string> = {
  signIn: "Numéro ou mot de passe incorrect.",
  activate: "Activation impossible : vérifiez le numéro et le code d'activation.",
  reset: "Réinitialisation impossible : vérifiez le numéro et le code.",
};

/** Shows staff sign-in, activation, or password reset, or local PIN unlock for a saved session. */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signOut } = useAuthActions();
  const resetPassword = useAction(adminApi.resetPassword);
  const { isAuthenticated: convexAuthed } = useConvexAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authComplete, setAuthComplete] = useState(false);
  // From submit until the profile is in: the store's user may appear
  // before signIn() resolves, which must not show the PIN screen.
  const [signingIn, setSigningIn] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");

  const isUnlocked = useAppLockStore((s) => s.isUnlocked);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  // Agents who can come back on this TPE with their PIN
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>([]);
  const [picked, setPicked] = useState<SavedAgent | null>(null);
  const [usePassword, setUsePassword] = useState(false);

  // The server ended a session: password form, with the agent's number
  const expiredPhone = useAuthStore((s) => s.expiredPhone);
  useEffect(() => {
    if (!expiredPhone) return;
    setPhoneNumber(expiredPhone);
    setUsePassword(true);
    setPicked(null);
    setError("Votre session a expiré : reconnectez-vous avec votre mot de passe.");
    useAuthStore.setState({ expiredPhone: null });
  }, [expiredPhone]);
  const reloadAgents = useCallback(() => {
    listSavedAgents().then(setSavedAgents);
  }, []);
  useEffect(reloadAgents, [reloadAgents, user]);

  // Session already on this device (earlier launch) but not unlocked since
  // this cold start: ask for the local PIN only.
  const isUnlockMode = !signingIn && !authComplete && user !== null && !isUnlocked;

  /** Where an unlocked agent goes: the binding screen until IT binds a TPE. */
  const enterApp = () => {
    useAppLockStore.getState().unlock();
    if (user?.device === null) {
      router.replace("/(auth)/bind-device" as any);
    } else {
      router.replace({
        pathname: "/(auth)/welcome",
        params: { orgName: user?.organization?.name ?? "Mizo" },
      } as any);
    }
  };

  // After a server sign-in: wait for the profile (users:me, synced by the
  // root layout), then choose the local PIN on this device if there's none.
  useEffect(() => {
    if (!authComplete || !convexAuthed || !user) return;
    if (user.status === "suspended") {
      setError("Votre compte a été suspendu. Veuillez contacter votre gérant.");
      setAuthComplete(false);
      setIsLoading(false);
      setSigningIn(false);
      return;
    }
    if (!user.branchId || !user.phone) {
      setError("Ce compte n'est associé à aucune agence. Contactez votre administrateur.");
      setAuthComplete(false);
      setIsLoading(false);
      setSigningIn(false);
      return;
    }
    (async () => {
      // Signed in with the password: a saved session for this agent is stale
      await forgetAgent(user.id).catch(() => {});
      if (await hasOfflineCredential(user.phone!)) {
        enterApp();
      } else {
        router.replace("/(auth)/set-pin" as any);
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authComplete, convexAuthed, user]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setCode("");
    setPassword("");
    setConfirm("");
    setError("");
  };

  /** Problem with the form, or "" when it can be sent. */
  const formProblem = (): string => {
    // Spaces, dots and dashes are formatting only; the server normalises the rest
    if (!/^\+?\d{8,15}$/.test(phoneNumber.replace(/[\s.\-()]/g, ""))) {
      return "Entrez un numéro de téléphone valide.";
    }
    if (mode !== "signIn" && !code.trim()) return "Entrez le code reçu de votre administrateur.";
    if (!password) return "Entrez votre mot de passe.";
    if (mode !== "signIn") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
      }
      if (password !== confirm) return "Les deux mots de passe ne correspondent pas.";
    }
    return "";
  };

  const handleSubmit = async () => {
    const problem = formProblem();
    if (problem) {
      setError(problem);
      return;
    }
    Keyboard.dismiss();
    setIsLoading(true);
    setSigningIn(true);
    setError("");
    const phone = phoneNumber.trim();
    try {
      // A previous agent's session on a shared TPE must not survive this one
      if (user) logout();
      if (mode === "activate") {
        await signIn("phone", { phone, password, flow: "signUp", code: code.trim() });
      } else {
        if (mode === "reset") {
          await resetPassword({ phone, code: code.trim(), newPassword: password });
        }
        await signIn("phone", { phone, password, flow: "signIn" });
      }
      setAuthComplete(true); // the effect above takes over once the profile is in
    } catch (e: any) {
      console.error("Auth error:", e);
      setError(e?.data === "WEAK_PASSWORD" ? formProblem() || REFUSED[mode] : REFUSED[mode]);
      setPassword("");
      setConfirm("");
      setIsLoading(false);
      setSigningIn(false);
    }
  };

  /** Local unlock: no server call, so it works offline. */
  const handleUnlock = async (pin: string) => {
    if (!user?.phone) {
      setUnlockCode("");
      setError("Session incomplète. Déconnectez-vous puis reconnectez-vous.");
      return;
    }
    setIsLoading(true);
    setError("");
    const check = await verifyOfflineCredential(user.phone, pin);
    setIsLoading(false);
    if (!check.valid) {
      setError(check.message ?? "Code incorrect.");
      setUnlockCode("");
      return;
    }
    enterApp();
  };

  /** Forgotten PIN: full sign-out (PIN and saved session go), then sign in again. */
  const handleSignOut = async () => {
    await forgetCurrentAgent();
    setUnlockCode("");
    setError("");
    try {
      await signOut();
    } catch (e) {
      console.warn("signOut failed:", e);
    }
  };

  /** "Ce n'est pas vous ?": keep this agent on the phone, show the picker. */
  const handleHandOver = async () => {
    setUnlockCode("");
    setError("");
    await handOverDevice();
    reloadAgents();
  };

  /** PIN of the agent picked in the list: bring their session back. */
  const handlePickedPin = async (pin: string) => {
    if (!picked) return;
    setIsLoading(true);
    setError("");
    let result: SwitchResult;
    try {
      result = await switchToAgent(picked, pin);
    } catch (e) {
      console.error("[login] switchToAgent failed:", e);
      result = { ok: false, message: "Impossible de restaurer la session. Réessayez." };
    } finally {
      setIsLoading(false);
      setUnlockCode("");
    }
    if (result.ok) {
      const u = useAuthStore.getState().user;
      router.replace(
        (u?.device === null
          ? "/(auth)/bind-device"
          : { pathname: "/(auth)/welcome", params: { orgName: u?.organization?.name ?? "Mizo" } }) as any,
      );
      return;
    }
    setError(result.message);
    if (result.needsPassword) {
      setPhoneNumber(picked.phone);
      setPicked(null);
      setUsePassword(true);
      reloadAgents();
    }
  };

  const showPicker =
    !signingIn && !authComplete && user === null && savedAgents.length > 0 && !usePassword;

  if (showPicker && picked) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.screen, styles.pinScreen]}>
          <View style={[styles.header, styles.pinHeader]}>
            <View style={styles.logo}>
              <MizoMark size={64} />
            </View>
            <MizoWordmark height={22} />
            <Text accessibilityRole="header" style={styles.title}>{picked.name}</Text>
            <Text style={styles.subtitle}>Entrez votre code PIN à 4 chiffres pour continuer.</Text>
          </View>

          <PinEntry
            length={4}
            value={unlockCode}
            onChange={(v) => {
              setUnlockCode(v);
              if (error) setError("");
            }}
            onComplete={handlePickedPin}
            disabled={isLoading}
            error={error}
            accessibilityLabel="Code PIN"
          />

          <View style={styles.pinStatus}>
            {isLoading ? (
              <ActivityIndicator color={T.orange} />
            ) : error ? (
              <LiveText style={styles.errorText}>{error}</LiveText>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setPicked(null);
              setUnlockCode("");
              setError("");
            }}
            style={styles.pinFooterLink}
          >
            <Text style={styles.footerLinkText}>Choisir un autre agent</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showPicker) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.header}>
            <View style={styles.logo}>
              <MizoMark size={64} />
            </View>
            <MizoWordmark height={22} />
            <Text accessibilityRole="header" style={styles.title}>Qui utilise ce TPE ?</Text>
            <Text style={styles.subtitle}>Choisissez votre nom, puis entrez votre code PIN.</Text>
          </View>

          <View style={styles.agentList}>
            {savedAgents.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  setPicked(a);
                  setError("");
                }}
                style={({ pressed }) => [styles.agentRow, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Se connecter en tant que ${a.name}`}
              >
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentAvatarText}>
                    {a.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0] ?? "")
                      .join("")
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agentName}>{a.name}</Text>
                  <Text style={styles.agentPhone}>{a.phone}</Text>
                </View>
                <ChevronRight size={18} color={T.textTertiary} />
              </Pressable>
            ))}
          </View>

          {error ? <LiveText style={[styles.errorText, { marginTop: SPACE.md }]}>{error}</LiveText> : null}

          <View style={styles.modeLinks}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setUsePassword(true);
                setError("");
              }}
              hitSlop={8}
            >
              <Text style={styles.footerText}>
                Pas dans la liste ? <Text style={styles.footerLinkText}>Se connecter</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isUnlockMode) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.screen, styles.pinScreen]}>
          <View style={[styles.header, styles.pinHeader]}>
            <View style={styles.logo}>
              <MizoMark size={64} />
            </View>
            <MizoWordmark height={22} />
            <Text accessibilityRole="header" style={styles.title}>{user?.name ?? "Bienvenue"}</Text>
            <Text style={styles.subtitle}>
              Entrez votre code PIN à 4 chiffres pour continuer.
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
            accessibilityLabel="Code PIN"
          />

          <View style={styles.pinStatus}>
            {isLoading ? (
              <ActivityIndicator color={T.orange} />
            ) : error ? (
              <LiveText style={styles.errorText}>{error}</LiveText>
            ) : null}
          </View>

          <Pressable accessibilityRole="button" onPress={handleHandOver} style={styles.pinFooterLink}>
            <Text style={styles.footerText}>
              Ce n&apos;est pas vous ? <Text style={styles.footerLinkText}>Changer d&apos;agent</Text>
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.pinFooterLink}>
            <Text style={styles.footerText}>
              Code oublié ? <Text style={styles.footerLinkText}>Se reconnecter</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const copy = MODES[mode];
  const secureProps = {
    secureTextEntry: !showPassword,
    autoCapitalize: "none" as const,
    autoCorrect: false,
    placeholderTextColor: T.textTertiary,
    style: styles.input,
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logo}>
              <MizoMark size={64} />
            </View>
            <MizoWordmark height={22} />
            <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color={T.textTertiary} style={styles.inputIcon} />
                <TextInput
                  accessibilityLabel="Numéro de téléphone"
                  style={styles.input}
                  placeholder="70 00 00 00"
                  placeholderTextColor={T.textTertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
            </View>

            {mode !== "signIn" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {mode === "activate" ? "Code d'activation" : "Code de réinitialisation"}
                </Text>
                <View style={styles.inputWrapper}>
                  <KeyRound size={18} color={T.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    accessibilityLabel={mode === "activate" ? "Code d'activation" : "Code de réinitialisation"}
                    style={styles.input}
                    placeholder="ABCD2345"
                    placeholderTextColor={T.textTertiary}
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={8}
                  />
                </View>
                <Text style={styles.hint}>8 caractères, valable 48 h, donné par votre administrateur.</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {mode === "signIn" ? "Mot de passe" : "Nouveau mot de passe"}
              </Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={T.textTertiary} style={styles.inputIcon} />
                <TextInput
                  accessibilityLabel={mode === "signIn" ? "Mot de passe" : "Nouveau mot de passe"}
                  {...secureProps}
                  placeholder={mode === "signIn" ? "Votre mot de passe" : `${MIN_PASSWORD_LENGTH} caractères minimum`}
                  value={password}
                  onChangeText={setPassword}
                  autoComplete={mode === "signIn" ? "password" : "new-password"}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} color={T.textSecondary} />
                  ) : (
                    <Eye size={18} color={T.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>

            {mode !== "signIn" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={T.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    accessibilityLabel="Confirmer le mot de passe"
                    {...secureProps}
                    placeholder="Retapez le mot de passe"
                    value={confirm}
                    onChangeText={setConfirm}
                    autoComplete="new-password"
                  />
                </View>
              </View>
            )}

            {error ? <LiveText style={styles.errorText}>{error}</LiveText> : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                isLoading && styles.btnDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitBtnText}>{copy.submit}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.modeLinks}>
            {savedAgents.length > 0 && user === null && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setUsePassword(false);
                  setError("");
                }}
                hitSlop={8}
                style={styles.savedLink}
              >
                <Users size={16} color={T.orange} />
                <Text style={styles.footerLinkText}>Agents enregistrés sur ce TPE</Text>
              </Pressable>
            )}
            {mode !== "signIn" ? (
              <Pressable accessibilityRole="button" onPress={() => switchMode("signIn")} hitSlop={8}>
                <Text style={styles.footerLinkText}>J&apos;ai déjà un mot de passe</Text>
              </Pressable>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={() => switchMode("activate")} hitSlop={8}>
                  <Text style={styles.footerText}>
                    Nouveau ? <Text style={styles.footerLinkText}>Première connexion</Text>
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => switchMode("reset")} hitSlop={8}>
                  <Text style={styles.footerLinkText}>Mot de passe oublié</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  screen: { flexGrow: 1, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xxxl },

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
  logo: { marginBottom: SPACE.md },
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
    backgroundColor: T.orangeStrong,
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
  footerLinkText: { color: T.orangeDark, fontWeight: "600" },

  hint: { fontSize: 12, color: T.textTertiary, marginLeft: SPACE.xs },
  modeLinks: { marginTop: SPACE.xxl, alignItems: "center", gap: SPACE.md },
  savedLink: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },

  agentList: { gap: SPACE.sm },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: T.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: SPACE.md,
    minHeight: 64,
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  agentAvatarText: { color: T.orangeDark, fontWeight: "700", fontSize: 14 },
  agentName: { fontSize: 15, fontWeight: "600", color: T.textPrimary },
  agentPhone: { fontSize: 12, color: T.textSecondary, marginTop: 2 },
});
