import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { chat, horizonSimulate } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function LearnScreen() {
  const [reply, setReply] = useState<string | null>(null);
  const [extra, setExtra] = useState("50");
  const [sim, setSim] = useState<string | null>(null);

  async function askCompass() {
    try {
      const res = await chat("compass", "What should I understand first about my loans?");
      setReply(res.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Compass failed");
    }
  }

  async function runHorizon() {
    try {
      const res = (await horizonSimulate(Number(extra) || 0)) as { preview: Record<string, number> };
      setSim(JSON.stringify(res.preview, null, 2));
    } catch (err) {
      setSim(err instanceof Error ? err.message : "Horizon failed");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
      <Text style={styles.title}>Learn & Grow</Text>
      <Text style={styles.sub}>Compass explains. Horizon simulates. Camera is this flow, not a tab.</Text>

      <Pressable style={[styles.scan, shadow]} onPress={() => router.push("/scan")}>
        <Text style={styles.scanKicker}>Award letter</Text>
        <Text style={styles.scanTitle}>Scan your aid package</Text>
        <Text style={styles.mute}>Camera or photo library → OCR → Compass</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={askCompass}>
        <Text style={styles.btnText}>Ask Compass</Text>
      </Pressable>
      {reply ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Compass</Text>
          <Text style={styles.body}>{reply}</Text>
        </View>
      ) : null}

      <View style={[styles.card, shadow, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>Horizon — extra monthly</Text>
        <TextInput value={extra} onChangeText={setExtra} keyboardType="numeric" style={styles.input} />
        <Pressable style={styles.btn} onPress={runHorizon}>
          <Text style={styles.btnText}>Simulate payoff</Text>
        </Pressable>
        {sim ? <Text style={[styles.body, { marginTop: 10 }]}>{sim}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginBottom: 16, marginTop: 4 },
  scan: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 18, marginBottom: 16 },
  scanKicker: { color: colors.green, fontWeight: "700" },
  scanTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, marginVertical: 4 },
  mute: { color: colors.mute },
  btn: { backgroundColor: colors.green, borderRadius: 18, padding: 16, alignItems: "center", marginBottom: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink },
  body: { color: colors.ink, lineHeight: 22 },
  input: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginBottom: 10, color: colors.ink },
});
