import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { scanAwardLetter } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function ScanTab() {
  const [status, setStatus] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus("Permission needed");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setStatus("Uploading…");
    try {
      const payload = await scanAwardLetter(result.assets[0].uri);
      setStatus(null);
      router.push({
        pathname: "/scan-result",
        params: {
          ocr: payload.ocr_text ?? "",
          extracted: JSON.stringify(payload.extracted ?? {}),
        },
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Scan failed");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Scan</Text>
      <Text style={styles.sub}>
        Photograph your award letter. Compass reads the OCR, then explains subsidized vs unsubsidized. Use the prepared sample in the demo.
      </Text>
      <Pressable style={[styles.card, shadow]} onPress={() => pick(true)}>
        <Text style={styles.kicker}>Camera</Text>
        <Text style={styles.cardTitle}>Take a photo</Text>
      </Pressable>
      <Pressable style={[styles.card, shadow]} onPress={() => pick(false)}>
        <Text style={styles.kicker}>Library</Text>
        <Text style={styles.cardTitle}>Choose sample letter</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginTop: 8, marginBottom: 20, lineHeight: 22 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 12 },
  kicker: { color: colors.green, fontWeight: "700" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 4 },
  status: { marginTop: 12, color: colors.ink },
});
