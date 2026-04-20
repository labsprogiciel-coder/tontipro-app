import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Download, TrendingUp, TrendingDown } from "lucide-react-native";

import { useClientStore } from "@/stores/client-store";
import { mergeTransactionsSorted, useTransactionStore } from "@/stores/transaction-store";

// ─── Design tokens (matching Kauridorr HTML) ─────────────────────────────────
const T = {
  bg:          "#ffffff",
  bg2:         "#f5f4f0",
  bg3:         "#eeede8",
  bgSuccess:   "#eaf3de",
  bgWarning:   "#faeeda",
  bgDanger:    "#fcebeb",
  text1:       "#1a1a18",
  text2:       "#5f5e5a",
  text3:       "#888780",
  textSuccess: "#3b6d11",
  textWarning: "#854f0b",
  textDanger:  "#a32d2d",
  border:      "rgba(0,0,0,0.09)",
  border2:     "rgba(0,0,0,0.18)",
  orange:      "#D85A30",
  orangeDk:    "#993C1D",
  orangeLt:    "#FAE8E0",
  greenMid:    "#3b6d11",
  greenLt:     "#eaf3de",
  blue:        "#185fa5",
  blueLt:      "#e6f1fb",
  dark:        "#1a1a18",
};

type Period = "7j" | "mois" | "trim" | "an";

const PERIOD_LABELS: Record<Period, string> = {
  "7j":   "7J",
  "mois": "Mois",
  "trim": "Trim.",
  "an":   "An",
};

