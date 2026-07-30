//app/(app)/data.tsx
/**
 * Kauridorr — Données (Import / Export hub)
 *
 * Screens handled by this single file (state-machine approach):
 *   hub            → main landing with 4 action tiles + recent history
 *   import-upload  → step 1/4 — pick file
 *   import-map     → step 2/4 — column mapping
 *   import-preview → step 3/4 — validation preview
 *   import-success → done
 *   export-config  → step 2/3 — format + date + toggles
 *   export-done    → done
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Download,
  Upload,
  RotateCcw,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  FileText,
  Calendar,
  ChevronRight,
  AlertTriangle,
  X,
  Clock,
  Share2,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as FSFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissions } from "@/hooks/usePermissions";

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
type Screen =
  | "hub"
  | "import-upload"
  | "import-map"
  | "import-preview"
  | "import-success"
  | "import-tx-upload"
  | "import-tx-preview"
  | "import-tx-success"
  | "clean-data"
  | "export-config"
  | "export-done";

type ParsedRow = {
  externalId?: string;
  name: string;
  phone: string;
  accountNumber?: string;
  commitmentAmount?: number;
  address?: string;
  groupName?: string;
  rawLine: number;
  status: "ok" | "err" | "dup";
  errorReason?: string;
};

type ImportResult = {
  imported: number;
  duplicates: number;
  errors: number;
  total: number;
};

type ParsedTx = {
  id: string;
  clientId: string;
  clientName: string;
  type: "deposit" | "withdrawal";
  amount: number;
  date: string;
  agentName: string;
  notes?: string;
  rawLine: number;
  status: "ok" | "err" | "dup";
  errorReason?: string;
};

type TxImportResult = {
  imported: number;
  duplicates: number;
  errors: number;
  total: number;
};

// ─── CSV utilities ────────────────────────────────────────────────────────────

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const clean = (v: string) => v.trim().replace(/^"|"$/g, "");
  const headers = lines[0].split(",").map(clean);
  const rows = lines
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => l.split(",").map(clean));
  return { headers, rows };
}

// Maps normalised CSV header → ParsedRow field name
const HEADER_MAP: Record<string, keyof ParsedRow> = {
  id: "externalId",
  nom: "name",
  nom_complet: "name",
  name: "name",
  prenom: "name",
  prénom: "name",
  nom_client: "name",
  fullname: "name",
  full_name: "name",
  tel: "phone",
  telephone: "phone",
  téléphone: "phone",
  phone: "phone",
  mobile: "phone",
  portable: "phone",
  phonenumber: "phone",
  phone_number: "phone",
  // backup format: "Numéro de compte" normalises to this key
  numero_de_compte: "accountNumber",
  account_number: "accountNumber",
  compte: "accountNumber",
  accountnumber: "accountNumber",
  idnumber: "accountNumber",
  montant: "commitmentAmount",
  montant_engagement: "commitmentAmount",
  engagement: "commitmentAmount",
  commitment: "commitmentAmount",
  commitmentamount: "commitmentAmount",
  // backup format: "Engagement d'épargne" normalises to this key
  "engagement_d'epargne": "commitmentAmount",
  localite: "address",
  localité: "address",
  adresse: "address",
  address: "address",
  quartier: "address",
  ville: "address",
  groupe: "groupName",
  groupe_tontine: "groupName",
  group: "groupName",
  tontine: "groupName",
  groupname: "groupName",
};

function normaliseKey(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function detectMapping(
  headers: string[],
): Record<string, keyof ParsedRow | "skip"> {
  const result: Record<string, keyof ParsedRow | "skip"> = {};
  for (const h of headers) {
    result[h] = HEADER_MAP[normaliseKey(h)] ?? "skip";
  }
  return result;
}

function buildParsedRows(
  headers: string[],
  rows: string[][],
  mapping: Record<string, keyof ParsedRow | "skip">,
): ParsedRow[] {
  return rows.map((cols, i) => {
    const record: Record<string, string> = {};
    headers.forEach((h, j) => {
      record[h] = cols[j] ?? "";
    });

    let externalId: string | undefined;
    let name = "";
    let phone = "";
    let accountNumber: string | undefined;
    let commitmentAmount: number | undefined;
    let address: string | undefined;
    let groupName: string | undefined;

    for (const h of headers) {
      const field = mapping[h];
      const val = record[h];
      if (field === "externalId" && val) externalId = val || undefined;
      if (field === "name" && !name) name = val;
      if (field === "phone" && !phone) phone = val;
      if (field === "accountNumber" && val) accountNumber = val || undefined;
      if (field === "commitmentAmount" && val)
        commitmentAmount = parseFloat(val) || undefined;
      if (field === "address" && val) address = val || undefined;
      if (field === "groupName" && val) groupName = val || undefined;
    }

    return {
      externalId,
      name,
      phone,
      accountNumber,
      commitmentAmount,
      address,
      groupName,
      rawLine: i + 2,
      status: "ok",
    };
  });
}

function validateRows(
  rows: ParsedRow[],
  existingPhones: Set<string>,
): ParsedRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const phone = row.phone.replace(/\s/g, "");
    if (!row.name.trim() || !phone) {
      return {
        ...row,
        status: "err" as const,
        errorReason: "Champs requis manquants",
      };
    }
    if (existingPhones.has(phone) || seen.has(phone)) {
      return {
        ...row,
        status: "dup" as const,
        errorReason: "Doublon téléphone",
      };
    }
    seen.add(phone);
    return { ...row, status: "ok" as const };
  });
}

// ─── Transaction CSV utilities ────────────────────────────────────────────────

function parseTxDate(dateStr: string, timeStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date().toISOString();
  const [d, m, y] = parts;
  let hours = 0,
    minutes = 0;
  const t = (timeStr || "").trim();
  if (/AM|PM/i.test(t)) {
    const isPM = /PM/i.test(t);
    const [h, min] = t.replace(/\s*(AM|PM)/i, "").split(":");
    hours = parseInt(h) || 0;
    minutes = parseInt(min) || 0;
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  } else {
    const [h, min] = t.split(":");
    hours = parseInt(h) || 0;
    minutes = parseInt(min) || 0;
  }
  return new Date(
    parseInt(y),
    parseInt(m) - 1,
    parseInt(d),
    hours,
    minutes,
  ).toISOString();
}

function parseTxCsv(content: string): ParsedTx[] {
  const { headers, rows } = parseCsv(content);
  const norm = headers.map(normaliseKey);
  const col = (name: string) => norm.indexOf(normaliseKey(name));

  const iID = col("ID");
  const iCid = col("ID Client");
  const iCname = col("Nom Client");
  const iType = col("Type");
  const iAmt = col("Montant");
  const iDate = col("Date");
  const iTime = col("Heure");
  const iAgent = col("Agent");
  const iNotes = col("Notes");

  const g = (cols: string[], i: number) =>
    (i >= 0 ? (cols[i] ?? "") : "").trim();
  const seen = new Set<string>();

  return rows.map((cols, i) => {
    const id = g(cols, iID);
    const clientId = g(cols, iCid);
    const clientName = g(cols, iCname);
    const typeRaw = g(cols, iType).toLowerCase();
    const amount = parseFloat(g(cols, iAmt)) || 0;
    const dateRaw = g(cols, iDate);
    const timeRaw = g(cols, iTime);
    const agentName = g(cols, iAgent);
    const notes = g(cols, iNotes) || undefined;

    const type: "deposit" | "withdrawal" | null =
      typeRaw === "collecte"
        ? "deposit"
        : typeRaw === "retrait"
          ? "withdrawal"
          : null;

    const base = { id, clientId, clientName, agentName, notes, rawLine: i + 2 };
    const fallback = {
      ...base,
      type: (type ?? "deposit") as "deposit" | "withdrawal",
      amount,
      date: new Date().toISOString(),
    };

    if (!id || !clientId || !type || !amount || !dateRaw) {
      return {
        ...fallback,
        status: "err" as const,
        errorReason: "Champs requis manquants",
      };
    }
    if (seen.has(id)) {
      return { ...fallback, status: "dup" as const, errorReason: "ID doublon" };
    }
    seen.add(id);
    return {
      ...base,
      type,
      amount,
      date: parseTxDate(dateRaw, timeRaw),
      status: "ok" as const,
    };
  });
}

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
      {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
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
      {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
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
function ScreenTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.screenTitleBlock}>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSub}>{subtitle}</Text>
    </View>
  );
}

/** Section label */
function SecTitle({ label }: { label: string }) {
  return <Text style={styles.secTitle}>{label}</Text>;
}

