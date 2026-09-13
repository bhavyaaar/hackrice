import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenTitle } from "../../src/components/Logo";
import { scanAwardLetter } from "../../src/lib/api";
import { colors, shadow } from "../../src/theme";

export default function ScanTab() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [tabFocused, setTabFocused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const cardWidth = width - 40;
  const cardHeight = Math.round(cardWidth * (4 / 3));

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      return () => setTabFocused(false);
    }, []),
  );

  async function upload(uri: string, name: string, type?: string | null) {
    setBusy(true);
    setStatus("Running OCR…");
    try {
      const payload = await scanAwardLetter(uri, name, type);
      setStatus(null);
      router.push({
        pathname: "/scan-result",
        params: {
          ocr: payload.ocr_text ?? "",
          extracted: JSON.stringify(payload.extracted ?? {}),
          storagePath: payload.storage_path ?? "",
        },
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    if (busy) return;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setStatus("Could not capture a photo");
        return;
      }
      await upload(photo.uri, "award-letter.jpg", "image/jpeg");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Capture failed");
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus("Photo library permission needed");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.fileName || "award-letter.jpg", asset.mimeType);
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.name || "award-letter.pdf", asset.mimeType || "application/pdf");
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <ScreenTitle title="Scan" />
        <Text style={styles.sub}>
          Point the camera at a letter or bill, or upload a file. Cloud Vision reads it; Compass explains it against your next paycheck or refund.
        </Text>
      </View>

      <View style={[styles.cameraCard, shadow, { width: cardWidth, height: cardHeight }]} collapsable={false}>
        {permission?.granted && tabFocused ? (
          <>
            <CameraView
              ref={cameraRef}
              style={{ width: cardWidth, height: cardHeight }}
              facing="back"
              mode="picture"
              ratio="4:3"
            />
            <View style={styles.viewfinder} pointerEvents="none" />
            <Pressable style={[styles.capture, busy && { opacity: 0.5 }]} onPress={() => void capture()} disabled={busy}>
              <Text style={styles.captureText}>{busy ? "Working…" : "Capture"}</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.permBox}>
            <Text style={styles.permCopy}>
              {permission?.granted ? "Camera pauses when you leave this tab." : "Allow camera to scan from this page."}
            </Text>
            {!permission?.granted ? (
              <Pressable style={styles.allow} onPress={() => void requestPermission()}>
                <Text style={styles.allowText}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <ScrollView style={styles.rest} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 14 }}>
        <Pressable style={[styles.card, shadow]} onPress={pickPhoto} disabled={busy}>
          <Text style={styles.kicker}>Photos</Text>
          <Text style={styles.cardTitle}>Choose an image</Text>
        </Pressable>
        <Pressable style={[styles.card, shadow]} onPress={pickPdf} disabled={busy}>
          <Text style={styles.kicker}>PDF</Text>
          <Text style={styles.cardTitle}>Upload a PDF</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  sub: { color: colors.mute, marginTop: 8, lineHeight: 22 },
  cameraCard: {
    alignSelf: "center",
    backgroundColor: "#111",
    borderRadius: 24,
  },
  rest: { flex: 1 },
  viewfinder: {
    position: "absolute",
    top: 20,
    left: 28,
    right: 28,
    bottom: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  capture: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: colors.green,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  captureText: { color: "#fff", fontWeight: "700" },
  permBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  permCopy: { color: "#d7e6dc", textAlign: "center", marginBottom: 12, lineHeight: 20 },
  allow: { backgroundColor: colors.green, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18 },
  allowText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 12 },
  kicker: { color: colors.green, fontWeight: "700" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 4 },
  status: { marginTop: 4, color: colors.ink, fontWeight: "600" },
});
