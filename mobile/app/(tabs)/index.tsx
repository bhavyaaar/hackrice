import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Logo } from "../../src/components/Logo";
import { bootstrap, studentState, type StudentState } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function HomeScreen() {
  const [state, setState] = useState<StudentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setError(null);
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
  const onTrack = safe > 0 && !state?.runway_shortfall_date;
  const food = state?.spending_by_category?.food_delivery ?? 0;
  const bills = state?.upcoming_bills ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />
      }
    >
      <View style={styles.top}>
        <View style={styles.brand}>
          <Logo size={48} />
          <View>
            <Text style={styles.logo}>northstar</Text>
            <Text style={styles.tagline}>navigate your student finances</Text>
          </View>
        </View>
        <Pressable style={styles.avatar} onPress={() => router.push("/(tabs)/profile")}>
          <Text style={styles.avatarText}>⎋</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, shadow]}>
        <Text style={styles.kicker}>Safe to spend</Text>
        <Text style={styles.heroNum}>${Math.round(safe).toLocaleString()}</Text>
        <Text style={[styles.ok, !onTrack && { color: colors.danger }]}>
          {state?.days_until_next_disbursement != null
            ? onTrack
              ? `You're on track · ${state.days_until_next_disbursement} days to next aid`
              : `Shortfall ${state.runway_shortfall_date} · ${state.days_until_next_disbursement} days to aid`
            : "No Nessie account yet — runway shows $0 until you add a key"}
        </Text>
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Aid runway</Text>
        <View style={styles.row}>
          <Text style={styles.mute}>Balance</Text>
          <Text style={styles.ink}>${Number(state?.balance ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.mute}>Avg daily spend</Text>
          <Text style={styles.ink}>${Number(state?.avg_daily_spend ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.mute}>Projected at next disbursement</Text>
          <Text style={styles.ink}>
            {state?.projected_balance_at_next_disbursement == null
              ? "—"
              : `$${Number(state.projected_balance_at_next_disbursement).toFixed(0)}`}
          </Text>
        </View>
      </View>

      <View style={[styles.card, shadow]}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Upcoming bills</Text>
          <Text style={styles.link}>See all</Text>
        </View>
        {bills.length === 0 ? (
          <Text style={styles.mute}>No bills yet. They appear after Nessie is linked.</Text>
        ) : (
          bills.map((bill) => (
            <View key={bill.payee} style={styles.billRow}>
              <View style={styles.billIcon}>
                <Text>⌂</Text>
              </View>
              <Text style={[styles.ink, { flex: 1 }]}>{bill.payee}</Text>
              <Text style={styles.amount}>${Number(bill.amount).toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Insight for you</Text>
        <Text style={styles.body}>
          {food > 0
            ? `You spent $${food.toFixed(0)} on dining recently. Anchor can check a purchase against your runway.`
            : "Once purchases sync from Nessie, Compass and Anchor will call out spend vs your next aid drop."}
        </Text>
        <Pressable style={styles.cta} onPress={() => router.push("/(tabs)/advisor")}>
          <Text style={styles.ctaText}>Ask Anchor</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logo: { color: colors.green, fontWeight: "800", fontSize: 20 },
  tagline: { color: colors.mute, marginTop: 2, fontSize: 13 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, color: colors.ink },
  hero: { backgroundColor: colors.greenSoft, borderRadius: 24, padding: 22, marginBottom: 16 },
  kicker: { color: colors.green, fontWeight: "600" },
  heroNum: { fontSize: 52, fontWeight: "800", color: colors.ink, marginVertical: 4 },
  ok: { color: colors.green, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "700", color: colors.ink, marginBottom: 10, fontSize: 16 },
  mute: { color: colors.mute },
  ink: { color: colors.ink, fontWeight: "600" },
  amount: { color: colors.ink, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  billIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { color: colors.green, fontWeight: "600", marginBottom: 10 },
  body: { color: colors.ink, lineHeight: 22 },
  cta: { marginTop: 14, backgroundColor: colors.green, borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700" },
  err: { color: colors.danger, marginTop: 8 },
});
