import { useRouter } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ShieldCheck, Star, User } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { Numpad } from "@/app/components/ui/numpad";

// ── Design tokens (from HTML :root) ────────────────────────────
const T = {
  orange: "#D85A30",
  orangeDark: "#993C1D",
  orangeLight: "#FAE8E0",
  bgPrimary: "#ffffff",
  bgSecondary: "#f5f4f0",
  bgTertiary: "#eeede8",
  bgSuccess: "#eaf3de",
  textPrimary: "#1a1a18",
  textSecondary: "#5f5e5a",
  textTertiary: "#888780",
  textSuccess: "#3b6d11",
  border: "rgba(0,0,0,0.1)",
  borderStrong: "rgba(0,0,0,0.2)",
};

type Step = 1 | 2 | 3 | 4 | 5;
type Role = "agent" | "admin";

// ── Step dot indicator ──────────────────────────────────────────
function StepDots({ current, total = 5 }: { current: number; total?: number }) {
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i + 1 < current;
        const isActive = i + 1 === current;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isDone && styles.dotDone,
              isActive && styles.dotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

// ── Back row ────────────────────────────────────────────────────
function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backRow}>
      <ChevronLeft size={16} color={T.textTertiary} />
      <Text style={styles.backText}>Retour</Text>
    </Pressable>
  );
}

// ── Primary button ──────────────────────────────────────────────
function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btnPrimary,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text style={styles.btnPrimaryText}>{label}</Text>
    </Pressable>
  );
}

// ── SCREEN 1: Welcome ───────────────────────────────────────────
function WelcomeScreen({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <View style={styles.screenWelcome}>
      {/* Decorative circles */}
      <View style={styles.welcomeCircle1} pointerEvents="none" />
      <View style={styles.welcomeCircle2} pointerEvents="none" />

      <View style={styles.welcomeLogo}>
        <View style={styles.logoCircle}>
          <ShieldCheck size={36} color="white" />
        </View>
        <Text style={styles.welcomeTitle}>Kauridorr</Text>
        <Text style={styles.welcomeSubtitle}>
          Gestion d'épargne moderne,{"\n"}sécurisée et accessible.
        </Text>
      </View>

      <View style={styles.welcomeBottom}>
        <Pressable
          onPress={onRegister}
          style={({ pressed }) => [styles.btnWhite, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnWhiteText}>Créer mon compte (hors ligne)</Text>
        </Pressable>
        <Pressable
          onPress={onLogin}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.btnGhostPressed]}
        >
          <Text style={styles.btnGhostText}>J'ai déjà un compte</Text>
        </Pressable>
        <Text style={styles.welcomeFootnote}>
          Mode hors ligne · Pour le mode en ligne, utilisez le lien d'invitation de votre gérant
        </Text>
      </View>
    </View>
  );
}

