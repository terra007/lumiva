import { Tabs } from "expo-router";
import { Zeichen, type ZeichenName } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";

const TABS: { name: string; titel: string; zeichen: ZeichenName }[] = [
  { name: "index", titel: "Heute", zeichen: "heute" },
  { name: "patienten", titel: "Patienten", zeichen: "patienten" },
  { name: "aufgaben", titel: "Aufgaben", zeichen: "aufgaben" },
  { name: "mehr", titel: "Mehr", zeichen: "mehr" },
];

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundSelected,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.titel,
            tabBarIcon: ({ focused }) => (
              <Zeichen
                name={t.zeichen}
                farbe={focused ? "akzentText" : "textSecondary"}
                groesse={24}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
