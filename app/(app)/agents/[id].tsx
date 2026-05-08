import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal, KeyRound } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAgentStore } from "@/stores/agent-store";
import { AgentRole, AgentPermissions } from "@/types/agent";
import { usePermissions } from "@/hooks/usePermissions";
import { Numpad } from "@/app/components/ui/numpad";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<AgentRole, string> = {
  admin:   "Administrateur",
  agent:   "Agent",
  blocked: "Bloqué",
};
const ROLE_BADGE_BG: Record<AgentRole, string> = { admin: T.orangeLt, agent: "#e6f1fb", blocked: "#fcebeb" };
const ROLE_BADGE_FG: Record<AgentRole, string> = { admin: T.orangeDk, agent: "#185fa5", blocked: T.textDanger };

const PERM_KEYS: { label: string; key: keyof AgentPermissions }[] = [
  { label: "Ajouter un client",       key: "addClient"     },
  { label: "Modifier un client",      key: "editClient"    },
  { label: "Effectuer un dépôt",      key: "deposit"       },
  { label: "Effectuer un retrait",    key: "withdrawal"    },
  { label: "Exporter les rapports",   key: "exportReports" },
  { label: "Gérer les agents",        key: "manageAgents"  },
  { label: "Importer des données",    key: "importData"    },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AgentDetailScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const router      = useRouter();
  const agent       = useAgentStore((s) => s.getAgentById(id ?? ""));
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const myPerms     = usePermissions();

  const [localPerms, setLocalPerms] = useState<AgentPermissions | null>(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const setAgentPin = useAgentStore((s) => s.setAgentPin);

  if (!agent) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator color={T.orange} />
        </View>
      </SafeAreaView>
    );
  }

  const perms = localPerms ?? agent.permissions;

  const togglePerm = (key: keyof AgentPermissions) => {
    const updated = { ...perms, [key]: !perms[key] };
    setLocalPerms(updated);
    updateAgent(agent.id, { permissions: updated });
  };

  const handlePinDigit = async (digit: string) => {
    if (pinSaving) return;
    const next = pinInput.length < 4 ? pinInput + digit : pinInput;
    setPinInput(next);
    if (next.length === 4) {
      setPinSaving(true);
      try {
        await setAgentPin(agent.id, next);
        setPinModalVisible(false);
        setPinInput("");
        Alert.alert("PIN défini", `Le PIN de ${agent.name} a été mis à jour.`);
      } catch {
        Alert.alert("Erreur", "Impossible de définir le PIN.");
        setPinInput("");
      } finally {
        setPinSaving(false);
      }
    }
  };

  const handleBlock = () => {
    Alert.alert(
      "Bloquer l'agent",
      `Voulez-vous bloquer ${agent.name} ? Il ne pourra plus se connecter.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Bloquer",
          style: "destructive",
          onPress: () => {
            updateAgent(agent.id, { role: "blocked" });
            router.back();
          },
        },
      ]
    );
  };

  const joinedAt = new Date(agent.joinedAt).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const roleBadge = { bg: ROLE_BADGE_BG[agent.role], fg: ROLE_BADGE_FG[agent.role] };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Dark header ── */}
        <View style={s.darkHdr}>
          <View style={s.navRow}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <ChevronLeft size={16} color="rgba(255,255,255,0.5)" />
              <Text style={s.backTxt}>Agents</Text>
            </Pressable>
            <Pressable style={s.iconBtn}>
              <MoreHorizontal size={15} color="white" />
            </Pressable>
          </View>

          <View style={s.hdrCenter}>
            <View style={s.hdrAvatarWrap}>
              <View style={[s.hdrAvatar, { backgroundColor: T.orangeLt }]}>
                <Text style={[s.hdrAvatarText, { color: T.orangeDk }]}>{getInitials(agent.name)}</Text>
              </View>
              <View style={[s.dot, agent.online ? s.dotOnline : s.dotOffline]} />
            </View>
            <Text style={s.hdrName}>{agent.name}</Text>
            <Text style={s.hdrPhone}>{agent.phone}</Text>
            <View style={s.badgeRow}>
              <View style={[s.pill, { backgroundColor: roleBadge.bg }]}>
                <Text style={[s.pillTxt, { color: roleBadge.fg }]}>{ROLE_LABEL[agent.role]}</Text>
              </View>
              {agent.online && (
                <View style={s.pillOnline}>
                  <Text style={s.pillOnlineTxt}>● En ligne</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.statsStrip}>
            <View style={s.statCell}>
              <Text style={s.statVal}>{agent.stats.clients}</Text>
              <Text style={s.statLbl}>Clients</Text>
            </View>
            <View style={[s.statCell, s.statBorder]}>
              <Text style={s.statVal}>{agent.stats.transactions}</Text>
              <Text style={s.statLbl}>Transactions</Text>
            </View>
            <View style={[s.statCell, s.statBorder]}>
              <Text style={s.statVal}>{agent.stats.collected}</Text>
              <Text style={s.statLbl}>FCFA collectés</Text>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>
          <Text style={s.secTitle}>Informations</Text>
          <View style={s.card}>
            <Row label="Nom complet" value={agent.name} />
            <RowDivider />
            <Row label="Téléphone" value={agent.phone} valueStyle={{ color: T.orange }} />
            <RowDivider />
            <Row label="Rôle" value={ROLE_LABEL[agent.role]} />
            <RowDivider />
            <Row label="Inscrit le" value={joinedAt} />
            <RowDivider />
            <Row label="Réf." value={agent.ref} valueStyle={{ fontSize: 11, color: T.text3 }} />
          </View>

          <Text style={s.secTitle}>Permissions actives</Text>
          {!myPerms.manageAgents && (
            <View style={{ backgroundColor: "#fff3cd", borderRadius: 8, padding: 10, marginBottom: 8, marginHorizontal: 0 }}>
              <Text style={{ fontSize: 12, color: "#856404" }}>🔒 Lecture seule — vous ne pouvez pas modifier les permissions.</Text>
            </View>
          )}
          <View style={s.permCard}>
            {PERM_KEYS.map((p, i) => (
              <View key={p.key} style={[s.permRow, i < PERM_KEYS.length - 1 && s.permBorder]}>
                <Text style={s.permLabel}>{p.label}</Text>
                <Switch
                  value={perms[p.key]}
                  onValueChange={() => { if (myPerms.manageAgents) togglePerm(p.key); }}
                  trackColor={{ false: T.border2, true: T.orange }}
                  thumbColor="white"
                  disabled={!myPerms.manageAgents}
                />
              </View>
            ))}
          </View>

          {myPerms.manageAgents && (
            <Pressable style={s.btnPin} onPress={() => { setPinInput(""); setPinModalVisible(true); }}>
              <KeyRound size={14} color={T.orange} />
              <Text style={s.btnPinTxt}>Définir le PIN</Text>
            </Pressable>
          )}

          <View style={s.actionRow}>
            <Pressable
              style={[s.btnBlock, !myPerms.manageAgents && { opacity: 0.4 }]}
              onPress={myPerms.manageAgents ? handleBlock : undefined}
            >
              <Text style={s.btnBlockTxt}>Bloquer l'agent</Text>
            </Pressable>
            <Pressable style={s.btnEdit}>
              <Text style={s.btnEditTxt}>Modifier →</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <Modal visible={pinModalVisible} transparent animationType="slide" onRequestClose={() => setPinModalVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setPinModalVisible(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Définir le PIN</Text>
            <Text style={s.modalSub}>{agent.name}</Text>
            <View style={s.pinDots}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[s.dot2, i < pinInput.length && s.dot2Filled]} />
              ))}
            </View>
            {pinSaving ? (
              <ActivityIndicator color={T.orange} style={{ marginVertical: 32 }} />
            ) : (
              <Numpad onPress={handlePinDigit} onDelete={() => setPinInput((p) => p.slice(0, -1))} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={s.revRow}>
      <Text style={s.revLabel}>{label}</Text>
      <Text style={[s.revValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function RowDivider() {
  return <View style={s.rowDiv} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: T.bg },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },

  darkHdr:       { backgroundColor: "#1a1a18", paddingBottom: 20 },
  navRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 10, marginBottom: 18 },
  backBtn:       { flexDirection: "row", alignItems: "center", gap: 4 },
  backTxt:       { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  iconBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },

  hdrCenter:     { alignItems: "center", gap: 8 },
  hdrAvatarWrap: { position: "relative" },
  hdrAvatar:     { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.12)" },
  hdrAvatarText: { fontSize: 20, fontWeight: "600" },
  dot:           { position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#1a1a18" },
  dotOnline:     { backgroundColor: T.green },
  dotOffline:    { backgroundColor: T.text3 },
  hdrName:       { fontSize: 18, fontWeight: "600", color: "white" },
  hdrPhone:      { fontSize: 12, color: "rgba(255,255,255,0.45)" },
  badgeRow:      { flexDirection: "row", gap: 6, marginTop: 2 },
  pill:          { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  pillTxt:       { fontSize: 10 },
  pillOnline:    { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: "rgba(59,109,17,0.3)" },
  pillOnlineTxt: { fontSize: 10, color: "#97c459" },

  statsStrip:    { flexDirection: "row", marginHorizontal: 18, marginTop: 18, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  statCell:      { flex: 1, paddingVertical: 11, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  statBorder:    { borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.08)" },
  statVal:       { fontSize: 16, fontWeight: "600", color: "white" },
  statLbl:       { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },

  body:          { padding: 18 },
  secTitle:      { fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },

  card:          { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
  revRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  revLabel:      { fontSize: 12, color: T.text2 },
  revValue:      { fontSize: 13, fontWeight: "500", color: T.text1 },
  rowDiv:        { height: 0.5, backgroundColor: T.border },

  permCard:      { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
  permRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  permBorder:    { borderBottomWidth: 0.5, borderBottomColor: T.border },
  permLabel:     { fontSize: 13, color: T.text1 },

  actionRow:     { flexDirection: "row", gap: 8, marginTop: 20 },
  btnBlock:      { flex: 1, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: "rgba(162,45,45,0.3)", backgroundColor: "#fcebeb", alignItems: "center" },
  btnBlockTxt:   { fontSize: 12, fontWeight: "500", color: T.textDanger },
  btnEdit:       { flex: 1, padding: 12, borderRadius: 12, backgroundColor: T.orange, alignItems: "center" },
  btnEditTxt:    { fontSize: 12, fontWeight: "500", color: "white" },

  btnPin:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: T.orange, backgroundColor: T.orangeLt, marginTop: 12 },
  btnPinTxt:     { fontSize: 12, fontWeight: "500", color: T.orange },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 32 },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border2, alignSelf: "center", marginBottom: 16 },
  modalTitle:    { fontSize: 16, fontWeight: "600", color: T.text1, textAlign: "center", marginBottom: 4 },
  modalSub:      { fontSize: 12, color: T.text3, textAlign: "center", marginBottom: 24 },
  pinDots:       { flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: 24 },
  dot2:          { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: T.border2, backgroundColor: "transparent" },
  dot2Filled:    { backgroundColor: T.orange, borderColor: T.orange },
});
