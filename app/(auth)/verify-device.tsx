// app/(auth)/verify-device.tsx
//
// First-login check that this phone is the terminal an it_admin bound to the
// agent (devices:bindDevice). No scanning or typing: the phone's serial is
// compared with the server's binding automatically.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import { AlertTriangle, Check } from "lucide-react-native";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { getOrCreateDeviceInstallId } from "@/utils/device-id";
import { KAURIDORR_THEME as T } from "@/constants/colors";

// Served by the admin backend (convex/devices.ts)
const myDevice = makeFunctionReference<
  "query",
  Record<string, never>,
  { serialNumber: string; model: string } | null
>("devices:myDevice");

async function getPhoneSerial(): Promise<string> {
  const installId = await getOrCreateDeviceInstallId();
  const brand = Device.brand || "Marque inconnue";
  const modelName = Device.modelName || "Modèle inconnu";
  return `${brand}-${modelName}-${installId}`.toUpperCase().slice(0, 50);
}

export default function VerifyDeviceScreen() {
  const router = useRouter();
  const bound = useQuery(myDevice);
  const [serial, setSerial] = useState<string | null>(null);

  useEffect(() => {
    getPhoneSerial().then(setSerial).catch(() => setSerial("—"));
  }, []);

  const matches =
    bound != null && serial != null && bound.serialNumber.toUpperCase() === serial.toUpperCase();

  // Nothing bound yet: the binding screen explains what to do
  useEffect(() => {
    if (bound === null) router.replace("/(auth)/bind-device" as any);
  }, [bound, router]);

  useEffect(() => {
    if (!matches) return;
    const t = setTimeout(() => router.replace("/dashboard" as any), 1200);
    return () => clearTimeout(t);
  }, [matches, router]);

  if (bound === undefined || serial === null || bound === null) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.body}>
          <ActivityIndicator color={T.orange} size="large" />
          <Text style={s.p}>Vérification du TPE…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.body}>
        <View style={[s.ring, !matches && s.ringError]}>
          {matches ? (
            <Check size={34} color={T.orange} strokeWidth={2.2} />
          ) : (
            <AlertTriangle size={34} color={T.orange} />
          )}
        </View>
        <Text style={s.h}>{matches ? "TPE vérifié !" : "Ce n'est pas votre TPE"}</Text>
        <Text style={s.p}>
          {matches
            ? "Redirection vers votre tableau de bord…"
            : "Ce téléphone ne correspond pas au TPE qui vous est assigné. Utilisez le bon appareil ou contactez l'Admin IT."}
        </Text>

        {!matches && (
          <>
            <View style={s.card}>
              <Text style={s.label}>TPE assigné</Text>
              <Text style={s.value}>{bound.serialNumber}</Text>
              <Text style={[s.label, { marginTop: 12 }]}>Ce téléphone</Text>
              <Text style={s.value}>{serial}</Text>
            </View>
            <Pressable style={s.btn} onPress={() => router.replace("/(auth)/login")}>
              <Text style={s.btnTxt}>Retour à la connexion</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.orangeLt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  ringError: { backgroundColor: T.bgDanger },
  h: { fontSize: 22, fontWeight: "700", color: T.text1, textAlign: "center" },
  p: { fontSize: 14, color: T.text2, textAlign: "center", marginTop: 8, lineHeight: 20 },
  card: { alignSelf: "stretch", backgroundColor: T.bg2, borderRadius: 12, padding: 16, marginTop: 24 },
  label: { fontSize: 12, color: T.text3, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: "600", color: T.text1, fontFamily: "Courier" },
  btn: {
    alignSelf: "stretch",
    backgroundColor: T.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
