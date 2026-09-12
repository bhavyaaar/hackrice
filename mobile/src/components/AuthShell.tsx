import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Logo } from "./Logo";
import { colors, shadow } from "../theme";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Logo size={44} />
            <Text style={styles.brand}>northstar</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.card, shadow]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, paddingBottom: 40, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.green,
    paddingTop: 72,
    paddingHorizontal: 28,
    paddingBottom: 56,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  brand: { color: colors.mint, fontWeight: "700", fontSize: 18, letterSpacing: 0.6 },
  title: { color: "#fff", fontSize: 32, fontWeight: "800" },
  sub: { color: colors.mint, marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 36,
    marginHorizontal: 18,
    marginTop: -36,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 28,
  },
});
