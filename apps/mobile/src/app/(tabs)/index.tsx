import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Fehler, Karte, Knopf, Laden, Seite } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { euro, fehlerText, formatDatumLang, STATUS, uhrzeit } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

export default function Heute() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const heute = useQuery(trpc.uebersicht.heute.queryOptions());
  const erledigt = useMutation(
    trpc.termine.status.mutationOptions({ onSuccess: () => qc.invalidateQueries() }),
  );

  return (
    <Seite
      titel="Heute"
      untertitel={formatDatumLang(new Date())}
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
          {heute.data.termine.length === 0 && (
            <ThemedText themeColor="textSecondary">Heute stehen keine Termine an.</ThemedText>
          )}
          {heute.data.termine.map((t) => (
            <Karte key={t.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <ThemedText type="smallBold">
                  {uhrzeit(t.beginn)}–{uhrzeit(t.ende)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {STATUS[t.status]}
                </ThemedText>
              </View>
              <Link href={{ pathname: "/patient/[id]", params: { id: t.patientId } }} asChild>
                <Pressable>
                  <ThemedText type="subtitle">{t.patientName}</ThemedText>
                </Pressable>
              </Link>
              <ThemedText type="small" themeColor="textSecondary">
                {t.sitzungsart}
              </ThemedText>
              {t.status === "geplant" && (
                <Knopf
                  art="zweit"
                  text="Als erledigt markieren"
                  deaktiviert={erledigt.isPending}
                  onPress={() => erledigt.mutate({ id: t.id, status: "erledigt" })}
                />
              )}
            </Karte>
          ))}
        </>
      )}
    </Seite>
  );
}

function Zahl({ titel, wert }: { titel: string; wert: string }) {
  return (
    <Karte style={{ flex: 1 }}>
      <ThemedText type="label" themeColor="textSecondary">
        {titel}
      </ThemedText>
      <ThemedText type="subtitle">{wert}</ThemedText>
    </Karte>
  );
}
