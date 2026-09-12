import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { bootstrap } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSignup() {
    setError(null);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      return;
    }
    try {
      await bootstrap();
    } catch {
      /* session may need email confirm */
    }
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>✦ Northstar</Text>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.mute}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password (min 6)"
        placeholderTextColor={colors.mute}
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSignup}>
        <Text style={styles.btnText}>Sign up</Text>
      </Pressable>
      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Log in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: "center" },
  mark: { color: colors.green, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, marginBottom: 24 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: colors.ink,
  },
  btn: { backgroundColor: colors.green, borderRadius: 18, padding: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { marginTop: 18, color: colors.green, textAlign: "center" },
  err: { color: colors.danger, marginBottom: 8 },
});
