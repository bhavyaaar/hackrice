import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenTitle } from "../../src/components/Logo";
import { horizonSimulate, studentState, type StudentState } from "../../src/lib/api";
import { monthsUntilGraduation, topLeak } from "../../src/lib/dashboard";
import { colors, shadow } from "../../src/theme";

const EXTRA_CHIPS = [25, 50, 100];

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

function span(months: number | null | undefined) {
  if (months == null || months <= 0) return "—";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years <= 0) return `${rem} mo`;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StudentState | null>(null);
  const [extra, setExtra] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    monthly: number;
    months: number;
    interest: number;
    baseMonths: number;
    baseInterest: number;
    saved: number;
    monthsSaved: number;
  } | null>(null);

  useEffect(() => {
    studentState()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  const loan = state?.loan_summary;
  const principal = Number(loan?.principal ?? 0);
  const subsidized = Number(loan?.subsidized ?? 0);
  const unsubsidized = Number(loan?.unsubsidized ?? 0);
  const rate = Number(loan?.rate ?? 0);
  const monthlyAccrual = unsubsidized > 0 && rate > 0 ? (unsubsidized * rate) / 12 : 0;
  const schoolMonths = monthsUntilGraduation(state?.profile_flags);
  const waitCost = monthlyAccrual * schoolMonths;
  const grownUnsub = unsubsidized + waitCost;
  const leak = topLeak(state);
  const extraAmt = Number(extra) || 50;
  const leakCovers = leak && extraAmt > 0 ? leak.amount / extraAmt : null;
  const subShare = principal > 0 ? subsidized / principal : 0;
  const unsubShare = principal > 0 ? unsubsidized / principal : 0;

  async function runHorizon(amount?: number) {
    const extraMonthly = amount ?? (Number(extra) || 0);
    if (amount != null) setExtra(String(amount));
    setBusy(true);
    setError(null);
    try {
      const res = await horizonSimulate(extraMonthly);
      if (res.plan?.error) {
        setResult(null);
        setError(res.plan.error);
        return;
      }
      setResult({
        monthly: Number(res.plan.monthly_payment ?? 0),
        months: Number(res.plan.months ?? 0),
        interest: Number(res.plan.interest_paid ?? 0),
        baseMonths: Number(res.baseline.months ?? 0),
        baseInterest: Number(res.baseline.interest_paid ?? 0),
        saved: Number(res.interest_saved ?? 0),
        monthsSaved: Number(res.months_saved ?? 0),
      });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Horizon failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: 40 }}
    >
      <ScreenTitle title="Finances" />
      <Text style={styles.sub}>Horizon — what the loans cost, and what extra payments change.</Text>

      <View style={[styles.hero, shadow]}>
        <Text style={styles.heroKicker}>Total loans</Text>
        <Text style={styles.heroNum}>{money(principal)}</Text>
        <Text style={styles.heroSub}>
          {(rate * 100).toFixed(2)}% · unsubsidized is accruing
          {monthlyAccrual > 0 ? ` about ${money(monthlyAccrual)}/mo while you’re in school` : ""}
        </Text>
        {principal > 0 ? (
          <View style={styles.split}>
            <View style={[styles.splitSeg, { flex: Math.max(subShare, 0.08), backgroundColor: "#B7E0C8" }]} />
            <View style={[styles.splitSeg, { flex: Math.max(unsubShare, 0.08), backgroundColor: "#F5A524" }]} />
          </View>
        ) : null}
        <View style={styles.splitLabels}>
          <Text style={styles.splitLabel}>Subsidized {money(subsidized)}</Text>
          <Text style={styles.splitLabel}>Unsubsidized {money(unsubsidized)}</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat label="Accruing / mo" value={money(monthlyAccrual)} />
        <Stat label="By graduation" value={money(waitCost)} />
        <Stat label="School left" value={span(schoolMonths)} />
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>What if I pay extra?</Text>
        <Text style={styles.mute}>Horizon estimates payoff if you add this much every month after school, on a 10-year plan.</Text>
        <View style={styles.chipRow}>
          {EXTRA_CHIPS.map((amount) => (
            <Pressable
              key={amount}
              style={[styles.chip, extra === String(amount) && styles.chipOn]}
              onPress={() => void runHorizon(amount)}
            >
              <Text style={[styles.chipText, extra === String(amount) && styles.chipTextOn]}>${amount}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <Text style={styles.prefix}>$</Text>
          <TextInput
            value={extra}
            onChangeText={setExtra}
            keyboardType="numeric"
            style={styles.input}
            placeholder="50"
            placeholderTextColor={colors.mute}
          />
          <Pressable style={styles.btn} onPress={() => void runHorizon()} disabled={busy}>
            <Text style={styles.btnText}>{busy ? "…" : "Run"}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {result ? (
          <View style={styles.result}>
            <View style={styles.resultRow}>
              <View style={styles.resultCell}>
                <Text style={styles.resultValue}>{span(result.months)}</Text>
                <Text style={styles.resultLabel}>With extra</Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={styles.resultValue}>{span(result.baseMonths)}</Text>
                <Text style={styles.resultLabel}>Min payment only</Text>
              </View>
            </View>
            <View style={styles.saveBox}>
              <Text style={styles.saveText}>
                {result.saved > 0
                  ? `Saves about ${money(result.saved)} in interest${result.monthsSaved > 0 ? ` · ${span(result.monthsSaved)} sooner` : ""}`
                  : "No extra vs minimum in this preview."}
              </Text>
              <Text style={styles.mute}>Payment would be {money(result.monthly)}/mo including the extra.</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>If you wait until graduation</Text>
        <Text style={styles.body}>
          {monthlyAccrual > 0
            ? `Unsubsidized ${money(unsubsidized)} keeps adding about ${money(monthlyAccrual)}/mo. Over ${span(schoolMonths)} that’s roughly ${money(waitCost)} extra principal — you’d owe about ${money(grownUnsub)} on that piece. Subsidized ${money(subsidized)} does not accrue while you’re in school.`
            : "Add unsubsidized loans on your profile to see what waiting costs."}
        </Text>
      </View>

      {leak ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Extra vs last 30 days</Text>
          <Text style={styles.body}>
            {leak.label} was {money(leak.amount)}. That’s about {leakCovers != null ? leakCovers.toFixed(1) : "—"} extra ${Math.round(extraAmt)} loan payments after school — or skip some of that category and fund Horizon instead.
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.linkCard} onPress={() => router.push({ pathname: "/(tabs)/advisor", params: { agent: "compass", q: "What should I understand first about my loans?" } })}>
        <Text style={styles.linkKicker}>Compass</Text>
        <Text style={styles.linkTitle}>Why unsubsidized accrues in school</Text>
        <Text style={styles.mute}>One concept, against this package.</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.stat, shadow]}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  sub: { color: colors.mute, marginBottom: 16, marginTop: 4, lineHeight: 20 },
  hero: { backgroundColor: "#16382C", borderRadius: 28, padding: 22, marginBottom: 14 },
  heroKicker: { color: "#B7E0C8", fontWeight: "700", fontSize: 13 },
  heroNum: { fontSize: 44, fontWeight: "800", color: "#fff", marginTop: 6 },
  heroSub: { color: "#D8F0E3", fontWeight: "600", lineHeight: 20, marginTop: 6 },
  split: { flexDirection: "row", height: 12, borderRadius: 8, overflow: "hidden", marginTop: 16, gap: 3 },
  splitSeg: { height: 12, borderRadius: 4 },
  splitLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  splitLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10 },
  statValue: { fontSize: 16, fontWeight: "800", color: colors.ink },
  statLabel: { color: colors.mute, marginTop: 4, fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "800", color: colors.ink, fontSize: 17, marginBottom: 6 },
  mute: { color: colors.mute, lineHeight: 20 },
  body: { color: colors.ink, lineHeight: 22 },
  ink: { color: colors.ink, fontWeight: "700" },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 10 },
  chip: { flex: 1, backgroundColor: colors.greenSoft, borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  chipOn: { backgroundColor: colors.green },
  chipText: { color: colors.green, fontWeight: "800" },
  chipTextOn: { color: "#fff" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefix: { color: colors.ink, fontWeight: "800", fontSize: 18 },
  input: { flex: 1, backgroundColor: colors.cream, borderRadius: 12, padding: 12, color: colors.ink, fontWeight: "700" },
  btn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18 },
  btnText: { color: "#fff", fontWeight: "800" },
  err: { color: colors.danger, marginTop: 10, fontWeight: "600" },
  result: { marginTop: 16 },
  resultRow: { flexDirection: "row", gap: 10 },
  resultCell: { flex: 1, backgroundColor: colors.cream, borderRadius: 16, padding: 14 },
  resultValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  resultLabel: { color: colors.mute, marginTop: 4, fontSize: 12, fontWeight: "600" },
  saveBox: { backgroundColor: colors.greenSoft, borderRadius: 16, padding: 14, marginTop: 10 },
  saveText: { color: colors.green, fontWeight: "700", lineHeight: 20, marginBottom: 4 },
  linkCard: { backgroundColor: colors.greenSoft, borderRadius: 22, padding: 18 },
  linkKicker: { color: colors.green, fontWeight: "700" },
  linkTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginVertical: 4 },
});
