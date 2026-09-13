import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenTitle } from "../../src/components/Logo";
import {
  getProfile,
  listDocuments,
  updateProfile,
  type ClassYear,
  type Housing,
  type SavedDocument,
  type SpendStyle,
  type StudentProfile,
} from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { colors, shadow } from "../../src/theme";

const EMPTY: StudentProfile = {
  full_name: "",
  school: "",
  class_year: "",
  graduation_year: "",
  housing: "",
  first_gen: true,
  international: false,
  has_ssn: true,
  pell: false,
  work_study_eligible: true,
  safe_to_spend_style: "strict",
  notify_bills: true,
  notify_aid: true,
  anchor_nags_doordash: true,
  splits_rent: false,
};

const YEARS: { id: ClassYear; label: string }[] = [
  { id: "first_year", label: "First-year" },
  { id: "sophomore", label: "Sophomore" },
  { id: "junior", label: "Junior" },
  { id: "senior", label: "Senior" },
  { id: "grad", label: "Grad" },
];

function labelFor(doc: SavedDocument) {
  const extracted = doc.extracted_json ?? {};
  const headline = extracted.headline;
  if (typeof headline === "string" && headline.trim()) return headline.trim();
  const type = extracted.document_type;
  if (typeof type === "string" && type.trim()) {
    return type.replaceAll("_", " ");
  }
  return "Saved document";
}

