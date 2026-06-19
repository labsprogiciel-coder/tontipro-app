import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Download, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react-native";

import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import { mergeTransactionsSorted, useTransactionStore } from "@/stores/transaction-store";
import { useAgentStore } from "@/stores/agent-store";
import { Transaction } from "@/types/transaction";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#ffffff",
  bg2:         "#f5f4f0",
  bg3:         "#eeede8",
  bgSuccess:   "#eaf3de",
  bgWarning:   "#faeeda",
  bgDanger:    "#fcebeb",
  bgBlue:      "#e6f1fb",
  text1:       "#1a1a18",
  text2:       "#5f5e5a",
  text3:       "#888780",
  textSuccess: "#3b6d11",
  textWarning: "#854f0b",
  textDanger:  "#a32d2d",
  textBlue:    "#185fa5",
  border:      "rgba(0,0,0,0.09)",
  border2:     "rgba(0,0,0,0.18)",
  orange:      "#D85A30",
  orangeDk:    "#993C1D",
  orangeLt:    "#FAE8E0",
  greenMid:    "#3b6d11",
  greenLt:     "#eaf3de",
  blue:        "#185fa5",
  blueLt:      "#e6f1fb",
  purple:      "#534AB7",
  purpleLt:    "#EEEDFE",
  dark:        "#1a1a18",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "auj" | "7j" | "mois" | "trim" | "an";
type AgentTab = "tout" | "depots" | "retraits" | "commission" | "clients";
type AdminTab = "global" | "agent" | "groupe" | "commissions";

const PERIOD_LABELS: Record<Period, string> = {
  "auj":  "Auj.",
  "7j":   "7J",
  "mois": "Mois",
  "trim": "Trim.",
  "an":   "An",
};

const PERIOD_STAT_LABEL: Record<Period, string> = {
  "auj":  "aujourd'hui",
  "7j":   "cette semaine",
  "mois": "ce mois",
  "trim": "ce trimestre",
  "an":   "cette année",
};

const WEEK_DAYS    = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_WEEKS  = ["S1", "S2", "S3", "S4"];
const SHORT_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const AVATAR_COLORS = [
  { bg: T.blueLt,    fg: T.blue       },
  { bg: T.greenLt,   fg: T.greenMid   },
  { bg: T.bgWarning, fg: T.textWarning },
  { bg: T.purpleLt,  fg: T.purple     },
  { bg: T.orangeLt,  fg: T.orangeDk   },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function periodStartMs(period: Period): number {
  const now = new Date();
  switch (period) {
    case "auj":  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case "7j":   return now.getTime() - 7 * 86400000;
    case "mois": return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case "trim": return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
    case "an":   return new Date(now.getFullYear(), 0, 1).getTime();
  }
}

function prevPeriodRange(period: Period): { start: number; end: number } {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear(), d = now.getDate();
  switch (period) {
    case "auj":
      return {
        start: new Date(y, m, d - 1).getTime(),
        end:   new Date(y, m, d).getTime(),
      };
    case "7j":
      return { start: now.getTime() - 14 * 86400000, end: now.getTime() - 7 * 86400000 };
    case "mois":
      return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() };
    case "trim":
      return { start: new Date(y, m - 5, 1).getTime(), end: new Date(y, m - 2, 1).getTime() };
    case "an":
      return { start: new Date(y - 1, 0, 1).getTime(), end: new Date(y, 0, 1).getTime() };
  }
}

const TODAY_SLOTS = ["Matin", "Midi", "A-M", "Soir"];

function buildBars(txList: Transaction[], period: Period) {
  if (period === "auj") {
    const b = TODAY_SLOTS.map((label) => ({ dep: 0, ret: 0, label }));
    txList.forEach((t) => {
      const h = new Date(t.date).getHours();
      const slot = h < 9 ? 0 : h < 13 ? 1 : h < 17 ? 2 : 3;
      if (t.type === "deposit")    b[slot].dep += t.amount;
      if (t.type === "withdrawal") b[slot].ret += t.amount;
    });
    return b;
  }
  if (period === "7j") {
    const b = WEEK_DAYS.map((label) => ({ dep: 0, ret: 0, label }));
    txList.forEach((t) => {
      const dow = (new Date(t.date).getDay() + 6) % 7;
      if (t.type === "deposit")    b[dow].dep += t.amount;
      if (t.type === "withdrawal") b[dow].ret += t.amount;
    });
    return b;
  }
  if (period === "mois") {
    const b = MONTH_WEEKS.map((label) => ({ dep: 0, ret: 0, label }));
    txList.forEach((t) => {
      const wi = Math.min(Math.floor((new Date(t.date).getDate() - 1) / 7), 3);
      if (t.type === "deposit")    b[wi].dep += t.amount;
      if (t.type === "withdrawal") b[wi].ret += t.amount;
    });
    return b;
  }
  if (period === "trim") {
    const now = new Date();
    const b = [0, 1, 2].map((i) => ({
      dep: 0, ret: 0, label: SHORT_MONTHS[(now.getMonth() - 2 + i + 12) % 12],
    }));
    txList.forEach((t) => {
      const idx = [0, 1, 2].findIndex(
        (i) => (new Date().getMonth() - 2 + i + 12) % 12 === new Date(t.date).getMonth()
      );
      if (idx === -1) return;
      if (t.type === "deposit")    b[idx].dep += t.amount;
      if (t.type === "withdrawal") b[idx].ret += t.amount;
    });
    return b;
  }
  const b = SHORT_MONTHS.map((label) => ({ dep: 0, ret: 0, label }));
  txList.forEach((t) => {
    const m = new Date(t.date).getMonth();
    if (t.type === "deposit")    b[m].dep += t.amount;
    if (t.type === "withdrawal") b[m].ret += t.amount;
  });
  return b;
}

function initials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── Shared components ────────────────────────────────────────────────────────

