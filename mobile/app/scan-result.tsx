import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, shadow } from "../src/theme";

export default function ScanResultScreen() {
  const { ocr, extracted } = useLocalSearchParams<{ ocr?: string; extracted?: string }>();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
      <Text style={styles.title}>Award letter</Text>
      <Text style={styles.sub} onPress={() => router.back()}>
        ← Back
      </Text>
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Raw OCR</Text>
        <Text style={styles.body}>{ocr || "—"}</Text>
      </View>
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardTitle}>Compass breakdown</Text>
        <Text style={styles.body}>{extracted || "—"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  sub: { color: colors.green, marginVertical: 8 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: colors.ink },
  body: { color: colors.ink, lineHeight: 22 },
});
