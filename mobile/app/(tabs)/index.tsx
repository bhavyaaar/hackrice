import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { bootstrap, studentState, type StudentState } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { colors, shadow } from "../../src/theme";

export default function HomeScreen() {
  const [state, setState] = useState<StudentState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      await bootstrap();
      setState(await studentState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const safe = state?.safe_to_spend ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
      <View style={styles.top}>
        <Text style={styles.logo}>✦ Northstar</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, shadow]}>
        <Text style={styles.kicker}>Safe to spend before next aid</Text>
        <Text style={styles.heroNum}>${safe.toFixed(0)}</Text>
        <Text style={styles.ok}>
          {state?.days_until_next_disbursement != null
            ? `${state.days_until_next_disbursement} days to next disbursement`
            : "Link Nessie via bootstrap/seed"}
        </Text>
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Upcoming bills</Text>
        {(state?.upcoming_bills ?? []).length === 0 ? (
          <Text style={styles.mute}>No bills yet — seed Nessie data</Text>
        ) : (
          state!.upcoming_bills.map((bill) => (
            <View key={bill.payee} style={styles.row}>
              <Text style={styles.ink}>{bill.payee}</Text>
              <Text style={styles.ink}>${Number(bill.amount).toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Runway</Text>
        <Text style={styles.mute}>
          Shortfall date: {state?.runway_shortfall_date ?? "—"} · avg ${state?.avg_daily_spend ?? 0}/day
        </Text>
        <Text style={styles.mute}>Balance ${state?.balance ?? 0}</Text>
      </View>

      {error ? <Text style={{ color: colors.danger, marginTop: 12 }}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { color: colors.green, fontWeight: "800", fontSize: 20 },
  signOut: { color: colors.mute },
  hero: { backgroundColor: colors.greenSoft, borderRadius: 24, padding: 22, marginBottom: 16 },
  kicker: { color: colors.green, fontWeight: "600" },
  heroNum: { fontSize: 48, fontWeight: "800", color: colors.ink, marginVertical: 4 },
  ok: { color: colors.green, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "700", color: colors.ink, marginBottom: 10, fontSize: 16 },
  mute: { color: colors.mute },
  ink: { color: colors.ink },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
});
