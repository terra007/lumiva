import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Fehler, Karte, Laden, Seite } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import {
  fehlerText,
  formatDatum,
  hinweisText,
  STATUS,
  TRAEGER,
  uhrzeit,
  wienDatum,
} from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

const TAG = 24 * 60 * 60_000;

export default function Patient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const [jetzt] = [new Date()];
  const p = useQuery(trpc.patienten.details.queryOptions({ id }));
  const termine = useQuery(
    trpc.termine.zeitraum.queryOptions({
      patientId: id,
      von: new Date(Math.floor(jetzt.getTime() / TAG) * TAG - 60 * TAG),
      bis: new Date(Math.floor(jetzt.getTime() / TAG) * TAG + 60 * TAG),
    }),
  );
  if (p.isPending) return <Laden />;
  if (p.error)
    return (
      <Seite titel="Patient">
        <Fehler text={fehlerText(p.error)} />
      </Seite>
    );
  const d = p.data;
  const kommend = (termine.data ?? []).filter((t) => t.beginn >= jetzt);
  const vergangen = (termine.data ?? []).filter((t) => t.beginn < jetzt).reverse();
  return (
    <Seite titel={`${d.vorname} ${d.nachname}`} neuLaden={() => p.refetch()} laedt={p.isRefetching}>
      <Stack.Screen options={{ title: `${d.vorname} ${d.nachname}` }} />
      <Karte>
        <Zeile k="Geburtsdatum" v={formatDatum(d.geburtsdatum)} />
        <Zeile k="Träger" v={TRAEGER[d.versicherungstraeger] ?? d.versicherungstraeger} />
        {d.svNummer ? <Zeile k="SV-Nummer" v={d.svNummer} /> : null}
        <Zeile k="Sitzungen" v={String(d.sitzungen)} />
        {d.kontakt.telefon ? <Zeile k="Telefon" v={d.kontakt.telefon} /> : null}
      </Karte>
      {d.hinweise.length > 0 && (
        <Karte>
          {d.hinweise.map((h) => (
            <ThemedText key={h.art} type="smallBold" themeColor="hinweis">
              {hinweisText(h)}
            </ThemedText>
          ))}
        </Karte>
      )}
      <ThemedText type="label" themeColor="textSecondary">
        Kommende Termine
      </ThemedText>
      {kommend.length === 0 && <ThemedText themeColor="textSecondary">Keine.</ThemedText>}
      {kommend.slice(0, 6).map((t) => (
        <Zeile
          key={t.id}
          k={`${formatDatum(wienDatum(t.beginn))} ${uhrzeit(t.beginn)}`}
          v={STATUS[t.status] ?? t.status}
        />
      ))}
      <ThemedText type="label" themeColor="textSecondary">
        Letzte Sitzungen
      </ThemedText>
      {vergangen.slice(0, 6).map((t) => (
        <Zeile
          key={t.id}
          k={`${formatDatum(wienDatum(t.beginn))} ${uhrzeit(t.beginn)}`}
          v={STATUS[t.status] ?? t.status}
        />
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Dokumentation und Honorarnoten bearbeitest du in der Web-App.
      </ThemedText>
    </Seite>
  );
}

function Zeile({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary">
        {k}
      </ThemedText>
      <ThemedText type="small">{v}</ThemedText>
    </View>
  );
}
