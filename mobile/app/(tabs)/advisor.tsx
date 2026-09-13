import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenTitle } from "../../src/components/Logo";
import {
  agentHistory,
  chat,
  simulatePurchase,
  type AnchorCard,
  type ChatTurn,
} from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

type Agent = "anchor" | "compass";

const VERDICT: Record<AnchorCard["verdict"], { label: string; bg: string; fg: string }> = {
  go: { label: "Go", bg: colors.greenSoft, fg: colors.green },
  stretch: { label: "Tight", bg: "#F4EED8", fg: "#8A6A12" },
  skip: { label: "Skip", bg: "#F8EDE8", fg: colors.danger },
};

export default function AdvisorScreen() {
  const params = useLocalSearchParams<{ q?: string; agent?: string }>();
  const [agent, setAgent] = useState<Agent>(params.agent === "compass" ? "compass" : "anchor");
  const [question, setQuestion] = useState(params.q || "Can I afford a $70 Chicago trip?");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async (who: Agent) => {
    try {
      const res = await agentHistory(who);
      setTurns(res.turns ?? []);
    } catch {
      setTurns([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (typeof params.q === "string" && params.q.trim()) setQuestion(params.q);
      const who: Agent =
        params.agent === "compass" || params.agent === "anchor" ? params.agent : agent;
      if (who !== agent) setAgent(who);
      void loadHistory(who);
    }, [params.q, params.agent, loadHistory]),
  );

  async function ask() {
    setBusy(true);
    try {
      const res = await chat(agent, question);
      setTurns(res.history ?? []);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          at: new Date().toISOString(),
          message: question,
          reply: err instanceof Error ? err.message : "Agent failed",
          card: null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function demoBuy() {
    setBusy(true);
    try {
      const res = (await simulatePurchase()) as { history?: ChatTurn[] };
      setAgent("anchor");
      setTurns(res.history ?? (await agentHistory("anchor")).turns);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          at: new Date().toISOString(),
          message: "Simulate a purchase",
          reply: err instanceof Error ? err.message : "Purchase failed",
          card: null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function switchAgent(who: Agent) {
    setAgent(who);
    void loadHistory(who);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <ScreenTitle title="Advisor" />
      <Text style={styles.sub}>Anchor checks a purchase. Compass explains a concept. Older chats stay on this tab.</Text>

      <View style={styles.switcher}>
        <Pressable
          style={[styles.chip, agent === "anchor" && styles.chipOn]}
          onPress={() => switchAgent("anchor")}
        >
          <Text style={[styles.chipText, agent === "anchor" && styles.chipTextOn]}>Anchor</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, agent === "compass" && styles.chipOn]}
          onPress={() => switchAgent("compass")}
        >
          <Text style={[styles.chipText, agent === "compass" && styles.chipTextOn]}>Compass</Text>
        </Pressable>
      </View>

      <TextInput
        value={question}
        onChangeText={setQuestion}
        style={styles.input}
        multiline
        placeholder={agent === "anchor" ? "Can I afford this?" : "What should I understand about my loans?"}
        placeholderTextColor={colors.mute}
      />
      <Pressable style={styles.btn} onPress={ask} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "Thinking…" : `Ask ${agent === "anchor" ? "Anchor" : "Compass"}`}</Text>
      </Pressable>
      {agent === "anchor" ? (
        <Pressable style={styles.ghost} onPress={demoBuy} disabled={busy}>
          <Text style={styles.ghostText}>Simulate a purchase (Nessie)</Text>
        </Pressable>
      ) : null}

      {turns.length === 0 ? (
        <Text style={styles.empty}>Nothing saved yet. Ask once and it will stay here.</Text>
      ) : (
        [...turns].reverse().map((turn) => (
          <View key={turn.id} style={styles.thread}>
            <Text style={styles.when}>{when(turn.at)}</Text>
            <View style={styles.you}>
              <Text style={styles.youLabel}>You</Text>
              <Text style={styles.youText}>{turn.message}</Text>
            </View>
            {agent === "anchor" && turn.card ? (
              <AnchorReply card={turn.card} />
            ) : (
              <View style={[styles.card, shadow]}>
                <Text style={styles.cardTitle}>{agent === "anchor" ? "Anchor" : "Compass"}</Text>
                <Text style={styles.body}>{turn.reply}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function when(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return `$${Math.round(value).toLocaleString()}`;
}

function AnchorReply({ card }: { card: AnchorCard }) {
  const tone = VERDICT[card.verdict] ?? VERDICT.stretch;
  const extra = money(card.extra_after);
  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.cardHead}>
        <Text style={styles.headline}>{card.headline}</Text>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>
      {card.why ? <Text style={styles.why}>{card.why}</Text> : null}

      <View style={styles.factGrid}>
        {extra ? (
          <View style={styles.fact}>
            <Text style={styles.factValue}>{extra}</Text>
            <Text style={styles.factLabel}>Extra after</Text>
          </View>
        ) : null}
        {card.days_to_aid != null ? (
          <View style={styles.fact}>
            <Text style={styles.factValue}>{card.days_to_aid}d</Text>
            <Text style={styles.factLabel}>To next cash</Text>
          </View>
        ) : null}
      </View>

      {(card.takeaways ?? []).map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.bullet}>{item}</Text>
        </View>
      ))}

      {(card.watch ?? []).length ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Watch</Text>
          {(card.watch ?? []).map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.warnDot}>•</Text>
              <Text style={styles.bullet}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {card.next_step ? (
        <View style={styles.nextBox}>
          <Text style={styles.nextText}>{card.next_step}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  sub: { color: colors.mute, marginBottom: 16, marginTop: 4, lineHeight: 20 },
  switcher: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.green },
  chipText: { color: colors.ink, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  input: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    minHeight: 80,
    color: colors.ink,
    marginBottom: 12,
  },
  btn: { backgroundColor: colors.green, borderRadius: 18, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: { padding: 14, alignItems: "center" },
  ghostText: { color: colors.green, fontWeight: "600" },
  empty: { color: colors.mute, marginTop: 18, lineHeight: 20 },
  thread: { marginTop: 16 },
  when: { color: colors.mute, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  you: { backgroundColor: colors.greenSoft, borderRadius: 16, padding: 12, marginBottom: 8 },
  youLabel: { color: colors.green, fontWeight: "800", fontSize: 11, marginBottom: 4 },
  youText: { color: colors.ink, fontWeight: "600", lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, marginTop: 8 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink },
  body: { color: colors.ink, lineHeight: 22 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headline: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.ink },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  why: { color: colors.mute, marginTop: 10, lineHeight: 20 },
  factGrid: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
  fact: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  factValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
  factLabel: { color: colors.mute, marginTop: 4, fontSize: 12 },
  bulletRow: { flexDirection: "row", gap: 8, marginTop: 8, paddingRight: 8 },
  dot: { color: colors.green, fontWeight: "800" },
  bullet: { flex: 1, color: colors.ink, lineHeight: 20 },
  warnBox: { backgroundColor: "#F8EDE8", borderRadius: 16, padding: 14, marginTop: 14 },
  warnTitle: { fontWeight: "800", color: colors.danger, marginBottom: 4 },
  warnDot: { color: colors.danger, fontWeight: "800" },
  nextBox: { backgroundColor: colors.greenSoft, borderRadius: 16, padding: 14, marginTop: 14 },
  nextText: { color: colors.green, fontWeight: "700", lineHeight: 20 },
});
