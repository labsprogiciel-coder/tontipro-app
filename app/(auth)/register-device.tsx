// app/(public)/register-device.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Linking,
  Platform,
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
import { Camera, Check, ChevronLeft, QrCode, Hash, Smartphone, Cpu, Hash as HashIcon, MapPin, Battery as BatteryIcon } from "lucide-react-native";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Device from "expo-device";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { getOrCreateDeviceInstallId } from "@/utils/device-id";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "qr" | "pin";
type Phase = "idle" | "loading" | "success";

interface DeviceInfo {
  serialNumber: string;
  model: string;
  brand: string;
  batteryPct: number | undefined;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | undefined;
    timestamp: number;
  } | undefined;
}

interface RegisterResult {
  deviceId: string;
  deviceInfo: DeviceInfo;
}

function mapError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  if (msg.includes("expiré")) return "Code expiré — demandez un nouveau code à votre responsable";
  if (msg.includes("déjà")) return "Ce terminal est déjà enregistré dans le système";
  if (msg.includes("invalide") || msg.includes("Invalid")) return "Code non reconnu — vérifiez puis réessayez";
  return "Une erreur est survenue — réessayez";
}

// ── Récupérer les infos du téléphone ───────────────────────────────────────────

async function getDeviceInfo(
  onProgress: (msg: string) => void
): Promise<DeviceInfo> {
  const modelName = Device.modelName || "Modèle inconnu";
  const brand = Device.brand || "Marque inconnue";

  // Numéro de série
  const installId = await getOrCreateDeviceInstallId();
  const serialNumber = `${brand}-${modelName}-${installId}`.toUpperCase();

  // Batterie
  onProgress("Lecture du niveau de batterie...");
  let batteryPct: number | undefined = undefined;
  try {
    const level = await Battery.getBatteryLevelAsync();
    batteryPct = Math.round(level * 100);
  } catch (error) {
    console.warn("Battery error:", error);
  }

  // Localisation
  onProgress("Détection de la localisation...");
  let location: DeviceInfo["location"] = undefined;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      location = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy?? undefined,
        timestamp: loc.timestamp,
      };
    } else {
      console.warn("Permission localisation refusée");
    }
  } catch (error) {
    console.warn("Location error:", error);
  }

  return {
    serialNumber: serialNumber.slice(0, 50),
    model: modelName,
    brand: brand,
    batteryPct,
    location,
  };
}

// ── Success overlay ────────────────────────────────────────────────────────────

function SuccessView({ result, onBack }: { result: RegisterResult; onBack: () => void }) {
  return (
    <View style={s.successWrap}>
      <View style={s.successRing}>
        <Check size={34} color={T.orange} strokeWidth={2.2} />
      </View>
      <Text style={s.successH}>TPE enregistré !</Text>
      <Text style={s.successP}>
        Le terminal a été ajouté à votre agence avec succès.
      </Text>

      <View style={s.deviceCard}>
        <View style={s.deviceRow}>
          <View style={s.deviceRowIcon}>
            <Cpu size={14} color={T.text2} />
          </View>
          <Text style={s.deviceLabel}>Marque</Text>
          <Text style={s.deviceValue}>{result.deviceInfo.brand}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.deviceRow}>
          <View style={s.deviceRowIcon}>
            <Smartphone size={14} color={T.text2} />
          </View>
          <Text style={s.deviceLabel}>Modèle</Text>
          <Text style={s.deviceValue}>{result.deviceInfo.model}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.deviceRow}>
          <View style={s.deviceRowIcon}>
            <HashIcon size={14} color={T.text2} />
          </View>
          <Text style={s.deviceLabel}>N° série</Text>
          <Text style={s.deviceValueMono}>{result.deviceInfo.serialNumber}</Text>
        </View>
        
        {/* Batterie */}
        <View style={s.divider} />
        <View style={s.deviceRow}>
          <View style={s.deviceRowIcon}>
            <BatteryIcon size={14} color={T.text2} />
          </View>
          <Text style={s.deviceLabel}>Batterie</Text>
          <Text style={s.deviceValue}>
            {result.deviceInfo.batteryPct !== undefined 
              ? `${result.deviceInfo.batteryPct}%` 
              : "Non disponible"}
          </Text>
        </View>
        
        {/* Localisation */}
        <View style={s.divider} />
        <View style={s.deviceRow}>
          <View style={s.deviceRowIcon}>
            <MapPin size={14} color={T.text2} />
          </View>
          <Text style={s.deviceLabel}>Position</Text>
          <Text style={s.deviceValue}>
            {result.deviceInfo.location 
              ? `${result.deviceInfo.location.latitude.toFixed(4)}, ${result.deviceInfo.location.longitude.toFixed(4)}`
              : "Non disponible"}
          </Text>
        </View>
      </View>

      <Pressable style={s.btnMain} onPress={onBack}>
        <Text style={s.btnMainTxt}>Retour au dashboard</Text>
      </Pressable>
    </View>
  );
}

