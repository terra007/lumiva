import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";

export function Seite({
  titel,
  untertitel,
  children,
  neuLaden,
  laedt = false,
}: {
  titel: string;
  untertitel?: string;
  children: ReactNode;
  neuLaden?: () => void;
  laedt?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.seite, { paddingTop: insets.top + Spacing.four }]}
      refreshControl={
        neuLaden ? <RefreshControl refreshing={laedt} onRefresh={neuLaden} /> : undefined
      }
    >
      <View style={styles.inhalt}>
        {untertitel && <ThemedText themeColor="textSecondary">{untertitel}</ThemedText>}
        <ThemedText type="title">{titel}</ThemedText>
        {children}
      </View>
    </ScrollView>
  );
}

export function Karte({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.karte,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Knopf({
  text,
  onPress,
  art = "haupt",
  deaktiviert = false,
}: {
  text: string;
  onPress: () => void;
  art?: "haupt" | "zweit";
  deaktiviert?: boolean;
}) {
  const theme = useTheme();
  const haupt = art === "haupt";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={deaktiviert}
      style={({ pressed }) => [
        styles.knopf,
        haupt
          ? { backgroundColor: theme.text }
          : {
              borderWidth: 1,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
        (pressed || deaktiviert) && { opacity: 0.6 },
      ]}
    >
      <ThemedText type="smallBold" style={{ color: haupt ? theme.background : theme.text }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

export function Laden() {
  return (
    <View style={{ padding: Spacing.five, alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

export function Fehler({ text }: { text: string }) {
  return (
    <ThemedText themeColor="gefahr" type="small">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  seite: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, alignItems: "center" },
  inhalt: { width: "100%", maxWidth: MaxContentWidth, gap: Spacing.three },
  karte: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  knopf: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
