//app/(app)/data.tsx
/**
 * Mizo — Données (export hub)
 *
 * Screens handled by this single file (state-machine approach):
 *   hub            → landing with the export tile + recent history
 *   export-config  → step 2/3 — format + date + toggles
 *   export-done    → done
 *
 * Importing customers or past transactions from Excel/CSV happens on the
 * admin dashboard (Admin › Importer), not on the phone.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Download,
  Upload,
  RotateCcw,
  ArrowLeft,
  Check,
  FileText,
  Calendar,
  ChevronRight,
  Clock,
  Share2,
} from "lucide-react-native";
import { File as FSFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { usePermissions } from "@/hooks/usePermissions";

import { SPACE } from "@/constants/spacing";
// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#ffffff",
  bg2: "#f5f4f0",
  bg3: "#eeede8",
  bgSuccess: "#eaf3de",
  bgWarning: "#faeeda",
  bgDanger: "#fcebeb",
  bgInfo: "#e6f1fb",
  text1: "#1a1a18",
  text2: "#5f5e5a",
  text3: "#888780",
  textSuccess: "#3b6d11",
  textWarning: "#854f0b",
  textDanger: "#a32d2d",
  textInfo: "#185fa5",
  border: "rgba(0,0,0,0.09)",
  border2: "rgba(0,0,0,0.18)",
  orange: "#D85A30",
  orangeStrong: "#BB4721", // fills behind white text (5.2:1)
  orangeDk: "#993C1D",
  orangeLt: "#FAE8E0",
  green: "#2a5c0f",
  greenMid: "#3b6d11",
  greenLt: "#eaf3de",
  blue: "#185fa5",
  blueLt: "#e6f1fb",
  purple: "#534AB7",
  purpleLt: "#EEEDFE",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "hub" | "export-config" | "export-done";

// ─── Shared sub-components ────────────────────────────────────────────────────

/** Orange / blue / green full-width primary button */
function BtnMain({
  label,
  color,
  icon,
  onPress,
}: {
  label: string;
  color: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.btnMain, { backgroundColor: color }]}
    >
      {icon && <View style={{ marginRight: SPACE.xs }}>{icon}</View>}
      <Text style={styles.btnMainText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Outline secondary button */
function BtnOutline({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.btnOutline}
    >
      {icon && <View style={{ marginRight: SPACE.xs }}>{icon}</View>}
      <Text style={styles.btnOutlineText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Step progress bar — 3 or 4 segments */
function StepBar({
  total,
  done,
  active,
  accent,
}: {
  total: number;
  done: number;
  active: number;
  accent: "orange" | "blue";
}) {
  const doneColor = accent === "orange" ? T.orange : T.blue;
  const activeColor = accent === "orange" ? "#F0997B" : "#85B7EB";
  return (
    <View style={styles.stepBar}>
      {Array.from({ length: total }).map((_, i) => {
        const bg =
          i < done
            ? doneColor
            : i === done + active - done - 1 || i === active - 1
              ? activeColor
              : T.border2;
        return (
          <View key={i} style={[styles.stepSeg, { backgroundColor: bg }]} />
        );
      })}
    </View>
  );
}

/** Back row with step badge */
function BackRow({
  label,
  step,
  total,
  onBack,
}: {
  label: string;
  step: number;
  total: number;
  onBack: () => void;
}) {
  return (
    <View style={styles.backRow}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <ArrowLeft size={16} color={T.text3} strokeWidth={1.8} />
        <Text style={styles.backLabel}>{label}</Text>
      </TouchableOpacity>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>
          {step} / {total}
        </Text>
      </View>
    </View>
  );
}

/** Screen title block */
/** Section label */
function SecTitle({ label }: { label: string }) {
  return <Text style={styles.secTitle}>{label}</Text>;
}

// ─── HUB SCREEN ───────────────────────────────────────────────────────────────
function HubScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const perms = usePermissions();

  const allTiles = [
    {
      key: "export-config" as Screen,
      name: "Exporter\nles données",
      desc: "CSV, rapport PDF ou sauvegarde",
      bg: T.blueLt,
      borderColor: "rgba(24,95,165,0.18)",
      iconBg: "rgba(24,95,165,0.12)",
      icon: <Upload size={20} color={T.blue} strokeWidth={1.6} />,
      requirePerm: "exportReports" as const,
    },
  ];

  const tiles = allTiles.filter((t) => perms[t.requirePerm]);

  const history = [
    {
      label: "Export clients — avr. 2025",
      sub: "CSV · 38 enreg. · 12 ko",
      bg: T.blueLt,
      icon: <FileText size={14} color={T.blue} strokeWidth={1.4} />,
    },
    {
      label: "Sauvegarde complète",
      sub: "ZIP · 15 mars 2025 · 234 ko",
      bg: T.purpleLt,
      icon: <RotateCcw size={14} color={T.purple} strokeWidth={1.4} />,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg3 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: SPACE.xxl }}
    >
      {/* Top bar */}
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <Text style={styles.pageTitle}>Données</Text>
          <View style={styles.iconBtn}>
            <Clock size={15} color={T.text2} strokeWidth={1.4} />
          </View>
        </View>
      </View>

      {/* Sync status */}
      <View style={styles.syncRow}>
        <View style={[styles.syncDot, { backgroundColor: T.greenMid }]} />
        <Text style={styles.syncTxt}>Dernière synchronisation réussie</Text>
        <Text style={styles.syncTime}>Aujourd&apos;hui · 08:42</Text>
      </View>

      {/* Action tiles */}
      <View style={styles.sectionPad}>
        <SecTitle label="Actions disponibles" />
      </View>
      <View style={styles.actionTiles}>
        {tiles.map((t, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onNavigate(t.key)}
            activeOpacity={0.8}
            style={[
              styles.tile,
              { backgroundColor: t.bg, borderColor: t.borderColor },
            ]}
          >
            <View style={[styles.tileIcon, { backgroundColor: t.iconBg }]}>
              {t.icon}
            </View>
            <Text style={styles.tileName}>{t.name}</Text>
            <Text style={styles.tileDesc}>{t.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Imports moved to the dashboard */}
      <View style={[styles.sectionPad, { marginTop: SPACE.md }]}>
        <View style={styles.card}>
          <View style={[styles.cardRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Importer des clients ou des transactions</Text>
              <Text style={styles.cardSub}>
                Depuis un fichier Excel ou CSV, sur le tableau de bord (Admin › Importer).
                Réservé aux superviseurs, comptables et admins IT.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Recent history */}
      <View style={[styles.sectionPad, { marginTop: SPACE.md }]}>
        <SecTitle label="Historique récent" />
        <View style={styles.card}>
          {history.map((h, i) => (
            <View
              key={i}
              style={[
                styles.cardRow,
                i === history.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.sm,
                  flex: 1,
                }}
              >
                <View style={[styles.histIcon, { backgroundColor: h.bg }]}>
                  {h.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{h.label}</Text>
                  <Text style={styles.cardSub}>{h.sub}</Text>
                </View>
              </View>
              <ChevronRight size={14} color={T.text3} strokeWidth={1.5} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function shareOrSaveCsv(
  filename: string,
  content: string,
  title: string,
) {
  const file = new FSFile(Paths.cache, filename);
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: title,
  });
}

const EXPORT_CSV =
  "fullName,phoneNumber,balance,groupName\n" +
  "Aïssata Zongo,70445566,25000,Groupe A\n" +
  "Koné Seydou,76112233,18500,Groupe B\n" +
  "Hamidou Kaboré,62889900,31200,Groupe A\n";

// ─── EXPORT CONFIG ────────────────────────────────────────────────────────────
type ExportFormat = "csv" | "pdf" | "zip";

function ExportConfigScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeClients, setIncludeClients] = useState(true);
  const [includeTx, setIncludeTx] = useState(true);
  const [includeAgents, setIncludeAgents] = useState(false);
  const [includeGoals, setIncludeGoals] = useState(true);

  const formats: {
    id: ExportFormat;
    name: string;
    desc: string;
    iconBg: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "csv",
      name: "CSV",
      desc: "Compatible Excel, Google Sheets",
      iconBg: T.bgSuccess,
      icon: <FileText size={18} color={T.greenMid} strokeWidth={1.5} />,
    },
    {
      id: "pdf",
      name: "PDF",
      desc: "Rapport imprimable formaté",
      iconBg: T.bgDanger,
      icon: <FileText size={18} color={T.textDanger} strokeWidth={1.5} />,
    },
    {
      id: "zip",
      name: "Sauvegarde ZIP",
      desc: "Archive complète de toutes les données",
      iconBg: T.purpleLt,
      icon: <RotateCcw size={18} color={T.purple} strokeWidth={1.5} />,
    },
  ];

  const toggles = [
    {
      label: "Liste des clients",
      sub: "Nom, téléphone, solde, groupe",
      val: includeClients,
      set: setIncludeClients,
    },
    {
      label: "Historique des transactions",
      sub: "Dépôts, retraits, commissions",
      val: includeTx,
      set: setIncludeTx,
    },
    {
      label: "Informations agents",
      sub: "Noms, rôles, performances",
      val: includeAgents,
      set: setIncludeAgents,
    },
    {
      label: "Objectifs d'épargne",
      sub: "Montants cibles et progressions",
      val: includeGoals,
      set: setIncludeGoals,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={3} done={2} active={2} accent="blue" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACE.xxl }}
      >
        <BackRow label="Données" step={2} total={3} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Configurer\nl'export"}</Text>
          <Text style={styles.screenSub}>
            Choisissez le format et les données à exporter.
          </Text>
        </View>

        {/* Format */}
        <View style={[styles.sectionPad, { paddingBottom: SPACE.md }]}>
          <SecTitle label="Format de fichier" />
        </View>
        <View style={styles.exportOpts}>
          {formats.map((f) => {
            const sel = format === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFormat(f.id)}
                activeOpacity={0.8}
                style={[
                  styles.expCard,
                  sel && {
                    borderColor: T.orange,
                    backgroundColor: T.orangeLt,
                  },
                ]}
              >
                <View style={[styles.expIcon, { backgroundColor: f.iconBg }]}>
                  {f.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expName, sel && { color: T.orangeDk }]}>
                    {f.name}
                  </Text>
                  <Text style={styles.expDesc}>{f.desc}</Text>
                </View>
                {sel ? (
                  <View style={styles.selCheck}>
                    <Check size={10} color="#fff" strokeWidth={2} />
                  </View>
                ) : (
                  <View style={styles.uncheck} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date range */}
        <View style={[styles.sectionPad, { paddingTop: SPACE.lg, paddingBottom: SPACE.sm }]}>
          <SecTitle label="Période" />
        </View>
        <View style={styles.dateRow}>
          <View style={styles.dateInput}>
            <Text style={styles.dateInputText}>01 jan. 2025</Text>
            <Calendar size={14} color={T.text3} strokeWidth={1.4} />
          </View>
          <Text style={styles.dateArrow}>→</Text>
          <View style={styles.dateInput}>
            <Text style={styles.dateInputText}>15 avr. 2025</Text>
            <Calendar size={14} color={T.text3} strokeWidth={1.4} />
          </View>
        </View>

        {/* Data options */}
        <View style={[styles.sectionPad, { paddingTop: SPACE.lg, paddingBottom: SPACE.sm }]}>
          <SecTitle label="Données à inclure" />
        </View>
        <View style={[styles.card, { marginHorizontal: SPACE.lg }]}>
          {toggles.map((t, i) => (
            <View
              key={t.label}
              style={[
                styles.toggleRow,
                i === toggles.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flex: 1, marginRight: SPACE.md }}>
                <Text style={styles.toggleLabel}>{t.label}</Text>
                <Text style={styles.toggleSub}>{t.sub}</Text>
              </View>
              <Switch
                value={t.val}
                onValueChange={t.set}
                trackColor={{ false: T.border2, true: T.orange }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <BtnMain
            label="Générer l'export"
            color={T.blue}
            icon={<Upload size={15} color="#fff" strokeWidth={1.8} />}
            onPress={onNext}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── EXPORT DONE ──────────────────────────────────────────────────────────────
function ExportDoneScreen({ onDone }: { onDone: () => void }) {
  const stats = [
    { val: "43", lbl: "Clients" },
    { val: "318", lbl: "Transactions" },
    { val: "22 ko", lbl: "Taille" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={styles.successScreen}
      showsVerticalScrollIndicator={false}
    >
      {/* Ring */}
      <View style={[styles.successRing, { backgroundColor: T.blueLt }]}>
        <Check size={34} color={T.blue} strokeWidth={2.2} />
      </View>
      <Text style={styles.successH}>Fichier prêt !</Text>
      <Text style={styles.successP}>
        {"Votre export CSV a été généré\navec succès."}
      </Text>

      {/* File card */}
      <View style={styles.fileCard}>
        <View style={[styles.fileCardHeader, { backgroundColor: T.blue }]}>
          <FileText
            size={32}
            color="#fff"
            strokeWidth={1.5}
            style={{ marginBottom: SPACE.sm }}
          />
          <Text style={styles.fileCardName}>
            kauridorr_export_avril2025.csv
          </Text>
          <Text style={styles.fileCardMeta}>
            43 clients · 318 transactions · 22 ko
          </Text>
        </View>
        <View style={styles.fileCardStats}>
          {stats.map((s, i) => (
            <View
              key={s.lbl}
              style={[
                styles.fileCardStatCell,
                i < stats.length - 1 && styles.fileCardStatBorder,
              ]}
            >
              <Text style={styles.fileCardStatVal}>{s.val}</Text>
              <Text style={styles.fileCardStatLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress (done) */}
      <View style={styles.progressWrap}>
        <View style={styles.progLabelRow}>
          <Text style={styles.progLabel}>Génération terminée</Text>
          <Text style={[styles.progLabel, { color: T.greenMid }]}>100%</Text>
        </View>
        <View style={styles.progTrack}>
          <View
            style={[
              styles.progFill,
              { backgroundColor: T.greenMid, width: "100%" },
            ]}
          />
        </View>
      </View>

      <View style={{ width: "100%", gap: SPACE.sm, marginTop: SPACE.xs }}>
        <BtnMain
          label="Télécharger le fichier"
          color={T.blue}
          icon={<Download size={15} color="#fff" strokeWidth={1.8} />}
          onPress={() =>
            shareOrSaveCsv(
              "kauridorr_export_avril2025.csv",
              EXPORT_CSV,
              "Télécharger export",
            )
          }
        />
        <BtnOutline
          label="Partager via WhatsApp / e-mail"
          icon={<Share2 size={14} color={T.text2} strokeWidth={1.5} />}
          onPress={() =>
            shareOrSaveCsv(
              "kauridorr_export_avril2025.csv",
              EXPORT_CSV,
              "Partager export",
            )
          }
        />
        <BtnOutline label="Nouvel export" onPress={onDone} />
      </View>
    </ScrollView>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function DataScreen() {
  const [screen, setScreen] = useState<Screen>("hub");
  const nav = (s: Screen) => setScreen(s);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg3 }} edges={["top"]}>
      {screen === "hub" && <HubScreen onNavigate={nav} />}

      {screen === "export-config" && (
        <ExportConfigScreen
          onBack={() => nav("hub")}
          onNext={() => nav("export-done")}
        />
      )}

      {screen === "export-done" && (
        <ExportDoneScreen onDone={() => nav("hub")} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Top bar (hub) ──
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
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Sync row ──
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  syncTxt: { fontSize: 12, color: T.text2 },
  syncTime: { marginLeft: "auto", fontSize: 11, color: T.text3 },

  // ── Section padding ──
  sectionPad: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },

  // ── Section title ──
  secTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACE.sm,
  },

  // ── Action tiles ──
  actionTiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "40%",
    borderRadius: 16,
    padding: SPACE.lg,
    gap: SPACE.sm,
    borderWidth: 0.5,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: {
    fontSize: 14,
    fontWeight: "600",
    color: T.text1,
    lineHeight: 19,
  },
  tileDesc: {
    fontSize: 11,
    color: T.text2,
    lineHeight: 15,
  },

  // ── Cards ──
  card: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  cardLabel: { fontSize: 13, color: T.text1 },
  cardSub: { fontSize: 11, color: T.text3, marginTop: SPACE.xxs },

  histIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  colBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: 4,
  },
  colBadgeText: { fontSize: 10, fontWeight: "500" },

  // ── Step bar ──
  stepBar: { height: 3, flexDirection: "row" },
  stepSeg: { flex: 1, height: 3 },

  // ── Back row ──
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: 0,
    backgroundColor: T.bg,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  backLabel: { fontSize: 13, color: T.text3 },
  stepBadge: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  stepBadgeText: { fontSize: 11, fontWeight: "500", color: T.text3 },

  // ── Screen title block ──
  screenTitleBlock: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.lg,
    backgroundColor: T.bg,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
    marginBottom: SPACE.xs,
  },
  screenSub: { fontSize: 13, color: T.text2, lineHeight: 19 },

  divider: { height: 1, backgroundColor: T.border, marginBottom: SPACE.md },

  // ── Upload zone ──
  uploadZone: {
    marginHorizontal: SPACE.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(216,90,48,0.35)",
    borderRadius: 16,
    padding: SPACE.xxl,
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: T.orangeLt,
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(216,90,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: { fontSize: 14, fontWeight: "600", color: T.orangeDk },
  uploadSub: {
    fontSize: 12,
    color: T.orangeDk,
    opacity: 0.7,
    textAlign: "center",
    lineHeight: 18,
  },

  fmtChip: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 5,
    backgroundColor: "rgba(216,90,48,0.15)",
  },
  fmtChipText: { fontSize: 10, color: T.orangeDk, fontWeight: "500" },

  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 13,
    padding: SPACE.md,
  },

  // ── File pill ──
  filePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
  },
  fileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 13, fontWeight: "500", color: T.text1 },
  fileMeta: { fontSize: 11, color: T.text3, marginTop: SPACE.xxs },
  fileRemove: {
    marginLeft: "auto",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.bg2,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Column map ──
  colMap: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
    marginHorizontal: SPACE.lg,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  mapHeaderText: {
    fontSize: 10,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  mapCsv: { fontSize: 12, color: T.text2, fontVariant: ["tabular-nums"] },
  mapField: { fontSize: 12, fontWeight: "500", textAlign: "right" },

  // ── Validation strip ──
  validationStrip: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: T.border,
    gap: SPACE.xxs,
    backgroundColor: T.border,
  },
  valCell: {
    flex: 1,
    backgroundColor: T.bg2,
    paddingVertical: SPACE.md,
    alignItems: "center",
  },
  valNum: { fontSize: 18, fontWeight: "700" },
  valLbl: { fontSize: 10, color: T.text3, marginTop: SPACE.xxs },

  // ── Warning banner ──
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    backgroundColor: T.bgWarning,
    borderWidth: 0.5,
    borderColor: "rgba(133,79,11,0.2)",
    borderRadius: 11,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 12,
    color: T.textWarning,
    lineHeight: 17,
  },

  // ── Preview table ──
  previewTable: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
    marginHorizontal: SPACE.lg,
  },
  ptHeader: {
    flexDirection: "row",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    gap: SPACE.sm,
  },
  ptHeaderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  ptRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    gap: SPACE.sm,
  },
  ptName: { fontSize: 12, fontWeight: "500", color: T.text1 },
  ptPhone: { flex: 1, fontSize: 11, color: T.text3 },
  ptBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: 5,
  },
  ptBadgeText: { fontSize: 10 },

  // ── Export options ──
  exportOpts: {
    paddingHorizontal: SPACE.lg,
    gap: SPACE.sm,
  },
  expCard: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  expIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expName: { fontSize: 13, fontWeight: "500", color: T.text1 },
  expDesc: { fontSize: 11, color: T.text3, marginTop: SPACE.xxs },
  selCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.orangeStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  uncheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.border2,
  },

  // ── Date row ──
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginHorizontal: SPACE.lg,
  },
  dateInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 11,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
  },
  dateInputText: { fontSize: 13, fontWeight: "500", color: T.text1 },
  dateArrow: { fontSize: 13, color: T.text3, paddingHorizontal: SPACE.xs },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  toggleLabel: { fontSize: 13, color: T.text1 },
  toggleSub: { fontSize: 11, color: T.text3, marginTop: SPACE.xxs },

  // ── CTA wrap ──
  ctaWrap: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
    gap: SPACE.sm,
  },

  // ── Buttons ──
  btnMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.lg,
    borderRadius: 13,
  },
  btnMainText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.md,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: T.border2,
    backgroundColor: T.bg,
  },
  btnOutlineText: { fontSize: 13, fontWeight: "500", color: T.text1 },

  // ── Success screen ──
  successScreen: {
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xxxl,
    paddingBottom: SPACE.xxl,
  },
  successRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.lg,
  },
  successH: {
    fontSize: 22,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
    marginBottom: SPACE.xs,
  },
  successP: {
    fontSize: 13,
    color: T.text2,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: SPACE.xl,
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    width: "100%",
    marginBottom: SPACE.lg,
  },
  resultTile: {
    flexGrow: 1,
    flexBasis: "40%",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    padding: SPACE.lg,
    alignItems: "center",
  },
  resultVal: { fontSize: 22, fontWeight: "700" },
  resultLbl: {
    fontSize: 11,
    color: T.text3,
    marginTop: SPACE.xxs,
    textAlign: "center",
  },

  errSummary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    width: "100%",
    backgroundColor: T.bgWarning,
    borderWidth: 0.5,
    borderColor: "rgba(133,79,11,0.2)",
    borderRadius: 12,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.lg,
  },
  errTxt: { flex: 1, fontSize: 12, color: T.textWarning, lineHeight: 18 },

  // ── File ready card ──
  fileCard: {
    width: "100%",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: SPACE.lg,
  },
  fileCardHeader: {
    padding: SPACE.lg,
    alignItems: "center",
  },
  fileCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  fileCardMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: SPACE.xxs,
  },
  fileCardStats: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: T.border,
  },
  fileCardStatCell: {
    flex: 1,
    padding: SPACE.md,
    alignItems: "center",
  },
  fileCardStatBorder: {
    borderRightWidth: 0.5,
    borderRightColor: T.border,
  },
  fileCardStatVal: { fontSize: 15, fontWeight: "700", color: T.text1 },
  fileCardStatLbl: { fontSize: 10, color: T.text3 },

  // ── Progress bar ──
  progressWrap: { width: "100%", marginBottom: SPACE.lg },
  progLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACE.xs,
  },
  progLabel: { fontSize: 12, color: T.text2 },
  progTrack: {
    height: 8,
    backgroundColor: T.bg2,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: T.border,
  },
  progFill: { height: "100%", borderRadius: 4 },

  // ── Clean data ──
  cleanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  cleanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanLabel: { fontSize: 14, fontWeight: "600" },
  cleanSub: { fontSize: 11, color: T.text3, marginTop: SPACE.xxs },
  cleanBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: 20,
  },
  cleanBadgeTxt: { fontSize: 13, fontWeight: "700" },
});
