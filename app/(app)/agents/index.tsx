import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Search, ChevronRight } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAgentStore } from "@/stores/agent-store";
import { Agent, AgentRole } from "@/types/agent";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Avatar colours per role ───────────────────────────────────────────────────

const AVATAR_BG: Record<AgentRole, string> = {
  admin:   T.orangeLt,
  agent:   "#e6f1fb",
  blocked: "#fcebeb",
};
const AVATAR_FG: Record<AgentRole, string> = {
  admin:   T.orangeDk,
  agent:   "#185fa5",
  blocked: T.textDanger,
};

const BADGE_STYLE: Record<AgentRole, { bg: string; fg: string; label: string }> = {
  admin:   { bg: T.orangeLt,  fg: T.orangeDk,   label: "Administrateur" },
  agent:   { bg: "#e6f1fb",   fg: "#185fa5",     label: "Agent"          },
  blocked: { bg: "#fcebeb",   fg: T.textDanger,  label: "Bloqué"         },
};

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({ agent, onPress }: { agent: Agent; onPress: () => void }) {
  const avBg  = AVATAR_BG[agent.role];
  const avFg  = AVATAR_FG[agent.role];
  const badge = BADGE_STYLE[agent.role];

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.pressed, agent.role === "blocked" && s.cardBlocked]}
      onPress={onPress}
    >
      <View style={[s.avatar, { backgroundColor: avBg }]}>
        <Text style={[s.avatarText, { color: avFg }]}>{getInitials(agent.name)}</Text>
        <View style={[s.dot, agent.online ? s.dotOnline : s.dotOffline,
          agent.role === "blocked" && s.dotDanger]} />
      </View>

      <View style={s.info}>
        <Text style={s.name}>{agent.name}</Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}>
          <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        <Text style={s.phone}>{agent.phone}</Text>
      </View>

      <View style={s.right}>
        <Text style={s.clientCount}>{agent.stats.clients}</Text>
        <Text style={s.clientSub}>clients</Text>
        <ChevronRight size={14} color={T.text3} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AgentsScreen() {
  const router  = useRouter();
  const agents  = useAgentStore((s) => s.agents);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.phone.includes(query)
      )
    : agents;

  const admins  = filtered.filter((a) => a.role === "admin");
  const field   = filtered.filter((a) => a.role === "agent");
  const blocked = filtered.filter((a) => a.role === "blocked");

  const total    = agents.length;
  const online   = agents.filter((a) => a.online).length;
  const nBlocked = agents.filter((a) => a.role === "blocked").length;

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Top bar */}
      <View style={s.topbar}>
        <Text style={s.pageTitle}>Agents</Text>
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
          <Text style={s.stripLbl}>Total agents</Text>
        </View>
        <View style={[s.stripCell, s.stripCellBorder]}>
          <Text style={[s.stripVal, { color: T.textSuccess }]}>{online}</Text>
          <Text style={s.stripLbl}>En ligne</Text>
        </View>
        <View style={[s.stripCell, s.stripCellBorder]}>
          <Text style={[s.stripVal, { color: T.textDanger }]}>{nBlocked}</Text>
          <Text style={s.stripLbl}>Bloqué</Text>
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {admins.length > 0 && (
          <>
            <Text style={s.secLbl}>Administrateurs</Text>
            {admins.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                // @ts-ignore
                onPress={() => router.push({ pathname: "/(app)/agents/[id]", params: { id: a.id } })}
              />
            ))}
          </>
        )}

        {field.length > 0 && (
          <>
            <Text style={s.secLbl}>Agents de terrain</Text>
            {field.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                // @ts-ignore
                onPress={() => router.push({ pathname: "/(app)/agents/[id]", params: { id: a.id } })}
              />
            ))}
          </>
        )}

        {blocked.length > 0 && (
          <>
            <Text style={s.secLbl}>Accès restreint</Text>
            {blocked.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                // @ts-ignore
                onPress={() => router.push({ pathname: "/(app)/agents/[id]", params: { id: a.id } })}
              />
            ))}
          </>
        )}

        {agents.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTxt}>Aucun agent enregistré</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.bg3 },
  topbar:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: T.bg, borderBottomWidth: 0.5, borderBottomColor: T.border },
  pageTitle:       { fontSize: 18, fontWeight: "600", color: T.text1, letterSpacing: -0.3 },
  addBtn:          { width: 34, height: 34, borderRadius: 17, backgroundColor: T.orange, alignItems: "center", justifyContent: "center" },

  strip:           { flexDirection: "row", backgroundColor: T.bg2, borderBottomWidth: 0.5, borderBottomColor: T.border },
  stripCell:       { flex: 1, paddingVertical: 10, alignItems: "center" },
  stripCellBorder: { borderLeftWidth: 0.5, borderLeftColor: T.border },
  stripVal:        { fontSize: 15, fontWeight: "600", color: T.text1 },
  stripLbl:        { fontSize: 10, color: T.text3, marginTop: 1 },

  searchWrap:      { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: T.bg, borderBottomWidth: 0.5, borderBottomColor: T.border },
  searchBar:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput:     { flex: 1, fontSize: 13, color: T.text1 },

  secLbl:          { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 5, fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5, backgroundColor: T.bg3 },

  card:            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: T.bg, borderBottomWidth: 0.5, borderBottomColor: T.border },
  cardBlocked:     { opacity: 0.7 },
  pressed:         { backgroundColor: T.bg2 },

  avatar:          { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarText:      { fontSize: 14, fontWeight: "600" },
  dot:             { position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: T.bg },
  dotOnline:       { backgroundColor: T.green },
  dotOffline:      { backgroundColor: T.text3 },
  dotDanger:       { backgroundColor: T.textDanger },

  info:            { flex: 1, gap: 3 },
  name:            { fontSize: 14, fontWeight: "500", color: T.text1 },
  badge:           { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  badgeText:       { fontSize: 10 },
  phone:           { fontSize: 11, color: T.text3 },

  right:           { alignItems: "flex-end" },
  clientCount:     { fontSize: 13, fontWeight: "600", color: T.text1 },
  clientSub:       { fontSize: 10, color: T.text3, marginTop: 1 },

  empty:           { paddingVertical: 48, alignItems: "center" },
  emptyTxt:        { fontSize: 13, color: T.text3 },
});
