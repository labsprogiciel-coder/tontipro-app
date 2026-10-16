// app/(auth)/bind-device.tsx
//
// Binding is done by an it_admin from the dashboard (devices:bindDevice, by
// serial number). The agent no longer scans a QR code or types a PIN: this
// screen shows the serial of this phone and waits until the server reports a
// terminal bound to the signed-in agent.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import { Check, Smartphone } from "lucide-react-native";
import { useQuery } from "convex/react";
import { myDevice } from "@/lib/admin-api";
import { getOrCreateDeviceInstallId } from "@/utils/device-id";
import { KAURIDORR_THEME as T } from "@/constants/colors";

/** Same serial the admin sees on the device list: BRAND-MODEL-INSTALLID */
async function getPhoneSerial(): Promise<string> {
  const installId = await getOrCreateDeviceInstallId();
  const brand = Device.brand || "Marque inconnue";
  const modelName = Device.modelName || "Modèle inconnu";
  return `${brand}-${modelName}-${installId}`.toUpperCase().slice(0, 50);
}

export default function BindDeviceScreen() {
  const router = useRouter();
  const [serial, setSerial] = useState<string | null>(null);
  const bound = useQuery(myDevice);

  useEffect(() => {
    getPhoneSerial()
      .then(setSerial)
      .catch(() => setSerial("—"));
  }, []);

  const isBound = bound !== undefined && bound !== null;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.body}>
        <View style={s.ring}>
          {isBound ? (
            <Check size={34} color={T.orange} strokeWidth={2.2} />
          ) : (
            <Smartphone size={34} color={T.orange} strokeWidth={2} />
          )}
        </View>

        <Text style={s.h}>{isBound ? "Appareil lié !" : "Appareil en attente de liaison"}</Text>
        <Text style={s.p}>
          {isBound
            ? "Votre TPE est associé à votre compte."
            : "Communiquez ce numéro de série à l'Admin IT. Cet écran se mettra à jour dès que la liaison est faite."}
        </Text>

        <View style={s.card}>
          <Text style={s.label}>Numéro de série</Text>
          <Text style={s.value} selectable>
            {isBound ? bound.serialNumber : (serial ?? "…")}
          </Text>
        </View>

        {isBound ? (
          <Pressable style={s.btn} onPress={() => router.replace("/dashboard")}>
            <Text style={s.btnTxt}>Aller au tableau de bord</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={T.orange} style={{ marginTop: 24 }} />
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
  h: { fontSize: 22, fontWeight: "700", color: T.text1, textAlign: "center" },
  p: { fontSize: 14, color: T.text2, textAlign: "center", marginTop: 8, lineHeight: 20 },
  card: {
    alignSelf: "stretch",
    backgroundColor: T.bg2,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  label: { fontSize: 12, color: T.text3, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: "600", color: T.text1, fontFamily: "Courier" },
  btn: {
    alignSelf: "stretch",
    backgroundColor: T.orangeStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
