// app/(auth)/verify-device.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Camera, Check, ChevronLeft, QrCode, Hash, ShieldCheck, AlertTriangle } from "lucide-react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/stores/auth-store";
import { KAURIDORR_THEME as T } from "@/constants/colors";

type Tab = "qr" | "pin";
type Phase = "idle" | "loading" | "success" | "error";

export default function VerifyDeviceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [verifiedDevice, setVerifiedDevice] = useState<any>(null);

  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  // Récupérer l'agent si pas encore en store
  useEffect(() => {
    if (!user) fetchCurrentUser();
  }, [user, fetchCurrentUser]);

  const expectedDevice = user?.device;

  // Si pas de device assigné → retour login avec erreur
  useEffect(() => {
    if (user && !expectedDevice) {
      Alert.alert(
        "Aucun TPE assigné",
        "Contactez votre administrateur pour qu'il vous assigne un TPE.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    }
  }, [user, expectedDevice, router]);

  const handleSuccess = useCallback((device: any) => {
    setVerifiedDevice(device);
    setPhase("success");

    // Ce dépistage n'a lieu qu'après un changement de mot de passe déjà
    // réussi (change-password.tsx n'envoie ici qu'avec reason=first_login
    // une fois mustChangePassword déjà retombé à false) — renvoyer vers
    // change-password ici créait une boucle infinie entre les deux écrans.
    setTimeout(() => {
      router.replace("/dashboard" as any);
    }, 1500);
  }, [router]);

  const handleError = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, []);

  if (!user || !expectedDevice) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <ActivityIndicator color={T.orange} size="large" />
          <Text style={{ marginTop: 12, color: T.text2 }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.replace("/(auth)/login")}>
          <ChevronLeft size={20} color={T.text3} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle}>Vérification du TPE</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Info box */}
      <View style={s.infoBox}>
        <View style={s.infoIconCircle}>
          <ShieldCheck size={20} color={T.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.infoTitle}>Sécurité requise</Text>
          <Text style={s.infoText}>
            Pour votre première connexion, vous devez scanner{" "}
            <Text style={s.infoTextBold}>le TPE qui vous a été assigné</Text>.
          </Text>
        </View>
      </View>

      {/* Expected device info */}
      <View style={s.expectedDeviceCard}>
        <Text style={s.expectedDeviceLabel}>TPE qui vous est assigné</Text>
        <View style={s.expectedDeviceRow}>
          <Text style={s.expectedDeviceSerial}>{expectedDevice.serialNumber}</Text>
          <Text style={s.expectedDeviceModel}>{expectedDevice.model}</Text>
        </View>
      </View>

      {/* Success state */}
      {phase === "success" && verifiedDevice && (
        <View style={s.successBox}>
          <View style={s.successCircle}>
            <Check size={24} color="white" />
          </View>
          <Text style={s.successTitle}>TPE vérifié !</Text>
          <Text style={s.successText}>Redirection vers votre tableau de bord...</Text>
        </View>
      )}

      {/* Tab bar */}
      {phase !== "success" && (
        <>
          <View style={s.tabBar}>
            <Pressable
              style={[s.tab, activeTab === "qr" && s.tabActive]}
              onPress={() => { setActiveTab("qr"); setError(null); setPhase("idle"); }}
            >
              <QrCode size={14} color={activeTab === "qr" ? T.orange : T.text3} />
              <Text style={[s.tabTxt, activeTab === "qr" && s.tabTxtActive]}>Scanner le QR</Text>
            </Pressable>
            <Pressable
              style={[s.tab, activeTab === "pin" && s.tabActive]}
              onPress={() => { setActiveTab("pin"); setError(null); setPhase("idle"); }}
            >
              <Hash size={14} color={activeTab === "pin" ? T.orange : T.text3} />
              <Text style={[s.tabTxt, activeTab === "pin" && s.tabTxtActive]}>Saisir le PIN</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            {activeTab === "qr" ? (
              <QrVerifyTab
                expectedDevice={expectedDevice}
                onSuccess={handleSuccess}
                onError={handleError}
                phase={phase}
              />
            ) : (
              <PinVerifyTab
                expectedDevice={expectedDevice}
                onSuccess={handleSuccess}
                onError={handleError}
                phase={phase}
                error={error}
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── QR Tab ──────────────────────────────────────────────────────────────────

function QrVerifyTab({ expectedDevice, onSuccess, onError, phase }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasScanned = useRef(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scanLineAnim]);

  const handleScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (hasScanned.current || phase === "loading") return;
    hasScanned.current = true;

    let payload: { serialNumber?: string } = {};
    try {
      payload = JSON.parse(result.data);
    } catch {
      onError("QR invalide — format non reconnu");
      hasScanned.current = false;
      return;
    }

    if (!payload.serialNumber) {
      onError("QR invalide — numéro de série manquant");
      hasScanned.current = false;
      return;
    }

    // Vérifier que le serial correspond au device assigné
    if (payload.serialNumber.toUpperCase() !== expectedDevice.serialNumber.toUpperCase()) {
      onError("❌ Ce n'est pas le TPE qui vous a été assigné. Veuillez scanner le bon appareil.");
      hasScanned.current = false;
      return;
    }

    onSuccess(expectedDevice);
  }, [expectedDevice, onSuccess, onError, phase]);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  if (!permission) {
    return <View style={s.centered}><ActivityIndicator color={T.orange} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={s.permissionWrap}>
        <View style={s.permIconCircle}>
          <Camera size={40} color={T.orange} />
        </View>
        <Text style={s.permTitle}>Caméra requise</Text>
        <Pressable style={s.btnMain} onPress={requestPermission}>
          <Text style={s.btnMainTxt}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={phase !== "loading" ? handleScanned : undefined}
      />
      <View style={s.qrOverlay}>
        <View style={s.qrInstruction}>
          <QrCode size={16} color="white" />
          <Text style={s.qrInstructionTxt}>Scannez le QR du TPE assigné</Text>
        </View>
        <View style={s.scanFrame}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
          <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
        </View>
      </View>
    </View>
  );
}

// ─── PIN Tab ─────────────────────────────────────────────────────────────────

function PinVerifyTab({ expectedDevice, onSuccess, onError, phase, error }: any) {
  const [serial, setSerial] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    if (!serial.trim()) {
      onError("Veuillez saisir le numéro de série");
      return;
    }

    if (serial.trim().toUpperCase() !== expectedDevice.serialNumber.toUpperCase()) {
      onError("❌ Ce numéro de série ne correspond pas au TPE qui vous a été assigné.");
      return;
    }

    onSuccess(expectedDevice);
  };

  return (
    <View style={s.pinTabWrap}>
      <Text style={s.pinTitle}>Saisir le numéro de série</Text>
      <Text style={s.pinSub}>
        Entrez le numéro de série inscrit sur le TPE qui vous a été assigné.
      </Text>

      <TextInput
        ref={inputRef}
        style={s.serialInput}
        value={serial}
        onChangeText={(t) => { setSerial(t.toUpperCase()); }}
        placeholder="Ex: ABC123XYZ"
        placeholderTextColor={T.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        editable={phase !== "loading"}
      />

      {phase === "loading" && (
        <View style={s.pinLoadRow}>
          <ActivityIndicator color={T.orange} size="small" />
          <Text style={s.pinLoadTxt}>Vérification...</Text>
        </View>
      )}

      {error && phase !== "loading" && (
        <View style={s.errorInline}>
          <AlertTriangle size={14} color={T.textDanger} />
          <Text style={s.errorInlineTxt}>{error}</Text>
        </View>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={!serial.trim() || phase === "loading"}
        style={({ pressed }) => [
          s.submitBtn,
          (!serial.trim() || phase === "loading") && s.btnDisabled,
          pressed && serial.trim() && phase !== "loading" && s.btnPressed,
        ]}
      >
        <Text style={s.submitBtnText}>Vérifier le TPE</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: T.text1 },

  // Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    margin: 16,
    padding: 14,
    backgroundColor: T.orangeLt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.orange + "33",
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  infoTitle: { fontSize: 14, fontWeight: "600", color: T.text1, marginBottom: 2 },
  infoText: { fontSize: 12, color: T.text2, lineHeight: 17 },
  infoTextBold: { fontWeight: "700", color: T.text1 },

  // Expected device card
  expectedDeviceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: T.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  expectedDeviceLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  expectedDeviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expectedDeviceSerial: {
    fontSize: 15,
    fontWeight: "700",
    color: T.text1,
    fontFamily: "monospace",
  },
  expectedDeviceModel: {
    fontSize: 13,
    color: T.text2,
  },

  // Success
  successBox: {
    margin: 16,
    padding: 24,
    backgroundColor: T.greenLt,
    borderRadius: 12,
    alignItems: "center",
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.green || "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  successTitle: { fontSize: 18, fontWeight: "600", color: T.text1, marginBottom: 4 },
  successText: { fontSize: 13, color: T.text2, textAlign: "center" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    backgroundColor: T.bg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: T.orange },
  tabTxt: { fontSize: 13, color: T.text3, fontWeight: "500" },
  tabTxtActive: { color: T.orange },

  // QR
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 32,
  },
  qrInstruction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  qrInstructionTxt: { fontSize: 13, color: "white", fontWeight: "500" },
  scanFrame: { width: 240, height: 240, position: "relative", overflow: "hidden" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: T.orange },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    top: "50%",
    height: 2,
    backgroundColor: T.orange,
    borderRadius: 1,
    opacity: 0.85,
  },

  // Permission
  permissionWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  permIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: T.orangeLt,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permTitle: { fontSize: 18, fontWeight: "600", color: T.text1, textAlign: "center" },

  // PIN
  pinTabWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 22,
  },
  pinTitle: { fontSize: 18, fontWeight: "600", color: T.text1, letterSpacing: -0.3, marginBottom: 6 },
  pinSub: { fontSize: 13, color: T.text2, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  serialInput: {
    width: "100%",
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: T.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border2,
    color: T.text1,
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 1,
    fontFamily: "monospace",
  },
  pinLoadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pinLoadTxt: { fontSize: 13, color: T.text3 },
  errorInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.bgDanger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
    maxWidth: 320,
  },
  errorInlineTxt: { fontSize: 13, color: T.textDanger, textAlign: "center", lineHeight: 18, flex: 1 },

  submitBtn: {
    backgroundColor: T.orange,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 16,
    width: "100%",
  },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnMain: {
    backgroundColor: T.orange,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: 22,
  },
  btnMainTxt: { fontSize: 14, fontWeight: "600", color: "white" },
});