function PeriodBar({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <View style={s.periodBar}>
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <Pressable key={p} style={[s.popt, period === p && s.poptActive]} onPress={() => onChange(p)}>
          <Text style={[s.poptText, period === p && s.poptTextActive]}>{PERIOD_LABELS[p]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BarChart({
  bars,
  showRet = true,
  barColor = T.orange,
  maxH = 64,
}: {
  bars: { dep: number; ret: number; label: string }[];
  showRet?: boolean;
  barColor?: string;
  maxH?: number;
}) {
  const maxVal = Math.max(...bars.flatMap((b) => [b.dep, showRet ? b.ret : 0]), 1);
  return (
    <View style={s.card}>
      <View style={s.chartLegend}>
        <View style={s.legItem}>
          <View style={[s.legDot, { backgroundColor: barColor }]} />
          <Text style={s.legText}>Dépôts</Text>
        </View>
        {showRet && (
          <View style={s.legItem}>
            <View style={[s.legDot, { backgroundColor: T.border2 }]} />
            <Text style={s.legText}>Retraits</Text>
          </View>
        )}
      </View>
      <View style={s.barChart}>
        {bars.map((b, i) => (
          <View key={i} style={s.barWrap}>
            <View style={[s.bar, { height: Math.max(4, (b.dep / maxVal) * maxH), backgroundColor: barColor }]} />
            {showRet && (
              <View style={[s.bar, { height: Math.max(4, (b.ret / maxVal) * maxH), backgroundColor: T.border2, marginTop: 2 }]} />
            )}
            <Text style={s.barLbl}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, link }: { title: string; link?: string }) {
  return (
    <View style={s.secRow}>
      <Text style={s.secTitle}>{title}</Text>
      {link ? <Text style={s.secLink}>{link}</Text> : null}
    </View>
  );
}

function ExportButton({ label = "Exporter mon rapport (CSV)" }: { label?: string }) {
  return (
    <Pressable style={s.exportBtn}>
      <Download size={14} color={T.text2} strokeWidth={1.5} />
      <Text style={s.exportText}>{label}</Text>
    </Pressable>
  );
}

// ─── Agent view components ────────────────────────────────────────────────────

function AgentHero({
  total, subtitle, trendUp, trendLabel, transactions, clients, commission,
}: {
  total: number; subtitle: string; trendUp: boolean; trendLabel: string;
  transactions: number; clients: number; commission: number;
}) {
  return (
    <View style={s.hero}>
      <Text style={s.heroLabel}>Collecte du mois</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}
        <Text style={s.heroCur}> FCFA</Text>
      </Text>
      <Text style={s.heroSub}>{subtitle}</Text>
      <View style={[s.trendPill, trendUp ? s.trendUp : s.trendDn]}>
        {trendUp
          ? <TrendingUp size={11} color="#97c459" strokeWidth={2} />
          : <TrendingDown size={11} color="#f09595" strokeWidth={2} />
        }
        <Text style={[s.trendText, trendUp ? s.trendTextUp : s.trendTextDn]}>{trendLabel}</Text>
      </View>
      <View style={s.kpiGrid}>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{transactions}</Text>
          <Text style={s.kcLbl}>Transactions</Text>
        </View>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{clients}</Text>
          <Text style={s.kcLbl}>Clients</Text>
        </View>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{commission.toLocaleString("fr-FR")}</Text>
          <Text style={s.kcLbl}>Commission</Text>
        </View>
      </View>
    </View>
  );
}

function QuickStats({
  deposits, withdrawals, depOps, retOps, periodLabel,
}: {
  deposits: number; withdrawals: number; depOps: number; retOps: number; periodLabel: string;
}) {
  return (
    <View style={s.qstatRow}>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Dépôts {periodLabel}</Text>
        <Text style={[s.qstatVal, { color: T.greenMid }]}>+{deposits.toLocaleString("fr-FR")}</Text>
        <Text style={s.qstatSub}>FCFA · {depOps} opér.</Text>
      </View>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Retraits {periodLabel}</Text>
        <Text style={[s.qstatVal, { color: T.orange }]}>−{withdrawals.toLocaleString("fr-FR")}</Text>
        <Text style={s.qstatSub}>FCFA · {retOps} opér.</Text>
      </View>
    </View>
  );
}

function TopClientItem({
  rank, initials: inits, name, txCount, amount, goalPct, avatarBg, avatarColor,
}: {
  rank: number; initials: string; name: string; txCount: number;
  amount: number; goalPct: number | null; avatarBg: string; avatarColor: string;
}) {
  return (
    <View style={[s.rankItem, rank === 3 ? { borderBottomWidth: 0 } : undefined]}>
      <Text style={s.rankNum}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{inits}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <Text style={s.rankSub}>{txCount} transactions</Text>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{amount.toLocaleString("fr-FR")} F</Text>
        <Text style={s.rankPct}>{goalPct !== null ? `Objectif ${goalPct}%` : "—"}</Text>
      </View>
    </View>
  );
}

function FilteredClientItem({
  rank, initials: inits, name, amount, pct, avatarBg, avatarColor,
}: {
  rank: number; initials: string; name: string;
  amount: number; pct: number; avatarBg: string; avatarColor: string;
}) {
  return (
    <View style={[s.rankItem, rank === 3 ? { borderBottomWidth: 0 } : undefined]}>
      <Text style={s.rankNum}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{inits}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <View style={s.progTrack}>
          <View style={[s.progFill, { width: `${pct}%`, backgroundColor: T.orange }]} />
        </View>
      </View>
      <View style={s.rankRight}>
        <Text style={[s.rankVal, { fontSize: 12 }]}>{amount.toLocaleString("fr-FR")} F</Text>
        <Text style={s.rankPct}>{pct}%</Text>
      </View>
    </View>
  );
}

// Focused hero for filtered tabs (Dépôts / Retraits)
function FocusedHero({
  label, total, subtitle, stat1, stat2, stat3, bgColor,
}: {
  label: string; total: number; subtitle: string;
  stat1: { val: string; lbl: string };
  stat2: { val: string; lbl: string };
  stat3: { val: string; lbl: string };
  bgColor: string;
}) {
  return (
    <View style={[s.focusedHero, { backgroundColor: bgColor }]}>
      <Text style={s.heroLabel}>{label}</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}<Text style={s.heroCur}> FCFA</Text>
      </Text>
      <Text style={s.heroSub}>{subtitle}</Text>
      <View style={s.focusedMiniRow}>
        {[stat1, stat2, stat3].map((st, i) => (
          <View key={i} style={s.focusedMini}>
            <Text style={s.focusedMiniVal}>{st.val}</Text>
            <Text style={s.focusedMiniLbl}>{st.lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Admin view components ────────────────────────────────────────────────────

function AdminHero({
  total, subtitle, trendUp, trendLabel, transactions, collected, commissions,
}: {
  total: number; subtitle: string; trendUp: boolean; trendLabel: string;
  transactions: number; collected: string; commissions: number;
}) {
  return (
    <View style={s.adminHero}>
      <Text style={s.heroLabel}>Épargne totale gérée</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}<Text style={s.heroCur}> FCFA</Text>
      </Text>
      <Text style={s.heroSub}>{subtitle}</Text>
      <View style={[s.trendPill, trendUp ? s.trendUp : s.trendDn]}>
        {trendUp
          ? <TrendingUp size={11} color="#97c459" strokeWidth={2} />
          : <TrendingDown size={11} color="#f09595" strokeWidth={2} />
        }
        <Text style={[s.trendText, trendUp ? s.trendTextUp : s.trendTextDn]}>{trendLabel}</Text>
      </View>
      <View style={s.kpiGrid}>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{transactions}</Text>
          <Text style={s.kcLbl}>Transactions</Text>
        </View>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{collected}</Text>
          <Text style={s.kcLbl}>Collectés</Text>
        </View>
        <View style={s.kpiCell}>
          <Text style={s.kcVal}>{commissions.toLocaleString("fr-FR")}</Text>
          <Text style={s.kcLbl}>Commissions</Text>
        </View>
      </View>
    </View>
  );
}

function AgentLeaderItem({
  rank, name, clients, ops, amount, trendPct,
  avatarBg, avatarColor,
}: {
  rank: number; name: string; clients: number; ops: number;
  amount: number; trendPct: number | null; avatarBg: string; avatarColor: string;
}) {
  const trendUp = trendPct === null || trendPct >= 0;
  return (
    <View style={[s.rankItem, { borderBottomColor: T.border }]}>
      <Text style={[s.rankNum, rank === 1 ? { color: T.orange, fontSize: 12 } : undefined]}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <Text style={s.rankSub}>{clients} clients · {ops} opér.</Text>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{amount.toLocaleString("fr-FR")} F</Text>
        {trendPct !== null && (
          <Text style={[s.rankPct, { color: trendUp ? T.textSuccess : T.textDanger }]}>
            {trendUp ? "↑" : "↓"} {Math.abs(trendPct)}%
          </Text>
        )}
      </View>
    </View>
  );
}

function AgentCompBar({
  name, amount, maxAmount, avatarBg, avatarColor, barColor, blocked,
}: {
  name: string; amount: number; maxAmount: number;
  avatarBg: string; avatarColor: string; barColor: string; blocked?: boolean;
}) {
  const pct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0;
  return (
    <View style={[s.agentCompRow, blocked ? { opacity: 0.45 } : undefined]}>
      <View style={s.agentCompHeader}>
        <View style={s.agentCompLeft}>
          <View style={[s.agentCompAv, { backgroundColor: avatarBg }]}>
            <Text style={[s.agentCompAvText, { color: avatarColor }]}>{initials(name)}</Text>
          </View>
          <Text style={s.agentCompName}>{name}</Text>
          {blocked && (
            <View style={s.blockedBadge}>
              <Text style={s.blockedBadgeText}>Bloqué</Text>
            </View>
          )}
        </View>
        <Text style={[s.agentCompAmount, blocked ? { color: T.text3 } : undefined]}>
          {amount.toLocaleString("fr-FR")} F
        </Text>
      </View>
      <View style={[s.progTrack, { height: 7 }]}>
        <View style={[s.progFill, { width: `${pct}%`, height: 7, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// ─── Agent report view ────────────────────────────────────────────────────────
function AgentView() {
  const [period, setPeriod]     = useState<Period>("mois");
  const [activeTab, setTab] = useState<AgentTab>("tout");

  const clients     = useClientStore((s) => s.clients);
  const transactions = useTransactionStore((s) => s.transactions);
  const pending      = useTransactionStore((s) => s.pendingTransactions);

  const all = useMemo(
    () => mergeTransactionsSorted(transactions, pending),
    [transactions, pending]
  );

  const start = periodStartMs(period);
  const filtered = useMemo(
    () => all.filter((t) => new Date(t.date).getTime() >= start),
    [all, start]
  );

  const prev = prevPeriodRange(period);
  const prevFiltered = useMemo(
    () => all.filter((t) => {
      const ms = new Date(t.date).getTime();
      return ms >= prev.start && ms < prev.end;
    }),
    [all, prev.start, prev.end]
  );

  const deposits     = filtered.filter((t) => t.type === "deposit");
  const withdrawals  = filtered.filter((t) => t.type === "withdrawal");
  const prevDeposits = prevFiltered.filter((t) => t.type === "deposit");
  const prevWithd    = prevFiltered.filter((t) => t.type === "withdrawal");

  const totalDep    = deposits.reduce((s, t) => s + t.amount, 0);
  const totalRet    = withdrawals.reduce((s, t) => s + t.amount, 0);
  const net         = totalDep - totalRet;
  const commission  = Math.round(net * 0.01);

  const prevNet = prevDeposits.reduce((s, t) => s + t.amount, 0)
                - prevWithd.reduce((s, t) => s + t.amount, 0);
  const trendPct = prevNet !== 0
    ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 100)
    : net > 0 ? 100 : 0;
  const trendUp   = trendPct >= 0;
  const trendLabel = `${trendUp ? "↑" : "↓"} ${Math.abs(trendPct)}% vs période préc.`;

  const activeClients = clients.filter((c) => c.status === "active").length;
  const chartBars     = useMemo(() => buildBars(filtered, period), [filtered, period]);
  const periodLabel   = PERIOD_STAT_LABEL[period];

  const topClients = useMemo(() => {
    const map = new Map<string, { amount: number; txCount: number; clientId: string }>();
    deposits.forEach((t) => {
      const prev = map.get(t.clientId) ?? { amount: 0, txCount: 0, clientId: t.clientId };
      map.set(t.clientId, { ...prev, amount: prev.amount + t.amount, txCount: prev.txCount + 1 });
    });
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((e) => ({ ...e, client: clients.find((c) => c.id === e.clientId) }));
  }, [deposits, clients]);

  const maxClientAmount = topClients[0]?.amount || 1;

  const AGENT_TABS: { id: AgentTab; label: string }[] = [
    { id: "tout",       label: "Tout" },
    { id: "depots",     label: "Dépôts" },
    { id: "retraits",   label: "Retraits" },
    { id: "commission", label: "Commission" },
    { id: "clients",    label: "Clients" },
  ];

  const isFiltered = activeTab !== "tout";

  // Breakdown bars for focused Dépôts/Retraits tabs (reuses buildBars)
  const dayBars = useMemo(() => buildBars(filtered, period), [filtered, period]);

  const peakDay = dayBars.reduce((max, b, i) =>
    b.dep > dayBars[max].dep ? i : max, 0);

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.topbarRow}>
            <Text style={s.pageTitle}>Mes rapports</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                style={[s.iconBtn, isFiltered && { backgroundColor: T.orangeLt, borderColor: "rgba(216,90,48,0.25)" }]}
                onPress={() => setTab("tout")}
              >
                <SlidersHorizontal size={14} color={isFiltered ? T.orange : T.text2} strokeWidth={1.5} />
              </Pressable>
              <Pressable style={s.iconBtn}>
                <Download size={14} color={T.text2} strokeWidth={1.5} />
              </Pressable>
            </View>
          </View>
          <PeriodBar period={period} onChange={setPeriod} />
        </View>

        {/* Pill tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillTabs}>
          {AGENT_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[s.ptab, activeTab === tab.id && s.ptabActiveOr]}
              onPress={() => setTab(tab.id)}
            >
              <Text style={[s.ptabText, activeTab === tab.id && s.ptabTextActiveOr]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tout ── */}
        {activeTab === "tout" && (
          <>
            <AgentHero
              total={net}
              subtitle={`${filtered.length} transactions · ${periodLabel}`}
              trendUp={trendUp}
              trendLabel={trendLabel}
              transactions={filtered.length}
              clients={activeClients}
              commission={commission}
            />
            <QuickStats
              deposits={totalDep}
              withdrawals={totalRet}
              depOps={deposits.length}
              retOps={withdrawals.length}
              periodLabel={periodLabel}
            />
            <View style={s.section}>
              <SectionHeader title="Activité hebdomadaire" />
              <BarChart bars={chartBars} />
            </View>
            <View style={s.section}>
              <SectionHeader title="Mes meilleurs clients" link="Voir tous →" />
              <View style={s.card}>
                {topClients.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucune donnée</Text>
                  </View>
                ) : (
                  topClients.map((entry, i) => {
                    const goal = entry.client?.commitmentAmount;
                    const goalPct = goal && goal > 0
                      ? Math.min(Math.round((entry.amount / goal) * 100), 100)
                      : null;
                    return (
                      <TopClientItem
                        key={entry.clientId}
                        rank={i + 1}
                        initials={initials(entry.client?.name)}
                        name={entry.client?.name ?? "—"}
                        txCount={entry.txCount}
                        amount={entry.amount}
                        goalPct={goalPct}
                        avatarBg={AVATAR_COLORS[i % 5].bg}
                        avatarColor={AVATAR_COLORS[i % 5].fg}
                      />
                    );
                  })
                )}
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title={`Ma commission (1%) · ${periodLabel}`} />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts (×{deposits.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{Math.round(totalDep * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits (×{withdrawals.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{Math.round(totalRet * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}>Total ce mois</Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton />
          </>
        )}

        {/* ── Dépôts tab ── */}
        {activeTab === "depots" && (
          <>
            <FocusedHero
              bgColor={T.orange}
              label={`Total dépôts — ${periodLabel}`}
              total={totalDep}
              subtitle={`${deposits.length} opérations · moy. ${deposits.length > 0 ? Math.round(totalDep / deposits.length).toLocaleString("fr-FR") : 0} F / opér.`}
              stat1={{ val: String(new Set(deposits.map((t) => t.clientId)).size), lbl: "Clients déposants" }}
              stat2={{ val: deposits.length > 0 ? (deposits.length / Math.max(new Set(deposits.map((t) => t.clientId)).size, 1)).toFixed(1) : "0", lbl: "Dépôts / client" }}
              stat3={{ val: `${trendUp ? "+" : ""}${trendPct}%`, lbl: "vs période préc." }}
            />
            <View style={s.section}>
              <SectionHeader title="Par jour de la semaine" />
              <View style={s.card}>
                <BarChart bars={dayBars} showRet={false} />
                <Text style={s.peakDayText}>Pic d'activité : {(period === "auj" ? TODAY_SLOTS : WEEK_DAYS)[peakDay]}</Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Répartition par client" link="Voir tous →" />
              <View style={s.card}>
                {topClients.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucune donnée</Text>
                  </View>
                ) : (
                  topClients.map((entry, i) => (
                    <FilteredClientItem
                      key={entry.clientId}
                      rank={i + 1}
                      initials={initials(entry.client?.name)}
                      name={entry.client?.name ?? "—"}
                      amount={entry.amount}
                      pct={Math.round((entry.amount / maxClientAmount) * 100)}
                      avatarBg={AVATAR_COLORS[i % 5].bg}
                      avatarColor={AVATAR_COLORS[i % 5].fg}
                    />
                  ))
                )}
              </View>
            </View>
            <ExportButton label="Exporter" />
          </>
        )}

        {/* ── Retraits tab ── */}
        {activeTab === "retraits" && (
          <>
            <FocusedHero
              bgColor={T.dark}
              label={`Total retraits — ${periodLabel}`}
              total={totalRet}
              subtitle={`${withdrawals.length} opérations · moy. ${withdrawals.length > 0 ? Math.round(totalRet / withdrawals.length).toLocaleString("fr-FR") : 0} F / opér.`}
              stat1={{ val: String(new Set(withdrawals.map((t) => t.clientId)).size), lbl: "Clients retrayants" }}
              stat2={{ val: withdrawals.length > 0 ? (withdrawals.length / Math.max(new Set(withdrawals.map((t) => t.clientId)).size, 1)).toFixed(1) : "0", lbl: "Retraits / client" }}
              stat3={{ val: `${totalDep > 0 ? Math.round((totalRet / totalDep) * 100) : 0}%`, lbl: "du total dépôts" }}
            />
            <View style={s.section}>
              <SectionHeader title="Par jour de la semaine" />
              <View style={s.card}>
                <View style={s.barChart}>
                  {dayBars.map((b, i) => {
                    const maxVal = Math.max(...dayBars.map((x) => x.ret), 1);
                    return (
                      <View key={i} style={s.barWrap}>
                        <View style={[s.bar, { height: Math.max(4, (b.ret / maxVal) * 64), backgroundColor: T.border2 }]} />
                        <Text style={s.barLbl}>{b.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Solde net de la période" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>+{totalDep.toLocaleString("fr-FR")} F</Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits</Text>
                  <Text style={[s.cVal, { color: T.orange }]}>−{totalRet.toLocaleString("fr-FR")} F</Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}>Net</Text>
                  <Text style={[s.cVal, { color: net >= 0 ? T.greenMid : T.orange, fontSize: 15 }]}>
                    {net >= 0 ? "+" : ""}{net.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton label="Exporter" />
          </>
        )}

        {/* ── Commission tab ── */}
        {activeTab === "commission" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Ma commission totale</Text>
              <Text style={s.heroBig}>
                {commission.toLocaleString("fr-FR")}<Text style={s.heroCur}> F</Text>
              </Text>
              <Text style={s.heroSub}>{periodLabel} · taux 1%</Text>
            </View>
            <View style={s.section}>
              <SectionHeader title="Détail commission" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts (1% × {deposits.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{Math.round(totalDep * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits (1% × {withdrawals.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{Math.round(totalRet * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}>Total</Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton label="Exporter mon rapport (CSV)" />
          </>
        )}

        {/* ── Clients tab ── */}
        {activeTab === "clients" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Activité clients</Text>
              <Text style={s.heroBig}>
                {activeClients}<Text style={s.heroCur}> actifs</Text>
              </Text>
              <Text style={s.heroSub}>{clients.length} clients au total</Text>
            </View>
            <View style={s.qstatRow}>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Clients déposants</Text>
                <Text style={[s.qstatVal, { color: T.greenMid }]}>
                  {new Set(deposits.map((t) => t.clientId)).size}
                </Text>
                <Text style={s.qstatSub}>{periodLabel}</Text>
              </View>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Clients retrayants</Text>
                <Text style={[s.qstatVal, { color: T.orange }]}>
                  {new Set(withdrawals.map((t) => t.clientId)).size}
                </Text>
                <Text style={s.qstatSub}>{periodLabel}</Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Meilleurs clients" link="Voir tous →" />
              <View style={s.card}>
                {topClients.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucune donnée</Text>
                  </View>
                ) : (
                  topClients.map((entry, i) => {
                    const goal = entry.client?.commitmentAmount;
                    const goalPct = goal && goal > 0
                      ? Math.min(Math.round((entry.amount / goal) * 100), 100)
                      : null;
                    return (
                      <TopClientItem
                        key={entry.clientId}
                        rank={i + 1}
                        initials={initials(entry.client?.name)}
                        name={entry.client?.name ?? "—"}
                        txCount={entry.txCount}
                        amount={entry.amount}
                        goalPct={goalPct}
                        avatarBg={AVATAR_COLORS[i % 5].bg}
                        avatarColor={AVATAR_COLORS[i % 5].fg}
                      />
                    );
                  })
                )}
              </View>
            </View>
            <ExportButton label="Exporter liste clients (CSV)" />
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Admin report view ────────────────────────────────────────────────────────
function AdminView() {
  const [period, setPeriod] = useState<Period>("mois");
  const [activeTab, setTab] = useState<AdminTab>("global");

  const clients     = useClientStore((s) => s.clients);
  const transactions = useTransactionStore((s) => s.transactions);
  const pending      = useTransactionStore((s) => s.pendingTransactions);
  const agents       = useAgentStore((s) => s.agents);

  const all = useMemo(
    () => mergeTransactionsSorted(transactions, pending),
    [transactions, pending]
  );

  const start = periodStartMs(period);
  const filtered = useMemo(
    () => all.filter((t) => new Date(t.date).getTime() >= start),
    [all, start]
  );

  const prev = prevPeriodRange(period);
  const prevFiltered = useMemo(
    () => all.filter((t) => {
      const ms = new Date(t.date).getTime();
      return ms >= prev.start && ms < prev.end;
    }),
    [all, prev.start, prev.end]
  );

  const deposits    = filtered.filter((t) => t.type === "deposit");
  const withdrawals = filtered.filter((t) => t.type === "withdrawal");
  const prevDep     = prevFiltered.filter((t) => t.type === "deposit");
  const prevRet     = prevFiltered.filter((t) => t.type === "withdrawal");

  const totalDep  = deposits.reduce((s, t) => s + t.amount, 0);
  const totalRet  = withdrawals.reduce((s, t) => s + t.amount, 0);
  const totalSaved = clients.reduce((s, c) => s + (c.balance ?? 0), 0);
  const commissions = Math.round((totalDep + totalRet) * 0.01);

  const prevNet = prevDep.reduce((s, t) => s + t.amount, 0) - prevRet.reduce((s, t) => s + t.amount, 0);
  const net = totalDep - totalRet;
  const trendPct = prevNet !== 0 ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 100) : 0;
  const trendUp  = trendPct >= 0;

  const periodLabel = PERIOD_STAT_LABEL[period];
  const chartBars   = useMemo(() => buildBars(filtered, period), [filtered, period]);

  // Agent leaderboard: compute stats dynamically from transactions
  const sortedAgents = useMemo(() => {
    // Build a map of agentId → { collected, clients, transactions }
    const agentStats = new Map<string, { collected: number; clients: Set<string>; transactions: number }>();
    for (const t of filtered) {
      // Transactions don't carry agentId in the local type; skip leaderboard if unavailable
      // Use clientId as a proxy for "clients served"
      const entry = agentStats.get(t.clientId) ?? { collected: 0, clients: new Set<string>(), transactions: 0 };
      if (t.type === 'deposit') entry.collected += t.amount;
      entry.clients.add(t.clientId);
      entry.transactions++;
      agentStats.set(t.clientId, entry);
    }

    return [...agents].sort((a, b) => {
      // Sort by fullName alphabetically as a stable fallback since agent-level
      // transaction stats require server-side aggregation.
      return a.fullName.localeCompare(b.fullName);
    });
  }, [agents, filtered]);

  // Group breakdown
  const groupStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; balance: number }>();
    clients.forEach((c) => {
      const g = c.groupName ?? "Sans groupe";
      const prev = map.get(g) ?? { name: g, count: 0, balance: 0 };
      map.set(g, { ...prev, count: prev.count + 1, balance: prev.balance + (c.balance ?? 0) });
    });
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [clients]);

  const ADMIN_TABS: { id: AdminTab; label: string }[] = [
    { id: "global",      label: "Vue globale" },
    { id: "agent",       label: "Par agent" },
    { id: "groupe",      label: "Par groupe" },
    { id: "commissions", label: "Commissions" },
  ];

  const maxAgentCollected = 1; // Stats computed server-side; placeholder for bar scaling

  const AGENT_BAR_COLORS = [T.orange, T.blue, T.greenMid, T.orange, T.text3];

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.topbarRow}>
            <Text style={s.pageTitle}>Rapports</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable style={s.iconBtn}>
                <SlidersHorizontal size={14} color={T.text2} strokeWidth={1.5} />
              </Pressable>
              <Pressable style={s.iconBtn}>
                <Download size={14} color={T.text2} strokeWidth={1.5} />
              </Pressable>
            </View>
          </View>
          <PeriodBar period={period} onChange={setPeriod} />
        </View>

        {/* Pill tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillTabs}>
          {ADMIN_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[s.ptab, activeTab === tab.id && s.ptabActiveDk]}
              onPress={() => setTab(tab.id)}
            >
              <Text style={[s.ptabText, activeTab === tab.id && s.ptabTextActiveDk]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Vue globale ── */}
        {activeTab === "global" && (
          <>
            <AdminHero
              total={totalSaved}
              subtitle={`${periodLabel} · ${clients.length} clients · ${agents.length} agents`}
              trendUp={trendUp}
              trendLabel={`${trendUp ? "↑" : "↓"} ${Math.abs(trendPct)}% vs période préc.`}
              transactions={filtered.length}
              collected={totalDep >= 1_000_000
                ? `${(totalDep / 1_000_000).toFixed(1)}M`
                : totalDep.toLocaleString("fr-FR")}
              commissions={commissions}
            />
            <View style={s.qstatRow}>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Dépôts totaux</Text>
                <Text style={[s.qstatVal, { color: T.greenMid }]}>+{totalDep.toLocaleString("fr-FR")}</Text>
                <Text style={s.qstatSub}>FCFA · {deposits.length} opér.</Text>
              </View>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Retraits totaux</Text>
                <Text style={[s.qstatVal, { color: T.orange }]}>−{totalRet.toLocaleString("fr-FR")}</Text>
                <Text style={s.qstatSub}>FCFA · {withdrawals.length} opér.</Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Collecte mensuelle" link="Détail →" />
              <BarChart bars={chartBars} />
            </View>
            <View style={s.section}>
              <SectionHeader title="Performance agents" link="Voir tous →" />
              <View style={s.card}>
                {sortedAgents.slice(0, 3).map((agent, i) => (
                  <AgentLeaderItem
                    key={agent._id}
                    rank={i + 1}
                    name={agent.fullName}
                    clients={0}
                    ops={0}
                    amount={0}
                    trendPct={null}
                    avatarBg={AVATAR_COLORS[i % 5].bg}
                    avatarColor={AVATAR_COLORS[i % 5].fg}
                  />
                ))}
                {sortedAgents.length === 0 && (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucun agent</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Commissions du mois" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts (1% × {deposits.length})</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {Math.round(totalDep * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits (1% × {withdrawals.length})</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {Math.round(totalRet * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}>Total organisation</Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commissions.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton label="Exporter rapport complet" />
          </>
        )}

        {/* ── Par agent ── */}
        {activeTab === "agent" && (
          <>
            <View style={s.section}>
              <SectionHeader title={`Collecte par agent — ${periodLabel}`} />
              <View style={s.card}>
                <View style={{ padding: 12, gap: 10 }}>
                  {sortedAgents.map((agent, i) => (
                    <AgentCompBar
                      key={agent._id}
                      name={agent.fullName}
                      amount={0}
                      maxAmount={maxAgentCollected}
                      avatarBg={AVATAR_COLORS[i % 5].bg}
                      avatarColor={AVATAR_COLORS[i % 5].fg}
                      barColor={AGENT_BAR_COLORS[i % 5]}
                      blocked={agent.status === "suspended"}
                    />
                  ))}
                  {sortedAgents.length === 0 && (
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucun agent</Text>
                  )}
                </View>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Détail par agent" />
              <View style={s.card}>
                {/* Header */}
                <View style={s.agentTableHeader}>
                  <Text style={[s.agentTableCell, { flex: 1 }]}>Agent</Text>
                  <Text style={[s.agentTableCell, { minWidth: 44, textAlign: "right" }]}>Clients</Text>
                  <Text style={[s.agentTableCell, { minWidth: 50, textAlign: "right" }]}>Opér.</Text>
                  <Text style={[s.agentTableCell, { minWidth: 64, textAlign: "right" }]}>Comm.</Text>
                </View>
                {sortedAgents.map((agent, i) => {
                  const collected = 0; // Server-side aggregation needed
                  const comm = 0;
                  const isLast = i === sortedAgents.length - 1;
                  return (
                    <View key={agent._id} style={[s.agentTableRow, isLast ? { borderBottomWidth: 0 } : undefined]}>
                      <Text style={[s.agentTableVal, { flex: 1 }]}>{agent.fullName}</Text>
                      <Text style={[s.agentTableSub, { minWidth: 44, textAlign: "right" }]}>
                        —
                      </Text>
                      <Text style={[s.agentTableSub, { minWidth: 50, textAlign: "right" }]}>
                        —
                      </Text>
                      <Text style={[s.agentTableComm, { minWidth: 64, textAlign: "right" }]}>
                        —
                      </Text>
                    </View>
                  );
                })}
                {sortedAgents.length === 0 && (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucun agent</Text>
                  </View>
                )}
              </View>
            </View>
            <ExportButton label="Exporter par agent (CSV)" />
          </>
        )}

        {/* ── Par groupe ── */}
        {activeTab === "groupe" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Groupes actifs</Text>
              <Text style={s.heroBig}>
                {groupStats.length}<Text style={s.heroCur}> groupes</Text>
              </Text>
              <Text style={s.heroSub}>{clients.length} clients au total</Text>
            </View>
            <View style={s.section}>
              <SectionHeader title="Épargne par groupe" />
              <View style={s.card}>
                {groupStats.map((g, i) => {
                  const maxBal = groupStats[0]?.balance || 1;
                  const pct = Math.round((g.balance / maxBal) * 100);
                  const isLast = i === groupStats.length - 1;
                  return (
                    <View key={g.name} style={[s.rankItem, isLast ? { borderBottomWidth: 0 } : undefined]}>
                      <Text style={s.rankNum}>{i + 1}</Text>
                      <View style={[s.rankAv, { backgroundColor: AVATAR_COLORS[i % 5].bg }]}>
                        <Text style={[s.rankAvText, { color: AVATAR_COLORS[i % 5].fg }]}>
                          {g.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rankName}>{g.name}</Text>
                        <View style={s.progTrack}>
                          <View style={[s.progFill, { width: `${pct}%`, backgroundColor: T.purple }]} />
                        </View>
                      </View>
                      <View style={s.rankRight}>
                        <Text style={s.rankVal}>{g.balance.toLocaleString("fr-FR")} F</Text>
                        <Text style={s.rankPct}>{g.count} clients</Text>
                      </View>
                    </View>
                  );
                })}
                {groupStats.length === 0 && (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>Aucun groupe défini</Text>
                  </View>
                )}
              </View>
            </View>
            <ExportButton label="Exporter par groupe (CSV)" />
          </>
        )}

        {/* ── Commissions ── */}
        {activeTab === "commissions" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Commissions organisation</Text>
              <Text style={s.heroBig}>
                {commissions.toLocaleString("fr-FR")}<Text style={s.heroCur}> F</Text>
              </Text>
              <Text style={s.heroSub}>{periodLabel} · taux 1% sur toutes opér.</Text>
              <View style={s.focusedMiniRow}>
                <View style={s.focusedMini}>
                  <Text style={s.focusedMiniVal}>{deposits.length}</Text>
                  <Text style={s.focusedMiniLbl}>Dépôts</Text>
                </View>
                <View style={s.focusedMini}>
                  <Text style={s.focusedMiniVal}>{withdrawals.length}</Text>
                  <Text style={s.focusedMiniLbl}>Retraits</Text>
                </View>
                <View style={s.focusedMini}>
                  <Text style={s.focusedMiniVal}>{filtered.length}</Text>
                  <Text style={s.focusedMiniLbl}>Total opér.</Text>
                </View>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Répartition des commissions" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts (1% × {deposits.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {Math.round(totalDep * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits (1% × {withdrawals.length} opér.)</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {Math.round(totalRet * 0.01).toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}>Total organisation</Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commissions.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            {sortedAgents.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="Par agent" />
                <View style={s.card}>
                  {sortedAgents.map((agent, i) => {
                    const collected = 0; // Server-side aggregation needed
                    const comm = 0;
                    const isLast = i === sortedAgents.length - 1;
                    return (
                      <View key={agent._id} style={[s.cRow, isLast ? { borderBottomWidth: 0 } : undefined]}>
                        <Text style={s.cLabel}>{agent.fullName}</Text>
                        <Text style={[s.cVal, { color: T.textSuccess }]}>
                          —
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            <ExportButton label="Exporter commissions (CSV)" />
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Root screen — role switch ─────────────────────────────────────────────────
export default function ReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.permissions === undefined;
  return isAdmin ? <AdminView /> : <AgentView />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },

  topbar: {
    backgroundColor: T.bg,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  topbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pageTitle: { fontSize: 18, fontWeight: "600", color: T.text1, letterSpacing: -0.2 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },

  periodBar: {
    flexDirection: "row", gap: 4,
    backgroundColor: T.bg2, padding: 3, borderRadius: 10,
  },
  popt:           { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 7 },
  poptActive:     { backgroundColor: T.bg, borderWidth: 0.5, borderColor: T.border },
  poptText:       { fontSize: 11, fontWeight: "500", color: T.text3 },
  poptTextActive: { color: T.text1 },

  pillTabs: { flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 14, justifyContent: "center" },
  ptab: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 0.5, borderColor: T.border2,
    backgroundColor: T.bg2,
  },
  ptabText:         { fontSize: 11, fontWeight: "500", color: T.text2 },
  ptabActiveOr:     { backgroundColor: T.orange, borderColor: T.orange },
  ptabTextActiveOr: { color: "#fff" },
  ptabActiveDk:     { backgroundColor: T.dark, borderColor: T.dark },
  ptabTextActiveDk: { color: T.bg },

  hero: {
    backgroundColor: T.orange,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22,
  },
  adminHero: {
    backgroundColor: T.dark,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22,
  },
  focusedHero: {
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20,
  },
  heroLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  heroBig:   { fontSize: 32, fontWeight: "700", color: "#fff", letterSpacing: -0.6, lineHeight: 38 },
  heroCur:   { fontSize: 14, fontWeight: "400", opacity: 0.55 },
  heroSub:   { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 },

  trendPill:    { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  trendUp:      { backgroundColor: "rgba(59,109,17,0.3)" },
  trendDn:      { backgroundColor: "rgba(162,45,45,0.3)" },
  trendText:    { fontSize: 11, fontWeight: "500" },
  trendTextUp:  { color: "#97c459" },
  trendTextDn:  { color: "#f09595" },

  kpiGrid: {
    flexDirection: "row", gap: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, overflow: "hidden", marginTop: 14,
  },
  kpiCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 10, alignItems: "center" },
  kcVal:   { fontSize: 15, fontWeight: "600", color: "#fff" },
  kcLbl:   { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },

  focusedMiniRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  focusedMini:    { flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  focusedMiniVal: { fontSize: 14, fontWeight: "600", color: "#fff" },
  focusedMiniLbl: { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1, textAlign: "center" },

  qstatRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14 },
  qstat:    { flex: 1, backgroundColor: T.bg, borderWidth: 0.5, borderColor: T.border, borderRadius: 12, padding: 12 },
  qstatLbl: { fontSize: 10, color: T.text3, marginBottom: 4 },
  qstatVal: { fontSize: 17, fontWeight: "600" },
  qstatSub: { fontSize: 10, color: T.text3, marginTop: 2 },

  section: { paddingHorizontal: 18, paddingTop: 14 },
  secRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  secTitle: { fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 },
  secLink:  { fontSize: 11, color: T.orange },

  card: { backgroundColor: T.bg, borderWidth: 0.5, borderColor: T.border, borderRadius: 14, overflow: "hidden" },

  chartLegend: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  legItem:     { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot:      { width: 8, height: 8, borderRadius: 2 },
  legText:     { fontSize: 10, color: T.text2 },
  barChart:    { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 86, paddingHorizontal: 14, paddingBottom: 10 },
  barWrap:     { flex: 1, flexDirection: "column", alignItems: "center" },
  bar:         { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLbl:      { fontSize: 9, color: T.text3, marginTop: 4 },
  peakDayText: { fontSize: 11, color: T.text3, paddingHorizontal: 14, paddingBottom: 10 },

  rankItem:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: T.border },
  rankNum:    { width: 20, fontSize: 11, fontWeight: "600", color: T.text3, textAlign: "center" },
  rankAv:     { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankAvText: { fontSize: 11, fontWeight: "600" },
  rankName:   { fontSize: 13, fontWeight: "500", color: T.text1 },
  rankSub:    { fontSize: 10, color: T.text3, marginTop: 1 },
  rankRight:  { alignItems: "flex-end" },
  rankVal:    { fontSize: 13, fontWeight: "600", color: T.text1 },
  rankPct:    { fontSize: 10, color: T.text3, marginTop: 1 },

  progTrack: { height: 4, backgroundColor: T.bg2, borderRadius: 2, overflow: "hidden", marginTop: 5 },
  progFill:  { height: 4, borderRadius: 2 },

  agentCompRow:    { gap: 4 },
  agentCompHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  agentCompLeft:   { flexDirection: "row", alignItems: "center", gap: 6 },
  agentCompAv:     { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  agentCompAvText: { fontSize: 9, fontWeight: "600" },
  agentCompName:   { fontSize: 12, fontWeight: "500", color: T.text1 },
  agentCompAmount: { fontSize: 12, fontWeight: "600", color: T.text1 },
  blockedBadge:    { backgroundColor: T.bgDanger, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  blockedBadgeText:{ fontSize: 9, color: T.textDanger },

  agentTableHeader: { flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: T.bg2, borderBottomWidth: 0.5, borderBottomColor: T.border },
  agentTableCell:   { fontSize: 10, color: T.text3 },
  agentTableRow:    { flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: T.border },
  agentTableVal:    { fontSize: 12, fontWeight: "500", color: T.text1 },
  agentTableSub:    { fontSize: 12, color: T.text2 },
  agentTableComm:   { fontSize: 12, fontWeight: "500", color: T.textSuccess },

  cRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: T.border },
  cLabel: { fontSize: 12, color: T.text2 },
  cVal:   { fontSize: 13, fontWeight: "500" },

  exportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    marginHorizontal: 18, marginTop: 16,
    backgroundColor: T.bg, borderWidth: 0.5, borderColor: T.border2,
    borderRadius: 12, paddingVertical: 13,
  },
  exportText: { fontSize: 13, fontWeight: "500", color: T.text1 },
});
