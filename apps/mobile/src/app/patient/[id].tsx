import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Fragment } from "react";
import { Linking, Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import {
  Abzeichen,
  type AbzeichenArt,
  Fehler,
  Karte,
  Laden,
  Seite,
  Trenner,
  Zeichen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
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

type Termin = { id: string; beginn: Date; status: string; sitzungsart: string };

export default function Patient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const theme = useTheme();
  const jetzt = new Date();
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
  const telefon = d.kontakt.telefon;
  const kommend = (termine.data ?? []).filter((t) => t.beginn >= jetzt);
  const vergangen = (termine.data ?? []).filter((t) => t.beginn < jetzt).reverse();
  return (
    <Seite
      titel={`${d.vorname} ${d.nachname}`}
      untertitel={`geb. ${formatDatum(d.geburtsdatum)} · ${TRAEGER[d.versicherungstraeger] ?? d.versicherungstraeger}`}
      neuLaden={() => {
        p.refetch();
        termine.refetch();
      }}
      laedt={p.isRefetching}
    >
      <Stack.Screen options={{ title: `${d.vorname} ${d.nachname}` }} />
      {d.hinweise.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            gap: Spacing.two,
            padding: Spacing.three,
            borderRadius: 16,
            backgroundColor: theme.hinweisFlaeche,
          }}
        >
          <Zeichen name="hinweis" farbe="hinweis" />
          <View style={{ flex: 1, gap: Spacing.one }}>
            {d.hinweise.map((h) => (
              <ThemedText key={h.art} type="small" themeColor="hinweis">
                {hinweisText(h)}
              </ThemedText>
            ))}
          </View>
        </View>
      )}
      <Karte>
        {d.svNummer ? <Zeile k="SV-Nummer" v={d.svNummer} /> : null}
        <Zeile k="Sitzungen" v={String(d.sitzungen)} />
        {telefon ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${telefon} anrufen`}
            onPress={() => Linking.openURL(`tel:${telefon.replace(/[^\d+]/g, "")}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: Spacing.two,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Telefon
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.one }}>
              <Zeichen name="telefon" farbe="akzentText" groesse={16} />
              <ThemedText type="smallBold" themeColor="akzentText">
                {telefon}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}
      </Karte>
      <Termine titel="Kommende Termine" termine={kommend.slice(0, 6)} leer="Keine geplant." />
      <Termine titel="Letzte Sitzungen" termine={vergangen.slice(0, 6)} leer="Noch keine." />
      <ThemedText type="small" themeColor="textSecondary">
        Dokumentation und Honorarnoten bearbeitest du in der Web-App.
      </ThemedText>
    </Seite>
  );
}

function Termine({ titel, termine, leer }: { titel: string; termine: Termin[]; leer: string }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="label" themeColor="textSecondary">
        {titel}
      </ThemedText>
      {termine.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {leer}
        </ThemedText>
      ) : (
        <Karte style={{ gap: 12 }}>
          {termine.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <Trenner />}
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two }}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontVariant: ["tabular-nums"] }}>
                    {formatDatum(wienDatum(t.beginn))}, {uhrzeit(t.beginn)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.sitzungsart}
                  </ThemedText>
                </View>
                <Abzeichen text={STATUS[t.status] ?? t.status} art={t.status as AbzeichenArt} />
              </View>
            </Fragment>
          ))}
        </Karte>
      )}
    </View>
  );
}

function Zeile({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary">
        {k}
      </ThemedText>
      <ThemedText type="small" selectable>
        {v}
      </ThemedText>
    </View>
  );
}
