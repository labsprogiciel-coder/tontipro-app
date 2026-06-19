// app/(app)/agents/add.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Check, RefreshCw, MessageSquare } from 'lucide-react-native'
import { KAURIDORR_THEME as T } from '@/constants/colors'
import { useAgentStore, AgentRole } from '@/stores/agent-store'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 'success'

interface FormState {
  fullName: string
  phoneNumber: string
  email: string
  role: AgentRole
  pin: string
  pinSentBySms: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Role config ───────────────────────────────────────────────────────────────

interface RoleDef {
  value: AgentRole
  emoji: string
  label: string
  desc: string
  /** Capability table: collect / register / approve / bindDevice */
  caps: [boolean, boolean, boolean, boolean]
}

const ROLES: RoleDef[] = [
  {
    value: 'field_agent',
    emoji: '👤',
    label: 'Agent de terrain',
    desc: 'Collecte et gestion de prospects',
    caps: [true, true, false, false],
  },
  {
    value: 'supervisor',
    emoji: '📋',
    label: 'Superviseur',
    desc: 'Collecte, clients complets, décaissements',
    caps: [true, true, true, true],
  },
  {
    value: 'accountant',
    emoji: '🧾',
    label: 'Comptable',
    desc: 'Approbation des décaissements uniquement',
    caps: [false, false, true, false],
  },
  {
    value: 'admin',
    emoji: '⭐',
    label: 'Administrateur',
    desc: 'Accès complet + gestion équipe',
    caps: [true, true, true, true],
  },
  {
    value: 'it_admin',
    emoji: '🖥',
    label: 'Admin IT',
    desc: 'Liaison et gestion des terminaux',
    caps: [false, false, false, true],
  },
]

const CAP_LABELS = ['Collecte', 'Enregistrer clients', 'Approuver décaissements', 'Lier terminaux']

// ── Step bar ──────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  if (step === 'success') return null
  const current = step as number
  return (
    <View style={s.stepbar}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            s.seg,
            n < current ? s.segDone : n === current ? s.segActive : s.segTodo,
          ]}
        />
      ))}
    </View>
  )
}

// ── Step 1 — Identity ─────────────────────────────────────────────────────────

function StepIdentity({
  form,
  onChange,
  onNext,
  onBack,
}: {
  form: FormState
  onChange: (k: keyof FormState, v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const canNext =
    form.fullName.trim().length > 1 &&
    form.phoneNumber.trim().length >= 8 &&
    form.email.trim().includes('@')

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Agents</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>1 / 3</Text></View>
      </View>

      <ScrollView style={s.formBody} keyboardShouldPersistTaps="handled">
        <Text style={s.screenTitle}>Identité{'\n'}de l'agent</Text>
        <Text style={s.screenSub}>Renseignez les informations personnelles du nouvel agent.</Text>

        <Field label="Nom complet *">
          <TextInput
            style={[s.input, form.fullName ? s.inputFilled : undefined]}
            placeholder="Prénom Nom"
            placeholderTextColor={T.text3}
            value={form.fullName}
            onChangeText={(v) => onChange('fullName', v)}
          />
        </Field>

        <Field label="Téléphone *">
          <View style={s.phoneRow}>
            <View style={s.countryPill}>
              <Text style={s.countryTxt}>🇧🇫 +226</Text>
            </View>
            <TextInput
              style={[s.input, { flex: 1 }, form.phoneNumber ? s.inputFilled : undefined]}
              placeholder="70 00 00 00"
              placeholderTextColor={T.text3}
              keyboardType="phone-pad"
              value={form.phoneNumber}
              onChangeText={(v) => onChange('phoneNumber', v)}
            />
          </View>
          {form.phoneNumber.length >= 8 && (
            <View style={s.hintOk}>
              <Check size={11} color={T.textSuccess} />
              <Text style={[s.hintTxt, { color: T.textSuccess }]}>Numéro vérifié</Text>
            </View>
          )}
        </Field>

        <Field label="E-mail *">
          <TextInput
            style={[s.input, form.email ? s.inputFilled : undefined]}
            placeholder="exemple@mail.com"
            placeholderTextColor={T.text3}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => onChange('email', v)}
          />
          <Text style={s.hintNeutral}>Utilisé pour le lien d'activation</Text>
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
  )
}

