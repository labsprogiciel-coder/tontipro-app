// app/(app)/clients/scan.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import {
  ChevronLeft,
  ScanLine,
  Flashlight,
  KeyboardIcon,
  Camera,
  ShieldCheck,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";

import { SPACE } from "@/constants/spacing";
const ID_BARCODE_TYPES: (
  | "pdf417"
  | "code128"
  | "code39"
  | "qr"
  | "aztec"
  | "ean13"
  | "datamatrix"
)[] = ["pdf417", "code128", "code39", "qr", "aztec", "ean13", "datamatrix"];

export default function ScanIDScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocalSearchParams<{ clientId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualId, setManualId] = useState("");
  const hasScanned = useRef(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scanLineAnim]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScanned.current) return;
      hasScanned.current = true;

      const data = result.data;
      console.log("[ScanID] Barcode scanned:", result.type, data);
      setScannedData(data);

      router.back();
      setTimeout(() => {
        router.setParams({ scannedId: data });
      }, 100);
    },
    [router],
  );

  const handleManualSubmit = useCallback(() => {
    if (!manualId.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un numéro d\u2019identité");
      return;
    }
    console.log("[ScanID] Manual entry:", manualId);
    router.back();
    setTimeout(() => {
      router.setParams({ scannedId: manualId.trim() });
    }, 100);
  }, [manualId, router]);

  const handleRetry = useCallback(() => {
    hasScanned.current = false;
    setScannedData(null);
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.webHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.webHeaderTitle}>Vérification KYC</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.webContent}>
          <View style={styles.webIconContainer}>
            <ShieldCheck size={48} color={colors.primary} />
          </View>
          <Text style={styles.webTitle}>
            {"Scanner une pièce d\u2019identité"}
          </Text>
          <Text style={styles.webSubtitle}>
            {"La caméra n\u2019est pas disponible sur cette plateforme."}
            {"\n"}
            {"Entrez le numéro d\u2019identité manuellement."}
          </Text>

          <View style={styles.webInputGroup}>
            <Text style={styles.webLabel}>{"Numéro d\u2019identité"}</Text>
            <TextInput
              style={styles.webInput}
              placeholder="Ex: SN-CNI-2845739"
              placeholderTextColor={colors.inactive}
              value={manualId}
              onChangeText={setManualId}
              autoCapitalize="characters"
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.webSubmitBtn,
              pressed && { opacity: 0.85 },
              !manualId.trim() && { backgroundColor: colors.inactive },
            ]}
            onPress={handleManualSubmit}
            disabled={!manualId.trim()}
          >
            <Text style={styles.webSubmitText}>Valider</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconWrap}>
            <Camera size={56} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
          <Text style={styles.permissionDesc}>
            {
              "Pour scanner une pièce d\u2019identité, l\u2019application a besoin d\u2019accéder à votre caméra."
            }
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.permissionBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.manualEntryLink,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.manualEntryText}>Saisir manuellement</Text>
          </Pressable>
        </View>

        {showManualEntry && (
          <View style={styles.manualOverlay}>
            <View style={styles.manualCard}>
              <Text style={styles.manualTitle}>{"Numéro d\u2019identité"}</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="Ex: SN-CNI-2845739"
                placeholderTextColor={colors.inactive}
                value={manualId}
                onChangeText={setManualId}
                autoCapitalize="characters"
                autoFocus
              />
              <View style={styles.manualActions}>
                <Pressable
                  style={[styles.manualActionBtn, styles.manualCancelBtn]}
                  onPress={() => setShowManualEntry(false)}
                >
                  <Text style={styles.manualCancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.manualActionBtn, styles.manualConfirmBtn]}
                  onPress={handleManualSubmit}
                >
                  <Text style={styles.manualConfirmText}>Valider</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (showManualEntry) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.webHeader}>
          <Pressable
            style={styles.backBtn}
            onPress={() => setShowManualEntry(false)}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.webHeaderTitle}>Saisie manuelle</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.webContent}>
          <View style={styles.webInputGroup}>
            <Text style={styles.webLabel}>{"Numéro d\u2019identité"}</Text>
            <TextInput
              style={styles.webInput}
              placeholder="Ex: SN-CNI-2845739"
              placeholderTextColor={colors.inactive}
              value={manualId}
              onChangeText={setManualId}
              autoCapitalize="characters"
              autoFocus
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.webSubmitBtn,
              pressed && { opacity: 0.85 },
              !manualId.trim() && { backgroundColor: colors.inactive },
            ]}
            onPress={handleManualSubmit}
            disabled={!manualId.trim()}
          >
            <Text style={styles.webSubmitText}>Valider</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ID_BARCODE_TYPES,
        }}
        onBarcodeScanned={scannedData ? undefined : handleBarcodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable style={styles.topBarBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
          <Text style={styles.topBarTitle}>
            {"Scanner la pièce d\u2019identité"}
          </Text>
          <Pressable
            style={[styles.topBarBtn, torchEnabled && styles.topBarBtnActive]}
            onPress={() => setTorchEnabled((v) => !v)}
          >
            <Flashlight
              size={20}
              color={torchEnabled ? colors.warning : "#fff"}
            />
          </Pressable>
        </View>

        <View style={styles.scanAreaWrapper}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineTranslate }] },
              ]}
            />
          </View>
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.instructionCard}>
            <ScanLine size={20} color={colors.primary} />
            <Text style={styles.instructionText}>
              {
                "Placez le code-barres de la pièce d\u2019identité dans le cadre"
              }
            </Text>
          </View>

          {scannedData ? (
            <View style={styles.resultCard}>
              <ShieldCheck size={24} color={colors.secondary} />
              <Text style={styles.resultLabel}>ID scanné</Text>
              <Text style={styles.resultData}>{scannedData}</Text>
              <Pressable style={styles.retryBtn} onPress={handleRetry}>
                <Text style={styles.retryText}>Scanner à nouveau</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.manualBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setShowManualEntry(true)}
            >
              <KeyboardIcon size={18} color="#fff" />
              <Text style={styles.manualBtnText}>Saisir manuellement</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarBtnActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600" as const,
  },
  scanAreaWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanArea: {
    width: 280,
    height: 200,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "50%",
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    opacity: 0.8,
  },
  bottomSection: {
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.lg,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    gap: SPACE.md,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: SPACE.xl,
    alignItems: "center",
    gap: SPACE.sm,
  },
  resultLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500" as const,
  },
  resultData: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.5,
  },
  retryBtn: {
    marginTop: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  retryText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500" as const,
  },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.lg,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  manualBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500" as const,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE.xxl,
    backgroundColor: colors.background,
  },
  permissionIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.xl,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.text,
    marginBottom: SPACE.md,
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACE.xxl,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.xxl,
    marginBottom: SPACE.lg,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  manualEntryLink: {
    paddingVertical: SPACE.sm,
  },
  manualEntryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "500" as const,
  },
  manualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
  },
  manualCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: SPACE.xl,
    width: "100%",
    maxWidth: 360,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: SPACE.lg,
  },
  manualInput: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACE.lg,
    height: 48,
    fontSize: 16,
    color: colors.text,
    marginBottom: SPACE.lg,
  },
  manualActions: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  manualActionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: SPACE.md,
    alignItems: "center",
  },
  manualCancelBtn: {
    backgroundColor: colors.card,
  },
  manualCancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500" as const,
  },
  manualConfirmBtn: {
    backgroundColor: colors.primary,
  },
  manualConfirmText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    padding: SPACE.sm,
  },
  webHeaderTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
  },
  webContent: {
    flex: 1,
    padding: SPACE.xl,
    backgroundColor: colors.background,
  },
  webIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight + "20",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: SPACE.lg,
    marginTop: SPACE.xxl,
  },
  webTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.text,
    textAlign: "center",
    marginBottom: SPACE.sm,
  },
  webSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACE.xxl,
  },
  webInputGroup: {
    marginBottom: SPACE.xl,
  },
  webLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: SPACE.sm,
  },
  webInput: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACE.lg,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  webSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: SPACE.lg,
    alignItems: "center",
  },
  webSubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
});
