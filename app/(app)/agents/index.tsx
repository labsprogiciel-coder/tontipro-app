// app/(app)/agents/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Search, ChevronRight, ChevronLeft } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAgentStore, Agent, AgentRole } from "@/stores/agent-store";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  {
    label: string;
    avatarBg: string;
    avatarFg: string;
    badgeBg: string;
    badgeFg: string;
  }
> = {
  field_agent: {
    label: "Agent de terrain",
    avatarBg: "#e6f1fb",
    avatarFg: "#185fa5",
    badgeBg: "#e6f1fb",
    badgeFg: "#185fa5",
  },
  supervisor: {
    label: "Superviseur",
    avatarBg: "#edf7ee",
    avatarFg: "#1e6b2e",
    badgeBg: "#edf7ee",
    badgeFg: "#1e6b2e",
  },
  accountant: {
    label: "Comptable",
    avatarBg: "#f3eeff",
    avatarFg: "#5b2db5",
    badgeBg: "#f3eeff",
    badgeFg: "#5b2db5",
  },
  admin: {
    label: "Administrateur",
    avatarBg: T.orangeLt,
    avatarFg: T.orangeDk,
    badgeBg: T.orangeLt,
    badgeFg: T.orangeDk,
  },
  it_admin: {
    label: "Admin IT",
    avatarBg: "#fef3e2",
    avatarFg: "#7c4d00",
    badgeBg: "#fef3e2",
    badgeFg: "#7c4d00",
  },
};

