// app/(app)/transactions/index.tsx
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowDown, ArrowUp, ChevronLeft } from "lucide-react-native";

import { KAURIDORR_THEME } from "@/constants/colors";
import {
  mergeTransactionsSorted,
  useOwnPendingTransactions,
  useOwnRejectedTransactions,
  useTransactionStore,
} from "@/stores/transaction-store";
import { useClientStore } from "@/stores/client-store";
import StatusBadge from "../../components/ui/status-bar";
import SearchInput from "../../components/quickactions/search-input";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

type SortOrder = "desc" | "asc";
type FilterType = "all" | "deposits" | "withdrawals" | "unsynced";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "deposits", label: "Dépôts" },
  { key: "withdrawals", label: "Retraits" },
  { key: "unsynced", label: "Non synchronisés" },
];

/** Not yet confirmed by the server: queued offline, or refused by it. */
const isUnsynced = (t: { status: string; syncError?: unknown }) =>
  t.status === "pending" || Boolean(t.syncError);

export const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const transactions = useTransactionStore((s) => s.transactions);
  const pendingTransactions = useOwnPendingTransactions();
  const rejectedTransactions = useOwnRejectedTransactions();
  const clients = useClientStore((s) => s.clients);

  // Merge synced + pending into one deduplicated, sorted list. Transactions
  // the server rejected are listed (badge "Échec") so the agent can see them.
  const mergedTransactions = useMemo(
    () =>
      mergeTransactionsSorted(transactions, [
        ...pendingTransactions,
        ...rejectedTransactions,
      ]),
    [transactions, pendingTransactions, rejectedTransactions],
  );

  const accountNumbers = useMemo(
    () => new Map(clients.map((c) => [c.id, c.accountNumber?.toLowerCase()])),
    [clients],
  );

  // One search box: matches the client's name or account code
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mergedTransactions;
    return mergedTransactions.filter(
      (t) =>
        (t.clientName?.toLowerCase().includes(q) ?? false) ||
        (accountNumbers.get(t.clientId)?.includes(q) ?? false),
    );
  }, [mergedTransactions, search, accountNumbers]);

  const counts = useMemo(
    () => ({
      all: searched.length,
      deposits: searched.filter((t) => t.type === "deposit").length,
      withdrawals: searched.filter((t) => t.type === "withdrawal").length,
      unsynced: searched.filter(isUnsynced).length,
    }),
    [searched],
  );

  const filteredTransactions = useMemo(() => {
    const result = searched.filter((t) => {
      if (filter === "deposits") return t.type === "deposit";
      if (filter === "withdrawals") return t.type === "withdrawal";
      if (filter === "unsynced") return isUnsynced(t);
      return true;
    });

    // Secondary sort so the user can flip between newest / oldest.
    result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === "desc" ? -diff : diff;
    });

    return result;
  }, [searched, filter, sortOrder]);

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of filteredTransactions) {
      if (t.status === "reversed" || t.syncError) continue;
      if (t.type === "deposit") inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow };
  }, [filteredTransactions]);

  const hasFilters = filter !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  // Group by calendar day so we can render date separators.
  const groupedList = useMemo(() => {
    type HeaderItem = { type: "header"; dateKey: string };
    type TxItem = { type: "item"; data: (typeof filteredTransactions)[0] };
    const items: (HeaderItem | TxItem)[] = [];
    let lastKey = "";

    for (const t of filteredTransactions) {
      const key = new Date(t.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      if (key !== lastKey) {
        items.push({ type: "header", dateKey: key });
        lastKey = key;
      }
      items.push({ type: "item", data: t });
    }
    return items;
  }, [filteredTransactions]);

  const getMultiplier = (
    clientId: string,
    amount: number,
  ): number | undefined => {
    const commitment = clients.find((c) => c.id === clientId)?.commitmentAmount;
    if (!commitment || commitment <= 0) return undefined;
    const m = Math.round(amount / commitment);
    return m >= 1 ? m : undefined;
  };

  const renderItem = ({ item }: { item: (typeof groupedList)[0] }) => {
    if (item.type === "header") {
      return <Text style={styles.dateHeader}>{item.dateKey}</Text>;
    }

    const t = item.data;
    const multiplier = getMultiplier(t.clientId, t.amount);

    const isDeposit = t.type === "deposit";

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => router.push(`/(app)/transactions/${t.id}`)}
      >
        <View
          style={[
            styles.typeIcon,
            { backgroundColor: isDeposit ? T.greenLt : T.orangeLt },
          ]}
        >
          {isDeposit ? (
            <ArrowDown size={16} color={T.greenMid} strokeWidth={2.2} />
          ) : (
            <ArrowUp size={16} color={T.orangeDk} strokeWidth={2.2} />
          )}
        </View>
        <View style={styles.left}>
          <Text style={styles.name} numberOfLines={1}>
            {t.clientName ?? "—"}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {isDeposit ? "Dépôt" : "Retrait"} ·{" "}
            {new Date(t.date).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.right}>
          <Text
            style={[
              styles.amount,
              { color: isDeposit ? T.greenMid : T.orangeDk },
            ]}
            numberOfLines={1}
          >
            {isDeposit ? "+" : "−"}
            {t.amount.toLocaleString("fr-FR")} F
          </Text>
          <View style={styles.badgeRow}>
            {multiplier != null && (
              <View
                style={[
                  styles.multiplierBadge,
                  { backgroundColor: isDeposit ? T.bgSuccess : T.orangeLt },
                ]}
              >
                <Text
                  style={[
                    styles.multiplierText,
                    { color: isDeposit ? T.textSuccess : T.orangeDk },
                  ]}
                >
                  ×{multiplier}
                </Text>
              </View>
            )}
            <StatusBadge status={t.syncError ? "failed" : t.status} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header row */}
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ChevronLeft size={18} color={T.text2} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Historique</Text>
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
        >
          {sortOrder === "desc" ? (
            <ArrowDown size={13} color={T.orange} strokeWidth={2} />
          ) : (
            <ArrowUp size={13} color={T.orange} strokeWidth={2} />
          )}
          <Text style={styles.sortLabel}>
            {sortOrder === "desc" ? "Plus récent" : "Plus ancien"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchInputWrapper}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nom ou code client"
        />
      </View>

      {/* Type / sync filters, with how many each would show */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          const count = counts[key];
          if (key === "unsynced" && count === 0 && !on) return null;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[
                styles.chip,
                on && styles.chipOn,
                key === "unsynced" && !on && styles.chipWarn,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {label}
              </Text>
              <View style={[styles.chipCount, on && styles.chipCountOn]}>
                <Text style={[styles.chipCountText, on && styles.chipTextOn]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* What the current view adds up to */}
      {filteredTransactions.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryCount}>
            {filteredTransactions.length} opération
            {filteredTransactions.length > 1 ? "s" : ""}
          </Text>
          <View style={styles.summaryTotals}>
            {totals.inflow > 0 && (
              <Text style={[styles.summaryAmount, { color: T.greenMid }]}>
                +{totals.inflow.toLocaleString("fr-FR")} F
              </Text>
            )}
            {totals.outflow > 0 && (
              <Text style={[styles.summaryAmount, { color: T.orangeDk }]}>
                −{totals.outflow.toLocaleString("fr-FR")} F
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Transaction list with date headers */}
      <FlatList
        data={groupedList}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.type === "header" ? `hdr-${item.dateKey}` : item.data.id
        }
        contentContainerStyle={{ paddingBottom: SPACE.xl }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>Aucune transaction</Text>
            <Text style={styles.emptySubtitle}>
              {hasFilters
                ? "Aucune transaction ne correspond à ces filtres."
                : "Les transactions apparaîtront ici une fois enregistrées."}
            </Text>
            {hasFilters && (
              <Pressable style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Effacer les filtres</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default HistoryScreen;

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
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
  title: { fontSize: 22, fontWeight: "700", color: T.text1 },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    backgroundColor: T.orangeLt,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
  },
  sortLabel: { fontSize: 11, fontWeight: "500", color: T.orange },

  chipScroll: { flexGrow: 0 },
  chipRow: {
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: 34,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs + 2,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg2,
  },
  chipOn: { backgroundColor: T.orangeStrong, borderColor: T.orangeStrong },
  chipWarn: { borderColor: T.textWarning },
  chipText: { fontSize: 13, fontWeight: "600", color: T.text2 },
  chipTextOn: { color: "#fff" },
  chipCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg,
  },
  chipCountOn: { backgroundColor: "rgba(255,255,255,0.22)" },
  chipCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: T.text3,
    fontVariant: ["tabular-nums"],
  },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 0.5,
    borderColor: T.border,
  },
  summaryCount: { fontSize: 12, color: T.text3, fontWeight: "500" },
  summaryTotals: { flexDirection: "row", gap: SPACE.md },
  summaryAmount: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  clearBtn: {
    marginTop: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border2,
  },
  clearBtnText: { fontSize: 13, fontWeight: "600", color: T.text1 },

  searchInputWrapper: { paddingHorizontal: SPACE.lg },

  dateHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    // No card behind the row: content aligns with the gutter and the date
    // headers; only vertical padding separates rows.
    paddingVertical: SPACE.md,
    marginHorizontal: SPACE.lg,
    borderBottomWidth: 0.5,
    borderColor: T.border,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  left: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  right: { alignItems: "flex-end", gap: SPACE.xs },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  multiplierBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: 6,
  },
  multiplierText: { fontSize: 10, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "600", color: T.text1 },
  sub: { fontSize: 12, color: T.text3 },
  amount: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },

  emptyContainer: {
    alignItems: "center",
    marginTop: SPACE.huge,
    paddingHorizontal: SPACE.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.orangeLt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.lg,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: T.text1,
    marginBottom: SPACE.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: T.text3,
    textAlign: "center",
    lineHeight: 20,
  },
});
