import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Abzeichen, Fehler, Karte, Knopf, Laden, Leer, Seite } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { euro, fehlerText, formatDatumLang, STATUS, uhrzeit } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

export default function Heute() {
  const trpc = useTRPC();
  const theme = useTheme();
  const qc = useQueryClient();
  const heute = useQuery(trpc.uebersicht.heute.queryOptions());
  const erledigt = useMutation(
    trpc.termine.status.mutationOptions({ onSuccess: () => qc.invalidateQueries() }),
  );
  const jetzt = new Date();

  return (
    <Seite
      titel="Heute"
      untertitel={formatDatumLang(jetzt)}
      neuLaden={() => heute.refetch()}
      laedt={heute.isRefetching}
    >
      {heute.isPending ? (
        <Laden />
      ) : heute.error ? (
        <Fehler text={fehlerText(heute.error)} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: Spacing.two }}>
            <Zahl titel="Termine" wert={String(heute.data.termine.length)} />
            <Zahl titel="Offen" wert={euro(heute.data.offeneHonorarnoten.summeCent)} />
            <Zahl titel="Aufgaben" wert={String(heute.data.offeneAufgaben)} />
          </View>
          {erledigt.error && <Fehler text={fehlerText(erledigt.error)} />}
          {heute.data.termine.length === 0 && (
            <Leer zeichen="kalender" text="Heute stehen keine Termine an." />
          )}
          {heute.data.termine.map((t) => {
            const laeuft = t.status === "geplant" && t.beginn <= jetzt && t.ende > jetzt;
            return (
              <Karte
                key={t.id}
                style={laeuft ? { borderColor: theme.akzent, borderWidth: 2 } : undefined}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: Spacing.two,
                  }}
                >
                  <ThemedText type="smallBold" style={{ fontVariant: ["tabular-nums"] }}>
                    {uhrzeit(t.beginn)} – {uhrzeit(t.ende)}
                  </ThemedText>
                  {laeuft ? (
                    <Abzeichen text="Läuft gerade" art="akzent" />
                  ) : (
                    <Abzeichen text={STATUS[t.status] ?? t.status} art={t.status} />
                  )}
                </View>
                <Link href={{ pathname: "/patient/[id]", params: { id: t.patientId } }} asChild>
                  <Pressable accessibilityRole="link">
                    <ThemedText type="subtitle">{t.patientName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t.sitzungsart}
                    </ThemedText>
                  </Pressable>
                </Link>
                {t.status === "geplant" && (
                  <Knopf
                    art="zweit"
                    text="Als erledigt markieren"
                    deaktiviert={erledigt.isPending}
                    onPress={() => erledigt.mutate({ id: t.id, status: "erledigt" })}
                  />
                )}
              </Karte>
            );
          })}
        </>
      )}
    </Seite>
  );
}

function Zahl({ titel, wert }: { titel: string; wert: string }) {
  return (
    <Karte style={{ flex: 1, padding: 12, gap: 2 }}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
        {titel}
      </ThemedText>
      <ThemedText
        type="subtitle"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {wert}
      </ThemedText>
    </Karte>
  );
}
