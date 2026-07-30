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
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Champ requis", "Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        name: trimmedName,
        phone: phone.trim(),
        email: email.trim(),
      });
      router.back();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour le profil.");
    } finally {
      setSaving(false);
    }
  }

  const avatarLabel = initials(name || user?.name || "AG");

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={T.text1} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar preview */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nom complet</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex. Konaté Djibril"
                placeholderTextColor={T.text3}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+226 70 00 00 00"
                placeholderTextColor={T.text3}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="agent@exemple.com"
                placeholderTextColor={T.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          {/* Save button */}
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              saving && styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: T.text1,
  },
  headerSpacer: { width: 30 },

  content: { padding: 20, paddingBottom: 40 },

  avatarWrap: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#fff" },

  form: { gap: 16, marginBottom: 28 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: T.text1,
  },

  saveBtn: {
    backgroundColor: T.orange,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
