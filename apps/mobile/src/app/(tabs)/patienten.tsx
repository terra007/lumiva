import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Fehler, Karte, Laden, Seite } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { fehlerText, hinweisText, TRAEGER } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

export default function Patienten() {
  const trpc = useTRPC();
  const theme = useTheme();
  const [suche, setSuche] = useState("");
  const liste = useQuery(trpc.patienten.liste.queryOptions());
  const gefiltert = (liste.data ?? []).filter((p) =>
    `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()),
  );
  return (
    <Seite titel="Patienten" neuLaden={() => liste.refetch()} laedt={liste.isRefetching}>
      <TextInput
        placeholder="Name suchen …"
        placeholderTextColor={theme.textSecondary}
        value={suche}
        onChangeText={setSuche}
        style={{
          borderWidth: 1,
          borderColor: theme.backgroundSelected,
          borderRadius: 10,
          padding: 10,
          color: theme.text,
          fontSize: 16,
        }}
      />
      {liste.isPending ? (
        <Laden />
      ) : liste.error ? (
        <Fehler text={fehlerText(liste.error)} />
      ) : (
        gefiltert.map((p) => (
          <Link key={p.id} href={{ pathname: "/patient/[id]", params: { id: p.id } }} asChild>
            <Pressable>
              <Karte>
                <ThemedText type="subtitle">
                  {p.nachname}, {p.vorname}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {TRAEGER[p.versicherungstraeger]} · {p.sitzungen} Sitzungen
                </ThemedText>
                {p.hinweise.map((h) => (
                  <ThemedText key={h.art} type="small" themeColor="hinweis">
                    {hinweisText(h)}
                  </ThemedText>
                ))}
              </Karte>
            </Pressable>
          </Link>
        ))
      )}
    </Seite>
  );
}