// ─── HUB SCREEN ───────────────────────────────────────────────────────────────
function HubScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const perms = usePermissions();

  const allTiles = [
    {
      key: "import-upload" as Screen,
      name: "Importer\ndes clients",
      desc: "Charger un fichier CSV ou Excel",
      bg: T.orangeLt,
      borderColor: "rgba(216,90,48,0.18)",
      iconBg: "rgba(216,90,48,0.15)",
      icon: <Download size={20} color={T.orange} strokeWidth={1.6} />,
      requirePerm: "importData" as const,
    },
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
    {
      key: "import-tx-upload" as Screen,
      name: "Importer des\ntransactions",
      desc: "Charger un fichier CSV de transactions",
      bg: T.purpleLt,
      borderColor: "rgba(83,74,183,0.18)",
      iconBg: "rgba(83,74,183,0.12)",
      icon: <RotateCcw size={20} color={T.purple} strokeWidth={1.6} />,
      requirePerm: "importData" as const,
    },
    {
      key: "clean-data" as Screen,
      name: "Nettoyer\nles données",
      desc: "Effacer et réimporter",
      bg: T.bgWarning,
      borderColor: "rgba(133,79,11,0.18)",
      iconBg: "rgba(133,79,11,0.12)",
      icon: <XCircle size={20} color={T.textWarning} strokeWidth={1.6} />,
      requirePerm: "importData" as const,
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
      label: "Import membres — mars 2025",
      sub: "CSV · 24 importés · 2 erreurs",
      bg: T.orangeLt,
      icon: <Download size={14} color={T.orange} strokeWidth={1.4} />,
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
      contentContainerStyle={{ paddingBottom: 32 }}
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

      {/* Recent history */}
      <View style={[styles.sectionPad, { marginTop: 14 }]}>
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
                  gap: 10,
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

const ERROR_REPORT_CSV =
  "fullName,phoneNumber,erreur\n" +
  "Binta Diallo,,Téléphone manquant\n" +
  "Roukia Traoré,70 44 55 66,Doublon détecté\n";

const EXPORT_CSV =
  "fullName,phoneNumber,balance,groupName\n" +
  "Aïssata Zongo,70445566,25000,Groupe A\n" +
  "Koné Seydou,76112233,18500,Groupe B\n" +
  "Hamidou Kaboré,62889900,31200,Groupe A\n";

// ─── IMPORT STEP 1 — Upload file ──────────────────────────────────────────────
function ImportUploadScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (file: DocumentPicker.DocumentPickerAsset) => void;
}) {
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      onNext(result.assets[0]);
    }
  };

  const required = [
    { col: "fullName", req: true },
    { col: "phoneNumber", req: true },
    { col: "commitmentAmount", req: true },
    { col: "address", req: false },
    { col: "groupName", req: false },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={4} done={1} active={1} accent="orange" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Données" step={1} total={4} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Importer\ndes clients"}</Text>
          <Text style={styles.screenSub}>
            Chargez votre fichier de membres. Les numéros de téléphone servent
            d&apos;identifiants uniques.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Upload zone */}
        <TouchableOpacity
          onPress={pickFile}
          activeOpacity={0.8}
          style={styles.uploadZone}
        >
          <View style={styles.uploadIconWrap}>
            <Upload size={24} color={T.orange} strokeWidth={1.5} />
          </View>
          <Text style={styles.uploadTitle}>
            Appuyer pour choisir un fichier
          </Text>
          <Text style={styles.uploadSub}>
            {"Depuis votre téléphone,\nGoogle Drive ou WhatsApp"}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[".CSV", ".XLS", ".XLSX"].map((f) => (
              <View key={f} style={styles.fmtChip}>
                <Text style={styles.fmtChipText}>{f}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Template download */}
        <View style={[styles.sectionPad, { marginTop: 14 }]}>
          <SecTitle label="Modèle de fichier" />
          <TouchableOpacity activeOpacity={0.7} style={styles.templateRow}>
            <View style={[styles.histIcon, { backgroundColor: T.bgSuccess }]}>
              <Download size={16} color={T.greenMid} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Télécharger le modèle CSV</Text>
              <Text style={styles.cardSub}>
                Colonnes requises : nom, téléphone, engagement
              </Text>
            </View>
            <ChevronRight size={14} color={T.text3} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        {/* Required columns */}
        <View style={[styles.sectionPad, { marginTop: 14 }]}>
          <SecTitle label="Colonnes requises" />
          <View style={styles.card}>
            {required.map((r, i) => (
              <View
                key={r.col}
                style={[
                  styles.cardRow,
                  i === required.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.cardLabel}>{r.col}</Text>
                <View
                  style={[
                    styles.colBadge,
                    { backgroundColor: r.req ? T.bgDanger : T.bg2 },
                  ]}
                >
                  <Text
                    style={[
                      styles.colBadgeText,
                      { color: r.req ? T.textDanger : T.text3 },
                    ]}
                  >
                    {r.req ? "Requis" : "Optionnel"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── IMPORT STEP 2 — Column mapping ──────────────────────────────────────────
function ImportMapScreen({
  onBack,
  onNext,
  file,
}: {
  onBack: () => void;
  onNext: (rows: ParsedRow[]) => void;
  file: DocumentPicker.DocumentPickerAsset | null;
}) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<
    Record<string, keyof ParsedRow | "skip">
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    (async () => {
      try {
        const content = await new FSFile(file.uri).text();
        const { headers: h, rows: r } = parseCsv(content);
        setHeaders(h);
        setCsvRows(r);
        setMapping(detectMapping(h));
      } finally {
        setLoading(false);
      }
    })();
  }, [file?.uri]);

  const FIELD_LABELS: Partial<Record<keyof ParsedRow | "skip", string>> = {
    name: "fullName",
    phone: "phoneNumber",
    commitmentAmount: "commitmentAmount",
    address: "address",
    groupName: "groupName",
    accountNumber: "accountNumber",
    skip: "Ignoré",
  };

  const fieldColor = (f: keyof ParsedRow | "skip") =>
    f === "skip" ? T.text3 : T.greenMid;

  const handleConfirm = () => {
    onNext(buildParsedRows(headers, csvRows, mapping));
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={4} done={2} active={2} accent="orange" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Retour" step={2} total={4} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>
            {"Correspondance\ndes colonnes"}
          </Text>
          <Text style={styles.screenSub}>
            Fichier :{" "}
            <Text style={{ fontWeight: "600" }}>{file?.name ?? "—"}</Text>
            {csvRows.length > 0 && ` · ${csvRows.length} lignes détectées`}
          </Text>
        </View>

        {/* Attached file pill */}
        <View style={styles.filePill}>
          <View style={[styles.fileIconWrap, { backgroundColor: T.bgSuccess }]}>
            <FileText size={16} color={T.greenMid} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName}>{file?.name ?? "—"}</Text>
            <Text style={styles.fileMeta}>
              {file?.size ? `${Math.round(file.size / 1024)} ko` : ""}
              {loading ? "  Lecture…" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.fileRemove}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <X size={11} color={T.text3} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Column map */}
        <View style={[styles.sectionPad, { marginTop: 0 }]}>
          <SecTitle label="Mappage automatique détecté" />
        </View>
        <View style={styles.colMap}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderText}>Colonne CSV</Text>
            <View style={{ width: 20 }} />
            <Text style={[styles.mapHeaderText, { textAlign: "right" }]}>
              Champ Kauridorr
            </Text>
          </View>
          {headers.length === 0 && !loading && (
            <View style={{ padding: 16 }}>
              <Text style={{ color: T.text3, fontSize: 13 }}>
                Aucune colonne détectée
              </Text>
            </View>
          )}
          {headers.map((h, i) => {
            const f = mapping[h] ?? "skip";
            return (
              <View
                key={h}
                style={[
                  styles.mapRow,
                  i === headers.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.mapCsv}>{h}</Text>
                <ArrowRight size={14} color={T.text3} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.mapField,
                    { color: fieldColor(f) },
                    f === "skip" && { fontWeight: "400" },
                  ]}
                >
                  {FIELD_LABELS[f] ?? String(f)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.ctaWrap}>
          <BtnMain
            label="Valider la correspondance"
            color={T.orange}
            icon={<ArrowRight size={15} color="#fff" strokeWidth={1.8} />}
            onPress={handleConfirm}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── IMPORT STEP 3 — Validation preview ──────────────────────────────────────
function ImportPreviewScreen({
  onBack,
  onNext,
  rawRows,
}: {
  onBack: () => void;
  onNext: (result: ImportResult) => void;
  rawRows: ParsedRow[];
}) {
  const clients = useClientStore((s) => s.clients);
  const addClient = useClientStore((s) => s.addClient);
  const [importing, setImporting] = useState(false);

  const existingPhones = new Set(
    clients.map((c) => c.phone.replace(/\s/g, "")),
  );
  const rows = validateRows(rawRows, existingPhones);

  const validCount = rows.filter((r) => r.status === "ok").length;
  const dupCount = rows.filter((r) => r.status === "dup").length;
  const errCount = rows.filter((r) => r.status === "err").length;

  const errorCsv =
    "fullName,phoneNumber,ligne,erreur\n" +
    rows
      .filter((r) => r.status !== "ok")
      .map(
        (r) => `"${r.name}","${r.phone}",${r.rawLine},"${r.errorReason ?? ""}"`,
      )
      .join("\n");

  const badgeBg: Record<string, string> = {
    ok: T.bgSuccess,
    err: T.bgDanger,
    dup: T.bgWarning,
  };
  const badgeTxt: Record<string, string> = {
    ok: T.greenMid,
    err: T.textDanger,
    dup: T.textWarning,
  };
  const badgeLbl: Record<string, string> = {
    ok: "OK",
    err: "Erreur",
    dup: "Doublon",
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const valid = rows.filter((r) => r.status === "ok");
      for (const row of valid) {
        await addClient({
          id: row.externalId,
          name: row.name,
          phone: row.phone,
          accountNumber: row.accountNumber,
          address: row.address,
          groupName: row.groupName,
          commitmentAmount: row.commitmentAmount,
        });
      }
      onNext({
        imported: valid.length,
        duplicates: dupCount,
        errors: errCount,
        total: rows.length,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={4} done={3} active={3} accent="orange" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Retour" step={3} total={4} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Aperçu\navant import"}</Text>
          <Text style={styles.screenSub}>
            Vérifiez les données avant de confirmer.
          </Text>
        </View>

        {/* Validation strip */}
        <View style={styles.sectionPad}>
          <View style={styles.validationStrip}>
            {[
              { num: String(validCount), lbl: "Valides", color: T.greenMid },
              { num: String(dupCount), lbl: "Doublons", color: T.textWarning },
              { num: String(errCount), lbl: "Erreurs", color: T.textDanger },
            ].map((v) => (
              <View key={v.lbl} style={styles.valCell}>
                <Text style={[styles.valNum, { color: v.color }]}>{v.num}</Text>
                <Text style={styles.valLbl}>{v.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Warning banner — only if there are issues */}
        {(dupCount > 0 || errCount > 0) && (
          <View style={styles.warnBanner}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangle
                size={14}
                color={T.textWarning}
                strokeWidth={1.4}
              />
            </View>
            <Text style={styles.warnBannerText}>
              {dupCount > 0 &&
                `${dupCount} doublon${dupCount > 1 ? "s" : ""} détecté${dupCount > 1 ? "s" : ""} (même téléphone). `}
              {errCount > 0 &&
                `${errCount} ligne${errCount > 1 ? "s" : ""} invalide${errCount > 1 ? "s" : ""}. `}
              {`Seules les ${validCount} lignes valides seront importées.`}
            </Text>
          </View>
        )}

        {/* Preview table */}
        <View style={[styles.sectionPad, { paddingBottom: 8 }]}>
          <SecTitle
            label={`Aperçu des données (${Math.min(rows.length, 5)} premières)`}
          />
        </View>
        <View style={styles.previewTable}>
          <View style={styles.ptHeader}>
            <Text style={[styles.ptHeaderText, { flex: 2 }]}>Nom</Text>
            <Text style={styles.ptHeaderText}>Téléphone</Text>
            <Text style={[styles.ptHeaderText, { textAlign: "right" }]}>
              Statut
            </Text>
          </View>
          {rows.slice(0, 5).map((r, i) => (
            <View
              key={i}
              style={[
                styles.ptRow,
                i === Math.min(rows.length, 5) - 1 && { borderBottomWidth: 0 },
                r.status === "err" && { backgroundColor: T.bgDanger },
              ]}
            >
              <Text style={[styles.ptName, { flex: 2 }]}>{r.name || "—"}</Text>
              <Text
                style={[
                  styles.ptPhone,
                  r.status === "err" && { color: T.textDanger },
                ]}
              >
                {r.phone || "—"}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={[
                    styles.ptBadge,
                    { backgroundColor: badgeBg[r.status] },
                  ]}
                >
                  <Text
                    style={[styles.ptBadgeText, { color: badgeTxt[r.status] }]}
                  >
                    {badgeLbl[r.status]}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <BtnMain
            label={
              importing
                ? "Import en cours…"
                : `Importer ${validCount} client${validCount !== 1 ? "s" : ""} valide${validCount !== 1 ? "s" : ""}`
            }
            color={T.orange}
            icon={<Download size={15} color="#fff" strokeWidth={1.8} />}
            onPress={handleImport}
          />
          {(dupCount > 0 || errCount > 0) && (
            <BtnOutline
              label="Télécharger rapport d'erreurs"
              icon={<FileText size={14} color={T.text2} strokeWidth={1.5} />}
              onPress={() =>
                shareOrSaveCsv(
                  "rapport_erreurs.csv",
                  errorCsv,
                  "Rapport d'erreurs",
                )
              }
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── IMPORT SUCCESS ───────────────────────────────────────────────────────────
function ImportSuccessScreen({
  onDone,
  result,
}: {
  onDone: () => void;
  result: ImportResult;
}) {
  const skipped = result.duplicates + result.errors;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={styles.successScreen}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.successRing, { backgroundColor: T.orangeLt }]}>
        <Check size={34} color={T.orange} strokeWidth={2.2} />
      </View>
      <Text style={styles.successH}>Import réussi !</Text>
      <Text style={styles.successP}>
        {`${result.imported} nouveau${result.imported !== 1 ? "x" : ""} membre${result.imported !== 1 ? "s" : ""} ajouté${result.imported !== 1 ? "s" : ""} à Kauridorr.`}
      </Text>

      <View style={styles.resultGrid}>
        {[
          { val: String(result.imported), lbl: "Importés", color: T.greenMid },
          {
            val: String(result.duplicates),
            lbl: "Ignorés (doublons)",
            color: T.textWarning,
          },
          { val: String(result.errors), lbl: "Erreurs", color: T.textDanger },
          { val: String(result.total), lbl: "Total traités", color: T.text1 },
        ].map((r) => (
          <View key={r.lbl} style={styles.resultTile}>
            <Text style={[styles.resultVal, { color: r.color }]}>{r.val}</Text>
            <Text style={styles.resultLbl}>{r.lbl}</Text>
          </View>
        ))}
      </View>

      {skipped > 0 && (
        <View style={styles.errSummary}>
          <View style={{ marginTop: 1 }}>
            <AlertTriangle size={15} color={T.textWarning} strokeWidth={1.4} />
          </View>
          <Text style={styles.errTxt}>
            {`${skipped} ligne${skipped !== 1 ? "s" : ""} ignorée${skipped !== 1 ? "s" : ""}. `}
            <Text style={{ fontWeight: "600", color: T.textWarning }}>
              Téléchargez le rapport
            </Text>
            {" pour les corriger et réimporter."}
          </Text>
        </View>
      )}

      <View style={{ width: "100%", gap: 8 }}>
        <BtnMain
          label="Voir la liste des clients"
          color={T.orange}
          onPress={onDone}
        />
        {skipped > 0 && (
          <BtnOutline
            label="Télécharger rapport d'erreurs"
            icon={<FileText size={14} color={T.text2} strokeWidth={1.5} />}
            onPress={() =>
              shareOrSaveCsv(
                "rapport_erreurs.csv",
                ERROR_REPORT_CSV,
                "Rapport d'erreurs",
              )
            }
          />
        )}
        <BtnOutline label="Nouvel import" onPress={onDone} />
      </View>
    </ScrollView>
  );
}

// ─── IMPORT TX STEP 1 — Upload ───────────────────────────────────────────────
function ImportTxUploadScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (file: DocumentPicker.DocumentPickerAsset) => void;
}) {
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "application/vnd.ms-excel"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) onNext(result.assets[0]);
  };

  const columns = [
    { col: "ID", req: true },
    { col: "ID Client", req: true },
    { col: "Nom Client", req: false },
    { col: "Type", req: true },
    { col: "Montant", req: true },
    { col: "Date", req: true },
    { col: "Heure", req: false },
    { col: "Agent", req: false },
    { col: "Notes", req: false },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={3} done={1} active={1} accent="orange" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Données" step={1} total={3} onBack={onBack} />
        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Importer des\ntransactions"}</Text>
          <Text style={styles.screenSub}>
            Chargez votre fichier de transactions au format backup CSV.
          </Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          onPress={pickFile}
          activeOpacity={0.8}
          style={styles.uploadZone}
        >
          <View style={styles.uploadIconWrap}>
            <Upload size={24} color={T.orange} strokeWidth={1.5} />
          </View>
          <Text style={styles.uploadTitle}>
            Appuyer pour choisir un fichier
          </Text>
          <Text style={styles.uploadSub}>
            {"Depuis votre téléphone,\nGoogle Drive ou WhatsApp"}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={styles.fmtChip}>
              <Text style={styles.fmtChipText}>.CSV</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={[styles.sectionPad, { marginTop: 14 }]}>
          <SecTitle label="Colonnes attendues" />
          <View style={styles.card}>
            {columns.map((r, i) => (
              <View
                key={r.col}
                style={[
                  styles.cardRow,
                  i === columns.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.cardLabel}>{r.col}</Text>
                <View
                  style={[
                    styles.colBadge,
                    { backgroundColor: r.req ? T.bgDanger : T.bg2 },
                  ]}
                >
                  <Text
                    style={[
                      styles.colBadgeText,
                      { color: r.req ? T.textDanger : T.text3 },
                    ]}
                  >
                    {r.req ? "Requis" : "Optionnel"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── IMPORT TX STEP 2 — Preview ──────────────────────────────────────────────
function ImportTxPreviewScreen({
  onBack,
  onNext,
  file,
}: {
  onBack: () => void;
  onNext: (result: TxImportResult) => void;
  file: DocumentPicker.DocumentPickerAsset | null;
}) {
  const importTransactions = useTransactionStore((s) => s.importTransactions);
  const existingTxs = useTransactionStore((s) => s.transactions);
  const reconcileBalances = useClientStore((s) => s.reconcileBalances);
  const agentId = useAuthStore((s) => s.user?.id);

  const [rows, setRows] = useState<ParsedTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    (async () => {
      try {
        const content = await new FSFile(file.uri).text();
        const parsed = parseTxCsv(content);
        const existingIds = new Set(existingTxs.map((t) => t.id));
        setRows(
          parsed.map((r) =>
            r.status === "ok" && existingIds.has(r.id)
              ? {
                  ...r,
                  status: "dup" as const,
                  errorReason: "Transaction déjà présente",
                }
              : r,
          ),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [file?.uri]);

  const validCount = rows.filter((r) => r.status === "ok").length;
  const dupCount = rows.filter((r) => r.status === "dup").length;
  const errCount = rows.filter((r) => r.status === "err").length;

  const badgeBg: Record<string, string> = {
    ok: T.bgSuccess,
    err: T.bgDanger,
    dup: T.bgWarning,
  };
  const badgeTxt: Record<string, string> = {
    ok: T.greenMid,
    err: T.textDanger,
    dup: T.textWarning,
  };
  const badgeLbl: Record<string, string> = {
    ok: "OK",
    err: "Erreur",
    dup: "Doublon",
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const valid = rows.filter((r) => r.status === "ok");
      const toImport = valid.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        clientName: r.clientName,
        amount: r.amount,
        type: r.type,
        date: r.date,
        status: "completed" as const,
        agentId: agentId ?? undefined,
        notes: r.notes ?? (r.agentName ? `Agent: ${r.agentName}` : undefined),
      }));
      importTransactions(toImport);
      const allTxs = [...existingTxs, ...toImport];
      reconcileBalances(allTxs);
      onNext({
        imported: valid.length,
        duplicates: dupCount,
        errors: errCount,
        total: rows.length,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <StepBar total={3} done={2} active={2} accent="orange" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Retour" step={2} total={3} onBack={onBack} />
        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Aperçu\navant import"}</Text>
          <Text style={styles.screenSub}>
            Fichier :{" "}
            <Text style={{ fontWeight: "600" }}>{file?.name ?? "—"}</Text>
            {rows.length > 0 && ` · ${rows.length} lignes`}
          </Text>
        </View>

        <View style={styles.sectionPad}>
          <View style={styles.validationStrip}>
            {[
              { num: String(validCount), lbl: "Valides", color: T.greenMid },
              { num: String(dupCount), lbl: "Doublons", color: T.textWarning },
              { num: String(errCount), lbl: "Erreurs", color: T.textDanger },
            ].map((v) => (
              <View key={v.lbl} style={styles.valCell}>
                <Text style={[styles.valNum, { color: v.color }]}>{v.num}</Text>
                <Text style={styles.valLbl}>{v.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {(dupCount > 0 || errCount > 0) && (
          <View style={styles.warnBanner}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangle
                size={14}
                color={T.textWarning}
                strokeWidth={1.4}
              />
            </View>
            <Text style={styles.warnBannerText}>
              {dupCount > 0 &&
                `${dupCount} doublon${dupCount > 1 ? "s" : ""} ignoré${dupCount > 1 ? "s" : ""}. `}
              {errCount > 0 &&
                `${errCount} ligne${errCount > 1 ? "s" : ""} invalide${errCount > 1 ? "s" : ""}. `}
              {`Seules les ${validCount} lignes valides seront importées.`}
            </Text>
          </View>
        )}

        <View style={[styles.sectionPad, { paddingBottom: 8 }]}>
          <SecTitle
            label={`Aperçu (${Math.min(rows.length, 5)} premières lignes)`}
          />
        </View>
        <View style={styles.previewTable}>
          <View style={styles.ptHeader}>
            <Text style={[styles.ptHeaderText, { flex: 2 }]}>Client</Text>
            <Text style={styles.ptHeaderText}>Montant</Text>
            <Text style={[styles.ptHeaderText, { textAlign: "right" }]}>
              Statut
            </Text>
          </View>
          {loading && (
            <View style={{ padding: 16 }}>
              <Text style={{ color: T.text3, fontSize: 13 }}>Lecture…</Text>
            </View>
          )}
          {rows.slice(0, 5).map((r, i) => (
            <View
              key={i}
              style={[
                styles.ptRow,
                i === Math.min(rows.length, 5) - 1 && { borderBottomWidth: 0 },
                r.status === "err" && { backgroundColor: T.bgDanger },
              ]}
            >
              <Text style={[styles.ptName, { flex: 2 }]}>
                {r.clientName || "—"}
              </Text>
              <Text
                style={[
                  styles.ptPhone,
                  r.status === "err" && { color: T.textDanger },
                ]}
              >
                {r.amount.toLocaleString("fr-FR")} F
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={[
                    styles.ptBadge,
                    { backgroundColor: badgeBg[r.status] },
                  ]}
                >
                  <Text
                    style={[styles.ptBadgeText, { color: badgeTxt[r.status] }]}
                  >
                    {badgeLbl[r.status]}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <BtnMain
            label={
              importing
                ? "Import en cours…"
                : `Importer ${validCount} transaction${validCount !== 1 ? "s" : ""}`
            }
            color={T.orange}
            icon={<Download size={15} color="#fff" strokeWidth={1.8} />}
            onPress={handleImport}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── IMPORT TX SUCCESS ────────────────────────────────────────────────────────
function ImportTxSuccessScreen({
  onDone,
  result,
}: {
  onDone: () => void;
  result: TxImportResult;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={styles.successScreen}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.successRing, { backgroundColor: T.purpleLt }]}>
        <Check size={34} color={T.purple} strokeWidth={2.2} />
      </View>
      <Text style={styles.successH}>Import réussi !</Text>
      <Text style={styles.successP}>
        {`${result.imported} transaction${result.imported !== 1 ? "s" : ""} importée${result.imported !== 1 ? "s" : ""}.`}
      </Text>
      <View style={styles.resultGrid}>
        {[
          { val: String(result.imported), lbl: "Importées", color: T.greenMid },
          {
            val: String(result.duplicates),
            lbl: "Ignorées (doublons)",
            color: T.textWarning,
          },
          { val: String(result.errors), lbl: "Erreurs", color: T.textDanger },
          { val: String(result.total), lbl: "Total traitées", color: T.text1 },
        ].map((r) => (
          <View key={r.lbl} style={styles.resultTile}>
            <Text style={[styles.resultVal, { color: r.color }]}>{r.val}</Text>
            <Text style={styles.resultLbl}>{r.lbl}</Text>
          </View>
        ))}
      </View>
      <View style={{ width: "100%", gap: 8 }}>
        <BtnMain label="Retour aux données" color={T.purple} onPress={onDone} />
        <BtnOutline label="Nouvel import" onPress={onDone} />
      </View>
    </ScrollView>
  );
}

// ─── CLEAN DATA ───────────────────────────────────────────────────────────────
function CleanDataScreen({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (s: Screen) => void;
}) {
  const clients = useClientStore((s) => s.clients);
  const clearClients = useClientStore((s) => s.clearAll);
  const reconcileBalances = useClientStore((s) => s.reconcileBalances);
  const transactions = useTransactionStore((s) => s.transactions);
  const pendingTxs = useTransactionStore((s) => s.pendingTransactions);
  const clearTxs = useTransactionStore((s) => s.clearAll);

  const clientCount = clients.length;
  const txCount = transactions.length + pendingTxs.length;

  const confirm = (title: string, message: string, onConfirm: () => void) =>
    Alert.alert(title, message, [
      { text: "Annuler", style: "cancel" },
      { text: "Effacer", style: "destructive", onPress: onConfirm },
    ]);

  const actions = [
    {
      label: "Effacer les clients",
      sub: `${clientCount} client${clientCount !== 1 ? "s" : ""} en mémoire`,
      count: clientCount,
      bg: T.bgDanger,
      border: "rgba(163,45,45,0.18)",
      iconBg: "rgba(163,45,45,0.12)",
      txtColor: T.textDanger,
      reimport: "import-upload" as Screen,
      onPress: () =>
        confirm(
          "Effacer les clients ?",
          `Cette action supprimera ${clientCount} client${clientCount !== 1 ? "s" : ""} de l'appareil. Les données sur le serveur ne seront pas affectées.`,
          clearClients,
        ),
    },
    {
      label: "Effacer les transactions",
      sub: `${txCount} transaction${txCount !== 1 ? "s" : ""} en mémoire`,
      count: txCount,
      bg: T.bgWarning,
      border: "rgba(133,79,11,0.18)",
      iconBg: "rgba(133,79,11,0.12)",
      txtColor: T.textWarning,
      reimport: "import-tx-upload" as Screen,
      onPress: () =>
        confirm(
          "Effacer les transactions ?",
          `Cette action supprimera ${txCount} transaction${txCount !== 1 ? "s" : ""} de l'appareil. Les données sur le serveur ne seront pas affectées.`,
          clearTxs,
        ),
    },
    {
      label: "Tout effacer",
      sub: `Clients + transactions`,
      count: clientCount + txCount,
      bg: T.bg2,
      border: T.border2,
      iconBg: T.bg3,
      txtColor: T.text1,
      reimport: "import-upload" as Screen,
      onPress: () =>
        confirm(
          "Tout effacer ?",
          `Supprime ${clientCount} client${clientCount !== 1 ? "s" : ""} et ${txCount} transaction${txCount !== 1 ? "s" : ""} de l'appareil.`,
          () => {
            clearClients();
            clearTxs();
          },
        ),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Données" step={1} total={1} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Nettoyer\nles données"}</Text>
          <Text style={styles.screenSub}>
            Effacez les données locales pour repartir d&apos;un import propre. Les
            données sur le serveur restent intactes.
          </Text>
        </View>

        <View style={[styles.sectionPad, { paddingBottom: 10 }]}>
          <SecTitle label="Actions disponibles" />
        </View>

        <View style={{ paddingHorizontal: 18, gap: 10 }}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={a.onPress}
              activeOpacity={0.8}
              style={[
                styles.cleanCard,
                { backgroundColor: a.bg, borderColor: a.border },
              ]}
            >
              <View style={[styles.cleanIcon, { backgroundColor: a.iconBg }]}>
                <XCircle size={20} color={a.txtColor} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cleanLabel, { color: a.txtColor }]}>
                  {a.label}
                </Text>
                <Text style={styles.cleanSub}>{a.sub}</Text>
              </View>
              <View style={[styles.cleanBadge, { backgroundColor: a.iconBg }]}>
                <Text style={[styles.cleanBadgeTxt, { color: a.txtColor }]}>
                  {a.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[styles.sectionPad, { paddingTop: 20, paddingBottom: 10 }]}
        >
          <SecTitle label="Réconciliation" />
        </View>
        <View style={{ paddingHorizontal: 18, gap: 8 }}>
          <BtnOutline
            label="Recalculer les soldes depuis les transactions"
            icon={<RotateCcw size={14} color={T.text2} strokeWidth={1.5} />}
            onPress={() => reconcileBalances([...transactions, ...pendingTxs])}
          />
        </View>

        <View
          style={[styles.sectionPad, { paddingTop: 20, paddingBottom: 10 }]}
        >
          <SecTitle label="Réimporter après nettoyage" />
        </View>
        <View style={{ paddingHorizontal: 18, gap: 8 }}>
          <BtnMain
            label="Importer des clients"
            color={T.orange}
            icon={<Download size={15} color="#fff" strokeWidth={1.8} />}
            onPress={() => onNavigate("import-upload")}
          />
          <BtnOutline
            label="Importer des transactions"
            icon={<RotateCcw size={14} color={T.text2} strokeWidth={1.5} />}
            onPress={() => onNavigate("import-tx-upload")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

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
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <BackRow label="Données" step={2} total={3} onBack={onBack} />

        <View style={styles.screenTitleBlock}>
          <Text style={styles.screenTitle}>{"Configurer\nl'export"}</Text>
          <Text style={styles.screenSub}>
            Choisissez le format et les données à exporter.
          </Text>
        </View>

        {/* Format */}
        <View style={[styles.sectionPad, { paddingBottom: 10 }]}>
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
        <View style={[styles.sectionPad, { paddingTop: 14, paddingBottom: 8 }]}>
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
        <View style={[styles.sectionPad, { paddingTop: 14, paddingBottom: 8 }]}>
          <SecTitle label="Données à inclure" />
        </View>
        <View style={[styles.card, { marginHorizontal: 18 }]}>
          {toggles.map((t, i) => (
            <View
              key={t.label}
              style={[
                styles.toggleRow,
                i === toggles.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
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
            style={{ marginBottom: 8 }}
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

      <View style={{ width: "100%", gap: 8, marginTop: 4 }}>
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
  const [pickedFile, setPickedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [txFile, setTxFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult>({
    imported: 0,
    duplicates: 0,
    errors: 0,
    total: 0,
  });
  const [txResult, setTxResult] = useState<TxImportResult>({
    imported: 0,
    duplicates: 0,
    errors: 0,
    total: 0,
  });

  const nav = (s: Screen) => setScreen(s);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg3 }} edges={["top"]}>
      {screen === "hub" && <HubScreen onNavigate={nav} />}

      {screen === "import-upload" && (
        <ImportUploadScreen
          onBack={() => nav("hub")}
          onNext={(file) => {
            setPickedFile(file);
            nav("import-map");
          }}
        />
      )}

      {screen === "import-map" && (
        <ImportMapScreen
          onBack={() => nav("import-upload")}
          onNext={(rows) => {
            setParsedRows(rows);
            nav("import-preview");
          }}
          file={pickedFile}
        />
      )}

      {screen === "import-preview" && (
        <ImportPreviewScreen
          onBack={() => nav("import-map")}
          onNext={(result) => {
            setImportResult(result);
            nav("import-success");
          }}
          rawRows={parsedRows}
        />
      )}

      {screen === "import-success" && (
        <ImportSuccessScreen onDone={() => nav("hub")} result={importResult} />
      )}

      {screen === "import-tx-upload" && (
        <ImportTxUploadScreen
          onBack={() => nav("hub")}
          onNext={(file) => {
            setTxFile(file);
            nav("import-tx-preview");
          }}
        />
      )}

      {screen === "import-tx-preview" && (
        <ImportTxPreviewScreen
          onBack={() => nav("import-tx-upload")}
          onNext={(result) => {
            setTxResult(result);
            nav("import-tx-success");
          }}
          file={txFile}
        />
      )}

      {screen === "import-tx-success" && (
        <ImportTxSuccessScreen onDone={() => nav("hub")} result={txResult} />
      )}

      {screen === "clean-data" && (
        <CleanDataScreen onBack={() => nav("hub")} onNavigate={nav} />
      )}

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
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
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
  sectionPad: { paddingHorizontal: 18, paddingTop: 14 },

  // ── Section title ──
  secTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // ── Action tiles ──
  actionTiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
  },
  tile: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    gap: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  cardLabel: { fontSize: 13, color: T.text1 },
  cardSub: { fontSize: 11, color: T.text3, marginTop: 1 },

  histIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  colBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
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
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 0,
    backgroundColor: T.bg,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  backLabel: { fontSize: 13, color: T.text3 },
  stepBadge: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  stepBadgeText: { fontSize: 11, fontWeight: "500", color: T.text3 },

  // ── Screen title block ──
  screenTitleBlock: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: T.bg,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  screenSub: { fontSize: 13, color: T.text2, lineHeight: 19 },

  divider: { height: 1, backgroundColor: T.border, marginBottom: 14 },

  // ── Upload zone ──
  uploadZone: {
    marginHorizontal: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(216,90,48,0.35)",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(216,90,48,0.15)",
  },
  fmtChipText: { fontSize: 10, color: T.orangeDk, fontWeight: "500" },

  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 13,
    padding: 12,
  },

  // ── File pill ──
  filePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  fileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 13, fontWeight: "500", color: T.text1 },
  fileMeta: { fontSize: 11, color: T.text3, marginTop: 1 },
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
    marginHorizontal: 18,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    gap: 1,
    backgroundColor: T.border,
  },
  valCell: {
    flex: 1,
    backgroundColor: T.bg2,
    paddingVertical: 10,
    alignItems: "center",
  },
  valNum: { fontSize: 18, fontWeight: "700" },
  valLbl: { fontSize: 10, color: T.text3, marginTop: 1 },

  // ── Warning banner ──
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: T.bgWarning,
    borderWidth: 0.5,
    borderColor: "rgba(133,79,11,0.2)",
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
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
    marginHorizontal: 18,
  },
  ptHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T.bg2,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    gap: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
    gap: 8,
  },
  ptName: { fontSize: 12, fontWeight: "500", color: T.text1 },
  ptPhone: { flex: 1, fontSize: 11, color: T.text3 },
  ptBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ptBadgeText: { fontSize: 10 },

  // ── Export options ──
  exportOpts: {
    paddingHorizontal: 18,
    gap: 8,
  },
  expCard: {
    backgroundColor: T.bg,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  expIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expName: { fontSize: 13, fontWeight: "500", color: T.text1 },
  expDesc: { fontSize: 11, color: T.text3, marginTop: 1 },
  selCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.orange,
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
    gap: 8,
    marginHorizontal: 18,
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
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  dateInputText: { fontSize: 13, fontWeight: "500", color: T.text1 },
  dateArrow: { fontSize: 13, color: T.text3, paddingHorizontal: 4 },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  toggleLabel: { fontSize: 13, color: T.text1 },
  toggleSub: { fontSize: 11, color: T.text3, marginTop: 1 },

  // ── CTA wrap ──
  ctaWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 8,
  },

  // ── Buttons ──
  btnMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
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
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: T.border2,
    backgroundColor: T.bg,
  },
  btnOutlineText: { fontSize: 13, fontWeight: "500", color: T.text1 },

  // ── Success screen ──
  successScreen: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 28,
  },
  successRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successH: {
    fontSize: 22,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  successP: {
    fontSize: 13,
    color: T.text2,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 22,
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
    marginBottom: 18,
  },
  resultTile: {
    width: "47%",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  resultVal: { fontSize: 22, fontWeight: "700" },
  resultLbl: {
    fontSize: 11,
    color: T.text3,
    marginTop: 3,
    textAlign: "center",
  },

  errSummary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    width: "100%",
    backgroundColor: T.bgWarning,
    borderWidth: 0.5,
    borderColor: "rgba(133,79,11,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  fileCardHeader: {
    padding: 16,
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
    marginTop: 3,
  },
  fileCardStats: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: T.border,
  },
  fileCardStatCell: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  fileCardStatBorder: {
    borderRightWidth: 0.5,
    borderRightColor: T.border,
  },
  fileCardStatVal: { fontSize: 15, fontWeight: "700", color: T.text1 },
  fileCardStatLbl: { fontSize: 10, color: T.text3 },

  // ── Progress bar ──
  progressWrap: { width: "100%", marginBottom: 18 },
  progLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
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
    gap: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cleanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanLabel: { fontSize: 14, fontWeight: "600" },
  cleanSub: { fontSize: 11, color: T.text3, marginTop: 2 },
  cleanBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cleanBadgeTxt: { fontSize: 13, fontWeight: "700" },
});
