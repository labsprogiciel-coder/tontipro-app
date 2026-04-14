import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";

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

const NUMPAD = [
  { label: "1", sub: "" },
  { label: "2", sub: "ABC" },
  { label: "3", sub: "DEF" },
  { label: "4", sub: "GHI" },
  { label: "5", sub: "JKL" },
  { label: "6", sub: "MNO" },
  { label: "7", sub: "PQRS" },
  { label: "8", sub: "TUV" },
  { label: "9", sub: "WXYZ" },
  { label: "", sub: "" },
  { label: "0", sub: "" },
  { label: "⌫", sub: "" },
];

export default function LoginScreen() {
  const router = useRouter();
  const { verifyPin, user, registeredPhone } = useAuthStore();

  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleKey = async (key: string) => {
    if (isLoading) return;

    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      if (error) setError("");
      return;
    }

    const next = pin.length < 4 ? pin + key : pin;
    setPin(next);

    if (next.length === 4) {
      setIsLoading(true);
      setError("");
      try {
        await verifyPin(next);
        router.replace("/dashboard");
      } catch (e: any) {
        setError(e.message ?? "PIN incorrect");
        setTimeout(() => {
          setPin("");
          setError("");
        }, 800);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Greeting: use persisted name or phone if available
  const greeting = user?.name ?? (registeredPhone ? `+226 ${registeredPhone.replace("+226", "")}` : null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={styles.appName}>Kauridorr</Text>
          {greeting && (
            <Text style={styles.greeting}>Bon retour, {greeting}</Text>
          )}
        </View>

        {/* PIN dots */}
        <View style={styles.pinDots}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
            />
          ))}
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Text style={styles.pinHint}>
            {isLoading ? "Vérification..." : "Entrez votre code PIN"}
          </Text>
        )}

        {/* Numpad */}
        <View style={styles.numpad}>
          {NUMPAD.map(({ label, sub }, i) => {
            if (!label) return <View key={i} style={styles.numBtnEmpty} />;
            return (
              <Pressable
                key={i}
                onPress={() => handleKey(label)}
                style={({ pressed }) => [
                  styles.numBtn,
                  pressed && styles.numBtnPressed,
                ]}
              >
                <Text style={label === "⌫" ? styles.numDelete : styles.numBig}>
                  {label}
                </Text>
                {sub ? <Text style={styles.numSub}>{sub}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Fallback: new account */}
        <Pressable onPress={() => router.push("/(auth)/reg")} style={styles.newAccountLink}>
          <Text style={styles.newAccountText}>Nouveau sur cet appareil ? S'inscrire</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgPrimary },
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 22, paddingTop: 60 },

  // Header
  header: { alignItems: "center", marginBottom: 40, gap: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  logoText: { fontSize: 28, fontWeight: "700", color: "white" },
  appName: { fontSize: 20, fontWeight: "600", color: T.textPrimary, letterSpacing: -0.3 },
  greeting: { fontSize: 13, color: T.textTertiary },

  // PIN dots
  pinDots: { flexDirection: "row", gap: 14, marginBottom: 12 },
  pinDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: T.borderStrong,
    backgroundColor: "transparent",
  },
  pinDotFilled: { backgroundColor: T.orange, borderColor: T.orange },
  pinHint: { fontSize: 12, color: T.textTertiary, marginBottom: 32, textAlign: "center" },
  errorText: { fontSize: 12, color: T.orangeDark, marginBottom: 32, textAlign: "center" },

  // Numpad
  numpad: { flexDirection: "row", flexWrap: "wrap", width: 240, gap: 10 },
  numBtn: {
    width: 70, height: 58, borderRadius: 14,
    backgroundColor: T.bgSecondary, borderWidth: 0.5, borderColor: T.border,
    justifyContent: "center", alignItems: "center", gap: 1,
  },
  numBtnEmpty: { width: 70, height: 58 },
  numBtnPressed: { backgroundColor: T.orangeLight, borderColor: T.orange },
  numBig: { fontSize: 20, fontWeight: "500", color: T.textPrimary },
  numSub: { fontSize: 8, color: T.textTertiary, letterSpacing: 0.8 },
  numDelete: { fontSize: 18, color: T.textSecondary },

  // New account
  newAccountLink: { marginTop: 36 },
  newAccountText: { fontSize: 12, color: T.textTertiary },
});
