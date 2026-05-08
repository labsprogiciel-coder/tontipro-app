import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Check, RefreshCw, MessageSquare } from "lucide-react-native";
import { KAURIDORR_THEME as T } from "@/constants/colors";
import { useAgentStore } from "@/stores/agent-store";
import { usePermissions } from "@/hooks/usePermissions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "agent" | "admin";
type Step = 1 | 2 | 3 | 4 | "success";

interface FormState {
  name: string;
  phone: string;
  zone: string;
  email: string;
  role: Role;
  permissions: { label: string; sub: string; enabled: boolean }[];
  pin: string;
  pinSentBySms: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Step bar ──────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  if (step === "success") return null;
  const current = step as number;
  return (
    <View style={s.stepbar}>
      {[1, 2, 3, 4].map((n) => (
        <View
          key={n}
          style={[
            s.seg,
            n < current  ? s.segDone   :
            n === current ? s.segActive :
            s.segTodo,
          ]}
        />
      ))}
    </View>
  );
}

// ── Step 1 — Identity ─────────────────────────────────────────────────────────

function StepIdentity({
  form,
  onChange,
  onNext,
  onBack,
}: {
  form: FormState;
  onChange: (k: keyof FormState, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canNext = form.name.trim().length > 1 && form.phone.trim().length >= 8;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Agents</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>1 / 4</Text></View>
      </View>

      <ScrollView style={s.formBody} keyboardShouldPersistTaps="handled">
        <Text style={s.screenTitle}>Identité{"\n"}de l'agent</Text>
        <Text style={s.screenSub}>Renseignez les informations personnelles du nouvel agent.</Text>

        <Field label="Nom complet">
          <TextInput
            style={[s.input, form.name ? s.inputFilled : undefined]}
            placeholder="Prénom Nom"
            placeholderTextColor={T.text3}
            value={form.name}
            onChangeText={(v) => onChange("name", v)}
          />
        </Field>

        <Field label="Téléphone *">
          <View style={s.phoneRow}>
            <View style={s.countryPill}>
              <Text style={s.countryTxt}>🇧🇫 +226</Text>
            </View>
            <TextInput
              style={[s.input, { flex: 1 }, form.phone ? s.inputFilled : undefined]}
              placeholder="70 00 00 00"
              placeholderTextColor={T.text3}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => onChange("phone", v)}
            />
          </View>
          {form.phone.length >= 8 && (
            <View style={s.hintOk}>
              <Check size={11} color={T.textSuccess} />
              <Text style={[s.hintTxt, { color: T.textSuccess }]}>Numéro vérifié — pas de doublon</Text>
            </View>
          )}
        </Field>

        <Field label="Quartier / Zone d'activité">
          <TextInput
            style={[s.input, form.zone ? s.inputFilled : undefined]}
            placeholder="Ex : Pissy, Ouagadougou"
            placeholderTextColor={T.text3}
            value={form.zone}
            onChangeText={(v) => onChange("zone", v)}
          />
        </Field>

        <Field label="E-mail (optionnel)">
          <TextInput
            style={s.input}
            placeholder="exemple@mail.com"
            placeholderTextColor={T.text3}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => onChange("email", v)}
          />
          <Text style={s.hintNeutral}>Le téléphone suffit pour l'authentification</Text>
        </Field>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.ctaWrap}>
        <Pressable
          style={[s.btnMain, !canNext && s.btnMainDisabled]}
          onPress={canNext ? onNext : undefined}
        >
          <Text style={s.btnMainTxt}>Continuer</Text>
          <ChevronRight size={15} color="white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Step 2 — Role & permissions ───────────────────────────────────────────────

