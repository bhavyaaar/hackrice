import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { chat, simulatePurchase } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function PlanScreen() {
  const [question, setQuestion] = useState("Can I afford a $70 Chicago trip?");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function askAnchor() {
    setBusy(true);
    try {
      const res = await chat("anchor", question);
      setReply(res.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Anchor failed");
    } finally {
      setBusy(false);
    }
  }

  async function demoBuy() {
    setBusy(true);
    try {
      const res = (await simulatePurchase()) as { reply: string };
      setReply(res.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
      <Text style={styles.title}>Can I afford it?</Text>
      <Text style={styles.sub}>Anchor — impulse check against your runway</Text>

      <TextInput value={question} onChangeText={setQuestion} style={styles.input} multiline />
      <Pressable style={styles.btn} onPress={askAnchor} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "Thinking…" : "Ask Anchor"}</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={demoBuy} disabled={busy}>
        <Text style={styles.ghostText}>Simulate a purchase (live Nessie POST)</Text>
      </Pressable>

      {reply ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Anchor</Text>
          <Text style={styles.body}>{reply}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginBottom: 16, marginTop: 4 },
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
