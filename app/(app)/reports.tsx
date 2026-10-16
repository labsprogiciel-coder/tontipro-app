// app/(app)/reports.tsx
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useQueries } from "convex/react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Download,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
} from "lucide-react-native";

import { useAuthStore } from "@/stores/auth-store";
import { useClientStore } from "@/stores/client-store";
import {
  convexRowToTransaction,
  mergeTransactionsSorted,
  useTransactionStore,
} from "@/stores/transaction-store";
import { Transaction } from "@/types/transaction";
import * as adminApi from "@/lib/admin-api";
import { shareCsv, toCsv } from "@/utils/csv-export";

import { SPACE } from "@/constants/spacing";
// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#ffffff",
  bg2: "#f5f4f0",
  bg3: "#eeede8",
  bgSuccess: "#eaf3de",
  bgWarning: "#faeeda",
  bgDanger: "#fcebeb",
  bgBlue: "#e6f1fb",
  text1: "#1a1a18",
  text2: "#5f5e5a",
  text3: "#888780",
  textSuccess: "#3b6d11",
  textWarning: "#854f0b",
  textDanger: "#a32d2d",
  textBlue: "#185fa5",
  border: "rgba(0,0,0,0.09)",
  border2: "rgba(0,0,0,0.18)",
  orange: "#D85A30",
  orangeStrong: "#BB4721", // fills behind white text (5.2:1)
  orangeDk: "#993C1D",
  orangeLt: "#FAE8E0",
  greenMid: "#3b6d11",
  greenLt: "#eaf3de",
  blue: "#185fa5",
  blueLt: "#e6f1fb",
  purple: "#534AB7",
  purpleLt: "#EEEDFE",
  dark: "#1a1a18",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "auj" | "7j" | "mois" | "trim" | "an";
type AgentTab = "tout" | "depots" | "retraits" | "commission" | "clients";
type AdminTab = "global" | "agent" | "groupe" | "commissions";

const PERIOD_LABELS: Record<Period, string> = {
  auj: "Auj.",
  "7j": "7J",
  mois: "Mois",
  trim: "Trim.",
  an: "An",
};

const PERIOD_STAT_LABEL: Record<Period, string> = {
  auj: "aujourd'hui",
  "7j": "ces 7 derniers jours",
  mois: "ce mois",
  trim: "ces 3 derniers mois",
  an: "cette année",
};

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// Days 22 to the end of the month share the last bucket.
const MONTH_WEEKS = ["1–7", "8–14", "15–21", "22–fin"];
const SHORT_MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const AVATAR_COLORS = [
  { bg: T.blueLt, fg: T.blue },
  { bg: T.greenLt, fg: T.greenMid },
  { bg: T.bgWarning, fg: T.textWarning },
  { bg: T.purpleLt, fg: T.purple },
  { bg: T.orangeLt, fg: T.orangeDk },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Local midnight `offsetDays` days from today (DST-safe: built from y/m/d). */
function dayStart(offsetDays = 0): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  );
}

// Every period is made of whole calendar days, so its bounds only change at
// midnight — they are also the report queries' args (stable subscriptions).
function periodStartMs(period: Period): number {
  const now = new Date();
  switch (period) {
    case "auj":
      return dayStart().getTime();
    case "7j":
      // Today plus the 6 previous days: exactly one bar per weekday.
      return dayStart(-6).getTime();
    case "mois":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case "trim":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
    case "an":
      return new Date(now.getFullYear(), 0, 1).getTime();
  }
}

function prevPeriodRange(period: Period): { start: number; end: number } {
  const now = new Date();
  const m = now.getMonth(),
    y = now.getFullYear();
  switch (period) {
    case "auj":
      return { start: dayStart(-1).getTime(), end: dayStart().getTime() };
    case "7j":
      return { start: dayStart(-13).getTime(), end: dayStart(-6).getTime() };
    case "mois":
      return {
        start: new Date(y, m - 1, 1).getTime(),
        end: new Date(y, m, 1).getTime(),
      };
    case "trim":
      return {
        start: new Date(y, m - 5, 1).getTime(),
        end: new Date(y, m - 2, 1).getTime(),
      };
    case "an":
      return {
        start: new Date(y - 1, 0, 1).getTime(),
        end: new Date(y, 0, 1).getTime(),
      };
  }
}

/**
 * % change vs the previous period, or null when there is nothing to compare
 * against (previous period empty but current one not).
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function trendInfo(pct: number | null, current: number, what = "") {
  const up = pct === null ? current >= 0 : pct >= 0;
  const subject = what ? `${what} ` : "";
  const label =
    pct === null
      ? `${subject}sans comparaison (période préc. vide)`
      : `${up ? "↑" : "↓"} ${Math.abs(pct)}% ${subject}vs période préc.`;
  return { up, label };
}

const COMMISSION_RATE = 0.01;

/** Rounded per line so the displayed deposit + withdrawal lines add up to the total. */
function commissionOf(deposits: number, withdrawals: number) {
  const dep = Math.round(deposits * COMMISSION_RATE);
  const ret = Math.round(withdrawals * COMMISSION_RATE);
  return { dep, ret, total: dep + ret };
}

const sum = (txs: Transaction[]) => txs.reduce((acc, t) => acc + t.amount, 0);

const CHART_TITLE: Record<Period, string> = {
  auj: "Activité de la journée",
  "7j": "Activité par jour",
  mois: "Activité par semaine",
  trim: "Activité par mois",
  an: "Activité par mois",
};

const TODAY_SLOTS = ["Matin", "Midi", "A-M", "Soir"];

