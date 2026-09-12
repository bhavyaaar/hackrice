import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { CameraIcon, DollarIcon, HouseIcon, PersonIcon, StarIcon } from "../../src/components/TabIcons";
import { useAuth } from "../../src/lib/auth";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.mute,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: { backgroundColor: colors.cream, borderTopColor: "#D7E6DC", height: 84, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size, focused }) => (
            <HouseIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size, focused }) => (
            <CameraIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: "Finances",
          tabBarIcon: ({ color, size, focused }) => (
            <DollarIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="advisor"
        options={{
          title: "Advisor",
          tabBarIcon: ({ color, size, focused }) => (
            <StarIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <PersonIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