/** Display order for role sections */
const ROLE_ORDER: AgentRole[] = [
  "admin",
  "supervisor",
  "accountant",
  "field_agent",
  "it_admin",
];

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({ agent, onPress }: { agent: Agent; onPress: () => void }) {
  const meta = ROLE_META[agent.role];
  const isSuspended = agent.status === "suspended";
  const isInvited = agent.status === "invited";

  return (
    <Pressable
      style={({ pressed }) => [
        s.card,
        pressed && s.pressed,
        isSuspended && s.cardSuspended,
      ]}
      onPress={onPress}
    >
      <View style={[s.avatar, { backgroundColor: meta.avatarBg }]}>
        <Text style={[s.avatarText, { color: meta.avatarFg }]}>
          {getInitials(agent.fullName)}
        </Text>
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

      <View style={s.info}>
        <Text style={s.name}>{agent.fullName}</Text>
        <View style={[s.badge, { backgroundColor: meta.badgeBg }]}>
          <Text style={[s.badgeText, { color: meta.badgeFg }]}>
            {meta.label}
          </Text>
        </View>
        <Text style={s.phone}>{agent.phoneNumber}</Text>
      </View>

      <View style={s.right}>
        {isInvited && <Text style={s.invitedTag}>En attente</Text>}
        {isSuspended && <Text style={s.suspendedTag}>Suspendu</Text>}
        <ChevronRight size={14} color={T.text3} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AgentsScreen() {
  const router = useRouter();
  const { agents, isLoading, loadAgents } = useAgentStore();
  const [query, setQuery] = useState("");

  // Gate: only admin or supervisor can reach this screen
  const me = useQuery(api.users.currentUser);
  const canAccess = me?.role === "admin" || me?.role === "supervisor";

  useEffect(() => {
    if (me?.branchId) {
      loadAgents(me.branchId);
    }
  }, [me?.branchId]);

  if (me === undefined) {
    // Still loading current user
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator color={T.orange} />
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccess) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: T.text1,
              marginBottom: 6,
            }}
          >
            Accès refusé
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: T.text3,
              textAlign: "center",
              paddingHorizontal: 32,
            }}
          >
            Seuls les administrateurs et superviseurs peuvent gérer les agents.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filtered = query.trim()
    ? agents.filter(
        (a) =>
          a.fullName.toLowerCase().includes(query.toLowerCase()) ||
          a.phoneNumber.includes(query) ||
          a.email.toLowerCase().includes(query.toLowerCase()),
      )
    : agents;

  const total = agents.length;
  const online = agents.filter((a) => a.online).length;
  const suspended = agents.filter((a) => a.status === "suspended").length;

  // Group by role in display order, skip empty groups
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_META[role].label + "s",
    items: filtered.filter((a) => a.role === role && a.status !== "suspended"),
  })).filter((g) => g.items.length > 0);

  const suspendedAgents = filtered.filter((a) => a.status === "suspended");

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Top bar */}
      <View style={s.topbar}>
        <View style={s.topbarLeft}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={18} color={T.text2} strokeWidth={2} />
          </Pressable>
          <Text style={s.pageTitle}>Agents</Text>
        </View>
        <Pressable
          style={s.addBtn}
          // @ts-ignore
          onPress={() => router.push("/(app)/agents/add")}
        >
          <Plus size={16} color="white" />
        </Pressable>
      </View>

      {/* Summary strip */}
      <View style={s.strip}>
        <View style={s.stripCell}>
          <Text style={s.stripVal}>{total}</Text>
          <Text style={s.stripLbl}>Total</Text>
        </View>
        <View style={[s.stripCell, s.stripCellBorder]}>
          <Text style={[s.stripVal, { color: T.textSuccess }]}>{online}</Text>
          <Text style={s.stripLbl}>En ligne</Text>
        </View>
        <View style={[s.stripCell, s.stripCellBorder]}>
          <Text style={[s.stripVal, { color: T.textDanger }]}>{suspended}</Text>
          <Text style={s.stripLbl}>Suspendu</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={14} color={T.text3} />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher un agent…"
            placeholderTextColor={T.text3}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {isLoading && agents.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator color={T.orange} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {grouped.map(({ role, label, items }) => (
            <React.Fragment key={role}>
              <Text style={s.secLbl}>{label}</Text>
              {items.map((a) => (
                <AgentCard
                  key={a._id}
                  agent={a}
                  // @ts-ignore
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/agents/[id]",
                      params: { id: a._id },
                    })
                  }
                />
              ))}
            </React.Fragment>
          ))}

          {suspendedAgents.length > 0 && (
            <>
              <Text style={s.secLbl}>Accès suspendu</Text>
              {suspendedAgents.map((a) => (
                <AgentCard
                  key={a._id}
                  agent={a}
                  // @ts-ignore
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/agents/[id]",
                      params: { id: a._id },
                    })
                  }
                />
              ))}
            </>
          )}

          {agents.length === 0 && !isLoading && (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Aucun agent enregistré</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: T.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  topbarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.3,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.orange,
    alignItems: "center",
    justifyContent: "center",
  },

  strip: {
    flexDirection: "row",
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  stripCell: { flex: 1, paddingVertical: 10, alignItems: "center" },
  stripCellBorder: { borderLeftWidth: 0.5, borderLeftColor: T.border },
  stripVal: { fontSize: 15, fontWeight: "600", color: T.text1 },
  stripLbl: { fontSize: 10, color: T.text3, marginTop: 1 },

  searchWrap: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: T.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.text1 },

  secLbl: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 5,
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    backgroundColor: T.bg3,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: T.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  cardSuspended: { opacity: 0.6 },
  pressed: { backgroundColor: T.bg2 },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: { fontSize: 14, fontWeight: "600" },
  dot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: T.bg,
  },
  dotOnline: { backgroundColor: T.green },
  dotOffline: { backgroundColor: T.text3 },
  dotDanger: { backgroundColor: T.textDanger },
  dotInvited: { backgroundColor: T.textWarning },

  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: "500", color: T.text1 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: { fontSize: 10 },
  phone: { fontSize: 11, color: T.text3 },

  right: { alignItems: "flex-end", gap: 4 },
  invitedTag: { fontSize: 10, color: T.textWarning },
  suspendedTag: { fontSize: 10, color: T.textDanger },

  empty: { paddingVertical: 48, alignItems: "center" },
  emptyTxt: { fontSize: 13, color: T.text3 },
});
