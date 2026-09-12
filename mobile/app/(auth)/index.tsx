import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../src/theme";

export default function WelcomeScreen() {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Image
          source={require("../../assets/northstar-mascot.png")}
          style={styles.mascot}
          resizeMode="cover"
        />
        <Text style={styles.wordmark}>northstar</Text>
        <Text style={styles.tag}>navigate your student finances</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={() => router.push("/(auth)/signup")}>
          <Text style={styles.btnText}>Create Account</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.ghostText}>Login Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0E1F18", justifyContent: "space-between", paddingBottom: 48 },
  hero: { alignItems: "center", paddingTop: 88 },
  mascot: { width: 240, height: 240, borderRadius: 120, marginBottom: 20 },
  wordmark: { color: "#8FB9A3", fontSize: 28, fontWeight: "700", letterSpacing: 1 },
  tag: { color: "#6B8F7C", marginTop: 6, fontSize: 15 },
  actions: { paddingHorizontal: 28 },
  btn: {
    backgroundColor: colors.green,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  ghost: {
    marginTop: 12,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#173126",
  },
  ghostText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
