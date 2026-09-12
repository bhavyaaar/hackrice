import { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

export function AuthField({
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon: ReactNode;
  secure?: boolean;
  keyboardType?: "email-address" | "default";
}) {
  return (
    <View style={styles.row}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mute}
        secureTextEntry={secure}
        autoCapitalize={keyboardType === "email-address" || secure ? "none" : "words"}
        keyboardType={keyboardType ?? "default"}
        style={styles.input}
      />
      <Text style={styles.icon}>{icon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginBottom: 14,
    minHeight: 54,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14 },
  icon: { fontSize: 16, color: colors.mute, marginLeft: 8 },
});
