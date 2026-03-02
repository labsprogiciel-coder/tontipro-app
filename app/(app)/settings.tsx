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
import {
  Bell,
  ChevronRight,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  User,
  Wifi,
  WifiOff,
} from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter?",
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/(auth)");
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.profileSection}>
          <View style={styles.profileAvatar}>
            <User size={32} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || "Nom de l'agent"}</Text>
            <Text style={styles.profileId}>ID: {user?.id || "AG12345"}</Text>
          </View>
          <Pressable
            style={styles.profileEditButton}
            onPress={() => router.push("/(app)/settings/profile")}
          >
            <Text style={styles.profileEditText}>Modifier</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Bell size={20} color={colors.primary} />
              </View>
              <Text style={styles.settingText}>Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{
                  false: colors.inactive,
                  true: colors.primaryLight,
                }}
                thumbColor={
                  notificationsEnabled ? colors.primary : colors.background
                }
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Moon size={20} color={colors.primary} />
              </View>
              <Text style={styles.settingText}>Mode sombre</Text>
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{
                  false: colors.inactive,
                  true: colors.primaryLight,
                }}
                thumbColor={darkModeEnabled ? colors.primary : colors.background}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View
                style={[
                  styles.settingIconContainer,
                  offlineModeEnabled
                    ? { backgroundColor: colors.warning + "20" }
                    : null,
                ]}
              >
                {offlineModeEnabled ? (
                  <WifiOff size={20} color={colors.warning} />
                ) : (
                  <Wifi size={20} color={colors.primary} />
                )}
              </View>
              <Text style={styles.settingText}>Mode hors ligne</Text>
              <Switch
                value={offlineModeEnabled}
                onValueChange={setOfflineModeEnabled}
                trackColor={{
                  false: colors.inactive,
                  true: colors.warning + "80",
                }}
                thumbColor={
                  offlineModeEnabled ? colors.warning : colors.background
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.settingCard}>
            <Pressable
              style={styles.settingButton}
              onPress={() => router.push("/(app)/settings/change-pin")}
            >
              <View style={styles.settingIconContainer}>
                <Lock size={20} color={colors.primary} />
              </View>
              <Text style={styles.settingText}>Changer le PIN</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingCard}>
            <Pressable
              style={styles.settingButton}
              onPress={() => router.push("/(app)/settings/help")}
            >
              <View style={styles.settingIconContainer}>
                <HelpCircle size={20} color={colors.primary} />
              </View>
              <Text style={styles.settingText}>Aide & Support</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.error} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.card,
    marginBottom: 20,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  profileId: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + "20",
  },
  profileEditText: {
    color: colors.primary,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight + "40",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.error + "10",
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.error,
    marginLeft: 8,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 20,
  },
});