import { Tabs } from "expo-router";
import { type ColorValue, Text } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.backgroundSelected,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Heute", tabBarIcon: ({ color }) => <TabSymbol z="☀︎" color={color} /> }}
      />
      <Tabs.Screen
        name="patienten"
        options={{
          title: "Patient:innen",
          tabBarIcon: ({ color }) => <TabSymbol z="☰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="aufgaben"
        options={{
          title: "Aufgaben",
          tabBarIcon: ({ color }) => <TabSymbol z="✓" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mehr"
        options={{ title: "Mehr", tabBarIcon: ({ color }) => <TabSymbol z="⋯" color={color} /> }}
      />
    </Tabs>
  );
}

function TabSymbol({ z, color }: { z: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{z}</Text>;
}