function buildBars(txList: Transaction[], period: Period) {
  if (period === "auj") {
    const b = TODAY_SLOTS.map((label) => ({ dep: 0, ret: 0, label }));
    txList.forEach((t) => {
      const h = new Date(t.date).getHours();
      const slot = h < 9 ? 0 : h < 13 ? 1 : h < 17 ? 2 : 3;
      if (t.type === "deposit") b[slot].dep += t.amount;
      if (t.type === "withdrawal") b[slot].ret += t.amount;
    });
    return b;
  }
  if (period === "7j") {
    // One bar per calendar day, oldest first, labelled with its weekday.
    const days = [...Array(7)].map((_, i) => dayStart(i - 6));
    const b = days.map((d) => ({
      dep: 0,
      ret: 0,
      label: WEEK_DAYS[(d.getDay() + 6) % 7],
    }));
    txList.forEach((t) => {
      const dt = new Date(t.date);
      const idx = days.findIndex(
        (d) =>
          d.getFullYear() === dt.getFullYear() &&
          d.getMonth() === dt.getMonth() &&
          d.getDate() === dt.getDate(),
      );
      if (idx === -1) return;
      if (t.type === "deposit") b[idx].dep += t.amount;
      if (t.type === "withdrawal") b[idx].ret += t.amount;
    });
    return b;
  }
  if (period === "mois") {
    const b = MONTH_WEEKS.map((label) => ({ dep: 0, ret: 0, label }));
    txList.forEach((t) => {
      const wi = Math.min(Math.floor((new Date(t.date).getDate() - 1) / 7), 3);
      if (t.type === "deposit") b[wi].dep += t.amount;
      if (t.type === "withdrawal") b[wi].ret += t.amount;
    });
    return b;
  }
  if (period === "trim") {
    const now = new Date();
    const months = [0, 1, 2].map(
      (i) => new Date(now.getFullYear(), now.getMonth() - 2 + i, 1),
    );
    const b = months.map((d) => ({
      dep: 0,
      ret: 0,
      label: SHORT_MONTHS[d.getMonth()],
    }));
    txList.forEach((t) => {
      const dt = new Date(t.date);
      const idx = months.findIndex(
        (d) =>
          d.getFullYear() === dt.getFullYear() &&
          d.getMonth() === dt.getMonth(),
      );
      if (idx === -1) return;
      if (t.type === "deposit") b[idx].dep += t.amount;
      if (t.type === "withdrawal") b[idx].ret += t.amount;
    });
    return b;
  }
  const b = SHORT_MONTHS.map((label) => ({ dep: 0, ret: 0, label }));
  txList.forEach((t) => {
    const m = new Date(t.date).getMonth();
    if (t.type === "deposit") b[m].dep += t.amount;
    if (t.type === "withdrawal") b[m].ret += t.amount;
  });
  return b;
}

/** Label of the busiest bar, or null when the period has no activity. */
function peakLabel(
  bars: { dep: number; ret: number; label: string }[],
  key: "dep" | "ret",
): string | null {
  const peak = bars.reduce(
    (best, b) => (b[key] > best[key] ? b : best),
    bars[0],
  );
  return peak && peak[key] > 0 ? peak.label : null;
}

// ─── Report data ──────────────────────────────────────────────────────────────

// Max rows per query (server clamps: listMineInRange 2000, listByBranch 1000).
// Above this many rows a period is flagged as possibly incomplete
const ROW_WARNING = 2000;

type ReportScope = "mine" | "branch";

/**
 * Current- and previous-period transactions for the reports. Server data
 * comes from date-bounded queries (the store only holds the latest 100 of the
 * caller's own operations); queued offline operations are merged in and
 * reversed operations are excluded. Offline, it falls back to the store and
 * flags the result as partial.
 */
function useReportData(period: Period, scope: ReportScope) {
  const start = periodStartMs(period);
  const prev = prevPeriodRange(period);
  const branchId = useAuthStore((s) => s.user?.branchId);

  // useQueries (not useQuery) so a failing query — e.g. a role without
  // transactions:audit — degrades to the local fallback instead of throwing
  // into the screen. The branch query returns the whole branch; both periods
  // are cut from it below.
  const queries = useMemo(() => {
    if (scope === "branch" && branchId) {
      const branch = { query: adminApi.listBranchTransactions, args: { branchId } };
      return { cur: branch, prev: branch };
    }
    return {
      cur: {
        query: adminApi.listMyTransactionsInRange,
        args: { from: start, to: Number.MAX_SAFE_INTEGER },
      },
      prev: {
        query: adminApi.listMyTransactionsInRange,
        args: { from: prev.start, to: prev.end },
      },
    };
  }, [scope, branchId, start, prev.start, prev.end]);
  const results = useQueries(queries);
  const failed = [results.cur, results.prev].some((r) => r instanceof Error);
  const curRows = failed ? undefined : (results.cur as any[] | undefined);
  const prevRows = failed ? undefined : (results.prev as any[] | undefined);

  const stored = useTransactionStore((s) => s.transactions);
  const pending = useTransactionStore((s) => s.pendingTransactions);
  const clients = useClientStore((s) => s.clients);

  return useMemo(() => {
    const nameOf = (id: string) => clients.find((c) => c.id === id)?.name;
    const agentNames = new Map<string, string>();
    const toTxs = (rows: any[]) =>
      rows.map((row) => {
        if (row.agentName) agentNames.set(row.agentId, row.agentName);
        return convexRowToTransaction(row, nameOf);
      });

    const partial = curRows === undefined || prevRows === undefined;
    const truncated =
      (curRows?.length ?? 0) >= ROW_WARNING || (prevRows?.length ?? 0) >= ROW_WARNING;

    // The branch query answers both periods with the same rows
    const server = partial
      ? stored
      : curRows === prevRows
        ? toTxs(curRows as any[])
        : [...toTxs(curRows as any[]), ...toTxs(prevRows as any[])];
    const all = mergeTransactionsSorted(server, pending).filter(
      (t) => t.status !== "reversed",
    );
    const inRange = (from: number, to: number) =>
      all.filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= from && ms < to;
      });

    return {
      current: inRange(start, Infinity),
      previous: inRange(prev.start, prev.end),
      agentNames,
      partial,
      truncated,
    };
  }, [
    curRows,
    prevRows,
    stored,
    pending,
    clients,
    start,
    prev.start,
    prev.end,
  ]);
}

function exportTransactionsCsv(
  txs: Transaction[],
  filename: string,
  agentName: (id?: string) => string = () => "",
) {
  const csv = toCsv(
    ["date", "type", "montant", "client", "agent", "statut"],
    txs.map((t) => [
      t.date,
      t.type === "deposit" ? "dépôt" : "retrait",
      t.amount,
      t.clientName,
      agentName(t.agentId),
      t.status,
    ]),
  );
  shareCsv(filename, csv, "Exporter le rapport").catch((e) =>
    Alert.alert(
      "Export impossible",
      e instanceof Error ? e.message : String(e),
    ),
  );
}

function initials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── Shared components ────────────────────────────────────────────────────────

