import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import {
  Abzeichen,
  Eingabe,
  Fehler,
  Karte,
  Laden,
  Leer,
  Seite,
  Trenner,
  Zeichen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { fehlerText, hinweisText, TRAEGER } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

export default function Patienten() {
  const trpc = useTRPC();
  const [suche, setSuche] = useState("");
  const liste = useQuery(trpc.patienten.liste.queryOptions());
  const gefiltert = (liste.data ?? []).filter((p) =>
    `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.trim().toLowerCase()),
  );
  return (
    <Seite titel="Patienten" neuLaden={() => liste.refetch()} laedt={liste.isRefetching}>
      <Eingabe
        placeholder="Name suchen …"
        accessibilityLabel="Name suchen"
        value={suche}
        onChangeText={setSuche}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {liste.isPending ? (
        <Laden />
      ) : liste.error ? (
        <Fehler text={fehlerText(liste.error)} />
      ) : gefiltert.length === 0 ? (
        <Leer
          zeichen="patienten"
          text={
            suche.trim()
              ? `Niemand gefunden für „${suche.trim()}“.`
              : "Noch keine aktiven Patienten."
          }
        />
      ) : (
        <Karte style={{ padding: 0, gap: 0 }}>
          {gefiltert.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <Trenner />}
              <Link href={{ pathname: "/patient/[id]", params: { id: p.id } }} asChild>
                {/* Layout auf einer inneren View: Link asChild reicht eine Style-Funktion nicht durch. */}
                <Pressable accessibilityRole="link">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.two,
                      padding: Spacing.three,
                    }}
                  >
                    <View style={{ flex: 1, gap: Spacing.one }}>
                      <ThemedText style={{ fontWeight: "600" }}>
                        {p.nachname}, {p.vorname}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {TRAEGER[p.versicherungstraeger]} · {p.sitzungen}{" "}
                        {p.sitzungen === 1 ? "Sitzung" : "Sitzungen"}
                      </ThemedText>
                      {p.hinweise.map((h) => (
                        <Abzeichen key={h.art} text={hinweisText(h)} art="hinweis" />
                      ))}
                    </View>
                    <Zeichen name="rechts" farbe="textSecondary" />
                  </View>
                </Pressable>
              </Link>
            </Fragment>
          ))}
        </Karte>
      )}
    </Seite>
  );
}
