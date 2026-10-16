// app/(auth)/bind-device.tsx
//
// Binding is done by an it_admin from the dashboard (devices:bindDevice, by
// serial number). On opening, this screen registers the phone's serial
// (devices:registerMine) so it appears in Agents & TPE as a "Demande de
// liaison" with a one-click "Lier à <agent>". It shows the serial so the
// admin can check it, and waits until the server reports the binding.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import { Check, Smartphone } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { myDevice, refusalMessage, registerMyDevice } from "@/lib/admin-api";
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
  const register = useMutation(registerMyDevice);
  // "sending" → "sent" once the dashboard has the request; error text otherwise
  const [request, setRequest] = useState<"sending" | "sent" | string>("sending");

  const sendRequest = (phoneSerial: string) => {
    setRequest("sending");
    const model = [Device.brand, Device.modelName].filter(Boolean).join(" ") || "Inconnu";
    register({ serialNumber: phoneSerial, model })
      .then(() => setRequest("sent"))
      .catch((e) =>
        setRequest(
          e?.data === "FORBIDDEN"
            ? "Votre rôle n'utilise pas de TPE."
            : refusalMessage(e) ?? "Pas de connexion : demande non envoyée.",
        ),
      );
  };

  useEffect(() => {
    getPhoneSerial()
      .then((s) => {
        setSerial(s);
        sendRequest(s);
      })
      .catch(() => setSerial("—"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            : request === "sent"
              ? "Demande envoyée à l'Admin IT. Il voit ce téléphone dans Agents & TPE et n'a plus qu'à cliquer sur « Lier ». Cet écran se mettra à jour tout seul."
              : request === "sending"
                ? "Envoi de la demande de liaison…"
                : "La demande n'a pas pu être envoyée."}
        </Text>

        <View style={s.card}>
          <Text style={s.label}>Numéro de série</Text>
          <Text style={s.value} selectable>
            {isBound ? bound.serialNumber : (serial ?? "…")}
          </Text>
        </View>

        {!isBound && request !== "sending" && request !== "sent" && (
          <>
            <Text style={s.err}>{request}</Text>
            {serial && serial !== "—" && (
              <Pressable style={s.btnGhost} onPress={() => sendRequest(serial)}>
                <Text style={s.btnGhostTxt}>Réessayer</Text>
              </Pressable>
            )}
          </>
        )}

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
  err: { fontSize: 13, color: T.danger, textAlign: "center", marginTop: 16 },
  btnGhost: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: T.border2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnGhostTxt: { color: T.text1, fontSize: 15, fontWeight: "600" },
});