// ── Step 2 — Role ─────────────────────────────────────────────────────────────

function StepRole({
  form,
  onChangeRole,
  onNext,
  onBack,
}: {
  form: FormState
  onChangeRole: (r: AgentRole) => void
  onNext: () => void
  onBack: () => void
}) {
  const selected = ROLES.find((r) => r.value === form.role)!

  return (
    <View style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>2 / 3</Text></View>
      </View>

      <ScrollView style={s.formBody}>
        <Text style={s.screenTitle}>Rôle{'\n'}de l'agent</Text>
        <Text style={s.screenSub}>
          Le rôle détermine les droits d'accès — aucune permission individuelle n'est nécessaire.
        </Text>

        <Text style={s.fieldLabel}>Choisir un rôle</Text>
        <View style={s.roleList}>
          {ROLES.map((r) => {
            const active = form.role === r.value
            return (
              <Pressable
                key={r.value}
                style={[s.roleCard, active && s.roleCardActive]}
                onPress={() => onChangeRole(r.value)}
              >
                <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.roleName, active && { color: T.orangeDk }]}>{r.label}</Text>
                  <Text style={s.roleDesc}>{r.desc}</Text>
                </View>
                {active && <Check size={14} color={T.orange} />}
              </Pressable>
            )
          })}
        </View>

        {/* Capability table */}
        <Text style={[s.fieldLabel, { marginTop: 20, marginBottom: 10 }]}>
          Capacités du rôle sélectionné
        </Text>
        <View style={s.capTable}>
          <View style={s.capHdr}>
            <Text style={[s.capCell, s.capHdrTxt, { flex: 2 }]}>Action</Text>
            <Text style={[s.capCell, s.capHdrTxt]}>Accès</Text>
          </View>
          {CAP_LABELS.map((label, i) => (
            <View key={label} style={[s.capRow, i < CAP_LABELS.length - 1 && s.capBorder]}>
              <Text style={[s.capCell, { flex: 2, color: T.text1, fontSize: 12 }]}>{label}</Text>
              <Text style={[s.capCell, { color: selected.caps[i] ? T.textSuccess : T.text3 }]}>
                {selected.caps[i] ? '✓' : '—'}
              </Text>
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
  )
}

// ── Step 3 — PIN ──────────────────────────────────────────────────────────────

function StepPin({
  form,
  onChangePin,
  onGeneratePin,
  onToggleSms,
  onNext,
  onBack,
}: {
  form: FormState
  onChangePin: (v: string) => void
  onGeneratePin: () => void
  onToggleSms: () => void
  onNext: () => void
  onBack: () => void
}) {
  const digits = form.pin.padEnd(4, '').split('')

  return (
    <View style={{ flex: 1 }}>
      <View style={s.navRow}>
        <Pressable style={s.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={T.text3} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>3 / 3</Text></View>
      </View>

      <ScrollView style={s.formBody}>
        <Text style={s.screenTitle}>PIN{'\n'}provisoire</Text>
        <Text style={s.screenSub}>
          Code temporaire que l'agent devra changer à sa première connexion.
        </Text>

        <View style={s.warningBox}>
          <Text style={s.warningTxt}>
            ⚠️  Communiquez ce PIN <Text style={{ fontWeight: '700' }}>uniquement</Text> en personne. Il expire à la première connexion.
          </Text>
        </View>

        <View style={s.pinSection}>
          <Text style={s.pinSectionLbl}>PIN temporaire</Text>
          <View style={s.pinBoxes}>
            {digits.map((d, i) => (
              <View key={i} style={[s.pinBox, d !== ' ' && s.pinBoxFilled]}>
                <Text style={[s.pinDigit, d !== ' ' && s.pinDigitFilled]}>{d !== ' ' ? d : ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            style={s.pinHiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            value={form.pin}
            onChangeText={(v) => onChangePin(v.replace(/\D/g, '').slice(0, 4))}
            caretHidden
          />
          <Text style={s.pinHint}>L'agent modifiera ce PIN à la première connexion</Text>
        </View>

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

        <Pressable style={[s.optionRow, { marginTop: 8 }]} onPress={onToggleSms}>
          <View style={[s.optionIcon, { backgroundColor: '#e6f1fb' }]}>
            <MessageSquare size={14} color="#185fa5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.optionTitle}>Envoyer par SMS</Text>
            <Text style={s.optionSub}>{form.phoneNumber ? `+226 ${form.phoneNumber}` : 'Numéro non renseigné'}</Text>
          </View>
          {form.pinSentBySms
            ? <Check size={14} color={T.textSuccess} />
            : <ChevronRight size={14} color={T.text3} />}
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.ctaWrap}>
        <Pressable
          style={[s.btnMain, form.pin.length < 4 && s.btnMainDisabled]}
          onPress={form.pin.length === 4 ? onNext : undefined}
        >
          <Text style={s.btnMainTxt}>Créer l'agent</Text>
          <ChevronRight size={15} color="white" />
        </Pressable>
      </View>
    </View>
  )
}

// ── Success ───────────────────────────────────────────────────────────────────

function SuccessScreen({
  form,
  createdId,
  onViewProfile,
  onAddAnother,
  onBackToList,
}: {
  form: FormState
  createdId: Id<'users'> | null
  onViewProfile: () => void
  onAddAnother: () => void
  onBackToList: () => void
}) {
  const av = initials(form.fullName) || '??'
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const roleDef = ROLES.find((r) => r.value === form.role)!

  return (
    <ScrollView contentContainerStyle={s.successScreen} showsVerticalScrollIndicator={false}>
      <View style={s.successRing}>
        <Check size={34} color={T.orange} strokeWidth={2.2} />
      </View>
      <Text style={s.successH}>Agent créé !</Text>
      <Text style={s.successP}>{form.fullName} a été ajouté{'\n'}à l'équipe avec succès.</Text>

      <View style={s.idCard}>
        <View style={s.idCardTop}>
          <View style={[s.idAv, { backgroundColor: T.orangeLt }]}>
            <Text style={[s.idAvTxt, { color: T.orangeDk }]}>{av}</Text>
          </View>
          <View>
            <Text style={s.idName}>{form.fullName}</Text>
            <Text style={s.idRef}>{roleDef.emoji} {roleDef.label}</Text>
          </View>
        </View>
        <IdRow label="Téléphone"      value={`+226 ${form.phoneNumber}`} valueStyle={{ color: T.orange }} />
        <IdRow label="E-mail"         value={form.email} />
        <IdRow label="PIN provisoire" value="En attente de connexion" valueStyle={{ color: T.textWarning }} />
        <IdRow label="Statut"         value="Invitation envoyée" />
        <IdRow label="Inscrit le"     value={today} />
      </View>

      <View style={s.actionPair}>
        <Pressable
          style={[s.btnPairOutline, !createdId && { opacity: 0.4 }]}
          onPress={createdId ? onViewProfile : undefined}
        >
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
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function IdRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <>
      <View style={s.idRow}>
        <Text style={s.idLabel}>{label}</Text>
        <Text style={[s.idValue, valueStyle]}>{value}</Text>
      </View>
      <View style={{ height: 0.5, backgroundColor: T.border }} />
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AddAgentScreen() {
  const router   = useRouter()
  const me       = useQuery(api.users.currentUser)
  const addAgent = useAgentStore((s) => s.addAgent)

  const canAccess = me?.role === 'admin' || me?.role === 'supervisor'

  const [step, setStep]               = useState<Step>(1)
  const [isSubmitting, setSubmitting] = useState(false)
  const [createdId, setCreatedId]     = useState<Id<'users'> | null>(null)
  const [form, setForm] = useState<FormState>({
    fullName: '',
    phoneNumber: '',
    email: '',
    role: 'field_agent',
    pin: randomPin(),
    pinSentBySms: false,
  })

  if (me === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator color={T.orange} />
      </SafeAreaView>
    )
  }

  if (!canAccess) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: T.text1, marginBottom: 6 }}>Accès refusé</Text>
        <Text style={{ fontSize: 13, color: T.text3, textAlign: 'center', paddingHorizontal: 32 }}>
          Vous n'avez pas la permission de gérer les agents.
        </Text>
      </SafeAreaView>
    )
  }

  const updateForm = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const next = () => setStep((s) => ((s as number) + 1) as Step)
  const back = () => {
    if (step === 1 || step === 'success') router.back()
    else setStep((s) => ((s as number) - 1) as Step)
  }

  const handleConfirm = async () => {
    if (isSubmitting || !me?.branchId) return
    setSubmitting(true)
    try {
      const agent = await addAgent({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        email: form.email,
        branchId: me.branchId,
        role: form.role,
        pin: form.pin || undefined,
      })
      setCreatedId(agent._id)
      setStep('success')
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Impossible de créer l'agent.")
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(1)
    setCreatedId(null)
    setForm({
      fullName: '',
      phoneNumber: '',
      email: '',
      role: 'field_agent',
      pin: randomPin(),
      pinSentBySms: false,
    })
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StepBar step={step} />

      {step === 1 && (
        <StepIdentity form={form} onChange={updateForm} onNext={next} onBack={back} />
      )}
      {step === 2 && (
        <StepRole
          form={form}
          onChangeRole={(r) => setForm((f) => ({ ...f, role: r }))}
          onNext={handleConfirm}
          onBack={back}
        />
      )}
      {step === 3 && (
        <StepPin
          form={form}
          onChangePin={(v) => setForm((f) => ({ ...f, pin: v }))}
          onGeneratePin={() => setForm((f) => ({ ...f, pin: randomPin() }))}
          onToggleSms={() => setForm((f) => ({ ...f, pinSentBySms: !f.pinSentBySms }))}
          onNext={handleConfirm}
          onBack={back}
        />
      )}
      {step === 'success' && (
        <SuccessScreen
          form={form}
          createdId={createdId}
          onViewProfile={() =>
            createdId &&
            // @ts-ignore
            router.push({ pathname: '/(app)/agents/[id]', params: { id: createdId } })
          }
          onAddAnother={reset}
          onBackToList={() => router.back()}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.bg },

  stepbar:         { flexDirection: 'row', height: 3 },
  seg:             { flex: 1, height: 3 },
  segDone:         { backgroundColor: T.orange },
  segActive:       { backgroundColor: T.orangeMd },
  segTodo:         { backgroundColor: T.border2 },

  navRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12 },
  backBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backTxt:         { fontSize: 13, color: T.text3 },
  stepBadge:       { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  stepBadgeTxt:    { fontSize: 11, fontWeight: '500', color: T.text3 },

  formBody:        { flex: 1, paddingHorizontal: 18, paddingTop: 0 },
  screenTitle:     { fontSize: 20, fontWeight: '600', color: T.text1, letterSpacing: -0.4, lineHeight: 26, marginTop: 14, marginBottom: 4 },
  screenSub:       { fontSize: 13, color: T.text2, lineHeight: 20, marginBottom: 22 },

  fieldLabel:      { fontSize: 11, fontWeight: '500', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:           { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: T.text1 },
  inputFilled:     { borderColor: T.orange, backgroundColor: T.orangeLt },
  phoneRow:        { flexDirection: 'row', gap: 7 },
  countryPill:     { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 12 },
  countryTxt:      { fontSize: 13, color: T.text1 },
  hintOk:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  hintTxt:         { fontSize: 11 },
  hintNeutral:     { fontSize: 11, color: T.text3, marginTop: 5 },

  ctaWrap:         { paddingHorizontal: 18, paddingBottom: Platform.OS === 'ios' ? 24 : 16, paddingTop: 8, backgroundColor: T.bg },
  btnMain:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: T.orange, borderRadius: 13, paddingVertical: 14 },
  btnMainDisabled: { opacity: 0.4 },
  btnMainTxt:      { fontSize: 14, fontWeight: '500', color: 'white' },

  roleList:        { gap: 8, marginBottom: 4 },
  roleCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: T.border2, borderRadius: 13, padding: 13 },
  roleCardActive:  { borderColor: T.orange, backgroundColor: T.orangeLt },
  roleName:        { fontSize: 13, fontWeight: '500', color: T.text1 },
  roleDesc:        { fontSize: 10, color: T.text2, lineHeight: 14, marginTop: 2 },

  capTable:        { backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 12, overflow: 'hidden' },
  capHdr:          { flexDirection: 'row', backgroundColor: T.bg3, paddingHorizontal: 12, paddingVertical: 8 },
  capHdrTxt:       { fontSize: 10, fontWeight: '600', color: T.text3, textTransform: 'uppercase' },
  capRow:          { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 9 },
  capBorder:       { borderBottomWidth: 0.5, borderBottomColor: T.border },
  capCell:         { flex: 1, fontSize: 13, color: T.text2 },

  warningBox:      { backgroundColor: T.bgWarning, borderWidth: 0.5, borderColor: 'rgba(133,79,11,0.2)', borderRadius: 12, padding: 11, marginBottom: 18 },
  warningTxt:      { fontSize: 12, color: T.textWarning, lineHeight: 18 },

  pinSection:      { alignItems: 'center', paddingVertical: 16 },
  pinSectionLbl:   { fontSize: 13, color: T.text2 },
  pinBoxes:        { flexDirection: 'row', gap: 10, marginVertical: 16 },
  pinBox:          { width: 48, height: 52, borderRadius: 12, backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  pinBoxFilled:    { borderColor: T.orange, backgroundColor: T.orangeLt },
  pinDigit:        { fontSize: 22, fontWeight: '600', color: T.text1 },
  pinDigitFilled:  { color: T.orangeDk },
  pinHint:         { fontSize: 11, color: T.text3 },
  pinHiddenInput:  { position: 'absolute', opacity: 0, height: 1, width: 1 },

  optionRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 12, padding: 12 },
  optionIcon:      { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionTitle:     { fontSize: 13, fontWeight: '500', color: T.text1 },
  optionSub:       { fontSize: 11, color: T.text3 },

  successScreen:   { alignItems: 'center', paddingTop: 48, paddingHorizontal: 22, paddingBottom: 28 },
  successRing:     { width: 76, height: 76, borderRadius: 38, backgroundColor: T.orangeLt, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  successH:        { fontSize: 22, fontWeight: '600', color: T.text1, letterSpacing: -0.4, marginBottom: 6 },
  successP:        { fontSize: 13, color: T.text2, lineHeight: 22, textAlign: 'center', marginBottom: 22 },

  idCard:          { width: '100%', backgroundColor: T.bg2, borderWidth: 0.5, borderColor: T.border, borderRadius: 16, overflow: 'hidden', marginBottom: 18 },
  idCardTop:       { backgroundColor: '#1a1a18', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  idAv:            { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  idAvTxt:         { fontSize: 14, fontWeight: '600' },
  idName:          { fontSize: 15, fontWeight: '600', color: 'white' },
  idRef:           { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  idRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9 },
  idLabel:         { fontSize: 12, color: T.text2 },
  idValue:         { fontSize: 12, fontWeight: '500', color: T.text1 },

  actionPair:      { flexDirection: 'row', gap: 8, width: '100%', marginBottom: 0 },
  btnPairOutline:  { flex: 1, padding: 12, borderRadius: 13, borderWidth: 0.5, borderColor: T.border2, backgroundColor: T.bg, alignItems: 'center' },
  btnPairOutlineTxt: { fontSize: 12, fontWeight: '500', color: T.text1 },
  btnPairOrange:   { flex: 1, padding: 12, borderRadius: 13, backgroundColor: T.orange, alignItems: 'center' },
  btnPairOrangeTxt: { fontSize: 12, fontWeight: '500', color: 'white' },
  btnOutline:      { width: '100%', padding: 13, borderRadius: 13, borderWidth: 0.5, borderColor: T.border2, backgroundColor: T.bg, alignItems: 'center' },
  btnOutlineTxt:   { fontSize: 13, fontWeight: '500', color: T.text1 },
})
