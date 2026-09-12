import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../theme";

const LOGO = require("../../assets/logo.png");

export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "#16382C",
        },
        style,
      ]}
    >
      <Image source={LOGO} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

export function ScreenTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Logo size={36} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
});
