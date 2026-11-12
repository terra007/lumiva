import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Karte, Knopf, Seite, Trenner } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { apiUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth";
import { useTRPC } from "@/lib/trpc";

const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber",
  therapeut: "Therapeut",
  assistenz: "Assistenz",
};

/** Anfangsbuchstaben ohne Titel wie „Mag.“ oder „Dr.“. */
function initialen(name: string): string {
  const teile = name.split(/\s+/).filter((t) => t && !t.endsWith("."));
  return (
    (teile[0]?.[0] ?? "") + (teile.length > 1 ? (teile.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

export default function Mehr() {
  const trpc = useTRPC();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const ich = useQuery(trpc.praxis.ich.queryOptions());
  const praxis = ich.data?.praxis;
  const name = ich.data?.benutzer?.name;

  return (
    <Seite titel="Mehr">
      <Karte>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.three }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.akzentFlaeche,
            }}
          >
            <ThemedText type="smallBold" themeColor="akzentText">
              {name ? initialen(name) : "…"}
            </ThemedText>
          </View>
          <View style={{ flex: 1, gap: Spacing.half }}>
            <ThemedText style={{ fontWeight: "600" }}>{name ?? "…"}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ich.data?.benutzer?.email}
            </ThemedText>
          </View>
        </View>
        {praxis && (
          <>
            <Trenner />
            <ThemedText type="small">
              {praxis.name} · {ROLLEN[praxis.rolle] ?? praxis.rolle}
            </ThemedText>
          </>
        )}
      </Karte>
      <Karte>
        <ThemedText type="label" themeColor="textSecondary">
          In der Web-App
        </ThemedText>
        <ThemedText type="small">
          Kalender, Honorarnoten, Dokumentation und Einstellungen findest du in der Web-App.
        </ThemedText>
        <Trenner />
        <ThemedText type="label" themeColor="textSecondary">
          Server
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {apiUrl()}
        </ThemedText>
      </Karte>
      <Knopf
        text="Abmelden"
        art="zweit"
        onPress={async () => {
          await authClient.signOut();
          queryClient.clear();
        }}
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: "center" }}>
        LUMIVA · Klarheit für deine Praxis.
      </ThemedText>
    </Seite>
  );
}
