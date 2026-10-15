// app/(app)/profile.tsx
//
// Read-only profile. Staff records belong to the admin backend and are edited
// by an IT admin from the dashboard (staff:manage); the app has no way to
// change them, so it shows them and says whom to ask.
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";

import { SPACE } from "@/constants/spacing";

const ROLE_LABELS: Record<string, string> = {
  field_agent: "Agent de terrain",
  supervisor: "Superviseur",
  accountant: "Comptable",
  it_admin: "Admin IT",
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const rows: [string, string | undefined][] = [
    ["Nom complet", user?.name],
    ["Téléphone", user?.phone],
    ["E-mail", user?.email],
    ["Agence", user?.branchName],
    ["Rôle", user ? ROLE_LABELS[user.role] : undefined],
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={T.text1} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Mon profil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.name || "AG")}</Text>
          </View>
        </View>

        <View style={styles.form}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.fieldGroup}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value || "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Pour modifier ces informations, contactez votre administrateur
          informatique.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    backgroundColor: T.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  backBtn: { padding: SPACE.xs },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: T.text1,
  },
  headerSpacer: { width: 30 },

  content: { padding: SPACE.xl, paddingBottom: SPACE.xxxl },

  avatarWrap: { alignItems: "center", marginBottom: SPACE.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#fff" },

  form: { gap: SPACE.lg, marginBottom: SPACE.xl },
  fieldGroup: { gap: SPACE.xs },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border2,
    borderRadius: 12,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    fontSize: 15,
    color: T.text1,
  },

  note: { fontSize: 13, color: T.text3, textAlign: "center" },
});
