import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else router.replace("/(tabs)");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>✦ Northstar</Text>
      <Text style={styles.title}>Welcome back</Text>
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
        placeholder="Password"
        placeholderTextColor={colors.mute}
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onLogin}>
        <Text style={styles.btnText}>Log in</Text>
      </Pressable>
      <Link href="/(auth)/signup" style={styles.link}>
        Need an account? Sign up
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
