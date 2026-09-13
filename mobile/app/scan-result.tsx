import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { saveDocument } from "../src/lib/api";
import { colors, shadow } from "../src/theme";

function money(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : String(value);
}

function asList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function prettyType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Document";
  return value.replaceAll("_", " ");
}

export default function ScanResultScreen() {
  const { ocr, extracted, storagePath, saved: savedParam } = useLocalSearchParams<{
    ocr?: string;
    extracted?: string;
    storagePath?: string;
    saved?: string;
  }>();
  const alreadySaved = savedParam === "1";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = extracted ? (JSON.parse(extracted) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  const docType = prettyType(parsed.document_type);
  const headline = typeof parsed.headline === "string" && parsed.headline.trim() ? parsed.headline.trim() : docType;
  const meaning =
    typeof parsed.what_it_means === "string" && parsed.what_it_means.trim()
      ? parsed.what_it_means.trim()
      : typeof parsed.explanation === "string"
        ? parsed.explanation
        : null;
  const takeaways = asList(parsed.takeaways);
  const warnings = asList(parsed.warnings);
  const nextStep = typeof parsed.next_step === "string" ? parsed.next_step.trim() : "";
  const facts = [
    { label: "Cost of attendance", value: money(parsed.total_cost_of_attendance) },
    { label: "Grants", value: money(parsed.grants_amount) },
    { label: "Subsidized", value: money(parsed.subsidized_loan_amount) },
    { label: "Unsubsidized", value: money(parsed.unsubsidized_loan_amount) },
    { label: "Work-study", value: money(parsed.work_study_amount) },
  ].filter((row) => row.value);

  async function onSave() {
    if (saved || saving) return;
    if (!storagePath) {
      setError("This scan is missing a storage path. Capture again, then save.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDocument({
        storage_path: storagePath,
        ocr_text: ocr ?? "",
        extracted: parsed,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Scan complete</Text>
      <Text style={styles.sub}>Here’s what Compass found</Text>

      <View style={[styles.card, shadow]}>
        <View style={styles.cardHead}>
          <Text style={styles.headline}>{headline}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{docType}</Text>
          </View>
        </View>
        {meaning ? <Text style={styles.meaning}>{meaning}</Text> : null}

        {facts.length ? (
          <>
            <Text style={styles.section}>Numbers</Text>
            <View style={styles.factGrid}>
              {facts.map((fact) => (
                <View key={fact.label} style={styles.fact}>
                  <Text style={styles.factValue}>{fact.value}</Text>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {takeaways.length ? (
          <>
            <Text style={styles.section}>What this means</Text>
            {takeaways.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.bullet}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}

        {warnings.length ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Watch</Text>
            {warnings.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={styles.warnDot}>•</Text>
                <Text style={styles.warnText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {nextStep ? (
          <View style={styles.nextBox}>
            <Text style={styles.nextText}>{nextStep}</Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={() => setShowRaw((open) => !open)}>
        <Text style={styles.rawToggle}>{showRaw ? "Hide scanned lines" : "Show scanned lines"}</Text>
      </Pressable>
      {showRaw ? (
        <View style={[styles.rawCard, shadow]}>
          <Text style={styles.rawBody}>{ocr || String(parsed.transcript || "—")}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {saved ? (
        <Pressable style={styles.saved} onPress={() => router.push("/(tabs)/profile")}>
          <Text style={styles.savedText}>Saved to profile  →</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={() => void onSave()} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "Saving…" : "Save to profile"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { color: colors.green, fontWeight: "700", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginTop: 4, marginBottom: 18 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 14 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headline: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.ink },
  badge: { backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: colors.green, fontWeight: "700", fontSize: 11, textTransform: "capitalize" },
  meaning: { color: colors.mute, marginTop: 10, lineHeight: 20 },
  section: { fontWeight: "800", color: colors.ink, marginTop: 18, marginBottom: 8 },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fact: {
    width: "47%",
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  factValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
  factLabel: { color: colors.mute, marginTop: 4, fontSize: 12 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 8, paddingRight: 8 },
  dot: { color: colors.green, fontWeight: "800", marginTop: 1 },
  bullet: { flex: 1, color: colors.ink, lineHeight: 20 },
  warnBox: { backgroundColor: "#F8EDE8", borderRadius: 16, padding: 14, marginTop: 16 },
  warnTitle: { fontWeight: "800", color: colors.danger, marginBottom: 8 },
  warnDot: { color: colors.danger, fontWeight: "800", marginTop: 1 },
  warnText: { flex: 1, color: colors.ink, lineHeight: 20 },
  nextBox: {
    backgroundColor: colors.greenSoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  nextText: { color: colors.green, fontWeight: "700", lineHeight: 20 },
  rawToggle: { color: colors.green, fontWeight: "700", marginBottom: 10 },
  rawCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 14 },
  rawBody: { color: colors.mute, lineHeight: 20, fontSize: 13 },
  err: { color: colors.danger, marginBottom: 10, fontWeight: "600" },
  btn: {
    backgroundColor: colors.green,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  saved: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  savedText: { color: colors.green, fontWeight: "800", fontSize: 16 },
});