// ── QR tab ─────────────────────────────────────────────────────────────────────

function QrTab({
  deviceInfo,
  onSuccess,
  onFallback,
}: {
  deviceInfo: DeviceInfo | null;
  onSuccess: (r: RegisterResult) => void;
  onFallback: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const hasScanned = useRef(false);

  const registerByToken = useMutation(api.devices.registerDeviceByToken);

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

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      onFallback();
    }
  }, [permission]);

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (hasScanned.current || phase === "loading") return;
    if (!deviceInfo) {
      setError("Informations du terminal non disponibles");
      return;
    }
    
    hasScanned.current = true;
    setError(null);

    let payload: { token?: string; type?: string } = {};
    try {
      payload = JSON.parse(result.data);
    } catch {
      setError("QR invalide — format non reconnu");
      hasScanned.current = false;
      return;
    }

    if (!payload.token || payload.type !== "device-registration") {
      setError("QR invalide — ce n'est pas un code d'enregistrement TPE");
      hasScanned.current = false;
      return;
    }

    setPhase("loading");
    try {
      const { deviceId } = await registerByToken({
        token: payload.token,
        serialNumber: deviceInfo.serialNumber,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        batteryPct: deviceInfo.batteryPct,
        registrationLocation: deviceInfo.location,
      });
      onSuccess({ deviceId, deviceInfo });
    } catch (e) {
      setError(mapError(e));
      setPhase("idle");
      hasScanned.current = false;
    }
  }, [phase, onSuccess, deviceInfo, registerByToken]);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  if (!permission) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={T.orange} />
      </View>
    );
  }

if (!permission.granted) {
  return (
    <View style={s.permissionWrap}>
      <View style={s.permIconCircle}>
        <Camera size={40} color={T.orange} />
      </View>
      <Text style={s.permTitle}>Accès à la caméra requis</Text>
      <Text style={s.permDesc}>
        Pour scanner le QR code, l&apos;application a besoin d&apos;accéder à votre caméra.
      </Text>
      
      {permission.canAskAgain ? (
        <Pressable style={s.btnMain} onPress={requestPermission}>
          <Text style={s.btnMainTxt}>Autoriser la caméra</Text>
        </Pressable>
      ) : (
        <>
          <View style={s.warningBox}>
            <Text style={s.warningText}>
              La permission a été refusée. Vous devez l&apos;activer manuellement dans les paramètres.
            </Text>
          </View>
          <Pressable 
            style={s.btnMain} 
            onPress={() => Linking.openSettings()}
          >
            <Text style={s.btnMainTxt}>Ouvrir les paramètres</Text>
          </Pressable>
        </>
      )}
      
      <Pressable style={s.linkBtn} onPress={onFallback}>
        <Text style={s.linkBtnTxt}>Saisir un code PIN à la place</Text>
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
        onBarcodeScanned={phase !== "loading" ? handleBarcodeScanned : undefined}
      />

      <View style={s.qrOverlay}>
        <View style={s.qrInstruction}>
          <QrCode size={16} color="white" />
          <Text style={s.qrInstructionTxt}>Placez le QR code dans le cadre</Text>
        </View>

        <View style={s.scanFrame}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
          {phase === "loading" ? (
            <View style={s.scanSpinner}>
              <ActivityIndicator color={T.orange} size="large" />
            </View>
          ) : (
            <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
          )}
        </View>

        {error ? (
          <View style={s.errorBadge}>
            <Text style={s.errorBadgeTxt}>{error}</Text>
          </View>
        ) : (
          <Text style={s.qrHelper}>Le QR est affiché sur le dashboard Kauri</Text>
        )}
      </View>
    </View>
  );
}

// ── PIN tab ────────────────────────────────────────────────────────────────────

const PIN_LENGTH = 6;