function previewFor(doc: SavedDocument) {
  const extracted = doc.extracted_json ?? {};
  const meaning = extracted.what_it_means;
  if (typeof meaning === "string" && meaning.trim()) return meaning.trim();
  const next = extracted.next_step;
  if (typeof next === "string" && next.trim()) return next.trim();
  return doc.ocr_text?.trim() || "Open to see Compass notes and numbers.";
}

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile>(EMPTY);
  const [loan, setLoan] = useState<{ principal: number; subsidized: number; unsubsidized: number; rate: number } | null>(null);
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? null);
    try {
      const [payload, saved] = await Promise.all([getProfile(), listDocuments()]);
      setProfile({ ...EMPTY, ...payload.profile });
      setLoan(payload.loan_summary);
      setDocs(saved);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function patch(partial: Partial<StudentProfile>) {
    setSaving(true);
    setStatus(null);
    try {
      setProfile((prev) => ({ ...prev, ...partial }));
      const payload = await updateProfile(partial);
      setProfile({ ...EMPTY, ...payload.profile });
      setLoan(payload.loan_summary);
      setStatus("Saved");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 48, paddingTop: insets.top + 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle title="Profile" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {status ? <Text style={styles.ok}>{status}</Text> : null}

      <Text style={styles.section}>Saved documents</Text>
      {docs.length === 0 ? (
        <Pressable style={[styles.card, shadow]} onPress={() => router.push("/(tabs)/scan")}>
          <Text style={styles.kicker}>Scan</Text>
          <Text style={styles.docTitle}>Nothing saved yet</Text>
          <Text style={styles.mute}>Scan an award letter or bill, then save it here for Compass.</Text>
        </Pressable>
      ) : (
        docs.map((doc) => (
          <Pressable
            key={doc.id}
            style={[styles.card, shadow]}
            onPress={() =>
              router.push({
                pathname: "/scan-result",
                params: {
                  ocr: doc.ocr_text ?? "",
                  extracted: JSON.stringify(doc.extracted_json ?? {}),
                  storagePath: doc.storage_path,
                  saved: "1",
                },
              })
            }
          >
            <Text style={styles.kicker}>{when(doc.created_at)}</Text>
            <Text style={styles.docTitle}>{labelFor(doc)}</Text>
            <Text style={styles.mute} numberOfLines={2}>
              {previewFor(doc)}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.section}>Aid situation</Text>
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardLead}>What Compass assumes about your package</Text>
        {loan ? (
          <View style={styles.loanBox}>
            <Row label="Principal" value={`$${loan.principal.toLocaleString()}`} />
            <Row label="Subsidized" value={`$${loan.subsidized.toLocaleString()}`} />
            <Row label="Unsubsidized" value={`$${loan.unsubsidized.toLocaleString()}`} />
            <Row label="Rate" value={`${(loan.rate * 100).toFixed(2)}%`} />
          </View>
        ) : (
          <Text style={styles.mute}>Save a scanned award letter to attach sub / unsub amounts.</Text>
        )}
        <Flag label="Pell Grant" value={profile.pell} onToggle={() => void patch({ pell: !profile.pell })} />
        <Flag
          label="Work-study eligible"
          value={profile.work_study_eligible}
          onToggle={() => void patch({ work_study_eligible: !profile.work_study_eligible })}
        />
        <Flag label="First-gen" value={profile.first_gen} onToggle={() => void patch({ first_gen: !profile.first_gen })} />
        <Flag label="International" value={profile.international} onToggle={() => void patch({ international: !profile.international })} />
        <Flag label="Has SSN" value={profile.has_ssn} onToggle={() => void patch({ has_ssn: !profile.has_ssn })} />
        <Flag label="Splitting rent" value={profile.splits_rent} onToggle={() => void patch({ splits_rent: !profile.splits_rent })} />
        <Text style={styles.label}>Anchor style</Text>
        <View style={styles.chips}>
          <Chip
            label="Strict cap"
            on={profile.safe_to_spend_style === "strict"}
            onPress={() => void patch({ safe_to_spend_style: "strict" as SpendStyle })}
          />
          <Chip
            label="Leave ~$20/week"
            on={profile.safe_to_spend_style === "buffer_20"}
            onPress={() => void patch({ safe_to_spend_style: "buffer_20" as SpendStyle })}
          />
        </View>
        <Flag
          label="Nag on food delivery"
          value={profile.anchor_nags_doordash}
          onToggle={() => void patch({ anchor_nags_doordash: !profile.anchor_nags_doordash })}
        />
      </View>

      <Text style={styles.section}>Identity</Text>
      <View style={[styles.card, shadow]}>
        <Text style={styles.email}>{profile.full_name || email || "—"}</Text>
        {email ? <Text style={styles.mute}>{email}</Text> : null}
        <Field
          label="Name"
          value={profile.full_name}
          onChangeText={(full_name) => setProfile((p) => ({ ...p, full_name }))}
        />
        <Field label="School" value={profile.school} onChangeText={(school) => setProfile((p) => ({ ...p, school }))} />
        <Field
          label="Graduation year"
          value={profile.graduation_year}
          onChangeText={(graduation_year) => setProfile((p) => ({ ...p, graduation_year }))}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>Class year</Text>
        <View style={styles.chips}>
          {YEARS.map((year) => (
            <Chip
              key={year.id}
              label={year.label}
              on={profile.class_year === year.id}
              onPress={() => void patch({ class_year: year.id })}
            />
          ))}
        </View>
        <Text style={styles.label}>Housing</Text>
        <View style={styles.chips}>
          <Chip label="On campus" on={profile.housing === "on_campus"} onPress={() => void patch({ housing: "on_campus" as Housing })} />
          <Chip label="Off campus" on={profile.housing === "off_campus"} onPress={() => void patch({ housing: "off_campus" as Housing })} />
        </View>
        <Pressable
          style={[styles.save, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={() =>
            void patch({
              full_name: profile.full_name,
              school: profile.school,
              graduation_year: profile.graduation_year,
            })
          }
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save identity"}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.btn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: 12, marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.mute}
        style={styles.input}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Flag({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.flag} onPress={onToggle}>
      <Text style={styles.flagLabel}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <Text style={styles.switchText}>{value ? "On" : "Off"}</Text>
      </View>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.mute}>{label}</Text>
      <Text style={styles.ink}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 12 },
  kicker: { color: colors.green, fontWeight: "700" },
  email: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  cardLead: { color: colors.mute, lineHeight: 20, marginBottom: 10 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 12 },
  label: { color: colors.mute, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { backgroundColor: colors.cream, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colors.green },
  chipText: { color: colors.ink, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  flag: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  flagLabel: { color: colors.ink, fontWeight: "600", flex: 1, paddingRight: 12 },
  switch: { backgroundColor: colors.cream, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, minWidth: 52, alignItems: "center" },
  switchOn: { backgroundColor: colors.greenSoft },
  switchText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  save: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  saveText: { color: "#fff", fontWeight: "800" },
  loanBox: { backgroundColor: colors.cream, borderRadius: 14, padding: 12, marginBottom: 8 },
  docTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 4, marginBottom: 6, textTransform: "capitalize" },
  mute: { color: colors.mute, lineHeight: 20 },
  ink: { color: colors.ink, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  err: { color: colors.danger, marginBottom: 10, fontWeight: "600" },
  ok: { color: colors.green, marginBottom: 10, fontWeight: "600" },
  btn: { backgroundColor: colors.ink, borderRadius: 18, padding: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
