import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Anmelden } from "@/components/anmelden";
import { Laden } from "@/components/ui";
import { authClient } from "@/lib/auth";
import { ApiProvider } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

export default function Wurzel() {
  const schema = useColorScheme();
  const { data: sitzung, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync();
  }, [isPending]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={schema === "dark" ? DarkTheme : DefaultTheme}>
        <ApiProvider>
          {isPending ? (
            <Laden />
          ) : !sitzung ? (
            <Anmelden />
          ) : (
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="patient/[id]"
                options={{ title: "Patient", headerBackTitle: "Zurück" }}
              />
            </Stack>
          )}
        </ApiProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