function PeriodBar({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
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
  const maxVal = Math.max(
    ...bars.flatMap((b) => [b.dep, showRet ? b.ret : 0]),
    1,
  );
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
            <View
              style={[
                s.bar,
                {
                  height: Math.max(4, (b.dep / maxVal) * maxH),
                  backgroundColor: barColor,
                },
              ]}
            />
            {showRet && (
              <View
                style={[
                  s.bar,
                  {
                    height: Math.max(4, (b.ret / maxVal) * maxH),
                    backgroundColor: T.border2,
                    marginTop: SPACE.xxs,
                  },
                ]}
              />
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

function ExportButton({
  label = "Exporter mon rapport (CSV)",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.exportBtn} onPress={onPress}>
      <Download size={14} color={T.text2} strokeWidth={1.5} />
      <Text style={s.exportText}>{label}</Text>
    </Pressable>
  );
}

/** Tells the user when the figures do not cover the whole period. */
function DataNotice({
  partial,
  truncated,
}: {
  partial: boolean;
  truncated: boolean;
}) {
  if (!partial && !truncated) return null;
  return (
    <View style={s.notice}>
      <Text style={s.noticeText}>
        {partial
          ? "Hors connexion ou chargement : chiffres basés sur les opérations récentes enregistrées sur cet appareil, peut-être incomplets."
          : "Période très chargée : seules les opérations les plus récentes sont incluses, les totaux peuvent être sous-estimés."}
      </Text>
    </View>
  );
}

// ─── Agent view components ────────────────────────────────────────────────────

function AgentHero({
  label,
  total,
  subtitle,
  trendUp,
  trendLabel,
  transactions,
  clients,
  commission,
}: {
  label: string;
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
      <Text style={s.heroLabel}>{label}</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}
        <Text style={s.heroCur}> FCFA</Text>
      </Text>
      <Text style={s.heroSub}>{subtitle}</Text>
      <View style={[s.trendPill, trendUp ? s.trendUp : s.trendDn]}>
        {trendUp ? (
          <TrendingUp size={11} color="#97c459" strokeWidth={2} />
        ) : (
          <TrendingDown size={11} color="#f09595" strokeWidth={2} />
        )}
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

function QuickStats({
  deposits,
  withdrawals,
  depOps,
  retOps,
  periodLabel,
}: {
  deposits: number;
  withdrawals: number;
  depOps: number;
  retOps: number;
  periodLabel: string;
}) {
  return (
    <View style={s.qstatRow}>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Dépôts {periodLabel}</Text>
        <Text style={[s.qstatVal, { color: T.greenMid }]}>
          +{deposits.toLocaleString("fr-FR")}
        </Text>
        <Text style={s.qstatSub}>FCFA · {depOps} opér.</Text>
      </View>
      <View style={s.qstat}>
        <Text style={s.qstatLbl}>Retraits {periodLabel}</Text>
        <Text style={[s.qstatVal, { color: T.orange }]}>
          −{withdrawals.toLocaleString("fr-FR")}
        </Text>
        <Text style={s.qstatSub}>FCFA · {retOps} opér.</Text>
      </View>
    </View>
  );
}

function TopClientItem({
  rank,
  initials: inits,
  name,
  txCount,
  amount,
  goalPct,
  avatarBg,
  avatarColor,
}: {
  rank: number;
  initials: string;
  name: string;
  txCount: number;
  amount: number;
  goalPct: number | null;
  avatarBg: string;
  avatarColor: string;
}) {
  return (
    <View
      style={[s.rankItem, rank === 3 ? { borderBottomWidth: 0 } : undefined]}
    >
      <Text style={s.rankNum}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{inits}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <Text style={s.rankSub}>
          {txCount} transaction{txCount > 1 ? "s" : ""}
        </Text>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{amount.toLocaleString("fr-FR")} F</Text>
        <Text style={s.rankPct}>
          {goalPct !== null ? `Objectif ${goalPct}%` : "—"}
        </Text>
      </View>
    </View>
  );
}

function FilteredClientItem({
  rank,
  initials: inits,
  name,
  amount,
  pct,
  avatarBg,
  avatarColor,
}: {
  rank: number;
  initials: string;
  name: string;
  amount: number;
  pct: number;
  avatarBg: string;
  avatarColor: string;
}) {
  return (
    <View
      style={[s.rankItem, rank === 3 ? { borderBottomWidth: 0 } : undefined]}
    >
      <Text style={s.rankNum}>{rank}</Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>{inits}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <View style={s.progTrack}>
          <View
            style={[
              s.progFill,
              { width: `${pct}%`, backgroundColor: T.orange },
            ]}
          />
        </View>
      </View>
      <View style={s.rankRight}>
        <Text style={[s.rankVal, { fontSize: 12 }]}>
          {amount.toLocaleString("fr-FR")} F
        </Text>
        <Text style={s.rankPct}>{pct}%</Text>
      </View>
    </View>
  );
}

// Focused hero for filtered tabs (Dépôts / Retraits)
function FocusedHero({
  label,
  total,
  subtitle,
  stat1,
  stat2,
  stat3,
  bgColor,
}: {
  label: string;
  total: number;
  subtitle: string;
  stat1: { val: string; lbl: string };
  stat2: { val: string; lbl: string };
  stat3: { val: string; lbl: string };
  bgColor: string;
}) {
  return (
    <View style={[s.focusedHero, { backgroundColor: bgColor }]}>
      <Text style={s.heroLabel}>{label}</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}
        <Text style={s.heroCur}> FCFA</Text>
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
  total,
  subtitle,
  trendUp,
  trendLabel,
  transactions,
  collected,
  commissions,
}: {
  total: number;
  subtitle: string;
  trendUp: boolean;
  trendLabel: string;
  transactions: number;
  collected: string;
  commissions: number;
}) {
  return (
    <View style={s.adminHero}>
      <Text style={s.heroLabel}>Épargne totale gérée</Text>
      <Text style={s.heroBig}>
        {total.toLocaleString("fr-FR")}
        <Text style={s.heroCur}> FCFA</Text>
      </Text>
      <Text style={s.heroSub}>{subtitle}</Text>
      <View style={[s.trendPill, trendUp ? s.trendUp : s.trendDn]}>
        {trendUp ? (
          <TrendingUp size={11} color="#97c459" strokeWidth={2} />
        ) : (
          <TrendingDown size={11} color="#f09595" strokeWidth={2} />
        )}
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
  rank,
  name,
  clients,
  ops,
  amount,
  trendPct,
  avatarBg,
  avatarColor,
}: {
  rank: number;
  name: string;
  clients: number;
  ops: number;
  amount: number;
  trendPct: number | null;
  avatarBg: string;
  avatarColor: string;
}) {
  const trendUp = trendPct === null || trendPct >= 0;
  return (
    <View style={[s.rankItem, { borderBottomColor: T.border }]}>
      <Text
        style={[
          s.rankNum,
          rank === 1 ? { color: T.orange, fontSize: 12 } : undefined,
        ]}
      >
        {rank}
      </Text>
      <View style={[s.rankAv, { backgroundColor: avatarBg }]}>
        <Text style={[s.rankAvText, { color: avatarColor }]}>
          {initials(name)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName}>{name}</Text>
        <Text style={s.rankSub}>
          {clients} clients · {ops} opér.
        </Text>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{amount.toLocaleString("fr-FR")} F</Text>
        {trendPct !== null && (
          <Text
            style={[
              s.rankPct,
              { color: trendUp ? T.textSuccess : T.textDanger },
            ]}
          >
            {trendUp ? "↑" : "↓"} {Math.abs(trendPct)}%
          </Text>
        )}
      </View>
    </View>
  );
}

function AgentCompBar({
  name,
  amount,
  maxAmount,
  avatarBg,
  avatarColor,
  barColor,
  blocked,
}: {
  name: string;
  amount: number;
  maxAmount: number;
  avatarBg: string;
  avatarColor: string;
  barColor: string;
  blocked?: boolean;
}) {
  const pct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0;
  return (
    <View style={[s.agentCompRow, blocked ? { opacity: 0.45 } : undefined]}>
      <View style={s.agentCompHeader}>
        <View style={s.agentCompLeft}>
          <View style={[s.agentCompAv, { backgroundColor: avatarBg }]}>
            <Text style={[s.agentCompAvText, { color: avatarColor }]}>
              {initials(name)}
            </Text>
          </View>
          <Text style={s.agentCompName}>{name}</Text>
          {blocked && (
            <View style={s.blockedBadge}>
              <Text style={s.blockedBadgeText}>Bloqué</Text>
            </View>
          )}
        </View>
        <Text
          style={[s.agentCompAmount, blocked ? { color: T.text3 } : undefined]}
        >
          {amount.toLocaleString("fr-FR")} F
        </Text>
      </View>
      <View style={[s.progTrack, { height: 7 }]}>
        <View
          style={[
            s.progFill,
            { width: `${pct}%`, height: 7, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Agent report view ────────────────────────────────────────────────────────
function AgentView() {
  const [period, setPeriod] = useState<Period>("mois");
  const [activeTab, setTab] = useState<AgentTab>("tout");

  const clients = useClientStore((s) => s.clients);
  const {
    current: filtered,
    previous: prevFiltered,
    partial,
    truncated,
  } = useReportData(period, "mine");

  const deposits = filtered.filter((t) => t.type === "deposit");
  const withdrawals = filtered.filter((t) => t.type === "withdrawal");
  const prevDeposits = prevFiltered.filter((t) => t.type === "deposit");
  const prevWithd = prevFiltered.filter((t) => t.type === "withdrawal");

  const totalDep = sum(deposits);
  const totalRet = sum(withdrawals);
  const net = totalDep - totalRet;
  const commission = commissionOf(totalDep, totalRet);

  const prevDep = sum(prevDeposits);
  const prevNet = prevDep - sum(prevWithd);
  const netTrend = trendInfo(pctChange(net, prevNet), net);
  const depTrendPct = pctChange(totalDep, prevDep);

  const activeClients = clients.filter((c) => c.status === "active").length;
  const chartBars = useMemo(
    () => buildBars(filtered, period),
    [filtered, period],
  );
  const periodLabel = PERIOD_STAT_LABEL[period];

  const topClients = useMemo(() => {
    const map = new Map<
      string,
      { amount: number; txCount: number; clientId: string }
    >();
    filtered.forEach((t) => {
      if (t.type !== "deposit") return;
      const prev = map.get(t.clientId) ?? {
        amount: 0,
        txCount: 0,
        clientId: t.clientId,
      };
      map.set(t.clientId, {
        ...prev,
        amount: prev.amount + t.amount,
        txCount: prev.txCount + 1,
      });
    });
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((e) => ({ ...e, client: clients.find((c) => c.id === e.clientId) }));
  }, [filtered, clients]);

  const maxClientAmount = topClients[0]?.amount || 1;

  // Progress toward the client's savings goal (balance / goal) — not the
  // per-collection commitment, which the period's deposits always exceed.
  const goalPctOf = (client?: (typeof clients)[number]) =>
    client?.savingsGoal && client.savingsGoal > 0
      ? Math.min(Math.round((client.balance / client.savingsGoal) * 100), 100)
      : null;

  const AGENT_TABS: { id: AgentTab; label: string }[] = [
    { id: "tout", label: "Tout" },
    { id: "depots", label: "Dépôts" },
    { id: "retraits", label: "Retraits" },
    { id: "commission", label: "Commission" },
    { id: "clients", label: "Clients" },
  ];

  const isFiltered = activeTab !== "tout";
  const peakDep = peakLabel(chartBars, "dep");
  const peakRet = peakLabel(chartBars, "ret");
  const exportReport = () =>
    exportTransactionsCsv(filtered, `mon-rapport-${period}.csv`);

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACE.xxl }}
      >
        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.topbarRow}>
            <Text style={s.pageTitle}>Mes rapports</Text>
            <View style={{ flexDirection: "row", gap: SPACE.xs }}>
              <Pressable
                style={[
                  s.iconBtn,
                  isFiltered && {
                    backgroundColor: T.orangeLt,
                    borderColor: "rgba(216,90,48,0.25)",
                  },
                ]}
                onPress={() => setTab("tout")}
              >
                <SlidersHorizontal
                  size={14}
                  color={isFiltered ? T.orange : T.text2}
                  strokeWidth={1.5}
                />
              </Pressable>
              <Pressable style={s.iconBtn} onPress={exportReport}>
                <Download size={14} color={T.text2} strokeWidth={1.5} />
              </Pressable>
            </View>
          </View>
          <PeriodBar period={period} onChange={setPeriod} />
        </View>

        {/* Pill tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillTabs}
        >
          {AGENT_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[s.ptab, activeTab === tab.id && s.ptabActiveOr]}
              onPress={() => setTab(tab.id)}
            >
              <Text
                style={[s.ptabText, activeTab === tab.id && s.ptabTextActiveOr]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <DataNotice partial={partial} truncated={truncated} />

        {/* ── Tout ── */}
        {activeTab === "tout" && (
          <>
            <AgentHero
              label={`Solde net (dépôts − retraits) · ${periodLabel}`}
              total={net}
              subtitle={`${filtered.length} transactions · ${periodLabel}`}
              trendUp={netTrend.up}
              trendLabel={netTrend.label}
              transactions={filtered.length}
              clients={activeClients}
              commission={commission.total}
            />
            <QuickStats
              deposits={totalDep}
              withdrawals={totalRet}
              depOps={deposits.length}
              retOps={withdrawals.length}
              periodLabel={periodLabel}
            />
            <View style={s.section}>
              <SectionHeader title={CHART_TITLE[period]} />
              <BarChart bars={chartBars} />
            </View>
            <View style={s.section}>
              <SectionHeader title="Mes meilleurs clients" link="Voir tous →" />
              <View style={s.card}>
                {topClients.length === 0 ? (
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucune donnée
                    </Text>
                  </View>
                ) : (
                  topClients.map((entry, i) => {
                    const goalPct = goalPctOf(entry.client);
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
                  <Text style={s.cLabel}>
                    Dépôts (×{deposits.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{commission.dep.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>
                    Retraits (×{withdrawals.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{commission.ret.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}
                  >
                    Total
                  </Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.total.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton onPress={exportReport} />
          </>
        )}

        {/* ── Dépôts tab ── */}
        {activeTab === "depots" && (
          <>
            <FocusedHero
              bgColor={T.orangeStrong}
              label={`Total dépôts — ${periodLabel}`}
              total={totalDep}
              subtitle={`${deposits.length} opérations · moy. ${deposits.length > 0 ? Math.round(totalDep / deposits.length).toLocaleString("fr-FR") : 0} F / opér.`}
              stat1={{
                val: String(new Set(deposits.map((t) => t.clientId)).size),
                lbl: "Clients déposants",
              }}
              stat2={{
                val:
                  deposits.length > 0
                    ? (
                        deposits.length /
                        Math.max(
                          new Set(deposits.map((t) => t.clientId)).size,
                          1,
                        )
                      ).toFixed(1)
                    : "0",
                lbl: "Dépôts / client",
              }}
              stat3={{
                val:
                  depTrendPct === null
                    ? "—"
                    : `${depTrendPct >= 0 ? "+" : ""}${depTrendPct}%`,
                lbl: "vs période préc.",
              }}
            />
            <View style={s.section}>
              <SectionHeader title={CHART_TITLE[period]} />
              <View style={s.card}>
                <BarChart bars={chartBars} showRet={false} />
                <Text style={s.peakDayText}>
                  {peakDep
                    ? `Pic d'activité : ${peakDep}`
                    : "Aucun dépôt sur la période"}
                </Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader
                title="Répartition par client"
                link="Voir tous →"
              />
              <View style={s.card}>
                {topClients.length === 0 ? (
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucune donnée
                    </Text>
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
            <ExportButton onPress={exportReport} label="Exporter" />
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
              stat1={{
                val: String(new Set(withdrawals.map((t) => t.clientId)).size),
                lbl: "Clients retrayants",
              }}
              stat2={{
                val:
                  withdrawals.length > 0
                    ? (
                        withdrawals.length /
                        Math.max(
                          new Set(withdrawals.map((t) => t.clientId)).size,
                          1,
                        )
                      ).toFixed(1)
                    : "0",
                lbl: "Retraits / client",
              }}
              stat3={{
                val: `${totalDep > 0 ? Math.round((totalRet / totalDep) * 100) : 0}%`,
                lbl: "du total dépôts",
              }}
            />
            <View style={s.section}>
              <SectionHeader title={CHART_TITLE[period]} />
              <View style={s.card}>
                <View style={s.barChart}>
                  {chartBars.map((b, i) => {
                    const maxVal = Math.max(...chartBars.map((x) => x.ret), 1);
                    return (
                      <View key={i} style={s.barWrap}>
                        <View
                          style={[
                            s.bar,
                            {
                              height: Math.max(4, (b.ret / maxVal) * 64),
                              backgroundColor: T.border2,
                            },
                          ]}
                        />
                        <Text style={s.barLbl}>{b.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.peakDayText}>
                  {peakRet
                    ? `Pic de retraits : ${peakRet}`
                    : "Aucun retrait sur la période"}
                </Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title="Solde net de la période" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{totalDep.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Retraits</Text>
                  <Text style={[s.cVal, { color: T.orange }]}>
                    −{totalRet.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}
                  >
                    Net
                  </Text>
                  <Text
                    style={[
                      s.cVal,
                      { color: net >= 0 ? T.greenMid : T.orange, fontSize: 15 },
                    ]}
                  >
                    {net >= 0 ? "+" : ""}
                    {net.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton onPress={exportReport} label="Exporter" />
          </>
        )}

        {/* ── Commission tab ── */}
        {activeTab === "commission" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Ma commission totale</Text>
              <Text style={s.heroBig}>
                {commission.total.toLocaleString("fr-FR")}
                <Text style={s.heroCur}> F</Text>
              </Text>
              <Text style={s.heroSub}>{periodLabel} · taux 1%</Text>
            </View>
            <View style={s.section}>
              <SectionHeader title="Détail commission" />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>
                    Dépôts (1% × {deposits.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{commission.dep.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>
                    Retraits (1% × {withdrawals.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    +{commission.ret.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}
                  >
                    Total
                  </Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.total.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton
              onPress={exportReport}
              label="Exporter mon rapport (CSV)"
            />
          </>
        )}

        {/* ── Clients tab ── */}
        {activeTab === "clients" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Activité clients</Text>
              <Text style={s.heroBig}>
                {activeClients}
                <Text style={s.heroCur}> actifs</Text>
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
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucune donnée
                    </Text>
                  </View>
                ) : (
                  topClients.map((entry, i) => {
                    const goalPct = goalPctOf(entry.client);
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
            <ExportButton
              onPress={exportReport}
              label="Exporter liste clients (CSV)"
            />
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

  const clients = useClientStore((s) => s.clients);
  const {
    current: filtered,
    previous: prevFiltered,
    agentNames,
    partial,
    truncated,
  } = useReportData(period, "branch");

  const deposits = filtered.filter((t) => t.type === "deposit");
  const withdrawals = filtered.filter((t) => t.type === "withdrawal");

  const totalDep = sum(deposits);
  const totalRet = sum(withdrawals);
  const totalSaved = clients.reduce((s, c) => s + (c.balance ?? 0), 0);
  const commission = commissionOf(totalDep, totalRet);

  // The hero shows all-time savings; its pill compares this period's deposits.
  const depTrend = trendInfo(
    pctChange(totalDep, sum(prevFiltered.filter((t) => t.type === "deposit"))),
    totalDep,
    "dépôts",
  );

  const periodLabel = PERIOD_STAT_LABEL[period];
  const chartBars = useMemo(
    () => buildBars(filtered, period),
    [filtered, period],
  );

  // Per-agent stats. "Collected" is deposits only; commission is earned on
  // every operation (deposits and withdrawals).
  const agentStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        collected: number;
        withdrawn: number;
        clientSet: Set<string>;
        ops: number;
      }
    >();
    for (const t of filtered) {
      const agentId = t.agentId;
      if (!agentId) continue;
      const entry = map.get(agentId) ?? {
        collected: 0,
        withdrawn: 0,
        clientSet: new Set<string>(),
        ops: 0,
      };
      if (t.type === "deposit") entry.collected += t.amount;
      else entry.withdrawn += t.amount;
      entry.clientSet.add(t.clientId);
      entry.ops++;
      map.set(agentId, entry);
    }
    return map;
  }, [filtered]);

  // Every agent who appears in the period's transactions; the branch query
  // names each one. The staff roster lives on the dashboard, not in the app.
  const agentRows = useMemo(
    () =>
      [...agentStatsMap.keys()].map((id) => ({
        id,
        name: agentNames.get(id) ?? "Agent inconnu",
        suspended: false,
      })),
    [agentStatsMap, agentNames],
  );

  const sortedAgents = useMemo(
    () =>
      [...agentRows].sort(
        (a, b) =>
          (agentStatsMap.get(b.id)?.collected ?? 0) -
          (agentStatsMap.get(a.id)?.collected ?? 0),
      ),
    [agentRows, agentStatsMap],
  );

  const agentCommission = (id: string) => {
    const st = agentStatsMap.get(id);
    return commissionOf(st?.collected ?? 0, st?.withdrawn ?? 0).total;
  };

  // Group breakdown
  const groupStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; balance: number }
    >();
    clients.forEach((c) => {
      const g = c.groupName ?? "Sans groupe";
      const prev = map.get(g) ?? { name: g, count: 0, balance: 0 };
      map.set(g, {
        ...prev,
        count: prev.count + 1,
        balance: prev.balance + (c.balance ?? 0),
      });
    });
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [clients]);

  const ADMIN_TABS: { id: AdminTab; label: string }[] = [
    { id: "global", label: "Vue globale" },
    { id: "agent", label: "Par agent" },
    { id: "groupe", label: "Par groupe" },
    { id: "commissions", label: "Commissions" },
  ];

  const maxAgentCollected = Math.max(
    ...sortedAgents.map((a) => agentStatsMap.get(a.id)?.collected ?? 0),
    1,
  );

  const AGENT_BAR_COLORS = [T.orange, T.blue, T.greenMid, T.orange, T.text3];

  const agentNameOf = (id?: string) =>
    (id && agentRows.find((a) => a.id === id)?.name) ?? "";
  const exportReport = () =>
    exportTransactionsCsv(
      filtered,
      `rapport-agence-${period}.csv`,
      agentNameOf,
    );

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACE.xxl }}
      >
        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.topbarRow}>
            <Text style={s.pageTitle}>Rapports</Text>
            <View style={{ flexDirection: "row", gap: SPACE.xs }}>
              <Pressable style={s.iconBtn} onPress={() => setTab("global")}>
                <SlidersHorizontal
                  size={14}
                  color={T.text2}
                  strokeWidth={1.5}
                />
              </Pressable>
              <Pressable style={s.iconBtn} onPress={exportReport}>
                <Download size={14} color={T.text2} strokeWidth={1.5} />
              </Pressable>
            </View>
          </View>
          <PeriodBar period={period} onChange={setPeriod} />
        </View>

        {/* Pill tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillTabs}
        >
          {ADMIN_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[s.ptab, activeTab === tab.id && s.ptabActiveDk]}
              onPress={() => setTab(tab.id)}
            >
              <Text
                style={[s.ptabText, activeTab === tab.id && s.ptabTextActiveDk]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <DataNotice partial={partial} truncated={truncated} />

        {/* ── Vue globale ── */}
        {activeTab === "global" && (
          <>
            <AdminHero
              total={totalSaved}
              subtitle={`${clients.length} clients · ${agentRows.length} agents`}
              trendUp={depTrend.up}
              trendLabel={depTrend.label}
              transactions={filtered.length}
              collected={
                totalDep >= 1_000_000
                  ? `${(totalDep / 1_000_000).toFixed(1)}M`
                  : totalDep.toLocaleString("fr-FR")
              }
              commissions={commission.total}
            />
            <View style={s.qstatRow}>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Dépôts totaux</Text>
                <Text style={[s.qstatVal, { color: T.greenMid }]}>
                  +{totalDep.toLocaleString("fr-FR")}
                </Text>
                <Text style={s.qstatSub}>FCFA · {deposits.length} opér.</Text>
              </View>
              <View style={s.qstat}>
                <Text style={s.qstatLbl}>Retraits totaux</Text>
                <Text style={[s.qstatVal, { color: T.orange }]}>
                  −{totalRet.toLocaleString("fr-FR")}
                </Text>
                <Text style={s.qstatSub}>
                  FCFA · {withdrawals.length} opér.
                </Text>
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title={CHART_TITLE[period]} />
              <BarChart bars={chartBars} />
            </View>
            <View style={s.section}>
              <SectionHeader title="Performance agents" link="Voir tous →" />
              <View style={s.card}>
                {sortedAgents.slice(0, 3).map((agent, i) => {
                  const stats = agentStatsMap.get(agent.id);
                  return (
                    <AgentLeaderItem
                      key={agent.id}
                      rank={i + 1}
                      name={agent.name}
                      clients={stats?.clientSet.size ?? 0}
                      ops={stats?.ops ?? 0}
                      amount={stats?.collected ?? 0}
                      trendPct={null}
                      avatarBg={AVATAR_COLORS[i % 5].bg}
                      avatarColor={AVATAR_COLORS[i % 5].fg}
                    />
                  );
                })}
                {sortedAgents.length === 0 && (
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucun agent
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={s.section}>
              <SectionHeader title={`Commissions · ${periodLabel}`} />
              <View style={s.card}>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>Dépôts (1% × {deposits.length})</Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {commission.dep.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>
                    Retraits (1% × {withdrawals.length})
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {commission.ret.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}
                  >
                    Total organisation
                  </Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.total.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            <ExportButton
              onPress={exportReport}
              label="Exporter rapport complet"
            />
          </>
        )}

        {/* ── Par agent ── */}
        {activeTab === "agent" && (
          <>
            <View style={s.section}>
              <SectionHeader title={`Collecte par agent — ${periodLabel}`} />
              <View style={s.card}>
                <View style={{ padding: SPACE.md, gap: SPACE.sm }}>
                  {sortedAgents.map((agent, i) => {
                    const stats = agentStatsMap.get(agent.id);
                    return (
                      <AgentCompBar
                        key={agent.id}
                        name={agent.name}
                        amount={stats?.collected ?? 0}
                        maxAmount={maxAgentCollected}
                        avatarBg={AVATAR_COLORS[i % 5].bg}
                        avatarColor={AVATAR_COLORS[i % 5].fg}
                        barColor={AGENT_BAR_COLORS[i % 5]}
                        blocked={agent.suspended}
                      />
                    );
                  })}
                  {sortedAgents.length === 0 && (
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucun agent
                    </Text>
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
                  <Text
                    style={[
                      s.agentTableCell,
                      { minWidth: 44, textAlign: "right" },
                    ]}
                  >
                    Clients
                  </Text>
                  <Text
                    style={[
                      s.agentTableCell,
                      { minWidth: 50, textAlign: "right" },
                    ]}
                  >
                    Opér.
                  </Text>
                  <Text
                    style={[
                      s.agentTableCell,
                      { minWidth: 64, textAlign: "right" },
                    ]}
                  >
                    Comm.
                  </Text>
                </View>
                {sortedAgents.map((agent, i) => {
                  const stats = agentStatsMap.get(agent.id);
                  const comm = agentCommission(agent.id);
                  const isLast = i === sortedAgents.length - 1;
                  return (
                    <View
                      key={agent.id}
                      style={[
                        s.agentTableRow,
                        isLast ? { borderBottomWidth: 0 } : undefined,
                      ]}
                    >
                      <Text style={[s.agentTableVal, { flex: 1 }]}>
                        {agent.name}
                      </Text>
                      <Text
                        style={[
                          s.agentTableSub,
                          { minWidth: 44, textAlign: "right" },
                        ]}
                      >
                        {stats?.clientSet.size ?? 0}
                      </Text>
                      <Text
                        style={[
                          s.agentTableSub,
                          { minWidth: 50, textAlign: "right" },
                        ]}
                      >
                        {stats?.ops ?? 0}
                      </Text>
                      <Text
                        style={[
                          s.agentTableComm,
                          { minWidth: 64, textAlign: "right" },
                        ]}
                      >
                        {comm.toLocaleString("fr-FR")} F
                      </Text>
                    </View>
                  );
                })}
                {sortedAgents.length === 0 && (
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucun agent
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <ExportButton
              onPress={exportReport}
              label="Exporter par agent (CSV)"
            />
          </>
        )}

        {/* ── Par groupe ── */}
        {activeTab === "groupe" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Groupes actifs</Text>
              <Text style={s.heroBig}>
                {groupStats.length}
                <Text style={s.heroCur}> groupes</Text>
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
                    <View
                      key={g.name}
                      style={[
                        s.rankItem,
                        isLast ? { borderBottomWidth: 0 } : undefined,
                      ]}
                    >
                      <Text style={s.rankNum}>{i + 1}</Text>
                      <View
                        style={[
                          s.rankAv,
                          { backgroundColor: AVATAR_COLORS[i % 5].bg },
                        ]}
                      >
                        <Text
                          style={[
                            s.rankAvText,
                            { color: AVATAR_COLORS[i % 5].fg },
                          ]}
                        >
                          {g.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rankName}>{g.name}</Text>
                        <View style={s.progTrack}>
                          <View
                            style={[
                              s.progFill,
                              { width: `${pct}%`, backgroundColor: T.purple },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={s.rankRight}>
                        <Text style={s.rankVal}>
                          {g.balance.toLocaleString("fr-FR")} F
                        </Text>
                        <Text style={s.rankPct}>{g.count} clients</Text>
                      </View>
                    </View>
                  );
                })}
                {groupStats.length === 0 && (
                  <View style={{ padding: SPACE.lg }}>
                    <Text style={{ fontSize: 13, color: T.text3 }}>
                      Aucun groupe défini
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <ExportButton
              onPress={exportReport}
              label="Exporter par groupe (CSV)"
            />
          </>
        )}

        {/* ── Commissions ── */}
        {activeTab === "commissions" && (
          <>
            <View style={[s.focusedHero, { backgroundColor: T.dark }]}>
              <Text style={s.heroLabel}>Commissions organisation</Text>
              <Text style={s.heroBig}>
                {commission.total.toLocaleString("fr-FR")}
                <Text style={s.heroCur}> F</Text>
              </Text>
              <Text style={s.heroSub}>
                {periodLabel} · taux 1% sur toutes opér.
              </Text>
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
                  <Text style={s.cLabel}>
                    Dépôts (1% × {deposits.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {commission.dep.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={s.cRow}>
                  <Text style={s.cLabel}>
                    Retraits (1% × {withdrawals.length} opér.)
                  </Text>
                  <Text style={[s.cVal, { color: T.greenMid }]}>
                    {commission.ret.toLocaleString("fr-FR")} F
                  </Text>
                </View>
                <View style={[s.cRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[s.cLabel, { fontWeight: "600", color: T.text1 }]}
                  >
                    Total organisation
                  </Text>
                  <Text style={[s.cVal, { color: T.orange, fontSize: 15 }]}>
                    {commission.total.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </View>
            </View>
            {sortedAgents.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="Par agent" />
                <View style={s.card}>
                  {sortedAgents.map((agent, i) => {
                    const comm = agentCommission(agent.id);
                    const isLast = i === sortedAgents.length - 1;
                    return (
                      <View
                        key={agent.id}
                        style={[
                          s.cRow,
                          isLast ? { borderBottomWidth: 0 } : undefined,
                        ]}
                      >
                        <Text style={s.cLabel}>{agent.name}</Text>
                        <Text style={[s.cVal, { color: T.textSuccess }]}>
                          {comm.toLocaleString("fr-FR")} F
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            <ExportButton
              onPress={exportReport}
              label="Exporter commissions (CSV)"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Root screen — role switch ─────────────────────────────────────────────────
export default function ReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isAdmin =
    role === "admin" ||
    role === "supervisor" ||
    role === "it_admin" ||
    role === "accountant";
  return isAdmin ? <AdminView /> : <AgentView />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg3 },

  topbar: {
    backgroundColor: T.bg,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  topbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.md,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.2,
  },
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

  periodBar: {
    flexDirection: "row",
    gap: SPACE.xs,
    backgroundColor: T.bg2,
    padding: SPACE.xs,
    borderRadius: 10,
  },
  popt: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm, borderRadius: 7 },
  poptActive: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
  },
  poptText: { fontSize: 11, fontWeight: "500", color: T.text3 },
  poptTextActive: { color: T.text1 },

  pillTabs: {
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    justifyContent: "center",
  },
  ptab: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: T.border2,
    backgroundColor: T.bg2,
  },
  ptabText: { fontSize: 11, fontWeight: "500", color: T.text2 },
  ptabActiveOr: { backgroundColor: T.orangeStrong, borderColor: T.orangeStrong },
  ptabTextActiveOr: { color: "#fff" },
  ptabActiveDk: { backgroundColor: T.dark, borderColor: T.dark },
  ptabTextActiveDk: { color: T.bg },

  hero: {
    backgroundColor: T.orangeStrong,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  adminHero: {
    backgroundColor: T.dark,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  focusedHero: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  heroLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACE.xs,
  },
  heroBig: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  heroCur: { fontSize: 14, fontWeight: "400", opacity: 0.55 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: SPACE.xs },

  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    alignSelf: "flex-start",
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
  },
  trendUp: { backgroundColor: "rgba(59,109,17,0.3)" },
  trendDn: { backgroundColor: "rgba(162,45,45,0.3)" },
  trendText: { fontSize: 11, fontWeight: "500" },
  trendTextUp: { color: "#97c459" },
  trendTextDn: { color: "#f09595" },

  kpiGrid: {
    flexDirection: "row",
    gap: SPACE.xxs,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: SPACE.md,
  },
  kpiCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: SPACE.md,
    alignItems: "center",
  },
  kcVal: { fontSize: 15, fontWeight: "600", color: "#fff" },
  kcLbl: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: SPACE.xxs },

  focusedMiniRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md },
  focusedMini: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingVertical: SPACE.sm,
    alignItems: "center",
  },
  focusedMiniVal: { fontSize: 14, fontWeight: "600", color: "#fff" },
  focusedMiniLbl: {
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
    marginTop: SPACE.xxs,
    textAlign: "center",
  },

  qstatRow: {
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
  },
  qstat: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    padding: SPACE.md,
  },
  qstatLbl: { fontSize: 10, color: T.text3, marginBottom: SPACE.xs },
  qstatVal: { fontSize: 17, fontWeight: "600" },
  qstatSub: { fontSize: 10, color: T.text3, marginTop: SPACE.xxs },

  section: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  secRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  secTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  secLink: { fontSize: 11, color: T.orange },

  card: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },

  chartLegend: {
    flexDirection: "row",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xs,
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { fontSize: 10, color: T.text2 },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.xs,
    height: 86,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  barWrap: { flex: 1, flexDirection: "column", alignItems: "center" },
  bar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLbl: { fontSize: 9, color: T.text3, marginTop: SPACE.xs },
  peakDayText: {
    fontSize: 11,
    color: T.text3,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  notice: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    padding: SPACE.md,
    borderRadius: 10,
    backgroundColor: T.bgWarning,
  },
  noticeText: { fontSize: 12, color: T.textWarning, lineHeight: 16 },

  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  rankNum: {
    width: 20,
    fontSize: 11,
    fontWeight: "600",
    color: T.text3,
    textAlign: "center",
  },
  rankAv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rankAvText: { fontSize: 11, fontWeight: "600" },
  rankName: { fontSize: 13, fontWeight: "500", color: T.text1 },
  rankSub: { fontSize: 10, color: T.text3, marginTop: SPACE.xxs },
  rankRight: { alignItems: "flex-end" },
  rankVal: { fontSize: 13, fontWeight: "600", color: T.text1 },
  rankPct: { fontSize: 10, color: T.text3, marginTop: SPACE.xxs },

  progTrack: {
    height: 4,
    backgroundColor: T.bg2,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: SPACE.xs,
  },
  progFill: { height: 4, borderRadius: 2 },

  agentCompRow: { gap: SPACE.xs },
  agentCompHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACE.xs,
  },
  agentCompLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  agentCompAv: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  agentCompAvText: { fontSize: 9, fontWeight: "600" },
  agentCompName: { fontSize: 12, fontWeight: "500", color: T.text1 },
  agentCompAmount: { fontSize: 12, fontWeight: "600", color: T.text1 },
  blockedBadge: {
    backgroundColor: T.bgDanger,
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.xxs,
    borderRadius: 4,
  },
  blockedBadgeText: { fontSize: 9, color: T.textDanger },

  agentTableHeader: {
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  agentTableCell: { fontSize: 10, color: T.text3 },
  agentTableRow: {
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  agentTableVal: { fontSize: 12, fontWeight: "500", color: T.text1 },
  agentTableSub: { fontSize: 12, color: T.text2 },
  agentTableComm: { fontSize: 12, fontWeight: "500", color: T.textSuccess },

  cRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  cLabel: { fontSize: 12, color: T.text2 },
  cVal: { fontSize: 13, fontWeight: "500" },

  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    marginHorizontal: SPACE.lg,
    marginTop: SPACE.lg,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border2,
    borderRadius: 12,
    paddingVertical: SPACE.md,
  },
  exportText: { fontSize: 13, fontWeight: "500", color: T.text1 },
});
