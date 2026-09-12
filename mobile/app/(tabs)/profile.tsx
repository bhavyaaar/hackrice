import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";
import { colors, shadow } from "../../src/theme";

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Profile</Text>
      <View style={[styles.card, shadow]}>
        <Text style={styles.kicker}>Signed in</Text>
        <Text style={styles.email}>{email ?? "—"}</Text>
      </View>
      <View style={[styles.card, shadow]}>
        <Text style={styles.body}>
          Northstar stores loans and agent state in Supabase. Bank transactions stay in Nessie.
        </Text>
      </View>
      <Pressable style={styles.btn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 12 },
  kicker: { color: colors.green, fontWeight: "700" },
  email: { color: colors.ink, fontSize: 18, fontWeight: "700", marginTop: 6 },
  body: { color: colors.mute, lineHeight: 22 },
  btn: { backgroundColor: colors.ink, borderRadius: 18, padding: 16, alignItems: "center", marginTop: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
});
