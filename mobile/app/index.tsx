import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)" />;
  return <Redirect href="/(tabs)" />;
}