// ── SCREEN 2: Phone number ──────────────────────────────────────
function PhoneScreen({
  phone,
  setPhone,
  onNext,
  onBack,
  error,
  isLoading,
}: {
  phone: string;
  setPhone: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  error: string;
  isLoading: boolean;
}) {
  return (
    <View style={styles.screenInner}>
      <BackRow onPress={onBack} />
      <StepDots current={1} />

      <Text style={styles.screenTitle}>Votre numéro{"\n"}de téléphone</Text>
      <Text style={styles.screenSub}>
        Entrez votre numéro pour recevoir un code de vérification par SMS.
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
        <View style={styles.phoneInputRow}>
          <View style={styles.countrySelect}>
            <Text style={styles.countryFlag}>🇧🇫</Text>
            <Text style={styles.countryCode}>+226</Text>
          </View>
          <TextInput
            style={[styles.textInput, phone.length > 0 && styles.textInputFilled]}
            placeholder="70 11 22 33"
            placeholderTextColor={T.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={8}
          />
        </View>
        <Text style={styles.inputNote}>Un SMS de vérification vous sera envoyé</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>


      <View style={styles.spacer} />
      <PrimaryButton
        label={isLoading ? "Envoi en cours..." : "Envoyer le code SMS →"}
        onPress={onNext}
        disabled={isLoading}
      />
    </View>
  );
}

// ── SCREEN 3: Profile ───────────────────────────────────────────
function ProfileScreen({
  name,
  setName,
  role,
  setRole,
  onNext,
  onBack,
  initials,
}: {
  name: string;
  setName: (v: string) => void;
  role: Role;
  setRole: (v: Role) => void;
  onNext: () => void;
  onBack: () => void;
  initials: string;
}) {
  return (
    <ScrollView style={styles.screenInner} contentContainerStyle={styles.screenInnerContent} showsVerticalScrollIndicator={false}>
      <BackRow onPress={onBack} />
      <StepDots current={3} />

      <Text style={styles.screenTitle}>Votre profil</Text>
      <Text style={styles.screenSub}>
        Complétez vos informations pour finaliser la configuration.
      </Text>

      {/* Avatar */}
      <View style={styles.avatarPicker}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials || "KD"}</Text>
          <View style={styles.avatarEdit}>
            <Text style={{ color: "white", fontSize: 9 }}>✎</Text>
          </View>
        </View>
        <Text style={styles.avatarHint}>Appuyez pour ajouter une photo</Text>
      </View>

      {/* Full name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Nom complet</Text>
        <TextInput
          style={[styles.textInput, styles.textInputFull, name.length > 0 && styles.textInputFilled]}
          placeholder="Konaté Djibril"
          placeholderTextColor={T.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      {/* Role selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Rôle dans l'organisation</Text>
        <View style={styles.roleSelector}>
          <Pressable
            onPress={() => setRole("agent")}
            style={[styles.roleCard, role === "agent" && styles.roleCardSelected]}
          >
            <View style={[styles.roleIcon, role === "agent" && styles.roleIconSelected]}>
              <User size={15} color={role === "agent" ? T.orange : T.textSecondary} />
            </View>
            <Text style={styles.roleName}>Agent</Text>
            <Text style={styles.roleDesc}>Collecte et gestion de clients sur le terrain</Text>
          </Pressable>

          <Pressable
            onPress={() => setRole("admin")}
            style={[styles.roleCard, role === "admin" && styles.roleCardSelected]}
          >
            <View style={[styles.roleIcon, role === "admin" && styles.roleIconSelected]}>
              <Star size={15} color={role === "admin" ? T.orange : T.textSecondary} />
            </View>
            <Text style={styles.roleName}>Administrateur</Text>
            <Text style={styles.roleDesc}>Accès complet et gestion des permissions</Text>
          </Pressable>
        </View>
      </View>

      <PrimaryButton label="Continuer →" onPress={onNext} disabled={!name.trim()} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── SCREEN 5: PIN ───────────────────────────────────────────────
function PinScreen({
  pin,
  setPin,
  onNext,
  onBack,
  isConfirming,
  error,
}: {
  pin: string;
  setPin: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  isConfirming: boolean;
  error: string;
}) {
  return (
    <View style={[styles.screenInner, styles.screenPinInner]}>
      <View style={styles.pinTopRow}>
        <BackRow onPress={onBack} />
        <StepDots current={isConfirming ? 5 : 4} />
      </View>

      <View style={styles.pinHeader}>
        <Text style={styles.screenTitle}>
          {isConfirming ? "Confirmez votre\ncode PIN" : "Créez votre\ncode PIN"}
        </Text>
        <Text style={styles.screenSub}>
          {isConfirming
            ? "Saisissez à nouveau le PIN pour confirmer."
            : "Ce PIN sécurise l'accès à votre compte.\nNe le partagez avec personne."}
        </Text>
      </View>

      <View style={styles.pinDots}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
        ))}
      </View>
      <Text style={styles.pinHint}>Entrez 4 chiffres</Text>
      {error ? <Text style={[styles.errorText, { textAlign: "center" }]}>{error}</Text> : null}

      <Numpad
        onPress={(digit) => { if (pin.length < 4) setPin(pin + digit); }}
        onDelete={() => setPin(pin.slice(0, -1))}
        accentColor={T.orange}
      />
    </View>
  );
}

// ── SCREEN 6: Success ───────────────────────────────────────────
function SuccessScreen({
  name,
  phone,
  role,
  onGoToDashboard,
}: {
  name: string;
  phone: string;
  role: Role;
  onGoToDashboard: () => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [scale]);

  return (
    <View style={styles.screenSuccess}>
      <View style={styles.successIconWrap}>
        <Animated.View style={[styles.successRing, { transform: [{ scale }] }]}>
          <Text style={styles.successCheck}>✓</Text>
        </Animated.View>
        <View>
          <Text style={styles.successTitle}>Compte configuré !</Text>
          <Text style={styles.successSub}>
            Bienvenue sur Kauridorr,{"\n"}
            {name}. Votre compte{"\n"}est prêt à être utilisé.
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        {[
          { label: "Téléphone", value: `+226 ${phone}` },
          { label: "Rôle", value: role === "admin" ? "Administrateur" : "Agent" },
          { label: "Code PIN", value: "●●●●" },
          { label: "Mode", value: "Hors ligne activé" },
        ].map(({ label, value }) => (
          <View key={label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Accéder au tableau de bord →" onPress={onGoToDashboard} />
    </View>
  );
}

// ── Root component ──────────────────────────────────────────────
// Steps: 1=Welcome  2=Phone  3=Profile  4=PIN  5=Success
export default function OnboardingScreen() {
  const router = useRouter();
  const { registerOffline } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [isPinConfirming, setIsPinConfirming] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [pinError, setPinError] = useState("");

  const normalizePhone = (p: string) =>
    /^[0-9]{8}$/.test(p) ? `+226${p}` : p;

  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const handlePhoneNext = () => {
    if (!phone || !/^[0-9]{8}$/.test(phone)) {
      setPhoneError("Numéro invalide. Ex: 70112233");
      return;
    }
    setPhoneError("");
    setStep(3);
  };

  // Step 4: PIN entry → confirm → register
  const handlePinKey = async (value: string) => {
    if (isPinConfirming) {
      setPinConfirm(value);
      if (value.length === 4) {
        if (value !== pin) {
          setPinError("Les PIN ne correspondent pas. Réessayez.");
          setTimeout(() => {
            setPinConfirm("");
            setPin("");
            setIsPinConfirming(false);
            setPinError("");
          }, 1200);
        } else {
          await registerOffline(normalizePhone(phone), name, "agent", value);
          setStep(5);
        }
      }
    } else {
      setPin(value);
      if (value.length === 4) setIsPinConfirming(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {step === 1 && (
          <WelcomeScreen
            onRegister={() => setStep(2)}
            onLogin={() => router.replace("/(auth)/login")}
          />
        )}

        {step === 2 && (
          <PhoneScreen
            phone={phone}
            setPhone={setPhone}
            onNext={handlePhoneNext}
            onBack={() => setStep(1)}
            error={phoneError}
            isLoading={false}
          />
        )}

        {step === 3 && (
          <ProfileScreen
            name={name}
            setName={setName}
            role={role}
            setRole={setRole}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
            initials={initials}
          />
        )}

        {step === 4 && (
          <PinScreen
            pin={isPinConfirming ? pinConfirm : pin}
            setPin={handlePinKey}
            onNext={() => {}}
            onBack={() => {
              if (isPinConfirming) {
                setIsPinConfirming(false);
                setPinConfirm("");
              } else {
                setPin("");
                setStep(3);
              }
            }}
            isConfirming={isPinConfirming}
            error={pinError}
          />
        )}

        {step === 5 && (
          <SuccessScreen
            name={name}
            phone={phone}
            role={role}
            onGoToDashboard={() => router.push("/(auth)/bind-device")}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },

  // Step dots
  stepDots: { flexDirection: "row", gap: 6, marginBottom: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.border },
  dotDone: { backgroundColor: T.orange, opacity: 0.35 },
  dotActive: { width: 18, backgroundColor: T.orange, opacity: 1 },

  // Back row
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 20 },
  backText: { fontSize: 13, color: T.textTertiary },

  // ── Welcome ──
  screenWelcome: {
    flex: 1,
    backgroundColor: T.orange,
    padding: 28,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  welcomeCircle1: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  welcomeCircle2: {
    position: "absolute",
    bottom: 80,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  welcomeLogo: { alignItems: "center", gap: 10, marginTop: 20, zIndex: 1 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "white",
    letterSpacing: -0.5,
    marginTop: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 20,
  },
  welcomeBottom: { zIndex: 1, width: "100%" },
  btnWhite: {
    backgroundColor: "white",
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  btnWhiteText: { fontSize: 14, fontWeight: "500", color: T.orange },
  btnGhost: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 13,
    padding: 12,
    alignItems: "center",
    marginBottom: 0,
  },
  btnGhostText: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  btnGhostPressed: { backgroundColor: "rgba(255,255,255,0.08)" },
  welcomeFootnote: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 12,
  },

  // ── Inner screens ──
  screenInner: { flex: 1, backgroundColor: T.bgPrimary, padding: 22, paddingTop: 16 },
  screenInnerContent: { paddingBottom: 32 },
  screenTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: T.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 6,
  },
  screenSub: {
    fontSize: 13,
    color: T.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },

  // ── Phone screen ──
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: T.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  phoneInputRow: { flexDirection: "row", gap: 8 },
  countrySelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  countryFlag: { fontSize: 16 },
  countryCode: { fontSize: 13, fontWeight: "500", color: T.textPrimary },
  textInput: {
    flex: 1,
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "500",
    color: T.textPrimary,
    height: 46,
  },
  textInputFull: { flex: undefined, width: "100%" },
  textInputFilled: { borderColor: T.orange, backgroundColor: T.orangeLight },
  inputNote: { fontSize: 11, color: T.textTertiary, marginTop: 6 },
  errorText: { fontSize: 12, color: T.orangeDark, marginTop: 6 },
  dividerOr: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: T.border },
  dividerText: { fontSize: 11, color: T.textTertiary },
  emailAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  emailAltText: { fontSize: 13, color: T.textSecondary, flex: 1 },
  badgeOpt: {
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeOptText: { fontSize: 10, color: T.textTertiary },
  spacer: { flex: 1 },

  // ── Primary button ──
  btnPrimary: {
    backgroundColor: T.orange,
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "500", color: "white" },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.85 },

  // ── OTP screen ──
  otpIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: T.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  otpBoxes: { flexDirection: "row", gap: 8, marginVertical: 24 },
  otpBox: {
    flex: 1,
    height: 52,
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxActive: { borderWidth: 1.5, borderColor: T.orange, backgroundColor: T.orangeLight },
  otpBoxFilled: { borderColor: T.orange },
  otpBoxText: { fontSize: 22, fontWeight: "600", color: T.textPrimary },
  otpMeta: { fontSize: 12, color: T.textTertiary, textAlign: "center", marginBottom: 8 },
  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  resendText: { fontSize: 12, color: T.textTertiary },
  resendLink: { fontSize: 12, color: T.orange },

  // ── Profile screen ──
  avatarPicker: { alignItems: "center", marginVertical: 16 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 24, fontWeight: "600", color: T.orange },
  avatarEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.orange,
    borderWidth: 2,
    borderColor: T.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarHint: { fontSize: 11, color: T.textTertiary },
  roleSelector: { flexDirection: "row", gap: 8 },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: 12,
    padding: 13,
    gap: 6,
  },
  roleCardSelected: { borderColor: T.orange, backgroundColor: T.orangeLight },
  roleIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: T.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  roleIconSelected: { backgroundColor: T.orangeLight },
  roleName: { fontSize: 13, fontWeight: "500", color: T.textPrimary },
  roleDesc: { fontSize: 10, color: T.textSecondary, lineHeight: 14 },

  // ── PIN screen ──
  screenPinInner: { alignItems: "center" },
  pinTopRow: { width: "100%" },
  pinHeader: { alignItems: "center", marginBottom: 0 },
  pinDots: { flexDirection: "row", gap: 14, marginVertical: 24 },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    backgroundColor: "transparent",
  },
  pinDotFilled: { backgroundColor: T.orange, borderColor: T.orange },
  pinHint: { fontSize: 11, color: T.textTertiary, marginBottom: 28, textAlign: "center" },
  // ── Success screen ──
  screenSuccess: {
    flex: 1,
    backgroundColor: T.bgPrimary,
    padding: 24,
    paddingTop: 60,
    justifyContent: "space-between",
    alignItems: "center",
  },
  successIconWrap: { alignItems: "center", gap: 20 },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.bgSuccess,
    justifyContent: "center",
    alignItems: "center",
  },
  successCheck: { fontSize: 32, color: T.textSuccess, fontWeight: "700" },
  successTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: T.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    color: T.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  summaryCard: {
    width: "100%",
    backgroundColor: T.bgSecondary,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  summaryLabel: { fontSize: 12, color: T.textSecondary },
  summaryValue: { fontSize: 12, fontWeight: "500", color: T.textPrimary },
});
