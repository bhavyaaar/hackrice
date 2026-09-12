import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/AuthField";
import { AuthShell } from "../../src/components/AuthShell";
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
    <AuthShell title="Login Account" subtitle="Pick up your runway where you left off.">
      <AuthField
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        icon="✉"
      />
      <AuthField placeholder="Password" value={password} onChangeText={setPassword} secure icon="🔒" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onLogin}>
        <Text style={styles.btnText}>Login Account</Text>
      </Pressable>
      <Text style={styles.forgot}>Forgot Password?</Text>
      <View style={styles.footer}>
        <Text style={styles.mute}>Don’t have an account? </Text>
        <Link href="/(auth)/signup" style={styles.link}>
          Create Account
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.green,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  forgot: { textAlign: "center", color: colors.mute, marginTop: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 14, flexWrap: "wrap" },
  mute: { color: colors.mute },
  link: { color: colors.green, fontWeight: "800" },
  err: { color: colors.danger, marginBottom: 8, textAlign: "center" },
});
