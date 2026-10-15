// app/(app)/transactions/index.tsx
import React, { useMemo, useState } from "react";
import {
  FlatList,
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
  useTransactionStore,
} from "@/stores/transaction-store";
import { useClientStore } from "@/stores/client-store";
import StatusBadge from "../../components/ui/status-bar";
import SearchInput from "../../components/quickactions/search-input";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

type SortOrder = "desc" | "asc";
type SearchType = "client" | "code";
type FilterType = "all" | "deposits" | "withdrawals";

export const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchType, setSearchType] = useState<SearchType>("client");

  const transactions = useTransactionStore((s) => s.transactions);
  const pendingTransactions = useTransactionStore((s) => s.pendingTransactions);
  const rejectedTransactions = useTransactionStore(
    (s) => s.rejectedTransactions,
  );
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

  const filteredTransactions = useMemo(() => {
    const q = search.toLowerCase();

    const result = mergedTransactions.filter((t) => {
      // Type filter
      if (filter === "deposits" && t.type !== "deposit") return false;
      if (filter === "withdrawals" && t.type !== "withdrawal") return false;

      // Search filter — only applied when the user has typed something.
      if (!q) return true;

      if (searchType === "client") {
        return t.clientName?.toLowerCase().includes(q) ?? false;
      }

      // searchType === "code" — resolve account number from the client store.
      const client = clients.find((c) => c.id === t.clientId);
      return client?.accountNumber?.toLowerCase().includes(q) ?? false;
    });

    // Secondary sort so the user can flip between newest / oldest.
    result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === "desc" ? -diff : diff;
    });

    return result;
  }, [mergedTransactions, filter, sortOrder, search, searchType, clients]);

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

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => router.push(`/(app)/transactions/${t.id}`)}
      >
        <View style={styles.left}>
          <Text style={styles.name}>{t.clientName ?? "—"}</Text>
          <Text style={styles.sub}>
            {new Date(t.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.right}>
          <View style={styles.amountRow}>
            {multiplier != null && (
              <View
                style={[
                  styles.multiplierBadge,
                  {
                    backgroundColor:
                      t.type === "deposit" ? T.bgSuccess : T.orangeLt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.multiplierText,
                    {
                      color: t.type === "deposit" ? T.textSuccess : T.orangeDk,
                    },
                  ]}
                >
                  ×{multiplier}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.amount,
                { color: t.type === "deposit" ? T.greenMid : T.orangeDk },
              ]}
            >
              {t.type === "deposit" ? "+" : "−"}
              {t.amount.toLocaleString("fr-FR")} F
            </Text>
          </View>
          <StatusBadge status={t.syncError ? "failed" : t.status} />
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

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "deposits", "withdrawals"] as FilterType[]).map((f) => {
          const label =
            f === "all" ? "Tous" : f === "deposits" ? "Dépôts" : "Retraits";
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f && styles.filterTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search type toggle */}
      <View style={styles.searchTypeRow}>
        <TouchableOpacity
          style={[
            styles.searchTypeBtn,
            searchType === "client" && styles.searchTypeBtnActive,
          ]}
          onPress={() => {
            setSearchType("client");
            setSearch("");
          }}
        >
          <Text
            style={[
              styles.searchTypeText,
              searchType === "client" && styles.searchTypeTextActive,
            ]}
          >
            Par client
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.searchTypeBtn,
            searchType === "code" && styles.searchTypeBtnActive,
          ]}
          onPress={() => {
            setSearchType("code");
            setSearch("");
          }}
        >
          <Text
            style={[
              styles.searchTypeText,
              searchType === "code" && styles.searchTypeTextActive,
            ]}
          >
            Par code
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchInputWrapper}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          onFilterPress={() => {}}
        />
      </View>

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
              {search.length > 0
                ? "Aucune transaction ne correspond à votre recherche."
                : "Les transactions apparaîtront ici une fois enregistrées."}
            </Text>
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

  filterRow: {
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xs,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: SPACE.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg2,
    alignItems: "center",
  },
  filterBtnActive: { borderColor: T.orange, backgroundColor: T.orangeLt },
  filterText: { fontSize: 12, fontWeight: "600", color: T.text3 },
  filterTextActive: { color: T.orange },

  searchTypeRow: {
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
  },
  searchTypeBtn: {
    flex: 1,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg2,
    alignItems: "center",
  },
  searchTypeBtnActive: { borderColor: T.orange, backgroundColor: T.orangeLt },
  searchTypeText: { fontSize: 12, fontWeight: "600", color: T.text3 },
  searchTypeTextActive: { color: T.orange },

  searchInputWrapper: { paddingHorizontal: SPACE.lg, marginBottom: SPACE.xs },

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
    justifyContent: "space-between",
    alignItems: "center",
    // No card behind the row: content aligns with the gutter and the date
    // headers; only vertical padding separates rows.
    paddingVertical: SPACE.md,
    marginHorizontal: SPACE.lg,
    borderBottomWidth: 0.5,
    borderColor: T.border,
  },
  left: { gap: SPACE.xs, flex: 1 },
  right: { alignItems: "flex-end", gap: SPACE.xs },
  amountRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  multiplierBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: 6,
  },
  multiplierText: { fontSize: 10, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "600", color: T.text1 },
  sub: { fontSize: 12, color: T.text3 },
  amount: { fontSize: 15, fontWeight: "700" },

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
