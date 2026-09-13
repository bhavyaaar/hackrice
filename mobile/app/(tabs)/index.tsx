import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "../../src/components/Logo";
import { bootstrap, firstNameFrom, nameFromAccessToken, nameFromAuthUser, studentState, type StudentState } from "../../src/lib/api";
import {
  categoryBars,
  initialsFrom,
  insightLine,
  prettyDate,
  sparkPoints,
  spendChips,
  todaySpendable,
  upcomingRows,
} from "../../src/lib/dashboard";
import { supabase } from "../../src/lib/supabase";
import { colors, shadow } from "../../src/theme";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StudentState | null>(null);
  const [hello, setHello] = useState("Hi");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setError(null);
      const { data } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      const authName = nameFromAuthUser(data.user) || nameFromAccessToken(sessionData.session?.access_token);
      const boot = await bootstrap(authName);
      const next = boot.state ?? (await studentState());
      setState(next);
      const first = firstNameFrom(authName, next.display_name, next.profile_flags?.full_name);
      setHello(first ? first : "there");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const linked = state != null && state.days_until_next_disbursement != null;
  const balance = Number(state?.balance ?? 0);
  const days = state?.days_until_next_disbursement;
  const aidDate = prettyDate(state?.next_disbursement_date);
  const offTrack = Boolean(state?.runway_shortfall_date);
  const spend = todaySpendable(state);
  const bars = categoryBars(state);
  const insight = insightLine(state);
  const upcoming = upcomingRows(state, state?.profile_flags).slice(0, 4);
  const chart = sparkPoints(state);
  const chips = spendChips(spend?.today ?? null);
  const initials = initialsFrom(hello, state?.display_name);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  function askAmount(amount: number) {
    const q = `Can I spend $${amount.toFixed(2)} right now and still make it to my next aid drop?`;
    router.push({ pathname: "/(tabs)/advisor", params: { q, agent: "anchor" } });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{todayLabel}</Text>
          <Text style={styles.hello}>Hey, {hello}</Text>
        </View>
        <Pressable style={styles.avatar} onPress={() => router.push("/(tabs)/profile")}>
          <Logo size={22} />
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
      </View>

      {!linked ? (
        <View style={[styles.hero, shadow]}>
          <Text style={styles.heroKicker}>Can I spend it?</Text>
          <Text style={styles.emptyTitle}>Checking isn’t linked yet</Text>
          <Text style={styles.heroMute}>Pull to refresh after bootstrap, or open Profile if this keeps happening.</Text>
          <Pressable style={styles.lightCta} onPress={() => void load()}>
            <Text style={styles.lightCtaText}>Try again</Text>
          </Pressable>
        </View>
      ) : spend?.yes ? (
        <View style={[styles.hero, shadow]}>
          <View style={styles.heroTop}>
            <Text style={styles.heroKicker}>Can I spend it?</Text>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Today</Text>
            </View>
          </View>
          <Text style={styles.heroNum}>
            ${spend.today.toLocaleString()}
            <Text style={styles.heroUnit}> today</Text>
          </Text>
          <Text style={styles.heroSub}>
            {`without missing ${spend.aidLabel}${spend.reserved > 0 ? ` · $${Math.round(spend.reserved).toLocaleString()} held for bills` : ""}`}
          </Text>
          {chart.length >= 2 ? (
            <Sparkline points={chart} dangerDate={state?.runway_shortfall_date} offTrack={offTrack} />
          ) : null}
          <View style={styles.trackLabels}>
            <Text style={styles.trackLabel}>Today</Text>
            <Text style={styles.trackLabel}>{aidDate || "Next aid"}</Text>
          </View>
          <View style={styles.heroChips}>
            {chips.map((amount) => (
              <Pressable key={amount} style={styles.heroChip} onPress={() => askAmount(amount)}>
                <Text style={styles.heroChipText}>${amount}</Text>
              </Pressable>
            ))}
          </View>
          {insight ? <Text style={styles.heroInsight}>{insight}</Text> : null}
        </View>
      ) : (
        <View style={[styles.hero, styles.heroOff, shadow]}>
          <Text style={styles.heroKicker}>Can I spend it?</Text>
          <Text style={styles.emptyTitle}>Not today</Text>
          <Text style={styles.heroSub}>
            {spend && spend.reserved > 0
              ? `Bills due before ${spend.aidLabel} already claim this stretch.`
              : `Spending today means missing ${spend?.aidLabel || aidDate || "next aid"}.`}
          </Text>
        </View>
      )}

      {linked ? (
        <View style={styles.statRow}>
          <Stat label="Checking" value={`$${Math.round(balance).toLocaleString()}`} />
          <Stat
            label="Held for bills"
            value={`$${Math.round(spend?.reserved ?? 0).toLocaleString()}`}
            warn={(spend?.reserved ?? 0) > 0 && (spend?.today ?? 0) === 0}
          />
          <Stat label="To aid" value={days != null ? `${days}d` : "—"} />
        </View>
      ) : null}

      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Last 30 days</Text>
        {bars.length ? (
          <>
            <View style={styles.stack}>
              {bars.map((bar) => (
                <View key={bar.key} style={{ flex: Math.max(bar.share, 0.06), backgroundColor: bar.color, height: 18 }} />
              ))}
            </View>
            {bars.map((bar) => (
              <View key={bar.key} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: bar.color }]} />
                <Text style={styles.legendLabel}>{bar.label}</Text>
                <Text style={styles.amount}>${Math.round(bar.amount).toLocaleString()}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.mute}>Purchases land here once Nessie has a history.</Text>
        )}
      </View>

      <View style={[styles.card, shadow]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Coming up</Text>
          <Text style={styles.link} onPress={() => router.push("/(tabs)/finances")}>
            Finances
          </Text>
        </View>
        {upcoming.length === 0 ? (
          <Text style={styles.mute}>Bills and aid dates appear after checking is linked.</Text>
        ) : (
          upcoming.map((row) => (
            <View key={row.id} style={styles.billRow}>
              <View style={[styles.billIcon, row.kind === "aid" && { backgroundColor: "#16382C" }]}>
                <Text style={row.kind === "aid" ? { color: "#fff" } : undefined}>{row.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ink}>{row.title}</Text>
                <Text style={styles.mute}>{row.subtitle}</Text>
              </View>
              <Text style={[styles.amount, row.kind === "aid" && { color: colors.green }]}>{row.amountLabel}</Text>
            </View>
          ))
        )}
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.stat, shadow]}>
      <Text style={[styles.statValue, warn && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Sparkline({
  points,
  dangerDate,
  offTrack,
}: {
  points: { date: string; balance: number }[];
  dangerDate?: string | null;
  offTrack: boolean;
}) {
  const min = Math.min(0, ...points.map((point) => point.balance));
  const max = Math.max(...points.map((point) => point.balance), 1);
  const span = max - min || 1;
  return (
    <View style={styles.spark}>
      {points.map((point, index) => {
        const height = ((point.balance - min) / span) * 44;
        const danger = Boolean(dangerDate && point.date.slice(0, 10) >= dangerDate.slice(0, 10));
        return (
          <View key={`${point.date}-${index}`} style={styles.sparkCol}>
            <View
              style={[
                styles.sparkBar,
                {
                  height: Math.max(3, height),
                  backgroundColor: danger || offTrack ? "#F3C0B6" : "#B7E0C8",
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  date: { color: colors.mute, fontWeight: "600", fontSize: 13 },
  hello: { color: colors.ink, fontWeight: "800", fontSize: 28, marginTop: 2 },
  avatar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  avatarText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  hero: { backgroundColor: "#16382C", borderRadius: 28, padding: 22, marginBottom: 14 },
  heroOff: { backgroundColor: "#4A2A24" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroKicker: { color: "#B7E0C8", fontWeight: "700", fontSize: 13 },
  live: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(183,224,200,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  liveOff: { backgroundColor: "rgba(243,192,182,0.18)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#B7E0C8" },
  liveText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  heroNum: { fontSize: 48, fontWeight: "800", color: "#fff", marginTop: 10 },
  heroUnit: { fontSize: 20, fontWeight: "700", color: "#B7E0C8" },
  heroSub: { color: "#D8F0E3", fontWeight: "600", lineHeight: 20, marginTop: 4 },
  heroMute: { color: "#D8F0E3", lineHeight: 20, marginTop: 8 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 8 },
  spark: { flexDirection: "row", alignItems: "flex-end", height: 48, gap: 2, marginTop: 16 },
  sparkCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: 48 },
  sparkBar: { width: "100%", borderRadius: 2, minHeight: 3 },
  trackLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  trackLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  heroChips: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroChip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  heroChipText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  heroInsight: { color: "#D8F0E3", marginTop: 14, lineHeight: 20, fontWeight: "600" },
  lightCta: { marginTop: 16, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  lightCtaText: { color: "#16382C", fontWeight: "800" },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
  statLabel: { color: colors.mute, marginTop: 4, fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 18, marginBottom: 14 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  cardTitle: { fontWeight: "800", color: colors.ink, fontSize: 17 },
  link: { color: colors.green, fontWeight: "700" },
  mute: { color: colors.mute, lineHeight: 20 },
  ink: { color: colors.ink, fontWeight: "700" },
  amount: { color: colors.ink, fontWeight: "800" },
  stack: { flexDirection: "row", overflow: "hidden", borderRadius: 10, marginTop: 12, marginBottom: 10, gap: 3 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  legendLabel: { flex: 1, color: colors.ink, fontWeight: "600" },
  billRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  billIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  err: { color: colors.danger, marginTop: 8 },
});
