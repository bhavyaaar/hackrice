import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenTitle } from "../src/components/Logo";
import { colors, shadow } from "../src/theme";

function money(value: unknown) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : String(value);
}

export default function ScanResultScreen() {
  const { ocr, extracted } = useLocalSearchParams<{ ocr?: string; extracted?: string }>();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = extracted ? (JSON.parse(extracted) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  const explanation = typeof parsed.explanation === "string" ? parsed.explanation : null;
  const docType = typeof parsed.document_type === "string" ? parsed.document_type.replaceAll("_", " ") : "Document";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <ScreenTitle title="Your document" />
      <Text style={styles.sub} onPress={() => router.back()}>
        ← Back
      </Text>
      <Text style={styles.kicker}>{docType}</Text>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>How this fits your journey</Text>
        <Text style={styles.body}>{explanation || "Compass did not return an explanation for this file."}</Text>
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Numbers Compass pulled</Text>
        <Row label="Cost of attendance" value={money(parsed.total_cost_of_attendance)} />
        <Row label="Subsidized loans" value={money(parsed.subsidized_loan_amount)} />
        <Row label="Unsubsidized loans" value={money(parsed.unsubsidized_loan_amount)} />
        <Row label="Work-study" value={money(parsed.work_study_amount)} />
        <Row label="Grants" value={money(parsed.grants_amount)} />
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Lines from the document</Text>
        <Text style={styles.body}>{ocr || String(parsed.transcript || "—")}</Text>
      </View>
    </ScrollView>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  sub: { color: colors.green, marginVertical: 8 },
  kicker: { color: colors.green, fontWeight: "700", textTransform: "capitalize", marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink },
  body: { color: colors.ink, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  mute: { color: colors.mute, flex: 1 },
  ink: { color: colors.ink, fontWeight: "600" },
});
