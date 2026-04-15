import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { mockAgents } from "@/__dev__/mocks/agents";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentRole = "admin" | "agent" | "blocked";

interface AgentDetail {
  id: string;
  initials: string;
  name: string;
  role: AgentRole;
  phone: string;
  zone: string;
  ref: string;
  joinedAt: string;
  online: boolean;
  stats: { clients: number; transactions: number; collected: string };
  permissions: { label: string; enabled: boolean }[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PERM_LABELS = [
  "Ajouter un client",
  "Effectuer un dépôt",
  "Effectuer un retrait",
  "Exporter les rapports",
  "Gérer les agents",
] as const;

function mockToDetail(a: (typeof mockAgents)[number]): AgentDetail {
  return {
    id: a.id,
    initials: a.initials,
    name: a.name,
    role: a.role,
    phone: a.phone,
    zone: a.zone,
    ref: a.ref,
    joinedAt: new Date(a.joinedAt).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    }),
    online: a.online,
    stats: a.stats,
    permissions: [
      { label: "Ajouter un client",     enabled: a.permissions.addClient     },
      { label: "Effectuer un dépôt",    enabled: a.permissions.deposit       },
      { label: "Effectuer un retrait",  enabled: a.permissions.withdrawal    },
      { label: "Exporter les rapports", enabled: a.permissions.exportReports },
      { label: "Gérer les agents",      enabled: a.permissions.manageAgents  },
    ],
  };
}

const AGENTS_MAP: Record<string, AgentDetail> = Object.fromEntries(
  mockAgents.map((a) => [a.id, mockToDetail(a)])
);

const ROLE_LABEL: Record<AgentRole, string> = {
  admin:   "Administrateur",
  agent:   "Agent",
  blocked: "Bloqué",
};
const ROLE_BADGE_BG: Record<AgentRole, string>  = { admin: T.orangeLt, agent: "#e6f1fb", blocked: "#fcebeb" };
const ROLE_BADGE_FG: Record<AgentRole, string>  = { admin: T.orangeDk, agent: "#185fa5", blocked: T.textDanger };

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const agent = AGENTS_MAP[id ?? ""] ?? AGENTS_MAP["AGT002"];

  const [perms, setPerms] = useState(agent.permissions.map((p) => ({ ...p })));

  const togglePerm = (i: number) => {
    setPerms((prev) => prev.map((p, idx) => idx === i ? { ...p, enabled: !p.enabled } : p));
  };

  const handleBlock = () => {
    Alert.alert(
      "Bloquer l'agent",
      `Voulez-vous bloquer ${agent.name} ? Il ne pourra plus se connecter.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Bloquer", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  const isOnline  = agent.online;
  const roleBadge = { bg: ROLE_BADGE_BG[agent.role], fg: ROLE_BADGE_FG[agent.role] };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Dark header ── */}
        <View style={s.darkHdr}>
          {/* Nav row */}
          <View style={s.navRow}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <ChevronLeft size={16} color="rgba(255,255,255,0.5)" />
              <Text style={s.backTxt}>Agents</Text>
            </Pressable>
            <Pressable style={s.iconBtn}>
              <MoreHorizontal size={15} color="white" />
            </Pressable>
          </View>

          {/* Avatar + name */}
          <View style={s.hdrCenter}>
            <View style={s.hdrAvatarWrap}>
              <View style={[s.hdrAvatar, { backgroundColor: T.orangeLt }]}>
                <Text style={[s.hdrAvatarText, { color: T.orangeDk }]}>{agent.initials}</Text>
              </View>
              <View style={[s.dot, isOnline ? s.dotOnline : s.dotOffline]} />
            </View>
            <Text style={s.hdrName}>{agent.name}</Text>
            <Text style={s.hdrPhone}>{agent.phone}</Text>
            <View style={s.badgeRow}>
              <View style={[s.pill, { backgroundColor: roleBadge.bg }]}>
                <Text style={[s.pillTxt, { color: roleBadge.fg }]}>{ROLE_LABEL[agent.role]}</Text>
              </View>
              {isOnline && (
                <View style={s.pillOnline}>
                  <Text style={s.pillOnlineTxt}>● En ligne</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats strip */}
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
          {/* Info section */}
          <Text style={s.secTitle}>Informations</Text>
          <View style={s.card}>
            <Row label="Nom complet" value={agent.name} />
            <RowDivider />
            <Row label="Téléphone" value={agent.phone} valueStyle={{ color: T.orange }} />
            <RowDivider />
            <Row label="Rôle" value={ROLE_LABEL[agent.role]} />
            <RowDivider />
            <Row label="Inscrit le" value={agent.joinedAt} />
            <RowDivider />
            <Row label="Réf." value={agent.ref} valueStyle={{ fontSize: 11, color: T.text3 }} />
          </View>

          {/* Permissions */}
          <Text style={s.secTitle}>Permissions actives</Text>
          <View style={s.permCard}>
            {perms.map((p, i) => (
              <View key={p.label} style={[s.permRow, i < perms.length - 1 && s.permBorder]}>
                <Text style={s.permLabel}>{p.label}</Text>
                <Switch
                  value={p.enabled}
                  onValueChange={() => togglePerm(i)}
                  trackColor={{ false: T.border2, true: T.orange }}
                  thumbColor="white"
                />
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={s.actionRow}>
            <Pressable style={s.btnBlock} onPress={handleBlock}>
              <Text style={s.btnBlockTxt}>Bloquer l'agent</Text>
            </Pressable>
            <Pressable style={s.btnEdit}>
              <Text style={s.btnEditTxt}>Modifier →</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
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
});
