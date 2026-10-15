// app/(auth)/set-pin.tsx
//
// Choose (or change, from Settings) the 4-digit PIN that unlocks the app on
// this device. Stored only as a hash in SecureStore (utils/secure-storage.ts);
// it never signs anyone in to the server, so it works offline and a lost PIN
// only costs a new sign-in with phone + password.
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { saveOfflineCredential } from "@/utils/secure-storage";
import { PinEntry } from "@/app/components/ui/pin-entry";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { SPACE } from "@/constants/spacing";

export default function SetPinScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isUnlocked = useAppLockStore((s) => s.isUnlocked);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const done = () => {
    // Opened from Settings: just go back. After sign-in: enter the app.
    if (isUnlocked) {
      router.back();
      return;
    }
    useAppLockStore.getState().unlock();
    if (user?.device === null) {
      router.replace("/(auth)/bind-device" as any);
    } else {
      router.replace({
        pathname: "/(auth)/welcome",
        params: { orgName: user?.organization?.name ?? "Kauri" },
      } as any);
    }
  };

  const handleComplete = async (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setValue("");
      return;
    }
    if (pin !== first) {
      setError("Les deux codes ne correspondent pas. Recommencez.");
      setFirst(null);
      setValue("");
      return;
    }
    if (!user?.phone) {
      setError("Session incomplète. Reconnectez-vous.");
      return;
    }
    setSaving(true);
    try {
      await saveOfflineCredential(user.phone, pin);
      done();
    } catch (e) {
      console.error("saveOfflineCredential failed:", e);
      setError("Impossible d'enregistrer le code. Réessayez.");
      setFirst(null);
      setValue("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.screen}>
        {isUnlocked && (
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.back}>
            <ArrowLeft size={18} color={T.text2} />
            <Text style={s.backText}>Retour</Text>
          </Pressable>
        )}
        <View style={s.header}>
          <View style={s.logo}>
            <ShieldCheck size={32} color="white" />
          </View>
          <Text style={s.title}>
            {first === null ? "Choisissez votre code PIN" : "Confirmez votre code PIN"}
          </Text>
          <Text style={s.subtitle}>
            {first === null
              ? "4 chiffres pour déverrouiller l'application sur ce TPE, même sans réseau."
              : "Tapez le même code une deuxième fois."}
          </Text>
        </View>

        <PinEntry
          length={4}
          value={value}
          onChange={(v) => {
            setValue(v);
            if (error) setError("");
          }}
          onComplete={handleComplete}
          disabled={saving}
          error={error}
          accessibilityLabel="Code PIN"
        />

        <View style={s.status}>
          {saving ? (
            <ActivityIndicator color={T.orange} />
          ) : error ? (
            <Text style={s.error}>{error}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  screen: { flex: 1, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl },
  back: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginBottom: SPACE.lg },
  backText: { fontSize: 14, color: T.text2, fontWeight: "500" },
  header: { alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.orange,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.md,
  },
  title: { fontSize: 22, fontWeight: "700", color: T.text1, textAlign: "center" },
  subtitle: { fontSize: 14, color: T.text2, textAlign: "center", lineHeight: 20 },
  status: { minHeight: 36, justifyContent: "center", alignItems: "center", marginTop: SPACE.md },
  error: { color: T.orangeDk, fontSize: 13, textAlign: "center" },
});
