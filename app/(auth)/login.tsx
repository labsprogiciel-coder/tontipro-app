import { useRouter } from "expo-router";
import { useState, useCallback, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, Hash } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, verifyOtp } = useAuthStore();

  // Étape : "phone" ou "otp"
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");

  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const validatePhone = useCallback((phone: string) => {
    const localRegex = /^[0-9]{8}$/;
    const fullRegex = /^\+226[0-9]{8}$/;
    return localRegex.test(phone) || fullRegex.test(phone);
  }, []);

  const normalizePhone = (phone: string) => {
    if (/^[0-9]{8}$/.test(phone)) return `+226${phone}`;
    return phone;
  };

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(text);
    if (phoneError && validatePhone(text)) setPhoneError("");
  };

  // ── Étape 1 : envoyer l'OTP ──────────────────────────────────
  const handleSendOtp = async () => {
    setPhoneError("");

    if (!phoneNumber) {
      setPhoneError("Veuillez entrer votre numéro de téléphone");
      phoneInputRef.current?.focus();
      return;
    }
    if (!validatePhone(phoneNumber)) {
      setPhoneError("Numéro invalide. Ex: 70000000 ou +22670000000");
      phoneInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      await sendOtp(normalizePhone(phoneNumber));
      setStep("otp"); // passe à l'étape 2
    } catch (error: any) {
      setPhoneError(error.message ?? "Erreur lors de l'envoi du code");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Étape 2 : vérifier l'OTP ─────────────────────────────────
  const handleVerifyOtp = async () => {
    setOtpError("");

    if (!otp || otp.length < 6) {
      setOtpError("Veuillez entrer le code à 6 chiffres");
      otpInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtp(normalizePhone(phoneNumber), otp);
      router.replace("/dashboard");
    } catch (error: any) {
      setOtpError(error.message ?? "Code incorrect ou expiré");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtp("");
    setIsLoading(true);
    try {
      await sendOtp(normalizePhone(phoneNumber));
    } catch (error: any) {
      setOtpError(error.message ?? "Erreur lors du renvoi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>ÉpargneMobile</Text>
            <Text style={styles.tagline}>Portail Agent</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>
              {step === "phone" ? "Bienvenue" : "Code de vérification"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "phone"
                ? "Entrez votre numéro pour recevoir un code SMS"
                : `Code envoyé au ${normalizePhone(phoneNumber)}`}
            </Text>

            {/* ── Étape 1 : saisie du numéro ── */}
            {step === "phone" && (
              <>
                <Pressable
                  style={[
                    styles.inputContainer,
                    phoneError ? styles.inputContainerError : null,
                  ]}
                  onPress={() => phoneInputRef.current?.focus()}
                >
                  <Phone size={20} color={colors.textSecondary} />
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.input}
                    placeholder="70 00 00 00"
                    placeholderTextColor={colors.inactive}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </Pressable>

                {phoneError ? (
                  <Text style={styles.errorText}>{phoneError}</Text>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? "Envoi en cours..." : "Recevoir le code SMS"}
                  </Text>
                </Pressable>
              </>
            )}

            {/* ── Étape 2 : saisie du code OTP ── */}
            {step === "otp" && (
              <>
                <Pressable
                  style={[
                    styles.inputContainer,
                    otpError ? styles.inputContainerError : null,
                  ]}
                  onPress={() => otpInputRef.current?.focus()}
                >
                  <Hash size={20} color={colors.textSecondary} />
                  <TextInput
                    ref={otpInputRef}
                    style={styles.input}
                    placeholder="Code à 6 chiffres"
                    placeholderTextColor={colors.inactive}
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text);
                      if (otpError) setOtpError("");
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </Pressable>

                {otpError ? (
                  <Text style={styles.errorText}>{otpError}</Text>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? "Vérification..." : "Se connecter"}
                  </Text>
                </Pressable>

                {/* Renvoyer le code */}
                <Pressable
                  onPress={handleResendOtp}
                  style={styles.resendRow}
                  disabled={isLoading}
                >
                  <Text style={styles.resendText}>
                    Pas reçu le code ?{" "}
                    <Text style={styles.resendHighlight}>Renvoyer</Text>
                  </Text>
                </Pressable>

                {/* Changer de numéro */}
                <Pressable
                  onPress={() => {
                    setStep("phone");
                    setOtp("");
                    setOtpError("");
                  }}
                  style={styles.changeNumberRow}
                >
                  <Text style={styles.changeNumberText}>
                    ← Changer de numéro
                  </Text>
                </Pressable>
              </>
            )}

            {/* Lien inscription (visible uniquement à l'étape 1) */}
            {step === "phone" && (
              <Pressable
                onPress={() => router.push("/(auth)/register")}
                style={styles.registerLink}
              >
                <Text style={styles.registerText}>
                  Nouvel agent?{" "}
                  <Text style={styles.registerHighlight}>S&apos;inscrire</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 8,
    height: 50,
  },
  inputContainerError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    paddingVertical: 0,
    height: "100%",
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 8,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: colors.inactive,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  resendRow: {
    marginTop: 16,
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendHighlight: {
    color: colors.primary,
    fontWeight: "600",
  },
  changeNumberRow: {
    marginTop: 12,
    alignItems: "center",
  },
  changeNumberText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  registerLink: {
    marginTop: 24,
    alignItems: "center",
  },
  registerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  registerHighlight: {
    color: colors.primary,
    fontWeight: "600",
  },
});