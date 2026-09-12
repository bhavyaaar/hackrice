import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { scanAwardLetter } from "../src/lib/api";
import { colors } from "../src/theme";

export default function ScanScreen() {
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
      <Text style={styles.title}>Scan award letter</Text>
      <Text style={styles.sub}>Compass flow — use the prepared sample in the demo, not a dark venue photo.</Text>
      <Pressable style={styles.btn} onPress={() => pick(true)}>
        <Text style={styles.btnText}>Open camera</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => pick(false)}>
        <Text style={styles.ghostText}>Choose sample from library</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to Learn</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 72 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginVertical: 12, lineHeight: 20 },
  btn: { backgroundColor: colors.green, borderRadius: 18, padding: 16, alignItems: "center", marginTop: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: { padding: 16, alignItems: "center" },
  ghostText: { color: colors.green, fontWeight: "700" },
  back: { textAlign: "center", color: colors.mute, marginTop: 8 },
  status: { marginTop: 16, color: colors.ink },
});
