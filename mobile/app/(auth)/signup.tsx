import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/AuthField";
import { AuthShell } from "../../src/components/AuthShell";
import { bootstrap, type ClassYear, type Housing } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

const YEARS: { id: ClassYear; label: string }[] = [
  { id: "first_year", label: "First-year" },
  { id: "sophomore", label: "Sophomore" },
  { id: "junior", label: "Junior" },
  { id: "senior", label: "Senior" },
  { id: "grad", label: "Grad" },
];

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [classYear, setClassYear] = useState<ClassYear | null>(null);
  const [housing, setHousing] = useState<Housing | null>(null);
  const [firstGen, setFirstGen] = useState(false);
  const [international, setInternational] = useState(false);
  const [pell, setPell] = useState(false);
  const [workStudy, setWorkStudy] = useState(false);
  const [hasSsn, setHasSsn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onSignup() {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (!school.trim() || !classYear || !housing) {
      setError("Add your school, class year, and housing.");
      return;
    }
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
      await bootstrap({
        full_name: name,
        school: school.trim(),
        class_year: classYear,
        housing,
        first_gen: firstGen,
        international,
        has_ssn: hasSsn,
        pell,
        work_study_eligible: workStudy,
      });
    } catch {
      /* session may need email confirm */
    }
    router.replace("/(tabs)");
  }

  return (
    <AuthShell title="Create Account" subtitle="Tell us your school and aid situation so Compass and Anchor start personal.">
      <AuthField placeholder="Full Name" value={name} onChangeText={setName} icon="👤" />
      <AuthField
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        icon="✉"
      />
      <AuthField placeholder="Set Password" value={password} onChangeText={setPassword} secure icon="🔒" />
      <AuthField placeholder="School" value={school} onChangeText={setSchool} icon="🎓" />

      <Text style={styles.label}>Class year</Text>
      <View style={styles.chips}>
        {YEARS.map((year) => (
          <Chip key={year.id} label={year.label} on={classYear === year.id} onPress={() => setClassYear(year.id)} />
        ))}
      </View>

      <Text style={styles.label}>Housing</Text>
      <View style={styles.chips}>
        <Chip label="On campus" on={housing === "on_campus"} onPress={() => setHousing("on_campus")} />
        <Chip label="Off campus" on={housing === "off_campus"} onPress={() => setHousing("off_campus")} />
      </View>

      <Text style={styles.label}>Aid situation · tap all that apply</Text>
      <View style={styles.chips}>
        <Chip label="Pell Grant" on={pell} onPress={() => setPell((v) => !v)} />
        <Chip label="Work-study" on={workStudy} onPress={() => setWorkStudy((v) => !v)} />
        <Chip label="First-gen" on={firstGen} onPress={() => setFirstGen((v) => !v)} />
        <Chip label="International" on={international} onPress={() => setInternational((v) => !v)} />
        <Chip label="No SSN" on={!hasSsn} onPress={() => setHasSsn((v) => !v)} />
      </View>

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

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
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
  label: { color: colors.mute, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { backgroundColor: colors.cream, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colors.green },
  chipText: { color: colors.ink, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
});
