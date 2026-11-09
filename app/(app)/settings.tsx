import { useMemo, useState } from "react";
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
import { forgetCurrentAgent, handOverDevice } from "@/lib/agent-switch";
import {
  isOwnTransaction,
  isUnclaimedTransaction,
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
  Smartphone,
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
    accessibilityRole="button"
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
      <ChevronRight size={18} color="#6c6b65" />
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

  // Shared TPE: other agents' queued operations wait for their next sign-in
  const othersPending = useTransactionStore(
    (s) =>
      s.pendingTransactions.filter((t) => !isOwnTransaction(t, user?.id) && !isUnclaimedTransaction(t))
        .length,
  );
  // Queued before the app recorded who took them: on a shared TPE they wait
  // until an agent says they are theirs (sent alone when no other agent is kept)
  // Select the stored array and filter outside the selector: a selector that
  // returns a new array on every call makes zustand re-render endlessly
  const pending = useTransactionStore((s) => s.pendingTransactions);
  const unclaimed = useMemo(() => pending.filter(isUnclaimedTransaction), [pending]);

  const claimUnclaimed = () => {
    // What the agent confirms: these operations, for the agent who opened the dialog
    const shown = unclaimed.map((t) => t.id);
    const opener = useAuthStore.getState().user?.id;
    const total = unclaimed.reduce((sum, t) => sum + t.amount, 0);
    const n = unclaimed.length;
    Alert.alert(
      "Opérations sans agent",
      `${n} opération${n > 1 ? "s" : ""} (${total.toLocaleString("fr-FR")} FCFA au total) ` +
        "enregistrée" + (n > 1 ? "s" : "") + " avant la gestion de plusieurs agents. " +
        "Confirmez seulement si c'est vous qui les avez faites : elles seront envoyées à votre nom.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Ce sont les miennes",
          onPress: async () => {
            const me = useAuthStore.getState().user?.id;
            // Another agent signed in meanwhile: not theirs to confirm
            if (!me || me !== opener) return;
            useTransactionStore.getState().claimUnclaimedTransactions(me, shown);
            await handleForceSync();
          },
        },
      ],
      { cancelable: true },
    );
  };

  /**
   * "Retirer ce téléphone": sign out of the server too, and forget this
   * agent's PIN, saved session and device key on the phone (otherwise
   * users:me would sign them back in). Coming back needs the password.
   */
  const signOutNow = async () => {
    await forgetCurrentAgent();
    // @ts-ignore
    router.replace("/(auth)");
  };

  /**
   * "Déconnexion": this agent's session, PIN and device key stay on the
   * phone; they come back by picking themselves and typing their PIN, even
   * offline, and so can another agent of the TPE (login.tsx).
   */
  const handOverNow = async () => {
    await handOverDevice();
    // @ts-ignore
    router.replace("/login");
  };

  /**
   * "Déconnexion" (`switching`: keeps the PIN, also hands a shared TPE to
   * another agent) or "Retirer ce téléphone". The signed-in agent's queued
   * operations stay on the phone but only sync under their own session, so
   * they are offered a sync first.
   */
  const confirmSignOut = (switching: boolean) => {
    const title = switching ? "Déconnexion" : "Retirer ce téléphone";
    const confirmLabel = switching ? "Se déconnecter" : "Retirer";
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
          ? "Vous reviendrez avec votre code PIN, même sans connexion. Un autre agent du TPE peut aussi se connecter avec le sien."
          : "Votre code PIN et votre accès seront effacés de ce téléphone : pour revenir, il faudra votre mot de passe et une connexion internet.",
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
              accessibilityRole="button"
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
          {unclaimed.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${unclaimed.length} opérations sans agent en attente : les réclamer`}
              onPress={claimUnclaimed}
              style={styles.infoBox}
            >
              <Users size={16} color="#6c6b65" />
              <Text style={[styles.infoText, { flex: 1 }]}>
                {unclaimed.length} opération{unclaimed.length > 1 ? "s" : ""} sans agent en attente :
                touchez ici si ce sont les vôtres.
              </Text>
            </Pressable>
          )}
          {othersPending > 0 && (
            <View style={styles.infoBox}>
              <Users size={16} color="#6c6b65" />
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
              <DatabaseBackup size={16} color="#6c6b65" />
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
          {/* Keeps the PIN: the agent, or another agent of a shared TPE, signs in with it */}
          <SettingItem
            icon={LogOut}
            label="Déconnexion"
            onPress={() => confirmSignOut(true)}
          />
          <View style={styles.divider} />
          {/* Removes the agent from this phone: the password is needed again */}
          <SettingItem
            icon={Smartphone}
            label="Retirer ce téléphone"
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
    color: "#6c6b65",
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
  itemValue: { fontSize: 13, color: "#6c6b65" },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginLeft: SPACE.xxxl,
  },
  pressed: { backgroundColor: "#f5f4f0" },
  destructiveText: { color: "#a32d2d" },
  versionText: {
    textAlign: "center",
    color: "#6c6b65",
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
    color: "#6c6b65",
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
