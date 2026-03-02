import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, User, Phone, MapPin, ScanLine, ShieldCheck, CreditCard, ChevronDown } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";

const ID_TYPES: { value: "cni" | "passport" | "permis" | "autre"; label: string }[] = [
  { value: "cni", label: "Carte Nationale d'Identité" },
  { value: "passport", label: "Passeport" },
  { value: "permis", label: "Permis de conduire" },
  { value: "autre", label: "Autre" },
];

export default function AddClientScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scannedId?: string }>();
  const { addClient } = useClientStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState<"cni" | "passport" | "permis" | "autre">("cni");
  const [showIdTypePicker, setShowIdTypePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (params.scannedId) {
      console.log("[AddClient] Received scanned ID:", params.scannedId);
      setIdNumber(params.scannedId);
    }
  }, [params.scannedId]);

  const handleScanId = () => {
    router.push("/(app)/clients/scan");
  };

  const handleAddClient = async () => {
    if (!name || !phone) {
      Alert.alert("Informations manquantes", "Veuillez entrer le nom et le numéro de téléphone du client");
      return;
    }

    setIsLoading(true);

    try {
      const deposit = initialDeposit ? parseInt(initialDeposit, 10) : 0;

      await addClient({
        name,
        phone,
        address,
        initialDeposit: deposit,
        idNumber: idNumber || undefined,
        idType: idNumber ? idType : undefined,
      });

      Alert.alert(
        "Client ajouté",
        `${name} a été inscrit avec succès`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Erreur", "Impossible d\u2019ajouter le client. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedIdTypeLabel = ID_TYPES.find((t) => t.value === idType)?.label ?? "";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Ajouter un nouveau client</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Informations du client</Text>

            <View style={styles.inputContainer}>
              <User size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor={colors.inactive}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Phone size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                placeholderTextColor={colors.inactive}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <MapPin size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Adresse (Optionnelle)"
                placeholderTextColor={colors.inactive}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.kycSection}>
              <View style={styles.kycHeader}>
                <ShieldCheck size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Vérification KYC</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.idTypeSelector, pressed && { opacity: 0.7 }]}
                onPress={() => setShowIdTypePicker(!showIdTypePicker)}
              >
                <CreditCard size={20} color={colors.textSecondary} />
                <Text style={styles.idTypeSelectorText} numberOfLines={1}>
                  {selectedIdTypeLabel}
                </Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </Pressable>

              {showIdTypePicker && (
                <View style={styles.idTypePicker}>
                  {ID_TYPES.map((type) => (
                    <Pressable
                      key={type.value}
                      style={({ pressed }) => [
                        styles.idTypeOption,
                        type.value === idType && styles.idTypeOptionActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => {
                        setIdType(type.value);
                        setShowIdTypePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.idTypeOptionText,
                          type.value === idType && styles.idTypeOptionTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.idInputRow}>
                <View style={[styles.inputContainer, styles.idInput]}>
                  <CreditCard size={20} color={colors.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Numéro d'identité"
                    placeholderTextColor={colors.inactive}
                    value={idNumber}
                    onChangeText={setIdNumber}
                    autoCapitalize="characters"
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.8 }]}
                  onPress={handleScanId}
                >
                  <ScanLine size={22} color="#fff" />
                </Pressable>
              </View>

              {idNumber ? (
                <View style={styles.kycBadge}>
                  <ShieldCheck size={16} color={colors.secondary} />
                  <Text style={styles.kycBadgeText}>ID renseigné</Text>
                </View>
              ) : (
                <Text style={styles.kycHint}>
                  {"Scannez ou saisissez le numéro de la pièce d\u2019identité du client"}
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Dépôt initial</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>FCFA</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.inactive}
                value={initialDeposit}
                onChangeText={setInitialDeposit}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.infoText}>
              Vous pouvez ajouter un dépôt initial ou le laisser vide
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleAddClient}
              disabled={isLoading}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? "Ajout en cours..." : "Ajouter le client"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: 12,
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 8,
    color: colors.text,
    fontSize: 15,
  },
  currencyPrefix: {
    color: colors.textSecondary,
    fontWeight: "500" as const,
  },
  kycSection: {
    marginTop: 8,
    backgroundColor: colors.primary + "08",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + "15",
  },
  kycHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: -8,
  },
  idTypeSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 12,
    gap: 8,
  },
  idTypeSelectorText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  idTypePicker: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  idTypeOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  idTypeOptionActive: {
    backgroundColor: colors.primary + "10",
  },
  idTypeOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  idTypeOptionTextActive: {
    color: colors.primary,
    fontWeight: "600" as const,
  },
  idInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  idInput: {
    flex: 1,
    marginBottom: 0,
  },
  scanButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.secondary + "15",
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  kycBadgeText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: colors.secondary,
  },
  kycHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  addButton: {
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
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600" as const,
  },
});