function PinTab({
  deviceInfo,
  onSuccess,
}: {
  deviceInfo: DeviceInfo | null;
  onSuccess: (r: RegisterResult) => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hasSubmitted = useRef(false);

  const registerByPin = useMutation(api.devices.registerDeviceByPin);

  const submit = useCallback(async (code: string) => {
    if (hasSubmitted.current) return;
    if (!deviceInfo) {
      setError("Informations du terminal non disponibles");
      return;
    }
    
    hasSubmitted.current = true;
    Keyboard.dismiss();
    setError(null);
    setPhase("loading");
    try {
      const { deviceId } = await registerByPin({
        pin: code,
        serialNumber: deviceInfo.serialNumber,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        batteryPct: deviceInfo.batteryPct,
        registrationLocation: deviceInfo.location,
      });
      onSuccess({ deviceId, deviceInfo });
    } catch (e) {
      setError(mapError(e));
      setPhase("idle");
      setDigits(Array(PIN_LENGTH).fill(""));
      hasSubmitted.current = false;
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  }, [onSuccess, deviceInfo, registerByPin]);

  const handleChange = useCallback((text: string, index: number) => {
    const cleaned = text.replace(/\D/g, "");

    if (cleaned.length > 1) {
      const next = cleaned.slice(0, PIN_LENGTH).split("");
      while (next.length < PIN_LENGTH) next.push("");
      setDigits(next);
      const filled = next.filter(Boolean).length;
      const focusIdx = Math.min(filled, PIN_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      if (filled === PIN_LENGTH) {
        submit(next.join(""));
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned.slice(-1);
    setDigits(next);

    if (cleaned) {
      if (index < PIN_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        const code = next.join("");
        if (code.length === PIN_LENGTH) submit(code);
      }
    }
  }, [digits, submit]);

  const handleKeyPress = useCallback(({ nativeEvent }: { nativeEvent: { key: string } }, index: number) => {
    if (nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  return (
    <View style={s.pinTabWrap}>
      <Text style={s.pinTitle}>Saisir le code PIN</Text>
      <Text style={s.pinSub}>Entrez le code à 6 chiffres affiché sur le dashboard.</Text>

      <View style={s.pinBoxRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            style={[
              s.pinBox,
              d ? s.pinBoxFilled : undefined,
              error ? s.pinBoxError : undefined,
            ]}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            selectTextOnFocus
            editable={phase !== "loading"}
            caretHidden
            textAlign="center"
          />
        ))}
      </View>

      {phase === "loading" && (
        <View style={s.pinLoadRow}>
          <ActivityIndicator color={T.orange} size="small" />
          <Text style={s.pinLoadTxt}>Enregistrement...</Text>
        </View>
      )}

      {error && phase !== "loading" && (
        <View style={s.errorInline}>
          <Text style={s.errorInlineTxt}>{error}</Text>
        </View>
      )}

      <Text style={s.pinHelper}>
        Vous n&apos;avez pas de code ?{" "}
        <Text style={s.pinHelperBold}>Demandez-le à votre responsable.</Text>
      </Text>
    </View>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Détection du terminal...");

  useEffect(() => {
    (async () => {
      try {
        const info = await getDeviceInfo((msg) => setLoadingMessage(msg));
        setDeviceInfo(info);
      } catch (error) {
        console.error("Erreur récupération infos device:", error);
        Alert.alert("Erreur", "Impossible de récupérer toutes les informations du terminal");
      } finally {
        setLoadingInfo(false);
      }
    })();
  }, []);

  const handleSuccess = useCallback((r: RegisterResult) => {
    setResult(r);
  }, []);

  const switchToPin = useCallback(() => {
    setActiveTab("pin");
  }, []);

  if (loadingInfo) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <ActivityIndicator color={T.orange} size="large" />
          <Text style={{ marginTop: 12, color: T.text2, fontSize: 13 }}>
            {loadingMessage}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={s.root}>
        <SuccessView result={result} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color={T.text3} />
        </Pressable>
        <Text style={s.headerTitle}>Enregistrer un TPE</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Device Info Card */}
      {deviceInfo && (
  <View style={s.deviceInfoCard}>
    <Text style={s.deviceInfoTitle}>Terminal détecté</Text>
    <View style={s.deviceInfoRow}>
      <Cpu size={14} color={T.text2} />
      <Text style={s.deviceInfoLabel}>{deviceInfo.brand}</Text>
      <Text style={s.deviceInfoSep}>·</Text>
      <Text style={s.deviceInfoValue}>{deviceInfo.model}</Text>
    </View>
    <View style={s.deviceInfoRow}>
      <HashIcon size={14} color={T.text2} />
      <Text style={s.deviceInfoValueMono} numberOfLines={1}>
        {deviceInfo.serialNumber}
      </Text>
    </View>

    {/* Batterie */}
    <View style={s.deviceInfoRow}>
      <BatteryIcon 
        size={14} 
        color={
          deviceInfo.batteryPct === undefined
            ? T.text3
            : deviceInfo.batteryPct < 25
            ? T.textDanger
            : deviceInfo.batteryPct < 50
            ? "#f59e0b"
            : T.text2
        } 
      />
      <Text style={s.deviceInfoLabel}>Batterie</Text>
      <Text 
        style={[
          s.deviceInfoValue,
          deviceInfo.batteryPct !== undefined && deviceInfo.batteryPct < 25 && { color: T.textDanger },
        ]}
      >
        {deviceInfo.batteryPct !== undefined ? `${deviceInfo.batteryPct}%` : "Non disponible"}
      </Text>
    </View>

    {/* Localisation - MAINTENANT À L'INTÉRIEUR */}
    <View style={s.deviceInfoRow}>
      <MapPin size={14} color={deviceInfo.location ? T.text2 : T.text3} />
      <Text style={s.deviceInfoLabel}>Position</Text>
      <Text style={s.deviceInfoValue}>
        {deviceInfo.location 
          ? `${deviceInfo.location.latitude.toFixed(4)}, ${deviceInfo.location.longitude.toFixed(4)}`
          : "Non disponible"
        }
      </Text>
    </View>
  </View>
)}

      {/* Tab bar */}
      <View style={s.tabBar}>
        <Pressable
          style={[s.tab, activeTab === "qr" && s.tabActive]}
          onPress={() => setActiveTab("qr")}
        >
          <QrCode size={14} color={activeTab === "qr" ? T.orange : T.text3} />
          <Text style={[s.tabTxt, activeTab === "qr" && s.tabTxtActive]}>
            Scanner le QR
          </Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === "pin" && s.tabActive]}
          onPress={() => setActiveTab("pin")}
        >
          <Hash size={14} color={activeTab === "pin" ? T.orange : T.text3} />
          <Text style={[s.tabTxt, activeTab === "pin" && s.tabTxtActive]}>
            Saisir le code PIN
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === "qr" ? (
          <QrTab deviceInfo={deviceInfo} onSuccess={handleSuccess} onFallback={switchToPin} />
        ) : (
          <PinTab deviceInfo={deviceInfo} onSuccess={handleSuccess} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: T.text1, letterSpacing: -0.2 },

  // Device Info Card
  deviceInfoCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: T.bg2,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: T.border,
  },
  deviceInfoTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: T.text2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  deviceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  deviceInfoLabel: { fontSize: 13, fontWeight: "500", color: T.text1 },
  deviceInfoSep: { fontSize: 13, color: T.text3 },
  deviceInfoValue: { fontSize: 13, color: T.text1, flex: 1 },
  deviceInfoValueMono: {
    fontSize: 12,
    color: T.text2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    flex: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    backgroundColor: T.bg,
    marginTop: 12,
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

  // QR tab
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
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: T.orange,
  },
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
  scanSpinner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  errorBadge: {
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 280,
  },
  errorBadgeTxt: { fontSize: 13, color: T.textDanger, textAlign: "center", lineHeight: 18 },
  qrHelper: { fontSize: 12, color: "rgba(255,255,255,0.65)", textAlign: "center" },

  // Camera permission
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
  permDesc: { fontSize: 13, color: T.text2, textAlign: "center", lineHeight: 20, marginBottom: 4 },
  linkBtn: { paddingVertical: 8, marginTop: 4 },
  linkBtnTxt: { fontSize: 13, color: T.orange, fontWeight: "500" },

  // PIN tab
  pinTabWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 22,
  },
  pinTitle: { fontSize: 18, fontWeight: "600", color: T.text1, letterSpacing: -0.3, marginBottom: 6 },
  pinSub: { fontSize: 13, color: T.text2, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  pinBoxRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  pinBox: {
    width: 46,
    height: 52,
    borderRadius: 12,
    backgroundColor: T.bg2,
    borderWidth: 1,
    borderColor: T.border2,
    fontSize: 22,
    fontWeight: "700",
    color: T.text1,
  },
  pinBoxFilled: { borderColor: T.orange, backgroundColor: T.orangeLt },
  pinBoxError: { borderColor: T.textDanger, backgroundColor: T.bgDanger },
  pinLoadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pinLoadTxt: { fontSize: 13, color: T.text3 },
  errorInline: {
    backgroundColor: T.bgDanger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
    maxWidth: 300,
  },
  errorInlineTxt: { fontSize: 13, color: T.textDanger, textAlign: "center", lineHeight: 18 },
  pinHelper: { fontSize: 12, color: T.text3, textAlign: "center", marginTop: 24, lineHeight: 18 },
  pinHelperBold: { fontWeight: "600", color: T.text2 },

  // CTA
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

  // Success
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.orangeLt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successH: { fontSize: 22, fontWeight: "600", color: T.text1, letterSpacing: -0.4 },
  successP: { fontSize: 13, color: T.text2, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  deviceCard: {
    width: "100%",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  deviceRowIcon: { width: 20, alignItems: "center" },
  deviceLabel: { fontSize: 12, color: T.text2, width: 60 },
  deviceValue: { fontSize: 13, fontWeight: "500", color: T.text1, flex: 1 },
  deviceValueMono: {
    fontSize: 12,
    fontWeight: "500",
    color: T.text1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    flex: 1,
  },
  divider: { height: 0.5, backgroundColor: T.border },
  warningBox: {
  backgroundColor: "#fffbeb",
  borderWidth: 1,
  borderColor: "#fde68a",
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
},
warningText: {
  fontSize: 13,
  color: "#92400e",
  textAlign: "center",
  lineHeight: 18,
},
});
