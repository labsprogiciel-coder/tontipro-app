import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { isOwnPendingClient, useClientStore } from "@/stores/client-store";
import { useAuthActions } from "@convex-dev/auth/react";
import { forgetCurrentAgent, handOverDevice } from "@/lib/agent-switch";
import {
  isOwnTransaction,
  useTransactionStore,
} from "@/stores/transaction-store";

import {
  User,
  ShieldCheck,
  Bell,
  CloudSunIcon,
  Languages,
  Info,
  LogOut,
  Users,
  ChevronRight,
  Database,
  LucideIcon,
  DatabaseBackup,
  AlertTriangle,
  Download,
} from "lucide-react-native";

import { LAYOUT, SPACE } from "@/constants/spacing";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

// "Mizo 1.0.0 (42) · maj 1a2b3c4": version, EAS build number, and the OTA
// update running on top of it, so a screenshot says exactly which code it is.
const APP_VERSION = [
  `Mizo ${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"})`,
  Updates.updateId ? `maj ${Updates.updateId.slice(0, 7)}` : null,
]
  .filter(Boolean)
  .join(" · ");
interface SettingItemProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}

const SettingItem = ({
  icon: Icon,
  label,
  value,
  onPress,
  destructive = false,
}: SettingItemProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.item, pressed && styles.pressed]}
  >
    <View style={[styles.itemLeft, destructive && styles.destructiveBg]}>
      <Icon size={20} color={destructive ? "#a32d2d" : "#5f5e5a"} />
      <Text style={[styles.itemLabel, destructive && styles.destructiveText]}>
        {label}
      </Text>
    </View>
    <View style={styles.itemRight}>
      {value && <Text style={styles.itemValue}>{value}</Text>}
      <ChevronRight size={18} color="#888780" />
    </View>
  </Pressable>
);
/** Shows account settings, manual synchronization, data export, and sign-out controls. */
const SettingsScreen = () => {
  const [isBiometricActive, setIsBiometricActive] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const { signOut } = useAuthActions();
  // Shared TPE: other agents' queued operations wait for their next sign-in
  const othersPending = useTransactionStore(
    (s) => s.pendingTransactions.filter((t) => !isOwnTransaction(t, user?.id)).length,
  );

  /**
   * "Déconnexion": sign out of the server too, and forget this agent's PIN
   * and saved session on the phone (otherwise users:me would sign them back
   * in).
   */
  const signOutNow = async () => {
    await forgetCurrentAgent();
    try {
      await signOut();
    } catch (e) {
      console.warn("signOut failed:", e);
    }
    // @ts-ignore
    router.replace("/(auth)");
  };

  /**
   * "Changer d'agent": this agent's session and PIN stay on the phone; the
   * next agent picks themselves and types their PIN (login.tsx).
   */
  const handOverNow = async () => {
    await handOverDevice();
    // @ts-ignore
    router.replace("/login");
  };

  /**
   * Sign-out, also used to hand a shared TPE to another agent. The signed-in
   * agent's queued operations stay on the phone but only sync under their
   * own session, so they are offered a sync first.
   */
  const confirmSignOut = (switching: boolean) => {
    const title = switching ? "Changer d'agent" : "Déconnexion";
    const confirmLabel = switching ? "Changer d'agent" : "Déconnexion";
    const me = useAuthStore.getState().user?.id;
    const pendingOps = useTransactionStore
      .getState()
      .pendingTransactions.filter((t) => isOwnTransaction(t, me)).length;
    const pendingClients = useClientStore
      .getState()
      .clients.filter((c) => isOwnPendingClient(c, me)).length;

    if (pendingOps === 0 && pendingClients === 0) {
      Alert.alert(
        title,
        switching
          ? "Un autre agent pourra se connecter avec son code PIN. Vous reviendrez avec le vôtre."
          : "Votre code PIN sera effacé de ce téléphone : il faudra votre mot de passe pour revenir.",
        [
          { text: "Annuler", style: "cancel" },
          { text: confirmLabel, style: "destructive", onPress: switching ? handOverNow : signOutNow },
        ],
        { cancelable: true },
      );
      return;
    }

    const parts = [
      pendingOps > 0 && `${pendingOps} opération${pendingOps > 1 ? "s" : ""}`,
      pendingClients > 0 && `${pendingClients} client${pendingClients > 1 ? "s" : ""}`,
    ].filter(Boolean).join(" et ");
    Alert.alert(
      "Données non synchronisées",
      `${parts} en attente sur ce téléphone. Synchronisez avant de partir : ` +
        "sinon, elles ne seront envoyées qu'à votre prochaine connexion sur ce TPE.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Synchroniser",
          onPress: async () => {
            await handleForceSync();
          },
        },
        {
          text: `${confirmLabel} quand même`,
          style: "destructive",
          onPress: switching ? handOverNow : signOutNow,
        },
      ],
      { cancelable: true },
    );
  };

  const handleLogout = () => confirmSignOut(false);

  const handleExport = () => {
    router.push("/(app)/data" as never);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncLabel, setLastSyncLabel] = useState("Sync à 14:10");

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const branchId = useAuthStore.getState().user?.branchId;
      await useClientStore.getState().syncPendingClients();
      if (branchId) {
        await useTransactionStore.getState().syncPendingTransactions(branchId);
      }
      const now = new Date();
      setLastSyncLabel(
        `Sync à ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
      );
      Alert.alert(
        "Synchronisation terminée",
        "Toutes les données en attente ont été envoyées.",
      );
    } catch (err) {
      Alert.alert(
        "Erreur de synchronisation",
        err instanceof Error ? err.message : "Impossible de synchroniser.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Page Header */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Summary */}
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name ?? "AG")
                  .split(" ")
                  .slice(0, 2)
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name ?? "Agent"}</Text>
              <Text style={styles.profileId}>
                {user?.phone ?? user?.email ?? `ID: ${user?.id?.slice(0, 8)}`}
              </Text>
            </View>
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push("/(app)/profile")}
            >
              <Text style={styles.editBtnText}>Voir</Text>
            </Pressable>
          </View>
        </View>

        {/* Security Section */}
        <Text style={styles.sectionLabel}>Sécurité & Accès</Text>
        <View style={styles.section}>
          <SettingItem
            icon={ShieldCheck}
            label="Modifier le PIN"
            onPress={() => router.push("/(auth)/set-pin" as never)}
          />
          <View style={styles.divider} />
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <User size={20} color="#5f5e5a" />
              <Text style={styles.itemLabel}>FaceID / Empreinte</Text>
            </View>
            <Switch
              value={isBiometricActive}
              onValueChange={setIsBiometricActive}
              trackColor={{ false: "#d0cfc8", true: "#D85A30" }}
            />
          </View>
        </View>
        {/* Sync & Offline - CRITICAL for your market */}
        <Text style={styles.sectionLabel}>Données & Synchronisation</Text>
        <View style={styles.section}>
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Database size={20} color="#5f5e5a" />
              <Text style={styles.itemLabel}>Mode Hors-ligne Forcé</Text>
            </View>
            <Switch
              value={isOfflineMode}
              onValueChange={setIsOfflineMode}
              trackColor={{ false: "#d0cfc8", true: "#D85A30" }}
            />
          </View>
          <View style={styles.divider} />
          <SettingItem
            icon={CloudSunIcon}
            label={isSyncing ? "Synchronisation…" : "Forcer la Synchronisation"}
            value={lastSyncLabel}
            onPress={handleForceSync}
          />
          {othersPending > 0 && (
            <View style={styles.infoBox}>
              <Users size={16} color="#888780" />
              <Text style={styles.infoText}>
                {othersPending} opération{othersPending > 1 ? "s" : ""} d&apos;un autre agent en attente sur ce
                TPE : envoyée{othersPending > 1 ? "s" : ""} à sa prochaine connexion.
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <SettingItem
            icon={Info}
            label="Espace de stockage"
            value="12.4 MB"
            onPress={() => {}}
          />
        </View>
        <View style={styles.container}>
          <Text style={styles.sectionLabel}>Sauvegarde & Restauration</Text>
          <View style={styles.section}>
            {/* Export Feature */}
            <SettingItem
              icon={Download}
              label="Exporter les données"
              value="Format .JSON"
              onPress={handleExport}
            />

            <View style={styles.divider} />

            {/* Backup Status Info */}
            <View style={styles.infoBox}>
              <DatabaseBackup size={16} color="#888780" />
              <Text style={styles.infoText}>
                Dernière sauvegarde locale : Aujourd&apos;hui à 10:45
              </Text>
            </View>
          </View>

          {/* Warning for agents */}
          <View style={styles.warningContainer}>
            <AlertTriangle size={14} color="#993C1D" />
            <Text style={styles.warningText}>
              Utilisez l&apos;importation uniquement sous la supervision
              d&apos;un administrateur.
            </Text>
          </View>
        </View>
        {/* General Preferences */}
        <Text style={styles.sectionLabel}>Préférences</Text>
        <View style={styles.section}>
          <SettingItem
            icon={Languages}
            label="Langue"
            value="Français"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingItem icon={Bell} label="Notifications" onPress={() => {}} />
        </View>

        {/* Sign Out */}
        <View
          style={[
            styles.section,
            { marginTop: SPACE.sm, marginBottom: SPACE.xxl },
          ]}
        >
          {/* A TPE can be shared: the next agent signs in with their own account */}
          <SettingItem
            icon={Users}
            label="Changer d'agent"
            onPress={() => confirmSignOut(true)}
          />
          <View style={styles.divider} />
          <SettingItem
            icon={LogOut}
            label="Déconnexion"
            onPress={handleLogout}
            destructive={true}
          />
        </View>

        <Text style={styles.versionText}>
          {APP_VERSION} • Made with ❤️ for Burkina Faso
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eeede8" },
  header: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    backgroundColor: "#ffffff",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a18" },
  scrollContent: { padding: SPACE.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888780",
    textTransform: "uppercase",
    marginBottom: SPACE.sm,
    // Aligned with the row content inside the cards below.
    marginLeft: SPACE.lg,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
    marginBottom: LAYOUT.sectionGap,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.lg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#BB4721",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "white", fontWeight: "700", fontSize: 18 },
  profileInfo: { flex: 1, marginLeft: SPACE.md },
  profileName: { fontSize: 16, fontWeight: "600", color: "#1a1a18" },
  profileId: { fontSize: 12, color: "#5f5e5a", marginTop: SPACE.xxs },
  editBtn: {
    backgroundColor: "#f5f4f0",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: "600", color: "#5f5e5a" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACE.lg,
    height: 56,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  itemLabel: { fontSize: 14, color: "#1a1a18", fontWeight: "500" },
  itemRight: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  itemValue: { fontSize: 13, color: "#888780" },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginLeft: SPACE.xxxl,
  },
  pressed: { backgroundColor: "#f5f4f0" },
  destructiveText: { color: "#a32d2d" },
  versionText: {
    textAlign: "center",
    color: "#888780",
    fontSize: 11,
    marginBottom: SPACE.lg,
  },
  destructiveBg: { backgroundColor: "rgba(163, 45, 45, 0.1)" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.lg,
    backgroundColor: "#f9f9f7",
    gap: SPACE.sm,
  },
  infoText: {
    fontSize: 12,
    color: "#888780",
    fontStyle: "italic",
  },
  warningContainer: {
    flexDirection: "row",
    // Hangs under the backup card (section gap minus 12) and lines up
    // with the card content; the next section keeps the full gap.
    paddingHorizontal: SPACE.lg,
    marginTop: -SPACE.md,
    marginBottom: LAYOUT.sectionGap,
    gap: SPACE.xs,
    alignItems: "center",
  },
  warningText: {
    fontSize: 11,
    color: "#993C1D",
    fontWeight: "500",
  },
});

export default SettingsScreen;
