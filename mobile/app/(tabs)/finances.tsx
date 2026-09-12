import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { horizonSimulate, studentState, type StudentState } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function FinancesScreen() {
  const [state, setState] = useState<StudentState | null>(null);
  const [extra, setExtra] = useState("50");
  const [sim, setSim] = useState<string | null>(null);

  useEffect(() => {
    studentState()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  const loan = state?.loan_summary;

  async function runHorizon() {
    try {
      const res = (await horizonSimulate(Number(extra) || 0)) as { preview: Record<string, number> };
      setSim(JSON.stringify(res.preview, null, 2));
    } catch (err) {
      setSim(err instanceof Error ? err.message : "Horizon failed");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={styles.title}>Finances</Text>
      <Text style={styles.sub}>Horizon — loans, runway, extra payments</Text>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Runway</Text>
        <Row label="Balance" value={`$${Number(state?.balance ?? 0).toFixed(2)}`} />
        <Row label="Safe to spend" value={`$${Number(state?.safe_to_spend ?? 0).toFixed(0)}`} />
        <Row label="Avg daily spend" value={`$${Number(state?.avg_daily_spend ?? 0).toFixed(2)}`} />
        <Row label="Days to next aid" value={state?.days_until_next_disbursement?.toString() ?? "—"} />
        <Row label="Shortfall date" value={state?.runway_shortfall_date ?? "—"} />
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Loans</Text>
        <Row label="Principal" value={loan ? `$${loan.principal}` : "—"} />
        <Row label="Subsidized" value={loan ? `$${loan.subsidized}` : "—"} />
        <Row label="Unsubsidized" value={loan ? `$${loan.unsubsidized}` : "—"} />
        <Row label="Rate" value={loan ? `${(loan.rate * 100).toFixed(2)}%` : "—"} />
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Extra monthly payment</Text>
        <TextInput value={extra} onChangeText={setExtra} keyboardType="numeric" style={styles.input} />
        <Pressable style={styles.btn} onPress={runHorizon}>
          <Text style={styles.btnText}>Simulate payoff</Text>
        </Pressable>
        {sim ? <Text style={styles.body}>{sim}</Text> : null}
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
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginBottom: 16, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink, fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  mute: { color: colors.mute },
  ink: { color: colors.ink, fontWeight: "600" },
  input: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginBottom: 10, color: colors.ink },
  btn: { backgroundColor: colors.green, borderRadius: 18, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  body: { color: colors.ink, marginTop: 12, lineHeight: 20 },
});
