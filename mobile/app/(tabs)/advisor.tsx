import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { chat, simulatePurchase } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

type Agent = "anchor" | "compass";

export default function AdvisorScreen() {
  const [agent, setAgent] = useState<Agent>("anchor");
  const [question, setQuestion] = useState("Can I afford a $70 Chicago trip?");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const res = await chat(agent, question);
      setReply(res.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  async function demoBuy() {
    setBusy(true);
    try {
      const res = (await simulatePurchase()) as { reply: string };
      setAgent("anchor");
      setReply(res.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={styles.title}>Advisor</Text>
      <Text style={styles.sub}>Anchor checks a purchase. Compass explains a concept. Both use the same runway numbers.</Text>

      <View style={styles.switcher}>
        <Pressable
          style={[styles.chip, agent === "anchor" && styles.chipOn]}
          onPress={() => setAgent("anchor")}
        >
          <Text style={[styles.chipText, agent === "anchor" && styles.chipTextOn]}>Anchor</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, agent === "compass" && styles.chipOn]}
          onPress={() => setAgent("compass")}
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

      {reply ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>{agent === "anchor" ? "Anchor" : "Compass"}</Text>
          <Text style={styles.body}>{reply}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
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
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginTop: 8 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink },
  body: { color: colors.ink, lineHeight: 22 },
});
