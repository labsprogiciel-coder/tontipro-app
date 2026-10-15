// app/(app)/clients/[id].tsx
import { useEffect, useState, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";
import { SPACE } from "@/constants/spacing";

// ── Label maps ────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Bihebdomadaire",
  monthly: "Mensuel",
};

// Convex status → display label
// 'prospect'  → active (not yet KYC-verified)
// 'verified'  → active + KYC verified
// 'rejected'  → inactive
const STATUS_LABELS: Record<string, string> = {
  prospect: "● Actif",
  verified: "● Vérifié",
  rejected: "● Inactif",
};

function formatTxTime(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Aujourd'hui · ${time}`;
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    ` · ${time}`
  );
}

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  MessageSquare,
  Archive,
  ArrowDown,
  ArrowUp,
} from "lucide-react-native";
import TransactionItem from "@/app/components/transactions/transaction-items";
import SectionHeader from "@/app/components/ui/section-header";
import { usePermissions } from "@/hooks/usePermissions";

// ── Component ─────────────────────────────────────────────────────────────────

const ClientDetails = () => {
  const router = useRouter();
  const { id, scannedId } = useLocalSearchParams<{
    id: string;
    scannedId?: string;
  }>();
  const { updateClient } = useClientStore();

  // `client` uses the local Client shape (already mapped from Convex fields in the store)
  const client = useClientStore(
    (state) => state.clients.find((c) => c.id === id) || null,
  );
  const allTransactions = useTransactionStore((state) => state.transactions);
  const allPendingTransactions = useTransactionStore(
    (state) => state.pendingTransactions,
  );

  const [isLoading, setIsLoading] = useState(true);
  const perms = usePermissions();

  const transactions = useMemo(() => {
    if (!id) return [];
    return [...allTransactions, ...allPendingTransactions]
      .filter((t) => t.clientId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [id, allTransactions, allPendingTransactions]);

  useEffect(() => {
    if (id) setIsLoading(false);
  }, [id]);

  // KYC scan result: record the ID number. The customer stays a prospect
  // until the back office verifies the document on the dashboard.
  useEffect(() => {
    if (scannedId && id && client) {
      updateClient(id, { idNumber: scannedId });
      Alert.alert(
        "Pièce d'identité enregistrée",
        `Numéro : ${scannedId}\nLa vérification KYC se fait depuis le tableau de bord.`,
      );
    }
  }, [scannedId, id, client, updateClient]);

  const handleNewDeposit = () => {
    router.push({
      pathname: "/(app)/transactions/new",
      params: { clientId: id },
    });
  };

  const handleNewWithdrawal = () => {
    router.push({
      pathname: "/(app)/transactions/new",
      params: { clientId: id, type: "withdrawal" },
    });
  };

  const handleScanKyc = () => {
    router.push({ pathname: "/(app)/clients/scan", params: { clientId: id } });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: "#888", fontSize: 14 }}>Client introuvable.</Text>
      </SafeAreaView>
    );
  }

  // Derive a display-friendly status string from the local Client shape.
  // kycVerified true  → 'verified', false + active → 'prospect', inactive → 'rejected'
  const convexStatus =
    client.status === "inactive"
      ? "rejected"
      : client.kycVerified
        ? "verified"
        : "prospect";

  // Savings goal progress
  const goal = client.savingsGoal ?? 0;
  const progressPct =
    goal > 0 ? Math.min(100, Math.round((client.balance / goal) * 100)) : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Dark Header ── */}
        <View style={styles.header}>
          <View style={styles.backRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <ChevronLeft
                color="rgba(255,255,255,0.55)"
                size={16}
                strokeWidth={1.8}
              />
              <Text style={styles.backLabel}>Mes clients</Text>
            </Pressable>
            <Pressable style={styles.moreBtn}>
              <MoreHorizontal color="white" size={16} />
            </Pressable>
          </View>

          <View style={styles.profileCenter}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {/* name is the local alias for fullName */}
                {client.name
                  .split(" ")
                  .map((w) => w[0] ?? "")
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </Text>
            </View>
            <Text style={styles.profileName}>{client.name}</Text>
            {/* phone is the local alias for phoneNumber */}
            <Text style={styles.profilePhone}>{client.phone}</Text>
            <View style={styles.profileBadges}>
              <View
                style={[
                  styles.badgeActive,
                  convexStatus === "rejected" && styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeActiveText,
                    convexStatus === "rejected" && styles.badgeInactiveText,
                  ]}
                >
                  {STATUS_LABELS[convexStatus] ?? "● Actif"}
                </Text>
              </View>
              <View style={styles.badgeSince}>
                {/* joinDate is mapped from createdAt */}
                <Text style={styles.badgeSinceText}>
                  Depuis{" "}
                  {new Date(client.joinDate).toLocaleDateString("fr-FR", {
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsStrip}>
            {/* balance — derived from collections on the server */}
            <View style={styles.statCell}>
              <Text style={styles.statVal}>
                {client.balance.toLocaleString("fr-FR")}
              </Text>
              <Text style={styles.statLbl}>Solde</Text>
            </View>

            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statVal}>{transactions.length}</Text>
              <Text style={styles.statLbl}>Transactions</Text>
            </View>

            {/* savingsGoal → metadata.savingsGoal in Convex */}
            <View style={styles.statCell}>
              <Text style={styles.statVal}>
                {client.savingsGoal
                  ? client.savingsGoal.toLocaleString("fr-FR")
                  : "—"}
              </Text>
              <Text style={styles.statLbl}>Objectif (FCFA)</Text>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>
          {/* Quick Actions */}
          <View style={styles.actionStrip}>
            <Pressable
              style={[styles.actBtn, !perms.editClient && { opacity: 0.4 }]}
              onPress={
                perms.editClient
                  ? () =>
                      router.push({
                        pathname: "/(app)/clients/add",
                        params: { clientId: id },
                      })
                  : undefined
              }
            >
              <View style={[styles.actIcon, { backgroundColor: "#FAE8E0" }]}>
                <Pencil size={15} color="#993C1D" strokeWidth={1.6} />
              </View>
              <Text style={styles.actLbl}>Modifier</Text>
            </Pressable>
            <Pressable style={styles.actBtn}>
              <View style={[styles.actIcon, { backgroundColor: "#e6f1fb" }]}>
                <MessageSquare size={15} color="#185fa5" strokeWidth={1.5} />
              </View>
              <Text style={styles.actLbl}>Note</Text>
            </Pressable>
            <Pressable style={styles.actBtn}>
              <View style={[styles.actIcon, { backgroundColor: "#f5f4f0" }]}>
                <Archive size={15} color="#5f5e5a" strokeWidth={1.5} />
              </View>
              <Text style={styles.actLbl}>Archiver</Text>
            </Pressable>
          </View>

          {/* Informations */}
          <View style={styles.section}>
            <SectionHeader
              title="Informations"
              linkText={perms.editClient ? "Modifier" : undefined}
              onLinkClick={
                perms.editClient
                  ? () =>
                      router.push({
                        pathname: "/(app)/clients/add",
                        params: { clientId: id },
                      })
                  : undefined
              }
            />
            <View style={styles.infoCard}>
              {/* fullName */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nom complet</Text>
                <Text style={styles.infoValue}>{client.name}</Text>
              </View>
              {/* phoneNumber */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone</Text>
                <Text style={[styles.infoValue, styles.infoAccent]}>
                  {client.phone}
                </Text>
              </View>
              {/* metadata.accountNumber */}
              {client.accountNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Numéro de compte</Text>
                  <Text style={styles.infoValue}>{client.accountNumber}</Text>
                </View>
              )}
              {/* metadata.address */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Adresse</Text>
                <Text style={styles.infoValue}>{client.address ?? "—"}</Text>
              </View>
              {/* metadata.groupName */}
              {client.groupName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Groupe</Text>
                  <Text style={styles.infoValue}>{client.groupName}</Text>
                </View>
              )}
              {/* metadata.commitmentAmount */}
              {client.commitmentAmount != null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Engagement/jour</Text>
                  <Text style={styles.infoValue}>
                    {client.commitmentAmount.toLocaleString("fr-FR")} F
                  </Text>
                </View>
              )}
              {/* metadata.collectionFrequency */}
              {client.collectionFrequency && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Fréquence</Text>
                  <Text style={styles.infoValue}>
                    {FREQ_LABELS[client.collectionFrequency] ??
                      client.collectionFrequency}
                  </Text>
                </View>
              )}
              {/* KYC status — derived from Convex status field */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Statut KYC</Text>
                <Text
                  style={[
                    styles.infoValue,
                    client.kycVerified ? styles.infoAccent : { color: "#888" },
                  ]}
                >
                  {client.kycVerified
                    ? `✓ Vérifié${client.kycDate ? " · " + new Date(client.kycDate).toLocaleDateString("fr-FR") : ""}`
                    : "Non vérifié"}
                </Text>
              </View>
              {/* KYC scan button (only when not yet verified) */}
              {!client.kycVerified && perms.editSensitiveClient && (
                <Pressable style={styles.kycScanRow} onPress={handleScanKyc}>
                  <Text style={styles.kycScanText}>
                    📷 Scanner la pièce d&apos;identité
                  </Text>
                </Pressable>
              )}
              {/* Savings goal progress — metadata.savingsGoal */}
              <View style={[styles.progressWrap, styles.infoRowLast]}>
                <View style={styles.progressTop}>
                  <Text style={styles.progressLabel}>Progression objectif</Text>
                  <Text style={styles.progressPct}>{progressPct}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressSub}>
                  {client.balance.toLocaleString("fr-FR")} /{" "}
                  {goal > 0 ? goal.toLocaleString("fr-FR") : "—"} FCFA
                </Text>
              </View>
            </View>
          </View>

          {/* Transactions récentes */}
          <View style={styles.section}>
            <SectionHeader
              title="Transactions récentes"
              linkText="Voir toutes"
            />
            <View style={styles.txCard}>
              {transactions.length === 0 ? (
                <View style={{ padding: SPACE.lg }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#888780",
                      textAlign: "center",
                    }}
                  >
                    Aucune transaction
                  </Text>
                </View>
              ) : (
                transactions
                  .slice(0, 5)
                  .map((tx, i) => (
                    <TransactionItem
                      key={tx.id}
                      name={tx.type === "deposit" ? "Dépôt" : "Retrait"}
                      type={tx.type}
                      time={formatTxTime(tx.date)}
                      amount={tx.amount.toLocaleString("fr-FR")}
                      isLast={i === Math.min(transactions.length, 5) - 1}
                    />
                  ))
              )}
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.bottomActions}>
            <Pressable
              style={[styles.btnDep, !perms.deposit && { opacity: 0.4 }]}
              onPress={perms.deposit ? handleNewDeposit : undefined}
            >
              <ArrowDown size={14} color="white" strokeWidth={1.8} />
              <Text style={styles.btnDepText}>Dépôt</Text>
            </Pressable>
            <Pressable
              style={[styles.btnRet, !perms.withdrawal && { opacity: 0.4 }]}
              onPress={perms.withdrawal ? handleNewWithdrawal : undefined}
            >
              <ArrowUp size={14} color="#1a1a18" strokeWidth={1.8} />
              <Text style={styles.btnRetText}>Retrait</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {},
  container: { flex: 1, backgroundColor: "#eeede8" },

  header: {
    backgroundColor: "#1a1a18",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xl,
    paddingTop: SPACE.md,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.lg,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  backLabel: { fontSize: 13, color: "rgba(255,255,255,0.55)" },
  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  profileCenter: { alignItems: "center", gap: SPACE.sm },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FAE8E0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  profileAvatarText: { fontSize: 22, fontWeight: "500", color: "#993C1D" },
  profileName: { fontSize: 18, fontWeight: "500", color: "white" },
  profilePhone: { fontSize: 12, color: "rgba(255,255,255,0.45)" },
  profileBadges: { flexDirection: "row", gap: SPACE.xs, marginTop: SPACE.xxs },
  badgeActive: {
    backgroundColor: "rgba(59,109,17,0.3)",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
  },
  badgeActiveText: { fontSize: 10, color: "#97c459" },
  badgeInactive: { backgroundColor: "rgba(180,40,40,0.25)" },
  badgeInactiveText: { color: "#e07070" },
  badgeSince: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
  },
  badgeSinceText: { fontSize: 10, color: "rgba(255,255,255,0.5)" },

  statsStrip: {
    flexDirection: "row",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: SPACE.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    alignItems: "center",
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statVal: { fontSize: 15, fontWeight: "500", color: "white" },
  statLbl: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: SPACE.xxs },

  body: { paddingBottom: SPACE.xxl },

  actionStrip: { flexDirection: "row", gap: SPACE.sm, padding: SPACE.lg, paddingBottom: 0 },
  actBtn: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 12,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    gap: SPACE.xs,
  },
  actIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  actLbl: { fontSize: 10, color: "#5f5e5a" },

  section: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },

  infoCard: {
    backgroundColor: "white",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 14,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 12, color: "#5f5e5a" },
  infoValue: { fontSize: 13, fontWeight: "500", color: "#1a1a18" },
  infoAccent: { color: "#D85A30" },

  kycScanRow: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  kycScanText: { fontSize: 13, color: "#185fa5", fontWeight: "500" },

  progressWrap: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  progressLabel: { fontSize: 12, color: "#5f5e5a" },
  progressPct: { fontSize: 12, fontWeight: "500", color: "#D85A30" },
  progressBarBg: {
    height: 6,
    backgroundColor: "#f5f4f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#D85A30",
    borderRadius: 3,
  },
  progressSub: { fontSize: 10, color: "#888780", marginTop: SPACE.xs },

  txCard: {
    backgroundColor: "white",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 14,
    overflow: "hidden",
  },

  bottomActions: {
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
  },
  btnDep: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    backgroundColor: "#D85A30",
    borderRadius: 12,
    paddingVertical: SPACE.md,
  },
  btnDepText: { color: "white", fontSize: 13, fontWeight: "500" },
  btnRet: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    backgroundColor: "white",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.18)",
    borderRadius: 12,
    paddingVertical: SPACE.md,
  },
  btnRetText: { color: "#1a1a18", fontSize: 13, fontWeight: "500" },

  rRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  rRowLast: { borderBottomWidth: 0 },
  rLabel: { fontSize: 12, color: "#5f5e5a", flex: 1 },
  rValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a18",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: SPACE.sm,
  },
});

export default ClientDetails;
