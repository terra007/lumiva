import { SymbolView } from "expo-symbols";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MaxContentWidth, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";

/** Symbole: SF Symbols auf iOS, Material Symbols auf Android und im Web. */
const ZEICHEN = {
  heute: { ios: "sun.max", android: "today", web: "today" },
  patienten: { ios: "person.2", android: "group", web: "group" },
  aufgaben: { ios: "checklist", android: "checklist", web: "checklist" },
  mehr: { ios: "ellipsis", android: "more_horiz", web: "more_horiz" },
  rechts: { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  haken: { ios: "checkmark", android: "check", web: "check" },
  plus: { ios: "plus", android: "add", web: "add" },
  telefon: { ios: "phone", android: "call", web: "call" },
  hinweis: { ios: "exclamationmark.triangle", android: "warning", web: "warning" },
  kalender: { ios: "calendar", android: "event", web: "event" },
  abmelden: {
    ios: "rectangle.portrait.and.arrow.right",
    android: "logout",
    web: "logout",
  },
} as const satisfies Record<string, ComponentProps<typeof SymbolView>["name"]>;

export type ZeichenName = keyof typeof ZEICHEN;

export function Zeichen({
  name,
  farbe = "text",
  groesse = 20,
}: {
  name: ZeichenName;
  farbe?: ThemeColor;
  groesse?: number;
}) {
  const theme = useTheme();
  return <SymbolView name={ZEICHEN[name]} size={groesse} tintColor={theme[farbe]} />;
}

export function Seite({
  titel,
  untertitel,
  kopf,
  children,
  neuLaden,
  laedt = false,
}: {
  titel: string;
  untertitel?: string;
  /** Eigener Kopf statt Titel und Untertitel, z. B. die Marke auf der Anmeldung. */
  kopf?: ReactNode;
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
      keyboardShouldPersistTaps="handled"
      refreshControl={
        neuLaden ? <RefreshControl refreshing={laedt} onRefresh={neuLaden} /> : undefined
      }
    >
      <View style={styles.inhalt}>
        {kopf ?? (
          <View style={{ gap: Spacing.half }}>
            {untertitel && (
              <ThemedText type="small" themeColor="textSecondary">
                {untertitel}
              </ThemedText>
            )}
            <ThemedText type="title" accessibilityRole="header">
              {titel}
            </ThemedText>
          </View>
        )}
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
        { backgroundColor: theme.flaeche, borderColor: theme.backgroundSelected },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Dünne Linie zwischen Zeilen einer Karte. */
export function Trenner() {
  const theme = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.backgroundSelected }} />
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
      accessibilityState={{ disabled: deaktiviert }}
      onPress={onPress}
      disabled={deaktiviert}
      style={({ pressed }) => [
        styles.knopf,
        haupt
          ? { backgroundColor: theme.text }
          : {
              borderWidth: 1,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.flaeche,
            },
        deaktiviert && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <ThemedText type="smallBold" style={{ color: haupt ? theme.background : theme.text }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

/** Eingabefeld im Stil der App. */
export function Eingabe({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.eingabe,
        {
          borderColor: theme.backgroundSelected,
          color: theme.text,
          backgroundColor: theme.flaeche,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const ABZEICHEN = {
  geplant: ["geplantFlaeche", "geplantText"],
  erledigt: ["erledigtFlaeche", "erledigtText"],
  abgesagt: ["ausgefallenFlaeche", "ausgefallenText"],
  nicht_erschienen: ["hinweisFlaeche", "hinweis"],
  hinweis: ["hinweisFlaeche", "hinweis"],
  gefahr: ["gefahrFlaeche", "gefahr"],
  akzent: ["akzentFlaeche", "akzentText"],
} as const satisfies Record<string, readonly [ThemeColor, ThemeColor]>;

export type AbzeichenArt = keyof typeof ABZEICHEN;

/** Kleines farbiges Etikett, z. B. für den Stand eines Termins oder einen Hinweis. */
export function Abzeichen({ text, art }: { text: string; art: AbzeichenArt }) {
  const theme = useTheme();
  const [flaeche, schrift] = ABZEICHEN[art];
  return (
    <View style={[styles.abzeichen, { backgroundColor: theme[flaeche] }]}>
      <ThemedText
        type="small"
        style={{ color: theme[schrift], fontSize: 12, lineHeight: 16, fontWeight: "600" }}
      >
        {text}
      </ThemedText>
    </View>
  );
}

/** Platzhalter für eine leere Liste. */
export function Leer({ zeichen, text }: { zeichen: ZeichenName; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.leer, { borderColor: theme.backgroundSelected }]}>
      <Zeichen name={zeichen} farbe="textSecondary" groesse={28} />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: "center" }}>
        {text}
      </ThemedText>
    </View>
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
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: theme.gefahrFlaeche, borderRadius: 10, padding: Spacing.two + 2 }}
    >
      <ThemedText themeColor="gefahr" type="small">
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  seite: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, alignItems: "center" },
  inhalt: { width: "100%", maxWidth: MaxContentWidth, gap: Spacing.three },
  karte: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  knopf: {
    minHeight: 44,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  eingabe: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  abzeichen: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  leer: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
});
