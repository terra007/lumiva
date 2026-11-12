import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { Karte, Knopf, Seite } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import { abmelden } from "@/lib/auth";
import { useTRPC } from "@/lib/trpc";

const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber",
  therapeut: "Therapeut",
  assistenz: "Assistenz",
};

export default function Mehr() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ich = useQuery(trpc.praxis.ich.queryOptions());
  const praxis = ich.data?.praxis;

  return (
    <Seite titel="Mehr">
      <Karte>
        <ThemedText type="subtitle">{ich.data?.benutzer?.name ?? "…"}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {ich.data?.benutzer?.email}
        </ThemedText>
        {praxis && (
          <ThemedText type="small">
            {praxis.name} · {ROLLEN[praxis.rolle] ?? praxis.rolle}
          </ThemedText>
        )}
      </Karte>
      <Karte>
        <ThemedText type="label">Server</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {apiUrl()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Kalender, Honorarnoten und Einstellungen findest du in der Web-App.
        </ThemedText>
      </Karte>
      <Knopf text="Abmelden" art="zweit" onPress={() => abmelden(queryClient)} />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: "center" }}>
        LUMIVA · Klarheit für deine Praxis.
      </ThemedText>
    </Seite>
  );
}