function periodStartMs(period: Period): number {
  const now = new Date();
  switch (period) {
    case "7j":   return now.getTime() - 7  * 24 * 60 * 60 * 1000;
    case "mois": return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case "trim": return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
    case "an":   return new Date(now.getFullYear(), 0, 1).getTime();
  }
}

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_WEEKS = ["S1", "S2", "S3", "S4"];
const SHORT_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PeriodBar({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <View style={s.periodBar}>
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <Pressable
          key={p}
          style={[s.popt, period === p && s.poptActive]}
          onPress={() => onChange(p)}
        >
          <Text style={[s.poptText, period === p && s.poptTextActive]}>
            {PERIOD_LABELS[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function KpiHero({
  total,
  subtitle,
  trendUp,
  trendLabel,
  transactions,
  clients,
  commission,
}: {
  total: number;
  subtitle: string;
  trendUp: boolean;
  trendLabel: string;
  transactions: number;
  clients: number;
  commission: number;
}) {
  return (
    <View style={s.hero}>
      <Text style={s.heroLabel}>Collecte de la période</Text>
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
        <Text style={[s.trendText, trendUp ? s.trendTextUp : s.trendTextDn]}>
          {trendLabel}
        </Text>
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

function QuickStats({ deposits, withdrawals, depOps, retOps }: {
  deposits: number; withdrawals: number; depOps: number; retOps: number;
}) {
  return (
    <View style={s.qstatRow}>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Dépôts</Text>
        <Text style={[s.qstatVal, { color: T.greenMid }]}>
          +{deposits.toLocaleString("fr-FR")}
        </Text>
        <Text style={s.qstatSub}>FCFA · {depOps} opér.</Text>
      </View>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Retraits</Text>
        <Text style={[s.qstatVal, { color: T.orange }]}>
          −{withdrawals.toLocaleString("fr-FR")}
        </Text>
        <Text style={s.qstatSub}>FCFA · {retOps} opér.</Text>
      </View>
    </View>
  );
}

function BarChart({ bars }: { bars: { dep: number; ret: number; label: string }[] }) {
  const maxVal = Math.max(...bars.flatMap((b) => [b.dep, b.ret]), 1);
  const maxH = 64;
  return (
    <View style={s.card}>
      <View style={s.chartLegend}>
        <View style={s.legItem}>
          <View style={[s.legDot, { backgroundColor: T.orange }]} />
          <Text style={s.legText}>Dépôts</Text>
        </View>
        <View style={s.legItem}>
          <View style={[s.legDot, { backgroundColor: T.border2 }]} />
          <Text style={s.legText}>Retraits</Text>
        </View>
      </View>
      <View style={s.barChart}>
        {bars.map((b, i) => (
          <View key={i} style={s.barWrap}>
            <View style={[s.bar, { height: Math.max(4, (b.dep / maxVal) * maxH), backgroundColor: T.orange }]} />
            <View style={[s.bar, { height: Math.max(4, (b.ret / maxVal) * maxH), backgroundColor: T.border2, marginTop: 2 }]} />
            <Text style={s.barLbl}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TopClientItem({
  rank,
  initials,
  name,
  txCount,
  amount,
  pct,
  avatarBg,
  avatarColor,
}: {
  rank: number; initials: string; name: string; txCount: number;
  amount: number; pct: number; avatarBg: string; avatarColor: string;
}) {
  return (
    <View style={s.rankItem}>
      <Text style={s.rankNum}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <View style={s.progTrack}>
          <View style={[s.progFill, { width: `${pct}%`, backgroundColor: T.orange }]} />
        </View>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{amount.toLocaleString("fr-FR")} F</Text>
        <Text style={s.rankPct}>{txCount} opér.</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>("mois");

  const clients     = useClientStore((s) => s.clients);
  const transactions = useTransactionStore((s) => s.transactions);
  const pending      = useTransactionStore((s) => s.pendingTransactions);

  const all = useMemo(
    () => mergeTransactionsSorted(transactions, pending),
    [transactions, pending]
  );

  // Filter transactions to the selected period
  const filtered = useMemo(() => {
    const start = periodStartMs(period);
    return all.filter((t) => new Date(t.date).getTime() >= start);
  }, [all, period]);

  const deposits    = filtered.filter((t) => t.type === "deposit");
  const withdrawals = filtered.filter((t) => t.type === "withdrawal");

  const totalDeposits    = deposits.reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = withdrawals.reduce((s, t) => s + t.amount, 0);
  const netTotal         = totalDeposits - totalWithdrawals;
  const commission       = Math.round(netTotal * 0.01);
  const activeClients    = clients.filter((c) => c.status === "active").length;

  // Bar chart buckets change based on period
  const chartBars = useMemo(() => {
    if (period === "7j") {
      const buckets = WEEK_DAYS.map((label) => ({ dep: 0, ret: 0, label }));
      filtered.forEach((t) => {
        const dow = (new Date(t.date).getDay() + 6) % 7;
        if (t.type === "deposit")    buckets[dow].dep += t.amount;
        if (t.type === "withdrawal") buckets[dow].ret += t.amount;
      });
      return buckets;
    }
    if (period === "mois") {
      const buckets = MONTH_WEEKS.map((label) => ({ dep: 0, ret: 0, label }));
      filtered.forEach((t) => {
        const day = new Date(t.date).getDate();
        const wi = Math.min(Math.floor((day - 1) / 7), 3);
        if (t.type === "deposit")    buckets[wi].dep += t.amount;
        if (t.type === "withdrawal") buckets[wi].ret += t.amount;
      });
      return buckets;
    }
    if (period === "trim") {
      const now = new Date();
      const buckets = [0, 1, 2].map((i) => {
        const m = (now.getMonth() - 2 + i + 12) % 12;
        return { dep: 0, ret: 0, label: SHORT_MONTHS[m] };
      });
      filtered.forEach((t) => {
        const tMonth = new Date(t.date).getMonth();
        const now2 = new Date();
        const idx = [0, 1, 2].findIndex((i) => (now2.getMonth() - 2 + i + 12) % 12 === tMonth);
        if (idx === -1) return;
        if (t.type === "deposit")    buckets[idx].dep += t.amount;
        if (t.type === "withdrawal") buckets[idx].ret += t.amount;
      });
      return buckets;
    }
    // "an" — 12 months
    const buckets = SHORT_MONTHS.map((label) => ({ dep: 0, ret: 0, label }));
    filtered.forEach((t) => {
      const m = new Date(t.date).getMonth();
      if (t.type === "deposit")    buckets[m].dep += t.amount;
      if (t.type === "withdrawal") buckets[m].ret += t.amount;
    });
    return buckets;
  }, [filtered, period]);

  const periodLabel = { "7j": "7 derniers jours", "mois": "ce mois", "trim": "ce trimestre", "an": "cette année" }[period];

  // Top clients by deposit amount
  const topClients = useMemo(() => {
    const byClient = new Map<string, { amount: number; txCount: number; clientId: string }>();
    deposits.forEach((t) => {
      const prev = byClient.get(t.clientId) ?? { amount: 0, txCount: 0, clientId: t.clientId };
      byClient.set(t.clientId, { ...prev, amount: prev.amount + t.amount, txCount: prev.txCount + 1 });
    });
    return [...byClient.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((entry) => {
        const client = clients.find((c) => c.id === entry.clientId);
        return { ...entry, client };
      });
  }, [deposits, clients]);

  const maxClientAmount = topClients[0]?.amount || 1;

  const AVATAR_COLORS = [
    { bg: T.blueLt,    fg: T.blue       },
    { bg: T.greenLt,   fg: T.greenMid   },
    { bg: T.bgWarning, fg: T.textWarning },
  ];

  const initials = (name?: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  };

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.topbarRow}>
            <Text style={s.pageTitle}>Mes rapports</Text>
            <Pressable style={s.iconBtn}>
              <Download size={14} color={T.text2} strokeWidth={1.5} />
            </Pressable>
          </View>
          <PeriodBar period={period} onChange={setPeriod} />
        </View>

        {/* Hero */}
        <KpiHero
          total={netTotal}
          subtitle={`${filtered.length} transactions · ${periodLabel}`}
          trendUp={netTotal >= 0}
          trendLabel={netTotal >= 0 ? "Solde positif" : "Solde négatif"}
          transactions={filtered.length}
          clients={activeClients}
          commission={commission}
        />

        {/* Quick stats */}
        <QuickStats
          deposits={totalDeposits}
          withdrawals={totalWithdrawals}
          depOps={deposits.length}
          retOps={withdrawals.length}
        />

        {/* Bar chart */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>
              {period === "7j" ? "Par jour" : period === "mois" ? "Par semaine" : period === "trim" ? "Par mois" : "Par mois (année)"}
            </Text>
          </View>
          <BarChart bars={chartBars} />
        </View>

        {/* Top clients */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>Meilleurs clients</Text>
            <Text style={s.secLink}>Voir tous →</Text>
          </View>
          <View style={s.card}>
            {topClients.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 13, color: T.text3 }}>Aucune donnée</Text>
              </View>
            ) : (
              topClients.map((entry, i) => (
                <TopClientItem
                  key={entry.clientId}
                  rank={i + 1}
                  initials={initials(entry.client?.name)}
                  name={entry.client?.name ?? "—"}
                  txCount={entry.txCount}
                  amount={entry.amount}
                  pct={Math.round((entry.amount / maxClientAmount) * 100)}
                  avatarBg={AVATAR_COLORS[i % 3].bg}
                  avatarColor={AVATAR_COLORS[i % 3].fg}
                />
              ))
            )}
          </View>
        </View>

        {/* Commission breakdown */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>Ma commission (1%) · {periodLabel}</Text>
          </View>
          <View style={s.card}>
            <View style={s.cRow}>
              <Text style={s.cLabel}>Dépôts (×{deposits.length} opér.)</Text>
              <Text style={[s.cVal, { color: T.greenMid }]}>
                +{Math.round(totalDeposits * 0.01).toLocaleString("fr-FR")} F
              </Text>
            </View>
            <View style={s.cRow}>
              <Text style={s.cLabel}>Retraits (×{withdrawals.length} opér.)</Text>
              <Text style={[s.cVal, { color: T.greenMid }]}>
                +{Math.round(totalWithdrawals * 0.01).toLocaleString("fr-FR")} F
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

        {/* Export */}
        <Pressable style={s.exportBtn}>
          <Download size={14} color={T.text2} strokeWidth={1.5} />
          <Text style={s.exportText}>Exporter mon rapport (CSV)</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },

  // top bar
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
  pageTitle: { fontSize: 22, fontWeight: "700", color: T.text1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // period bar
  periodBar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: T.bg2,
    padding: 3,
    borderRadius: 10,
  },
  popt: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 7,
  },
  poptActive: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
  },
  poptText: { fontSize: 11, fontWeight: "500", color: T.text3 },
  poptTextActive: { color: T.text1 },

  // hero
  hero: {
    backgroundColor: T.orange,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  heroBig: { fontSize: 32, fontWeight: "700", color: "#fff", letterSpacing: -0.6, lineHeight: 38 },
  heroCur: { fontSize: 14, fontWeight: "400", opacity: 0.55 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 },

  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  trendUp:      { backgroundColor: "rgba(59,109,17,0.3)" },
  trendDn:      { backgroundColor: "rgba(162,45,45,0.3)" },
  trendText:    { fontSize: 11, fontWeight: "500" },
  trendTextUp:  { color: "#97c459" },
  trendTextDn:  { color: "#f09595" },

  kpiGrid: {
    flexDirection: "row",
    gap: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 14,
  },
  kpiCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 10,
    alignItems: "center",
  },
  kcVal:  { fontSize: 15, fontWeight: "600", color: "#fff" },
  kcLbl:  { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },

  // quick stats
  qstatRow: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
  qstat: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  qstatLbl: { fontSize: 10, color: T.text3, marginBottom: 4 },
  qstatVal: { fontSize: 17, fontWeight: "600" },
  qstatSub: { fontSize: 10, color: T.text3, marginTop: 2 },

  // section
  section: { paddingHorizontal: 18, paddingTop: 14 },
  secRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  secTitle: { fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 },
  secLink: { fontSize: 11, color: T.orange },

  // card
  card: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },

  // bar chart
  chartLegend: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { fontSize: 10, color: T.text2 },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 86, paddingHorizontal: 14, paddingBottom: 10 },
  barWrap: { flex: 1, flexDirection: "column", alignItems: "center", gap: 0 },
  bar: { width: "100%", borderRadius: 3 },
  barLbl: { fontSize: 9, color: T.text3, marginTop: 4 },

  // rank item
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  rankNum: { width: 20, fontSize: 11, fontWeight: "600", color: T.text3, textAlign: "center" },
  rankAv: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankAvText: { fontSize: 11, fontWeight: "600" },
  rankName: { fontSize: 13, fontWeight: "500", color: T.text1, marginBottom: 4 },
  progTrack: { height: 4, backgroundColor: T.bg2, borderRadius: 2, overflow: "hidden" },
  progFill:  { height: 4, borderRadius: 2 },
  rankRight: { marginLeft: "auto", alignItems: "flex-end" },
  rankVal:   { fontSize: 12, fontWeight: "600", color: T.text1 },
  rankPct:   { fontSize: 10, color: T.text3, marginTop: 1 },

  // commission card rows
  cRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  cLabel: { fontSize: 12, color: T.text2 },
  cVal:   { fontSize: 13, fontWeight: "500" },

  // export
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginHorizontal: 18,
    marginTop: 16,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border2,
    borderRadius: 12,
    paddingVertical: 13,
  },
  exportText: { fontSize: 13, fontWeight: "500", color: T.text1 },
});
