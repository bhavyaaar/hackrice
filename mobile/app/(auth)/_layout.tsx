import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Logo } from "../../src/components/Logo";
import { useAuth } from "../../src/lib/auth";
import { colors } from "../../src/theme";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0E1F18", gap: 16 }}>
        <Logo size={96} />
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }
  if (session) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
