import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, Check, ArrowDown } from "lucide-react-native";

import { KAURIDORR_THEME } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useAuthStore } from "@/stores/auth-store";
import { useConfigStore } from "@/stores/config-store";
import { Client, CollectionFrequency } from "@/types/client";
import { Numpad } from "@/app/components/ui/numpad";
import { usePermissions } from "@/hooks/usePermissions";

const T = KAURIDORR_THEME;

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_QUICK_PICKS = [1, 2, 3, 4, 5, 10, 20];

const FREQUENCIES: { value: CollectionFrequency; label: string; desc: string }[] = [
  { value: "daily",    label: "Quotidienne",   desc: "Collecte chaque jour ouvrable (lun – sam)" },
  { value: "weekly",   label: "Hebdomadaire",  desc: "Une fois par semaine, jour fixe" },
  { value: "biweekly", label: "Bihebdo.",      desc: "Deux fois par semaine" },
  { value: "monthly",  label: "Mensuelle",     desc: "Le même jour chaque mois" },
];

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  return n.toLocaleString("fr-FR");
}

function getProjection(amount: number) {
  const weekly  = amount * 6;
  const monthly = amount * 26;
  return {
    weekly,
    monthly,
    sixMonths: monthly * 6,
    oneYear:   monthly * 12,
  };
}

function freqLabel(f: CollectionFrequency): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

function freqDaysLabel(days: number[]): string {
  const names = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  if (days.length === 6 && !days.includes(6)) return "lun – sam";
  return days.map((d) => names[d]).join(", ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | "success";

// ── Shared sub-components (defined outside to keep stable references) ─────────

function StepProgressBar({ activeStep, isSuccess }: { activeStep: number; isSuccess: boolean }) {
  return (
    <View style={styles.progressTrack}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.progressSeg,
            s < activeStep   && styles.progressDone,
            s === activeStep && !isSuccess && styles.progressActive,
            isSuccess        && styles.progressDone,
          ]}
        />
      ))}
    </View>
  );
}