function StepRole({
  form,
  onChangeRole,
  onTogglePerm,
  onNext,
  onBack,
}: {
  form: FormState;
  onChangeRole: (r: Role) => void;
  onTogglePerm: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>2 / 4</Text></View>
      </View>

      <ScrollView style={s.formBody}>
        <Text style={s.screenTitle}>Rôle &{"\n"}permissions</Text>
        <Text style={s.screenSub}>Définissez le niveau d'accès de cet agent dans Kauridorr.</Text>

        <Text style={s.fieldLabel}>Rôle</Text>
        <View style={s.roleGrid}>
          <Pressable
            style={[s.roleCard, form.role === "agent" && s.roleCardAgent]}
            onPress={() => onChangeRole("agent")}
          >
            <View style={[s.roleIcon, { backgroundColor: form.role === "agent" ? "#e6f1fb" : T.bg2 }]}>
              <Text style={{ fontSize: 14 }}>👤</Text>
            </View>
            <Text style={[s.roleName, form.role === "agent" && { color: "#185fa5" }]}>Agent</Text>
            <Text style={s.roleDesc}>Collecte terrain et gestion clients</Text>
          </Pressable>

          <Pressable
            style={[s.roleCard, form.role === "admin" && s.roleCardAdmin]}
            onPress={() => onChangeRole("admin")}
          >
            <View style={[s.roleIcon, { backgroundColor: form.role === "admin" ? T.orangeLt : T.bg2 }]}>
              <Text style={{ fontSize: 14 }}>⭐</Text>
            </View>
            <Text style={[s.roleName, form.role === "admin" && { color: T.orangeDk }]}>Administrateur</Text>
            <Text style={s.roleDesc}>Accès complet + gestion équipe</Text>
          </Pressable>
        </View>

        <Text style={[s.fieldLabel, { marginBottom: 8 }]}>Permissions spécifiques</Text>
        <View style={s.permCard}>
          {form.permissions.map((p, i) => (
            <View key={p.label} style={[s.permRow, i < form.permissions.length - 1 && s.permBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.permLabel}>{p.label}</Text>
                <Text style={s.permSub}>{p.sub}</Text>
              </View>
              <Switch
                value={p.enabled}
                onValueChange={() => onTogglePerm(i)}
                trackColor={{ false: T.border2, true: T.orange }}
                thumbColor="white"
              />
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.ctaWrap}>
        <Pressable style={s.btnMain} onPress={onNext}>
          <Text style={s.btnMainTxt}>Continuer</Text>
          <ChevronRight size={15} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 3 — Temporary PIN ────────────────────────────────────────────────────

function StepPin({
  form,
  onChangePin,
  onGeneratePin,
  onToggleSms,
  onNext,
  onBack,
}: {
  form: FormState;
  onChangePin: (v: string) => void;
  onGeneratePin: () => void;
  onToggleSms: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const digits = form.pin.padEnd(4, "").split("");

  return (
    <View style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>3 / 4</Text></View>
      </View>

      <ScrollView style={s.formBody}>
        <Text style={s.screenTitle}>PIN{"\n"}provisoire</Text>
        <Text style={s.screenSub}>Créez un code temporaire que l'agent devra changer à sa première connexion.</Text>

        {/* Warning */}
        <View style={s.warningBox}>
          <Text style={s.warningTxt}>
            ⚠️  Communiquez ce PIN <Text style={{ fontWeight: "700" }}>uniquement</Text> en personne à l'agent. Il expire à la première connexion.
          </Text>
        </View>

        {/* PIN display */}
        <View style={s.pinSection}>
          <Text style={s.pinSectionLbl}>PIN temporaire</Text>
          <View style={s.pinBoxes}>
            {digits.map((d, i) => (
              <View key={i} style={[s.pinBox, d !== " " && s.pinBoxFilled]}>
                <Text style={[s.pinDigit, d !== " " && s.pinDigitFilled]}>{d !== " " ? d : ""}</Text>
              </View>
            ))}
          </View>
          {/* Hidden input for editing */}
          <TextInput
            style={s.pinHiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            value={form.pin}
            onChangeText={(v) => onChangePin(v.replace(/\D/g, "").slice(0, 4))}
            caretHidden
          />
          <Text style={s.pinHint}>L'agent devra le modifier dès la première connexion</Text>
        </View>

        {/* Generate */}
        <Pressable style={s.optionRow} onPress={onGeneratePin}>
          <View style={[s.optionIcon, { backgroundColor: T.orangeLt }]}>
            <RefreshCw size={14} color={T.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optionTitle}>Générer un PIN aléatoire</Text>
            <Text style={s.optionSub}>Remplace le code actuel</Text>
          </View>
          <ChevronRight size={14} color={T.text3} />
        </Pressable>

        {/* SMS */}
        <Pressable style={[s.optionRow, { marginTop: 8 }]} onPress={onToggleSms}>
          <View style={[s.optionIcon, { backgroundColor: "#e6f1fb" }]}>
            <MessageSquare size={14} color="#185fa5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optionTitle}>Envoyer par SMS</Text>
            <Text style={s.optionSub}>{form.phone ? `+226 ${form.phone}` : "Numéro non renseigné"}</Text>
          </View>
          {form.pinSentBySms
            ? <Check size={14} color={T.textSuccess} />
            : <ChevronRight size={14} color={T.text3} />
          }
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.ctaWrap}>
        <Pressable
          style={[s.btnMain, form.pin.length < 4 && s.btnMainDisabled]}
          onPress={form.pin.length === 4 ? onNext : undefined}
        >
          <Text style={s.btnMainTxt}>Continuer</Text>
          <ChevronRight size={15} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 4 — Review ───────────────────────────────────────────────────────────

function StepReview({
  form,
  onConfirm,
  isSubmitting,
  onBack,
}: {
  form: FormState;
  onConfirm: () => void;
  isSubmitting?: boolean;
  onBack: () => void;
}) {
  const av = initials(form.name) || "??";
  const activePerms = form.permissions.filter((p) => p.enabled);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Dark header */}
      <View style={s.reviewHdr}>
        <View style={s.navRow}>
          <Pressable style={s.backBtn} onPress={onBack}>
            <ChevronLeft size={16} color="rgba(255,255,255,0.5)" />
            <Text style={[s.backTxt, { color: "rgba(255,255,255,0.5)" }]}>Retour</Text>
          </Pressable>
          <View style={[s.stepBadge, s.stepBadgeDark]}>
            <Text style={[s.stepBadgeTxt, { color: "rgba(255,255,255,0.5)" }]}>4 / 4</Text>
          </View>
        </View>
        <View style={s.reviewCenter}>
          <View style={[s.reviewAv, { backgroundColor: T.orangeLt }]}>
            <Text style={[s.reviewAvTxt, { color: T.orangeDk }]}>{av}</Text>
          </View>
          <Text style={s.reviewName}>{form.name || "—"}</Text>
          <Text style={s.reviewPhone}>+226 {form.phone}{form.zone ? ` · ${form.zone}` : ""}</Text>
          <View style={s.reviewBadgeRow}>
            <View style={[s.pill, { backgroundColor: T.orangeLt }]}>
              <Text style={[s.pillTxt, { color: T.orangeDk }]}>
                {form.role === "admin" ? "Administrateur" : "Agent"}
              </Text>
            </View>
            <View style={[s.pill, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
              <Text style={[s.pillTxt, { color: "rgba(255,255,255,0.6)" }]}>AGT-2025-NEW</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.reviewBody}>
        <Text style={s.secTitle}>Identité</Text>
        <View style={s.card}>
          <RevRow label="Nom"      value={form.name  || "—"} />
          <RevDiv />
          <RevRow label="Téléphone" value={`+226 ${form.phone}`} valueStyle={{ color: T.orange }} />
          <RevDiv />
          <RevRow label="Zone"     value={form.zone  || "—"} />
          <RevDiv />
          <RevRow label="Rôle"     value={form.role === "admin" ? "Administrateur" : "Agent"} />
        </View>

        <Text style={s.secTitle}>Permissions accordées</Text>
        <View style={s.permChips}>
          {form.permissions.map((p) => (
            <View key={p.label} style={[s.chip, !p.enabled && s.chipOff]}>
              <Text style={[s.chipTxt, !p.enabled && s.chipTxtOff]}>{p.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.secTitle}>Accès</Text>
        <View style={s.card}>
          <RevRow label="PIN provisoire" value={`●●●●  (${form.pin})`} />
          <RevDiv />
          <RevRow label="Transmission"   value={form.pinSentBySms ? "SMS envoyé" : "Manuel"} valueStyle={form.pinSentBySms ? { color: T.green } : undefined} />
          <RevDiv />
          <RevRow label="Expiration PIN" value="1ère connexion" />
        </View>

        <Pressable
          style={[s.btnMain, { marginTop: 20 }, isSubmitting && s.btnMainDisabled]}
          onPress={isSubmitting ? undefined : onConfirm}
        >
          {isSubmitting
            ? <ActivityIndicator size="small" color="white" />
            : <><Check size={15} color="white" /><Text style={s.btnMainTxt}>Créer l'agent</Text></>
          }
        </Pressable>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

// ── Success ───────────────────────────────────────────────────────────────────

function SuccessScreen({
  form,
  onViewProfile,
  onAddAnother,
  onBackToList,
}: {
  form: FormState;
  onViewProfile: () => void;
  onAddAnother: () => void;
  onBackToList: () => void;
}) {
  const av = initials(form.name) || "??";
  const activeCount = form.permissions.filter((p) => p.enabled).length;
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ScrollView contentContainerStyle={s.successScreen} showsVerticalScrollIndicator={false}>
      <View style={s.successRing}>
        <Check size={34} color={T.orange} strokeWidth={2.2} />
      </View>
      <Text style={s.successH}>Agent créé !</Text>
      <Text style={s.successP}>{form.name} a été ajouté{"\n"}à l'équipe Kauridorr avec succès.</Text>

      {/* ID card */}
      <View style={s.idCard}>
        <View style={s.idCardTop}>
          <View style={[s.idAv, { backgroundColor: T.orangeLt }]}>
            <Text style={[s.idAvTxt, { color: T.orangeDk }]}>{av}</Text>
          </View>
          <View>
            <Text style={s.idName}>{form.name}</Text>
            <Text style={s.idRef}>AGT-2025-NEW</Text>
          </View>
        </View>
        <IdRow label="Téléphone"      value={`+226 ${form.phone}`}      valueStyle={{ color: T.orange }} />
        <IdRow label="Rôle"           value={form.role === "admin" ? "Administrateur" : "Agent"} />
        <IdRow label="Permissions"    value={`${activeCount} active${activeCount > 1 ? "s" : ""}`} />
        <IdRow label="PIN provisoire" value="En attente de connexion"   valueStyle={{ color: T.textWarning }} />
        <IdRow label="Inscrit le"     value={today} />
      </View>

      {/* Actions */}
      <View style={s.actionPair}>
        <Pressable style={s.btnPairOutline} onPress={onViewProfile}>
          <Text style={s.btnPairOutlineTxt}>Voir le profil</Text>
        </Pressable>
        <Pressable style={s.btnPairOrange} onPress={onAddAnother}>
          <Text style={s.btnPairOrangeTxt}>Nouvel agent</Text>
        </Pressable>
      </View>
      <Pressable style={[s.btnOutline, { marginTop: 8 }]} onPress={onBackToList}>
        <Text style={s.btnOutlineTxt}>Retour à la liste des agents</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function RevRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={s.revRow}>
      <Text style={s.revLabel}>{label}</Text>
      <Text style={[s.revValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function RevDiv() {
  return <View style={s.rowDiv} />;
}

function IdRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <>
      <View style={s.idRow}>
        <Text style={s.idLabel}>{label}</Text>
        <Text style={[s.idValue, valueStyle]}>{value}</Text>
      </View>
      <View style={s.rowDiv} />
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

const DEFAULT_PERMISSIONS = [
  { label: "Ajouter un client",     sub: "Créer de nouveaux membres",       enabled: true  },
  { label: "Modifier un client",    sub: "Éditer infos et solde",            enabled: true  },
  { label: "Effectuer un dépôt",    sub: "Enregistrer les versements",       enabled: true  },
  { label: "Effectuer un retrait",  sub: "Autoriser les décaissements",      enabled: true  },
  { label: "Exporter les rapports", sub: "Télécharger CSV / données",        enabled: false },
  { label: "Gérer les agents",      sub: "Créer / bloquer des agents",       enabled: false },
  { label: "Importer des données",  sub: "Charger fichiers CSV / sauvegardes", enabled: false },
];

export default function AddAgentScreen() {
  const router    = useRouter();
  const addAgent  = useAgentStore((s) => s.addAgent);
  const perms     = usePermissions();

  if (!perms.manageAgents) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.bg }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: T.text1, marginBottom: 6 }}>Accès refusé</Text>
        <Text style={{ fontSize: 13, color: T.text3, textAlign: "center", paddingHorizontal: 32 }}>
          Vous n'avez pas la permission de gérer les agents.
        </Text>
      </SafeAreaView>
    );
  }

  const [step, setStep]               = useState<Step>(1);
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId]     = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    zone: "",
    email: "",
    role: "agent",
    permissions: DEFAULT_PERMISSIONS.map((p) => ({ ...p })),
    pin: randomPin(),
    pinSentBySms: false,
  });

  const updateForm = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleTogglePerm = (i: number) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.map((p, idx) =>
        idx === i ? { ...p, enabled: !p.enabled } : p
      ),
    }));

  const handleGeneratePin = () =>
    setForm((f) => ({ ...f, pin: randomPin() }));

  const handleToggleSms = () =>
    setForm((f) => ({ ...f, pinSentBySms: !f.pinSentBySms }));

  const next = () => setStep((s) => ((s as number) + 1) as Step);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setSubmitting(true);
    try {
      const agent = await addAgent({
        name: form.name,
        phone: form.phone,
        zone: form.zone || undefined,
        email: form.email || undefined,
        role: form.role,
        pin: form.pin || undefined,
        permissions: {
          addClient:     form.permissions[0].enabled,
          editClient:    form.permissions[1].enabled,
          deposit:       form.permissions[2].enabled,
          withdrawal:    form.permissions[3].enabled,
          exportReports: form.permissions[4].enabled,
          manageAgents:  form.permissions[5].enabled,
          importData:    form.permissions[6].enabled,
        },
      });
      setCreatedId(agent.id);
      setStep("success");
    } catch {
      Alert.alert("Erreur", "Impossible de créer l'agent. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };
  const back = () => {
    if (step === 1 || step === "success") {
      router.back();
    } else {
      setStep((s) => ((s as number) - 1) as Step);
    }
  };

  const reset = () => {
    setStep(1);
    setForm({
      name: "", phone: "", zone: "", email: "",
      role: "agent",
      permissions: DEFAULT_PERMISSIONS.map((p) => ({ ...p })),
      pin: randomPin(),
      pinSentBySms: false,
    });
  };

  const isSuccess = step === "success";

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StepBar step={step} />

      {step === 1 && (
        <StepIdentity
          form={form}
          onChange={updateForm}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <StepRole
          form={form}
          onChangeRole={(r) => setForm((f) => ({ ...f, role: r }))}
          onTogglePerm={handleTogglePerm}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <StepPin
          form={form}
          onChangePin={(v) => setForm((f) => ({ ...f, pin: v }))}
          onGeneratePin={handleGeneratePin}
          onToggleSms={handleToggleSms}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <StepReview
          form={form}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
          onBack={back}
        />
      )}
      {isSuccess && (
        <SuccessScreen
          form={form}
          // @ts-ignore
          onViewProfile={() => createdId && router.push({ pathname: "/(app)/agents/[id]", params: { id: createdId } })}
          onAddAnother={reset}
          onBackToList={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.bg },

  stepbar:         { flexDirection: "row", height: 3 },
  seg:             { flex: 1, height: 3 },
  segDone:         { backgroundColor: T.orange },
  segActive:       { backgroundColor: T.orangeMd },
  segTodo:         { backgroundColor: T.border2 },

  navRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 0 },
  backBtn:         { flexDirection: "row", alignItems: "center", gap: 4 },
  backTxt:         { fontSize: 13, color: T.text3 },
  stepBadge:       { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  stepBadgeDark:   { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.12)" },
  stepBadgeTxt:    { fontSize: 11, fontWeight: "500", color: T.text3 },

  formBody:        { flex: 1, paddingHorizontal: 18, paddingTop: 0 },
  screenTitle:     { fontSize: 20, fontWeight: "600", color: T.text1, letterSpacing: -0.4, lineHeight: 26, marginTop: 14, marginBottom: 4 },
  screenSub:       { fontSize: 13, color: T.text2, lineHeight: 20, marginBottom: 22 },

  fieldLabel:      { fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input:           { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: T.text1 },
  inputFilled:     { borderColor: T.orange, backgroundColor: T.orangeLt },
  phoneRow:        { flexDirection: "row", gap: 7 },
  countryPill:     { flexDirection: "row", alignItems: "center", backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 12 },
  countryTxt:      { fontSize: 13, color: T.text1 },
  hintOk:          { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  hintTxt:         { fontSize: 11 },
  hintNeutral:     { fontSize: 11, color: T.text3, marginTop: 5 },

  ctaWrap:         { paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 24 : 16, paddingTop: 8, backgroundColor: T.bg },
  btnMain:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: T.orange, borderRadius: 13, paddingVertical: 14 },
  btnMainDisabled: { opacity: 0.4 },
  btnMainTxt:      { fontSize: 14, fontWeight: "500", color: "white" },

  roleGrid:        { flexDirection: "row", gap: 8, marginBottom: 14 },
  roleCard:        { flex: 1, borderWidth: 0.5, borderColor: T.border2, borderRadius: 13, padding: 13, gap: 5 },
  roleCardAgent:   { borderColor: "#185fa5", backgroundColor: "#e6f1fb" },
  roleCardAdmin:   { borderColor: T.orange, backgroundColor: T.orangeLt },
  roleIcon:        { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  roleName:        { fontSize: 13, fontWeight: "500", color: T.text1 },
  roleDesc:        { fontSize: 10, color: T.text2, lineHeight: 14 },

  permCard:        { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  permRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  permBorder:      { borderBottomWidth: 0.5, borderBottomColor: T.border },
  permLabel:       { fontSize: 13, color: T.text1 },
  permSub:         { fontSize: 10, color: T.text3, marginTop: 1 },

  warningBox:      { backgroundColor: T.bgWarning, borderWidth: 0.5, borderColor: "rgba(133,79,11,0.2)", borderRadius: 12, padding: 11, marginBottom: 18 },
  warningTxt:      { fontSize: 12, color: T.textWarning, lineHeight: 18 },

  pinSection:      { alignItems: "center", paddingVertical: 16 },
  pinSectionLbl:   { fontSize: 13, color: T.text2 },
  pinBoxes:        { flexDirection: "row", gap: 10, marginVertical: 16 },
  pinBox:          { width: 48, height: 52, borderRadius: 12, backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  pinBoxFilled:    { borderColor: T.orange, backgroundColor: T.orangeLt },
  pinDigit:        { fontSize: 22, fontWeight: "600", color: T.text1 },
  pinDigitFilled:  { color: T.orangeDk },
  pinHint:         { fontSize: 11, color: T.text3 },
  pinHiddenInput:  { position: "absolute", opacity: 0, height: 1, width: 1 },

  optionRow:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 12, padding: 12 },
  optionIcon:      { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  optionTitle:     { fontSize: 13, fontWeight: "500", color: T.text1 },
  optionSub:       { fontSize: 11, color: T.text3 },

  reviewHdr:       { backgroundColor: "#1a1a18", paddingBottom: 24 },
  reviewCenter:    { alignItems: "center", gap: 8, paddingHorizontal: 18 },
  reviewAv:        { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.12)" },
  reviewAvTxt:     { fontSize: 18, fontWeight: "600" },
  reviewName:      { fontSize: 18, fontWeight: "600", color: "white" },
  reviewPhone:     { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  reviewBadgeRow:  { flexDirection: "row", gap: 6, marginTop: 2 },
  pill:            { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  pillTxt:         { fontSize: 10 },
  reviewBody:      { paddingHorizontal: 18 },

  secTitle:        { fontSize: 11, fontWeight: "500", color: T.text3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  card:            { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
  revRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  revLabel:        { fontSize: 12, color: T.text2 },
  revValue:        { fontSize: 13, fontWeight: "500", color: T.text1 },
  rowDiv:          { height: 0.5, backgroundColor: T.border },

  permChips:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip:            { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, backgroundColor: T.bgSuccess },
  chipOff:         { backgroundColor: T.bg2 },
  chipTxt:         { fontSize: 10, color: T.textSuccess },
  chipTxtOff:      { color: T.text3, textDecorationLine: "line-through" },

  successScreen:   { alignItems: "center", paddingTop: 48, paddingHorizontal: 22, paddingBottom: 28 },
  successRing:     { width: 76, height: 76, borderRadius: 38, backgroundColor: T.orangeLt, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  successH:        { fontSize: 22, fontWeight: "600", color: T.text1, letterSpacing: -0.4, marginBottom: 6 },
  successP:        { fontSize: 13, color: T.text2, lineHeight: 22, textAlign: "center", marginBottom: 22 },

  idCard:          { width: "100%", backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 16, overflow: "hidden", marginBottom: 18 },
  idCardTop:       { backgroundColor: "#1a1a18", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  idAv:            { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  idAvTxt:         { fontSize: 14, fontWeight: "600" },
  idName:          { fontSize: 15, fontWeight: "600", color: "white" },
  idRef:           { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  idRow:           { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 9 },
  idLabel:         { fontSize: 12, color: T.text2 },
  idValue:         { fontSize: 12, fontWeight: "500", color: T.text1 },

  actionPair:      { flexDirection: "row", gap: 8, width: "100%", marginBottom: 0 },
  btnPairOutline:  { flex: 1, padding: 12, borderRadius: 13, borderWidth: 0.5, borderColor: T.border2, backgroundColor: T.bg, alignItems: "center" },
  btnPairOutlineTxt: { fontSize: 12, fontWeight: "500", color: T.text1 },
  btnPairOrange:   { flex: 1, padding: 12, borderRadius: 13, backgroundColor: T.orange, alignItems: "center" },
  btnPairOrangeTxt: { fontSize: 12, fontWeight: "500", color: "white" },
  btnOutline:      { width: "100%", padding: 13, borderRadius: 13, borderWidth: 0.5, borderColor: T.border2, backgroundColor: T.bg, alignItems: "center" },
  btnOutlineTxt:   { fontSize: 13, fontWeight: "500", color: T.text1 },
});
