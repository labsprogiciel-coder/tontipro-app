// app/(app)/transactions/[id].tsx
//
// Field references for the transaction detail screen:
//   • transaction.id  — Convex Id string (same shape, no UI change)
//   • transaction.date — ISO string (the store normalises timestamp→date)
//   • clientName is resolved from the client store via convexRowToTransaction.
//   • All other field names are identical.
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Share2,
} from "lucide-react-native";
import { Shadow } from "react-native-shadow-2";

import { KAURIDORR_THEME as K } from "@/constants/colors";
import { useTransactionStore } from "@/stores/transaction-store";
import { useClientStore } from "@/stores/client-store";
import { useAuthStore } from "@/stores/auth-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
const fmtAmount = (n: number) => n.toLocaleString("fr-FR");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
};

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function InfoRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

type StatusKey = "completed" | "pending" | "reversed";
const STATUS_LABEL: Record<StatusKey, string> = {
  completed: "Validé",
  pending: "En attente",
  reversed: "Annulé",
};
const STATUS_BG: Record<StatusKey, string> = {
  completed: K.bgSuccess,
  pending: "#faeeda",
  reversed: "#fce8e8",
};
const STATUS_COLOR: Record<StatusKey, string> = {
  completed: K.textSuccess,
  pending: K.textWarning,
  reversed: "#c0392b",
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTransactionById, syncPendingTransactions } = useTransactionStore();
  const { getClientById } = useClientStore();
  const { user } = useAuthStore();
  const branchId = useAuthStore((s) => s.user?.branchId ?? "");

  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!id) return;
    const tx = getTransactionById(id);
    if (tx) {
      setTransaction(tx);
      const c = getClientById(tx.clientId);
      if (c) setClient(c);
    } else {
      Alert.alert("Erreur", "Transaction introuvable");
      router.back();
    }
    setIsLoading(false);
  }, [id, getTransactionById, getClientById, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={K.orange} />
      </SafeAreaView>
    );
  }
  if (!transaction) return null;

  const isDeposit = transaction.type === "deposit";
  const heroColor = isDeposit ? K.orange : K.green;
  const typeLabel = isDeposit ? "Dépôt" : "Retrait";
  const signPrefix = isDeposit ? "+" : "−";

  // Derive balances from the client's current balance.
  const balanceAfter = client?.balance ?? 0;
  const balanceBefore = isDeposit
    ? balanceAfter - transaction.amount
    : balanceAfter + transaction.amount;

  const commission = Math.round(transaction.amount * 0.01);

  // Build a human-readable reference from the Convex id.
  const reference = `TXN-${new Date(transaction.date)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${transaction.id.slice(-4)}`;

  const agentName = user?.name ?? "Agent";
  const agentInitials = initials(agentName);

  const timeline = [
    {
      label: "Transaction initiée",
      time: fmtTime(transaction.date),
      note: `Agent ${agentInitials}`,
      done: true,
    },
    {
      label: "PIN confirmé",
      time: fmtTime(transaction.date),
      note: "",
      done: true,
    },
    {
      label: isDeposit ? "Solde mis à jour" : "Solde débité",
      time: fmtTime(transaction.date),
      note: `${fmtAmount(balanceBefore)} → ${fmtAmount(balanceAfter)} FCFA`,
      done: transaction.status === "completed",
      green: true,
    },
  ];

  async function handleShare() {
    try {
      await Share.share({
        message: `Reçu ${typeLabel} — ${fmtAmount(transaction!.amount)} FCFA\nClient : ${
          client?.name ?? transaction!.clientName
        }\nRéf. : ${reference}\nDate : ${fmtDateTime(transaction!.date)}`,
      });
    } catch {
      // user dismissed share sheet
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero block ── */}
        <View style={[styles.heroBlock, { backgroundColor: heroColor }]}>
          <View style={styles.backRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <ChevronLeft
                size={16}
                color="rgba(255,255,255,0.75)"
                strokeWidth={2}
              />
              <Text style={styles.backLabel}>Historique</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={handleShare}>
              <Share2 size={15} color="white" strokeWidth={1.6} />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.typeBadge}>
              {isDeposit ? (
                <ArrowDownLeft size={12} color="white" strokeWidth={1.8} />
              ) : (
                <ArrowUpRight size={12} color="white" strokeWidth={1.8} />
              )}
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
            <View style={styles.heroAmountRow}>
              <Text style={styles.heroAmount}>
                {signPrefix}
                {fmtAmount(transaction.amount)}
              </Text>
              <Text style={styles.heroCurrency}>FCFA</Text>
            </View>
            <Text style={styles.heroDate}>{fmtDateTime(transaction.date)}</Text>
          </View>
        </View>

        {/* ── Balance bridge ── */}
        <Shadow
          stretch
          distance={5}
          startColor="rgba(0,0,0,0.09)"
          offset={[0, 2]}
          containerStyle={styles.balanceBridgeShadow}
        >
          <View style={styles.balanceBridge}>
            <View style={styles.balCol}>
              <Text style={styles.balLbl}>AVANT</Text>
              <Text style={styles.balVal}>{fmtAmount(balanceBefore)}</Text>
              <Text style={styles.balUnit}>FCFA</Text>
            </View>
            <View
              style={[
                styles.balArrow,
                { backgroundColor: isDeposit ? K.orangeLt : K.greenLt },
              ]}
            >
              <ArrowRight
                size={16}
                color={isDeposit ? K.orange : K.green}
                strokeWidth={1.8}
              />
            </View>
            <View style={[styles.balCol, styles.balColRight]}>
              <Text style={styles.balLbl}>APRÈS</Text>
              <Text
                style={[
                  styles.balVal,
                  { color: isDeposit ? K.textSuccess : K.orange },
                ]}
              >
                {fmtAmount(balanceAfter)}
              </Text>
              <Text style={styles.balUnit}>FCFA</Text>
            </View>
          </View>
        </Shadow>

        {/* ── Transaction details ── */}
        <View style={styles.section}>
          <SectionTitle label="Détails de la transaction" />
          <Shadow stretch distance={3} startColor="rgba(0,0,0,0.07)" offset={[0, 1]}>
            <View style={styles.infoCard}>
              <InfoRow
                label="Référence"
                value={reference}
                valueStyle={styles.monoValue}
              />
              <InfoRow
                label="Type"
                value={typeLabel}
                valueStyle={{ color: isDeposit ? K.orange : K.textSuccess }}
              />
              <InfoRow
                label="Montant"
                value={`${signPrefix}${fmtAmount(transaction.amount)} FCFA`}
                valueStyle={{ color: isDeposit ? K.textSuccess : K.orange }}
              />
              <InfoRow label="Date" value={fmtDate(transaction.date)} />
              <InfoRow label="Heure" value={fmtTime(transaction.date)} />
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Statut</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        STATUS_BG[transaction.status as StatusKey] ??
                        STATUS_BG.pending,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          STATUS_COLOR[transaction.status as StatusKey] ??
                          STATUS_COLOR.pending,
                      },
                    ]}
                  >
                    {STATUS_LABEL[transaction.status as StatusKey] ??
                      transaction.status}
                  </Text>
                </View>
              </View>
            </View>
          </Shadow>
        </View>

        {/* ── Commission ── */}
        <View style={styles.section}>
          <SectionTitle label="Commission" />
          <Shadow stretch distance={3} startColor="rgba(0,0,0,0.07)" offset={[0, 1]}>
            <View style={styles.commRow}>
              <View style={styles.commLeft}>
                <View style={styles.commIcon}>
                  <Text style={styles.commIconText}>%</Text>
                </View>
                <View>
                  <Text style={styles.commLabel}>Commission agent</Text>
                  <Text style={styles.commSub}>1% du montant</Text>
                </View>
              </View>
              <Text style={styles.commVal}>{fmtAmount(commission)} FCFA</Text>
            </View>
          </Shadow>
        </View>

        {/* ── Client ── */}
        {client && (
          <View style={styles.section}>
            <SectionTitle label="Client" />
            <Shadow stretch distance={3} startColor="rgba(0,0,0,0.07)" offset={[0, 1]}>
              <Pressable
                style={styles.clientMini}
                onPress={() => router.push(`/(app)/clients/${client.id}`)}
              >
                <View style={[styles.avatar, { backgroundColor: "#e6f1fb" }]}>
                  <Text style={[styles.avatarText, { color: "#185fa5" }]}>
                    {initials(client.name)}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientPhone}>{client.phone}</Text>
                </View>
                <View style={styles.clientRight}>
                  <Text style={styles.clientBal}>
                    {fmtAmount(client.balance)} F
                  </Text>
                  <Text style={[styles.clientLink, { color: heroColor }]}>
                    Voir profil →
                  </Text>
                </View>
              </Pressable>
            </Shadow>
          </View>
        )}

        {/* ── Agent ── */}
        <View style={styles.section}>
          <SectionTitle label="Enregistré par" />
          <Shadow stretch distance={3} startColor="rgba(0,0,0,0.07)" offset={[0, 1]}>
            <View style={styles.agentMini}>
              <View style={styles.agentAvatar}>
                <Text style={styles.agentAvatarText}>{agentInitials}</Text>
              </View>
              <View>
                <Text style={styles.agentName}>{agentName}</Text>
                <Text style={styles.agentRole}>Administrateur</Text>
              </View>
              <View style={styles.agentTime}>
                <Text style={styles.agentTimeText}>
                  {new Date(transaction.date).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.agentDate}>
                  {fmtDate(transaction.date)}
                </Text>
              </View>
            </View>
          </Shadow>
        </View>

        {/* ── Timeline ── */}
        <View style={styles.section}>
          <SectionTitle label="Historique de statut" />
          <Shadow stretch distance={3} startColor="rgba(0,0,0,0.07)" offset={[0, 1]}>
            <View style={styles.infoCard}>
              <View style={{ padding: 14, paddingBottom: 2 }}>
                {timeline.map((item, i) => (
                  <View key={i} style={styles.tlItem}>
                    <View style={styles.tlLeft}>
                      <View
                        style={[
                          styles.tlDot,
                          {
                            backgroundColor: item.done
                              ? item.green
                                ? K.textSuccess
                                : K.orange
                              : K.text3,
                          },
                        ]}
                      />
                      {i < timeline.length - 1 && (
                        <View style={styles.tlLine} />
                      )}
                    </View>
                    <View style={styles.tlContent}>
                      <Text
                        style={[
                          styles.tlEvent,
                          item.green && item.done
                            ? { color: K.textSuccess }
                            : undefined,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.tlTime}>
                        {item.time}
                        {item.note ? ` · ${item.note}` : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Shadow>
        </View>

        {/* ── Pending sync notice ── */}
        {transaction.status === "pending" && (
          <View style={styles.section}>
            <View style={styles.pendingCard}>
              <Text style={styles.pendingText}>
                Transaction en attente de synchronisation. Elle sera envoyée
                automatiquement à la prochaine connexion.
              </Text>
              <Pressable
                style={styles.syncBtn}
                onPress={() => syncPendingTransactions(branchId)}
              >
                <Text style={styles.syncBtnText}>Synchroniser maintenant</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <Pressable style={styles.btnShare} onPress={handleShare}>
            <Share2 size={14} color={K.text2} strokeWidth={1.5} />
            <Text style={styles.btnShareText}>Partager reçu</Text>
          </Pressable>
          {client && (
            <Pressable
              style={[styles.btnClient, { backgroundColor: heroColor }]}
              onPress={() => router.push(`/(app)/clients/${client.id}`)}
            >
              <Text style={styles.btnClientText}>Voir client →</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: K.bg3 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: K.bg3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  heroBlock: { paddingBottom: 36 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: { alignItems: "center", paddingTop: 16, gap: 6 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "500", color: "white" },
  heroAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  heroAmount: {
    fontSize: 46,
    fontWeight: "700",
    color: "white",
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  heroCurrency: {
    fontSize: 18,
    fontWeight: "400",
    color: "rgba(255,255,255,0.65)",
    marginBottom: 6,
  },
  heroDate: { fontSize: 12, color: "rgba(255,255,255,0.55)" },

  balanceBridgeShadow: { marginHorizontal: 18, marginTop: -16, zIndex: 2 },
  balanceBridge: {
    backgroundColor: K.bg,
    borderWidth: 0.5,
    borderColor: K.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  balCol: { flex: 1 },
  balColRight: { alignItems: "flex-end" },
  balLbl: {
    fontSize: 10,
    color: K.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  balVal: { fontSize: 15, fontWeight: "600", color: K.text1 },
  balUnit: { fontSize: 10, color: K.text3 },
  balArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  section: { paddingHorizontal: 18, paddingTop: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: K.text3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  infoCard: {
    backgroundColor: K.bg,
    borderWidth: 0.5,
    borderColor: K.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: K.border,
  },
  infoLabel: { fontSize: 12, color: K.text2 },
  infoValue: { fontSize: 13, fontWeight: "500", color: K.text1 },
  monoValue: {
    fontSize: 11,
    color: K.text3,
    fontVariant: ["tabular-nums"],
  },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "500" },

  commRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: K.bg2,
    borderWidth: 0.5,
    borderColor: K.border,
    borderRadius: 12,
    padding: 11,
    paddingHorizontal: 14,
  },
  commLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  commIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: K.orangeLt,
    alignItems: "center",
    justifyContent: "center",
  },
  commIconText: { fontSize: 13, fontWeight: "700", color: K.orange },
  commLabel: { fontSize: 13, fontWeight: "500", color: K.text1 },
  commSub: { fontSize: 10, color: K.text3 },
  commVal: { fontSize: 14, fontWeight: "600", color: K.orange },

  clientMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: K.bg,
    borderWidth: 0.5,
    borderColor: K.border,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "600" },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: "500", color: K.text1 },
  clientPhone: { fontSize: 11, color: K.text3, marginTop: 1 },
  clientRight: { alignItems: "flex-end" },
  clientBal: { fontSize: 12, fontWeight: "500", color: K.text1 },
  clientLink: { fontSize: 11, marginTop: 2 },

  agentMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: K.bg,
    borderWidth: 0.5,
    borderColor: K.border,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
  },
  agentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: K.orangeLt,
    alignItems: "center",
    justifyContent: "center",
  },
  agentAvatarText: { fontSize: 12, fontWeight: "600", color: K.orangeDk },
  agentName: { fontSize: 13, fontWeight: "500", color: K.text1 },
  agentRole: { fontSize: 11, color: K.text3, marginTop: 1 },
  agentTime: { marginLeft: "auto", alignItems: "flex-end" },
  agentTimeText: { fontSize: 11, color: K.text3 },
  agentDate: { fontSize: 10, color: K.text3, marginTop: 1 },

  tlItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tlLeft: { width: 28, alignItems: "center", flexShrink: 0 },
  tlDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tlLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: K.border2,
    minHeight: 22,
    marginTop: 2,
  },
  tlContent: { paddingBottom: 16, flex: 1 },
  tlEvent: { fontSize: 13, fontWeight: "500", color: K.text1 },
  tlTime: { fontSize: 11, color: K.text3, marginTop: 2 },

  pendingCard: {
    backgroundColor: "#faeeda",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  pendingText: {
    fontSize: 13,
    color: K.textWarning,
    textAlign: "center",
    lineHeight: 18,
  },
  syncBtn: {
    backgroundColor: K.orange,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  syncBtnText: { color: "white", fontSize: 13, fontWeight: "600" },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  btnShare: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: K.border2,
    backgroundColor: K.bg,
  },
  btnShareText: { fontSize: 12, fontWeight: "500", color: K.text1 },
  btnClient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnClientText: { fontSize: 12, fontWeight: "500", color: "white" },
});