function StepNavRow({ onBack, stepLabel, backLabel }: { onBack: () => void; stepLabel: string; backLabel: string }) {
  return (
    <View style={styles.navRow}>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <ChevronLeft size={16} color={T.text3} strokeWidth={1.8} />
        <Text style={styles.backLabel}>{backLabel}</Text>
      </Pressable>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{stepLabel}</Text>
      </View>
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={{ color: T.orange }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddClientScreen() {
  const router  = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const addClient    = useClientStore((s) => s.addClient);
  const updateClient = useClientStore((s) => s.updateClient);
  const getClientById = useClientStore((s) => s.getClientById);
  const user         = useAuthStore((s) => s.user);
  const baseUnit     = useConfigStore((s) => s.baseUnit);
  const maxMultiplier = useConfigStore((s) => s.maxMultiplier);
  const perms        = usePermissions();

  const isEdit = !!clientId;

  const actionAllowed = isEdit ? perms.editClient : perms.addClient;
  if (!actionAllowed) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.bg }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: T.text1, marginBottom: 6 }}>Accès refusé</Text>
        <Text style={{ fontSize: 13, color: T.text3, textAlign: "center", paddingHorizontal: 32 }}>
          {isEdit
            ? "Vous n'avez pas la permission de modifier les clients."
            : "Vous n'avez pas la permission d'ajouter des clients."}
        </Text>
      </SafeAreaView>
    );
  }

  // Step tracking
  const [step, setStep] = useState<Step>(1);

  // Step 1 – Identity
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [locality,  setLocality]  = useState("");
  const [email,     setEmail]     = useState("");
  const [groupName, setGroupName] = useState("");

  // Step 2 – Daily commitment amount (entered via numpad, must be >= baseUnit)
  const [amountText, setAmountText] = useState("0");

  const commitmentAmount = parseInt(amountText, 10) || 0;

  // Step 3 – Frequency & goal
  const [frequency,   setFrequency]   = useState<CollectionFrequency>("daily");
  const [activeDays,  setActiveDays]  = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [hasGoal,     setHasGoal]     = useState(false);
  const [savingsGoal, setSavingsGoal] = useState("");

  // Success state
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // ── Pre-populate in edit mode ─────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const existing = getClientById(clientId);
    if (!existing) return;
    setName(existing.name);
    setPhone(existing.phone.replace(/^\+226\s?/, ""));
    setLocality(existing.address ?? "");
    setEmail(existing.email ?? "");
    setGroupName(existing.groupName ?? "");
    if (existing.commitmentAmount) setAmountText(String(existing.commitmentAmount));
    if (existing.collectionFrequency) setFrequency(existing.collectionFrequency);
    if (existing.collectionDays?.length) setActiveDays(existing.collectionDays);
    if (existing.savingsGoal) { setHasGoal(true); setSavingsGoal(String(existing.savingsGoal)); }
  }, [clientId]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const proj = useMemo(() => getProjection(commitmentAmount), [commitmentAmount]);

  const step1Valid = name.trim().length > 0 && phone.trim().length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function toggleDay(idx: number) {
    setActiveDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  }

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const goalValue = hasGoal && savingsGoal ? parseInt(savingsGoal.replace(/\s/g, ""), 10) : undefined;
      const payload = {
        name:                name.trim(),
        phone:               "+226 " + phone.trim(),
        address:             locality.trim() || undefined,
        groupName:           groupName.trim() || undefined,
        commitmentAmount,
        collectionFrequency: frequency,
        collectionDays:      activeDays,
        savingsGoal:         !isNaN(goalValue as number) ? goalValue : undefined,
      };
      if (isEdit && clientId) {
        const client = await updateClient(clientId, payload);
        setCreatedClient(client);
      } else {
        const client = await addClient(payload);
        setCreatedClient(client);
      }
      setStep("success");
    } catch {
      // keep on review screen, let user retry
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setStep(1);
    setName(""); setPhone(""); setLocality(""); setEmail(""); setGroupName("");
    setAmountText("0");
    setFrequency("daily"); setActiveDays([0,1,2,3,4,5]);
    setHasGoal(false); setSavingsGoal("");
    setCreatedClient(null);
  }

  // ── Progress bar helpers ──────────────────────────────────────────────────────

  const numericStep = step === "success" ? 4 : (step as number);
  const isSuccess   = step === "success";

  // ── STEP 1 ────────────────────────────────────────────────────────────────────

  function Step1() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StepProgressBar activeStep={numericStep} isSuccess={isSuccess} />
        <StepNavRow onBack={() => router.back()} stepLabel="1 / 4" backLabel="Clients" />
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>{isEdit ? "Modifier le client" : "Identité du membre"}</Text>
          <Text style={styles.screenSub}>{isEdit ? "Modifiez les informations du client." : "Renseignez les informations de base du nouveau membre de la tontine."}</Text>

          <Field label="Nom complet" required>
            <TextInput
              style={[styles.fieldInput, name.length > 0 && styles.fieldInputFilled]}
              placeholder="Aïssata Zongo"
              placeholderTextColor={T.text3}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </Field>

          <Field label="Numéro de téléphone" required>
            <View style={styles.phoneRow}>
              <View style={styles.countryPill}>
                <Text style={styles.countryPillText}>🇧🇫 +226</Text>
              </View>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }, phone.length > 0 && styles.fieldInputFilled]}
                placeholder="70 44 55 66"
                placeholderTextColor={T.text3}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            {phone.length >= 8 && (
              <View style={styles.fieldHintOk}>
                <Check size={11} color={T.textSuccess} strokeWidth={2} />
                <Text style={styles.fieldHintOkText}>Numéro vérifié</Text>
              </View>
            )}
          </Field>

          <Field label="Quartier / Localité">
            <TextInput
              style={[styles.fieldInput, locality.length > 0 && styles.fieldInputFilled]}
              placeholder="Tampouy, Ouagadougou"
              placeholderTextColor={T.text3}
              value={locality}
              onChangeText={setLocality}
            />
          </Field>

          <Field label="Nom du groupe tontine (optionnel)">
            <TextInput
              style={[styles.fieldInput, groupName.length > 0 && styles.fieldInputFilled]}
              placeholder="Groupe Koom-Koom"
              placeholderTextColor={T.text3}
              value={groupName}
              onChangeText={setGroupName}
            />
          </Field>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.ctaWrap}>
          <Pressable
            style={[styles.btnMain, !step1Valid && styles.btnMainDisabled]}
            onPress={() => step1Valid && setStep(2)}
          >
            <Text style={styles.btnMainText}>Continuer</Text>
            <ChevronRight size={15} color="white" strokeWidth={1.8} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 2 ────────────────────────────────────────────────────────────────────

  function Step2() {
    const amount      = parseInt(amountText, 10) || 0;
    const isValid     = amount >= baseUnit;
    const units       = baseUnit > 0 ? Math.round(amount / baseUnit) : 0;
    const formatted   = amount.toLocaleString("fr-FR");
    const chips       = UNIT_QUICK_PICKS.map((q) => String(q * baseUnit));

    function handleDigit(d: string) {
      setAmountText((prev) => (prev === "0" ? d : prev + d));
    }

    function handleDelete() {
      setAmountText((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    }

    return (
      <View style={{ flex: 1 }}>
        <StepProgressBar activeStep={numericStep} isSuccess={isSuccess} />
        <StepNavRow onBack={() => setStep(1)} stepLabel="2 / 4" backLabel="Retour" />

        {/* Amount display */}
        <View style={styles.amountDisplay}>
          <Text style={styles.amountLabel}>Épargne quotidienne</Text>
          <Text style={[styles.amountValue, { color: isValid ? T.orange : T.text3 }]}>
            {formatted} <Text style={styles.amountCurrency}>FCFA</Text>
          </Text>
          {amount > 0 && (
            <Text style={styles.unitBaseHint}>
              {isValid
                ? `≈ ×${units} unité${units !== 1 ? "s" : ""} · min ${formatNum(baseUnit)} FCFA`
                : `Minimum ${formatNum(baseUnit)} FCFA requis`}
            </Text>
          )}
        </View>

        {/* Quick chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ height: 52, flexShrink: 0 }}
        >
          {chips.map((val) => (
            <Pressable
              key={val}
              style={[styles.chip, amountText === val && styles.chipActive]}
              onPress={() => setAmountText(val)}
            >
              <Text style={[styles.chipText, amountText === val && styles.chipTextActive]}>
                {parseInt(val, 10).toLocaleString("fr-FR")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Numpad */}
        <Numpad onPress={handleDigit} onDelete={handleDelete} />

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Pressable
            style={[styles.btnMain, !isValid && styles.btnMainDisabled]}
            onPress={() => isValid && setStep(3)}
          >
            <Text style={styles.btnMainText}>Continuer</Text>
            <ChevronRight size={15} color="white" strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ── STEP 3 ────────────────────────────────────────────────────────────────────

  function Step3() {
    const goalNum = hasGoal && savingsGoal ? parseInt(savingsGoal.replace(/\s/g, ""), 10) : NaN;
    const monthsToGoal = !isNaN(goalNum) && proj.monthly > 0
      ? Math.ceil(goalNum / proj.monthly)
      : null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StepProgressBar activeStep={numericStep} isSuccess={isSuccess} />
        <StepNavRow onBack={() => setStep(2)} stepLabel="3 / 4" backLabel="Retour" />
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>Fréquence de collecte</Text>
          <Text style={styles.screenSub}>À quelle fréquence l'agent passera-t-il collecter l'épargne ?</Text>

          {/* Frequency cards */}
          <View style={styles.freqGrid}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                style={[styles.freqCard, frequency === f.value && styles.freqCardActive]}
                onPress={() => setFrequency(f.value)}
              >
                <Text style={[styles.freqName, frequency === f.value && styles.freqNameActive]}>
                  {f.label}
                </Text>
                <Text style={[styles.freqDesc, frequency === f.value && styles.freqDescActive]}>
                  {f.desc}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Day selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Jours de collecte</Text>
            <View style={styles.daysRow}>
              {DAY_LABELS.map((label, idx) => (
                <Pressable
                  key={idx}
                  style={[styles.dayBtn, activeDays.includes(idx) && styles.dayBtnActive]}
                  onPress={() => toggleDay(idx)}
                >
                  <Text style={[styles.dayBtnText, activeDays.includes(idx) && styles.dayBtnTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldHintInfo}>
              {activeDays.length} jour{activeDays.length !== 1 ? "s" : ""} / semaine
            </Text>
          </View>

          {/* Goal toggle */}
          <View style={styles.goalToggle}>
            <View style={styles.goalToggleLeft}>
              <View style={styles.goalToggleIcon}>
                <Text style={{ fontSize: 14 }}>⭐</Text>
              </View>
              <View>
                <Text style={styles.toggleLabel}>Objectif d'épargne</Text>
                <Text style={styles.toggleSub}>Définir un montant cible</Text>
              </View>
            </View>
            <Switch
              value={hasGoal}
              onValueChange={setHasGoal}
              trackColor={{ false: T.bg3, true: T.orange }}
              thumbColor="white"
            />
          </View>

          {hasGoal && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Montant cible (FCFA)</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[styles.fieldInput, savingsGoal.length > 0 && styles.fieldInputFilled, { paddingRight: 50 }]}
                  placeholder="Ex. 78 000"
                  placeholderTextColor={T.text3}
                  value={savingsGoal}
                  onChangeText={setSavingsGoal}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>FCFA</Text>
              </View>
              {monthsToGoal !== null && (
                <View style={styles.fieldHintOk}>
                  <Check size={11} color={T.textSuccess} strokeWidth={2} />
                  <Text style={styles.fieldHintOkText}>
                    Atteint en ~{monthsToGoal} mois à ce rythme
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.ctaWrap}>
          <Pressable style={styles.btnMain} onPress={() => setStep(4)}>
            <Text style={styles.btnMainText}>Continuer</Text>
            <ChevronRight size={15} color="white" strokeWidth={1.8} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP 4 — Review ───────────────────────────────────────────────────────────

  function Step4() {
    const goalNum = hasGoal && savingsGoal ? parseInt(savingsGoal.replace(/\s/g, ""), 10) : NaN;
    const today = formatDate(new Date().toISOString());

    return (
      <>
        <StepProgressBar activeStep={numericStep} isSuccess={isSuccess} />
        <StepNavRow onBack={() => setStep(3)} stepLabel="4 / 4" backLabel="Retour" />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Orange header */}
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewLabel}>Nouveau membre</Text>
            <Text style={styles.reviewName}>{name}</Text>
            <Text style={styles.reviewPhone}>
              +226 {phone}{locality ? ` · ${locality}` : ""}
            </Text>
            <View style={styles.reviewCommit}>
              <Text style={styles.reviewCommitAmount}>{formatNum(commitmentAmount)} FCFA</Text>
              <Text style={styles.reviewCommitPeriod}> / jour · {activeDays.length}j/sem</Text>
            </View>
          </View>

          <View style={styles.reviewBody}>
            {/* Engagement */}
            <Text style={styles.reviewSectionTitle}>Engagement</Text>
            <View style={styles.reviewCard}>
              <View style={styles.rRow}>
                <Text style={styles.rLabel}>Montant / jour</Text>
                <Text style={[styles.rValue, styles.rValueOrange]}>{formatNum(commitmentAmount)} FCFA</Text>
              </View>
              <View style={styles.rRow}>
                <Text style={styles.rLabel}>Fréquence</Text>
                <Text style={styles.rValue}>{freqLabel(frequency)} ({freqDaysLabel(activeDays)})</Text>
              </View>
              {groupName ? (
                <View style={styles.rRow}>
                  <Text style={styles.rLabel}>Groupe</Text>
                  <Text style={styles.rValue}>{groupName}</Text>
                </View>
              ) : null}
              {!isNaN(goalNum) && hasGoal ? (
                <View style={[styles.rRow, styles.rRowLast]}>
                  <Text style={styles.rLabel}>Objectif</Text>
                  <Text style={[styles.rValue, styles.rValueGreen]}>{formatNum(goalNum)} FCFA</Text>
                </View>
              ) : (
                <View style={[styles.rRow, styles.rRowLast]}>
                  <Text style={styles.rLabel}>Objectif</Text>
                  <Text style={[styles.rValue, { color: T.text3 }]}>Non défini</Text>
                </View>
              )}
            </View>

            {/* Projections */}
            <Text style={[styles.reviewSectionTitle, { marginTop: 16 }]}>Projections</Text>
            <View style={styles.projChips}>
              <View style={styles.projChip}>
                <Text style={styles.projChipVal}>{formatNum(proj.weekly)}</Text>
                <Text style={styles.projChipLbl}>/ semaine</Text>
              </View>
              <View style={styles.projChip}>
                <Text style={styles.projChipVal}>{formatNum(proj.monthly)}</Text>
                <Text style={styles.projChipLbl}>/ mois</Text>
              </View>
              <View style={styles.projChip}>
                <Text style={styles.projChipVal}>{formatNum(proj.sixMonths)}</Text>
                <Text style={styles.projChipLbl}>6 mois</Text>
              </View>
              <View style={styles.projChip}>
                <Text style={styles.projChipVal}>{formatNum(proj.oneYear)}</Text>
                <Text style={styles.projChipLbl}>1 an</Text>
              </View>
            </View>

            {/* Agent */}
            <Text style={[styles.reviewSectionTitle, { marginTop: 16 }]}>Agent responsable</Text>
            <View style={styles.reviewCard}>
              <View style={styles.rRow}>
                <Text style={styles.rLabel}>Agent</Text>
                <Text style={styles.rValue}>{user?.name ?? "—"}</Text>
              </View>
              <View style={[styles.rRow, styles.rRowLast]}>
                <Text style={styles.rLabel}>Date d'inscription</Text>
                <Text style={styles.rValue}>{today}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.btnMain, { marginTop: 18 }, isSubmitting && styles.btnMainDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              <Check size={15} color="white" strokeWidth={2.2} />
              <Text style={styles.btnMainText}>
                {isSubmitting ? "Inscription en cours…" : "Confirmer l'inscription"}
              </Text>
            </Pressable>

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>
      </>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────────

  function SuccessScreen() {
    if (!createdClient) return null;
    const initials = getInitials(createdClient.name);
    const goalNum  = createdClient.savingsGoal;

    return (
      <ScrollView
        contentContainerStyle={styles.successContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successRing}>
          <Check size={34} color={T.orange} strokeWidth={2.2} />
        </View>
        <Text style={styles.successH}>Membre inscrit !</Text>
        <Text style={styles.successP}>
          {createdClient.name} a été ajouté(e) avec succès
          {createdClient.groupName ? ` au groupe ${createdClient.groupName}.` : "."}
        </Text>

        {/* Member card */}
        <View style={styles.memberCard}>
          <View style={styles.memberCardTop}>
            <View style={styles.memberAv}>
              <Text style={styles.memberAvText}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.memberName}>{createdClient.name}</Text>
              <Text style={styles.memberId}>ID membre · {createdClient.id}</Text>
            </View>
          </View>
          <View style={styles.rRow}>
            <Text style={styles.rLabel}>Téléphone</Text>
            <Text style={[styles.rValue, styles.rValueOrange]}>{createdClient.phone}</Text>
          </View>
          {createdClient.commitmentAmount != null && (
            <View style={styles.rRow}>
              <Text style={styles.rLabel}>Engagement</Text>
              <Text style={styles.rValue}>{formatNum(createdClient.commitmentAmount)} FCFA / jour</Text>
            </View>
          )}
          {goalNum != null && (
            <View style={styles.rRow}>
              <Text style={styles.rLabel}>Objectif</Text>
              <Text style={[styles.rValue, styles.rValueGreen]}>{formatNum(goalNum)} FCFA</Text>
            </View>
          )}
          <View style={[styles.rRow, styles.rRowLast]}>
            <Text style={styles.rLabel}>Premier dépôt</Text>
            <Text style={[styles.rValue, { color: T.textWarning }]}>En attente</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionPair}>
          <Pressable
            style={styles.btnOutline}
            onPress={() =>
              router.push({
                pathname: "/(app)/transactions/new",
                params: { clientId: createdClient.id },
              })
            }
          >
            <ArrowDown size={14} color={T.text2} strokeWidth={1.8} />
            <Text style={styles.btnOutlineText}>Dépôt maintenant</Text>
          </Pressable>
          <Pressable style={styles.btnOrange} onPress={resetForm}>
            <Text style={styles.btnOrangeText}>Nouveau membre</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.btnOutline, { width: "100%", marginTop: 8 }]} onPress={() => router.push("/(app)/clients")}>
          <Text style={styles.btnOutlineText}>Voir la liste des clients</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {step === 1         && Step1()}
      {step === 2         && Step2()}
      {step === 3         && Step3()}
      {step === 4         && Step4()}
      {step === "success" && SuccessScreen()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },

  // Progress bar
  progressTrack: {
    height: 3,
    flexDirection: "row",
    backgroundColor: T.bg3,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    backgroundColor: T.border2,
  },
  progressDone: {
    backgroundColor: T.orange,
  },
  progressActive: {
    backgroundColor: T.orangeMd,
  },

  // Nav row
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backLabel: {
    fontSize: 13,
    color: T.text3,
  },
  stepBadge: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
  },

  // Body scroll area
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 0,
  },

  // Screen header text
  screenTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.4,
    lineHeight: 26,
    marginTop: 14,
    marginBottom: 4,
  },
  screenSub: {
    fontSize: 13,
    color: T.text2,
    lineHeight: 20,
    marginBottom: 22,
  },

  // Fields
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: T.text1,
  },
  fieldInputFilled: {
    borderColor: T.orange,
    backgroundColor: T.orangeLt,
  },
  fieldHintOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  fieldHintOkText: {
    fontSize: 11,
    color: T.textSuccess,
  },
  fieldHintInfo: {
    fontSize: 11,
    color: T.text3,
    marginTop: 5,
  },

  // Phone row
  phoneRow: {
    flexDirection: "row",
    gap: 7,
  },
  countryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  countryPillText: {
    fontSize: 13,
    color: T.text1,
  },

  // Custom amount apply
  applyBtn: {
    backgroundColor: T.orange,
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  applyBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },

  // CTA wrap
  ctaWrap: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    paddingTop: 8,
    backgroundColor: T.bg,
    borderTopWidth: 0.5,
    borderTopColor: T.border,
  },

  // Primary button
  btnMain: {
    backgroundColor: T.orange,
    borderRadius: 13,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  btnMainDisabled: {
    opacity: 0.35,
  },
  btnMainText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },

  // Amount display (Step 2)
  amountDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  amountLabel: {
    fontSize: 12,
    color: T.text3,
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 65,
    fontWeight: "600",
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  amountCurrency: {
    fontSize: 18,
    fontWeight: "400",
    color: T.text3,
  },
  unitBaseHint: {
    fontSize: 11,
    color: T.text3,
    marginTop: 6,
  },

  // Horizontal chips row
  chipsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginVertical: 2
  },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: T.orangeLt,
    borderColor: T.orange,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: T.text2,
  },
  chipTextActive: {
    color: T.orangeDk,
  },

  // Preset grid
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    width: "30%",
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: T.border2,
    backgroundColor: T.bg2,
  },
  presetBtnActive: {
    borderColor: T.orange,
    backgroundColor: T.orangeLt,
  },
  presetBtnCustom: {
    borderStyle: "dashed",
  },
  presetVal: {
    fontSize: 14,
    fontWeight: "600",
    color: T.text1,
  },
  presetValActive: {
    color: T.orangeDk,
  },
  presetValCustom: {
    fontSize: 12,
    fontWeight: "500",
    color: T.text3,
  },
  presetLbl: {
    fontSize: 10,
    color: T.text3,
    marginTop: 1,
  },
  presetLblActive: {
    color: T.orangeDk,
    opacity: 0.7,
  },

  // Projection card
  projCard: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 14,
  },
  projTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    marginBottom: 10,
  },
  projRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  projRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 14,
  },
  projLabel: {
    fontSize: 12,
    color: T.text2,
  },
  projValue: {
    fontSize: 13,
    fontWeight: "600",
    color: T.text1,
  },
  projValueHighlight: {
    color: T.orange,
  },

  // Frequency grid
  freqGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  freqCard: {
    width: "47%",
    borderWidth: 0.5,
    borderColor: T.border2,
    borderRadius: 13,
    padding: 13,
  },
  freqCardActive: {
    borderColor: T.orange,
    backgroundColor: T.orangeLt,
  },
  freqName: {
    fontSize: 13,
    fontWeight: "500",
    color: T.text1,
    marginBottom: 3,
  },
  freqNameActive: {
    color: T.orangeDk,
  },
  freqDesc: {
    fontSize: 10,
    color: T.text2,
    lineHeight: 14,
  },
  freqDescActive: {
    color: T.orangeDk,
    opacity: 0.7,
  },

  // Day selector
  daysRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
  },
  dayBtnActive: {
    backgroundColor: T.orange,
    borderColor: T.orange,
  },
  dayBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: T.text3,
  },
  dayBtnTextActive: {
    color: "white",
  },

  // Goal toggle
  goalToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 12,
    marginBottom: 12,
  },
  goalToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalToggleIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: T.orangeLt,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: T.text1,
  },
  toggleSub: {
    fontSize: 11,
    color: T.text3,
  },

  // Input suffix
  inputSuffix: {
    position: "absolute",
    right: 13,
    top: "50%",
    marginTop: -9,
    fontSize: 12,
    color: T.text3,
  },

  // Review screen
  reviewHeader: {
    backgroundColor: T.orange,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
  },
  reviewLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 4,
  },
  reviewName: {
    fontSize: 22,
    fontWeight: "600",
    color: "white",
    letterSpacing: -0.44,
  },
  reviewPhone: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  reviewCommit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  reviewCommitAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: "white",
  },
  reviewCommitPeriod: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
  },
  reviewBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  reviewSectionTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    marginBottom: 8,
  },
  reviewCard: {
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  rRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  rRowLast: {
    borderBottomWidth: 0,
  },
  rLabel: {
    fontSize: 12,
    color: T.text2,
    flex: 1,
  },
  rValue: {
    fontSize: 13,
    fontWeight: "500",
    color: T.text1,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  rValueOrange: {
    color: T.orange,
  },
  rValueGreen: {
    color: T.green,
  },

  // Projection chips
  projChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  projChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    alignItems: "center",
  },
  projChipVal: {
    fontSize: 12,
    fontWeight: "600",
    color: T.text1,
  },
  projChipLbl: {
    fontSize: 10,
    color: T.text3,
  },

  // Success screen
  successContainer: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 28,
  },
  successRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: T.orangeLt,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successH: {
    fontSize: 22,
    fontWeight: "600",
    color: T.text1,
    letterSpacing: -0.44,
    marginBottom: 6,
  },
  successP: {
    fontSize: 13,
    color: T.text2,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: "center",
  },
  memberCard: {
    width: "100%",
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  memberCardTop: {
    backgroundColor: T.orange,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberAv: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  memberId: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },

  // Action pair
  actionPair: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: T.border2,
    backgroundColor: T.bg,
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.text1,
  },
  btnOrange: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: T.orange,
  },
  btnOrangeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "white",
  },
});
