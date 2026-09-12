import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/AuthField";
import { AuthShell } from "../../src/components/AuthShell";
import { bootstrap } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSignup() {
    setError(null);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
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
    <AuthShell title="Create Account" subtitle="One profile for runway, loans, and the three agents.">
      <AuthField placeholder="Full Name" value={name} onChangeText={setName} icon="👤" />
      <AuthField
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        icon="✉"
      />
      <AuthField placeholder="Set Password" value={password} onChangeText={setPassword} secure icon="🔒" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSignup}>
        <Text style={styles.btnText}>Create Account  →</Text>
      </Pressable>
      <View style={styles.footer}>
        <Text style={styles.mute}>Already have an account? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Login to Account
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16, flexWrap: "wrap" },
  mute: { color: colors.mute },
  link: { color: colors.green, fontWeight: "800" },
  err: { color: colors.danger, marginBottom: 8, textAlign: "center" },
});
