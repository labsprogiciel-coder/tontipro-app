// app/(app)/agents/[id].tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal, KeyRound } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAgentStore, AgentRole } from "@/stores/agent-store";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Numpad } from "@/app/components/ui/numpad";

import { SPACE } from "@/constants/spacing";
// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Role display config ───────────────────────────────────────────────────────

const ROLE_META: Record<
  AgentRole,
  { label: string; badgeBg: string; badgeFg: string }
> = {
  field_agent: {
    label: "Agent de terrain",
    badgeBg: "#e6f1fb",
    badgeFg: "#185fa5",
  },
  supervisor: { label: "Superviseur", badgeBg: "#edf7ee", badgeFg: "#1e6b2e" },
  accountant: { label: "Comptable", badgeBg: "#f3eeff", badgeFg: "#5b2db5" },
  admin: { label: "Administrateur", badgeBg: T.orangeLt, badgeFg: T.orangeDk },
  it_admin: { label: "Admin IT", badgeBg: "#fef3e2", badgeFg: "#7c4d00" },
};

/** Roles that can be assigned — shown as options in the role picker */
const ROLE_OPTIONS: AgentRole[] = [
  "field_agent",
  "supervisor",
  "accountant",
  "admin",
  "it_admin",
];

// Role → capability table rows
const CAPABILITY_ROWS: { label: string; roles: AgentRole[] }[] = [
  { label: "Collecte", roles: ["field_agent", "supervisor", "admin"] },
  {
    label: "Enregistrer clients",
    roles: ["field_agent", "supervisor", "admin"],
  },
  {
    label: "Approuver décaissements",
    roles: ["supervisor", "accountant", "admin"],
  },
  { label: "Lier des terminaux", roles: ["supervisor", "admin", "it_admin"] },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useQuery(api.users.currentUser);
  const { getAgentById, updateAgent, suspendAgent, setAgentPin } =
    useAgentStore();

  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const agent = getAgentById(id as Id<"users">);

  const canManage = me?.role === "admin" || me?.role === "supervisor";

  if (!agent) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator color={T.orange} />
        </View>
      </SafeAreaView>
    );
  }

  const meta = ROLE_META[agent.role];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRoleChange = async (newRole: AgentRole) => {
    setRolePickerVisible(false);
    if (newRole === agent.role) return;
    setIsSaving(true);
    try {
      await updateAgent(agent._id, { role: newRole });
    } catch (err) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de changer le rôle.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePinDigit = async (digit: string) => {
    if (pinSaving) return;
    const next = pinInput.length < 4 ? pinInput + digit : pinInput;
    setPinInput(next);
    if (next.length === 4) {
      setPinSaving(true);
      try {
        await setAgentPin(agent._id, agent.phoneNumber, next);
        setPinModalVisible(false);
        setPinInput("");
        Alert.alert(
          "PIN défini",
          `Le PIN de ${agent.fullName} a été mis à jour.`,
        );
      } catch {
        Alert.alert("Erreur", "Impossible de définir le PIN.");
        setPinInput("");
      } finally {
        setPinSaving(false);
      }
    }
  };

  const handleSuspend = () => {
    Alert.alert(
      "Suspendre l'agent",
      `Voulez-vous suspendre ${agent.fullName} ? Il ne pourra plus se connecter.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Suspendre",
          style: "destructive",
          onPress: async () => {
            try {
              await suspendAgent(agent._id);
              router.back();
            } catch (err) {
              Alert.alert(
                "Erreur",
                err instanceof Error ? err.message : "Impossible de suspendre.",
              );
            }
          },
        },
      ],
    );
  };

  const isSuspended = agent.status === "suspended";
  const isInvited = agent.status === "invited";

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
                <Text style={[s.hdrAvatarText, { color: T.orangeDk }]}>
                  {getInitials(agent.fullName)}
                </Text>
              </View>
              <View
                style={[
                  s.dot,
                  isSuspended
                    ? s.dotDanger
                    : isInvited
                      ? s.dotInvited
                      : agent.online
                        ? s.dotOnline
                        : s.dotOffline,
                ]}
              />
            </View>
            <Text style={s.hdrName}>{agent.fullName}</Text>
            <Text style={s.hdrPhone}>{agent.phoneNumber}</Text>
            <View style={s.badgeRow}>
              <View style={[s.pill, { backgroundColor: meta.badgeBg }]}>
                <Text style={[s.pillTxt, { color: meta.badgeFg }]}>
                  {meta.label}
                </Text>
              </View>
              {isInvited && (
                <View
                  style={[s.pill, { backgroundColor: "rgba(133,79,11,0.15)" }]}
                >
                  <Text style={[s.pillTxt, { color: T.textWarning }]}>
                    ● En attente d&apos;activation
                  </Text>
                </View>
              )}
              {agent.online && !isSuspended && !isInvited && (
                <View style={s.pillOnline}>
                  <Text style={s.pillOnlineTxt}>● En ligne</Text>
                </View>
              )}
              {isSuspended && (
                <View style={[s.pill, { backgroundColor: "#fcebeb" }]}>
                  <Text style={[s.pillTxt, { color: T.textDanger }]}>
                    Suspendu
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>
          <Text style={s.secTitle}>Informations</Text>
          <View style={s.card}>
            <Row label="Nom complet" value={agent.fullName} />
            <RowDivider />
            <Row
              label="Téléphone"
              value={agent.phoneNumber}
              valueStyle={{ color: T.orange }}
            />
            <RowDivider />
            <Row label="E-mail" value={agent.email} />
            <RowDivider />
            <Row
              label="Statut"
              value={
                isSuspended
                  ? "Suspendu"
                  : isInvited
                    ? "Invitation envoyée"
                    : "Actif"
              }
            />
            <RowDivider />
            <Row
              label="ID Convex"
              value={agent._id}
              valueStyle={{ fontSize: 11, color: T.text3 }}
            />
          </View>

          {/* Role */}
          <Text style={s.secTitle}>Rôle</Text>
          {!canManage && (
            <View style={s.readonlyBanner}>
              <Text style={s.readonlyTxt}>
                🔒 Lecture seule — vous ne pouvez pas modifier le rôle.
              </Text>
            </View>
          )}
          <Pressable
            style={[s.roleRow, !canManage && { opacity: 0.6 }]}
            onPress={canManage ? () => setRolePickerVisible(true) : undefined}
            disabled={!canManage || isSaving}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.roleRowLabel}>Rôle actuel</Text>
              <Text style={[s.roleRowValue, { color: meta.badgeFg }]}>
                {meta.label}
              </Text>
            </View>
            {canManage &&
              (isSaving ? (
                <ActivityIndicator size="small" color={T.orange} />
              ) : (
                <Text style={s.roleRowChange}>Changer →</Text>
              ))}
          </Pressable>

          {/* Capability table for current role */}
          <Text style={s.secTitle}>Capacités du rôle</Text>
          <View style={s.capCard}>
            {CAPABILITY_ROWS.map((row, i) => {
              const has = row.roles.includes(agent.role);
              return (
                <View
                  key={row.label}
                  style={[
                    s.capRow,
                    i < CAPABILITY_ROWS.length - 1 && s.capBorder,
                  ]}
                >
                  <Text style={s.capLabel}>{row.label}</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: has ? T.textSuccess : T.text3,
                    }}
                  >
                    {has ? "✓" : "—"}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Actions */}
          {canManage && (
            <Pressable
              style={s.btnPin}
              onPress={() => {
                setPinInput("");
                setPinModalVisible(true);
              }}
            >
              <KeyRound size={14} color={T.orange} />
              <Text style={s.btnPinTxt}>Définir le PIN</Text>
            </Pressable>
          )}

          <View style={s.actionRow}>
            {!isSuspended && (
              <Pressable
                style={[s.btnSuspend, !canManage && { opacity: 0.4 }]}
                onPress={canManage ? handleSuspend : undefined}
              >
                <Text style={s.btnSuspendTxt}>Suspendre l&apos;agent</Text>
              </Pressable>
            )}
            <Pressable
              style={[s.btnEdit, isSuspended && { flex: 2 }]}
              onPress={canManage ? () => setRolePickerVisible(true) : undefined}
              disabled={!canManage}
            >
              <Text style={s.btnEditTxt}>Modifier →</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ── Role picker modal ── */}
      <Modal
        visible={rolePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRolePickerVisible(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setRolePickerVisible(false)}
        >
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Changer le rôle</Text>
            <Text style={s.modalSub}>{agent.fullName}</Text>
            <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.sm, paddingBottom: SPACE.xl }}>
              {ROLE_OPTIONS.map((r) => {
                const m = ROLE_META[r];
                const active = agent.role === r;
                return (
                  <Pressable
                    key={r}
                    style={[s.rolePill, active && s.rolePillActive]}
                    onPress={() => handleRoleChange(r)}
                  >
                    <Text
                      style={[s.rolePillTxt, active && { color: T.orangeDk }]}
                    >
                      {m.label}
                    </Text>
                    {active && (
                      <Text style={{ fontSize: 11, color: T.orange }}>
                        ✓ Actuel
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── PIN modal ── */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setPinModalVisible(false)}
        >
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Définir le PIN</Text>
            <Text style={s.modalSub}>{agent.fullName}</Text>
            <View style={s.pinDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[s.dot2, i < pinInput.length && s.dot2Filled]}
                />
              ))}
            </View>
            {pinSaving ? (
              <ActivityIndicator
                color={T.orange}
                style={{ marginVertical: SPACE.xxl }}
              />
            ) : (
              <Numpad
                onPress={handlePinDigit}
                onDelete={() => setPinInput((p) => p.slice(0, -1))}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={s.revRow}>
      <Text style={s.revLabel}>{label}</Text>
      <Text style={[s.revValue, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function RowDivider() {
  return <View style={s.rowDiv} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  darkHdr: { backgroundColor: "#1a1a18", paddingBottom: SPACE.xl },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    marginBottom: SPACE.lg,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  backTxt: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  hdrCenter: { alignItems: "center", gap: SPACE.sm },
  hdrAvatarWrap: { position: "relative" },
  hdrAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hdrAvatarText: { fontSize: 20, fontWeight: "600" },
  dot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#1a1a18",
  },
  dotOnline: { backgroundColor: T.green },
  dotOffline: { backgroundColor: T.text3 },
  dotDanger: { backgroundColor: T.textDanger },
  dotInvited: { backgroundColor: T.textWarning },
  hdrName: { fontSize: 18, fontWeight: "600", color: "white" },
  hdrPhone: { fontSize: 12, color: "rgba(255,255,255,0.45)" },
  badgeRow: {
    flexDirection: "row",
    gap: SPACE.xs,
    marginTop: SPACE.xxs,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: 20 },
  pillTxt: { fontSize: 10 },
  pillOnline: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
    backgroundColor: "rgba(59,109,17,0.3)",
  },
  pillOnlineTxt: { fontSize: 10, color: "#97c459" },

  body: { padding: SPACE.lg },
  secTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACE.sm,
    marginTop: SPACE.lg,
  },

  card: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  revRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  revLabel: { fontSize: 12, color: T.text2 },
  revValue: {
    fontSize: 13,
    fontWeight: "500",
    color: T.text1,
    flexShrink: 1,
    marginLeft: SPACE.lg,
    textAlign: "right",
  },
  rowDiv: { height: 0.5, backgroundColor: T.border },

  readonlyBanner: {
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  readonlyTxt: { fontSize: 12, color: "#856404" },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  roleRowLabel: { fontSize: 11, color: T.text3, marginBottom: SPACE.xxs },
  roleRowValue: { fontSize: 14, fontWeight: "600" },
  roleRowChange: { fontSize: 12, color: T.orange, fontWeight: "500" },

  capCard: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  capRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  capBorder: { borderBottomWidth: 0.5, borderBottomColor: T.border },
  capLabel: { fontSize: 13, color: T.text1 },

  actionRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.lg },
  btnSuspend: {
    flex: 1,
    padding: SPACE.md,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(162,45,45,0.3)",
    backgroundColor: "#fcebeb",
    alignItems: "center",
  },
  btnSuspendTxt: { fontSize: 12, fontWeight: "500", color: T.textDanger },
  btnEdit: {
    flex: 1,
    padding: SPACE.md,
    borderRadius: 12,
    backgroundColor: T.orange,
    alignItems: "center",
  },
  btnEditTxt: { fontSize: 12, fontWeight: "500", color: "white" },

  btnPin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    padding: SPACE.md,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: T.orange,
    backgroundColor: T.orangeLt,
    marginTop: SPACE.md,
  },
  btnPinTxt: { fontSize: 12, fontWeight: "500", color: T.orange },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xxl,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border2,
    alignSelf: "center",
    marginBottom: SPACE.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: T.text1,
    textAlign: "center",
    marginBottom: SPACE.xs,
  },
  modalSub: {
    fontSize: 12,
    color: T.text3,
    textAlign: "center",
    marginBottom: SPACE.lg,
  },

  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  rolePillActive: { borderColor: T.orange, backgroundColor: T.orangeLt },
  rolePillTxt: { fontSize: 14, fontWeight: "500", color: T.text1 },

  pinDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.md,
    marginBottom: SPACE.xl,
  },
  dot2: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: T.border2,
    backgroundColor: "transparent",
  },
  dot2Filled: { backgroundColor: T.orange, borderColor: T.orange },
});
