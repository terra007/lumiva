import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import {
  Abzeichen,
  Eingabe,
  Fehler,
  Karte,
  Knopf,
  Laden,
  Leer,
  Seite,
  Trenner,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { fehlerText, formatDatum, wienDatum } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";

export default function Aufgaben() {
  const trpc = useTRPC();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [titel, setTitel] = useState("");
  const liste = useQuery(trpc.aufgaben.liste.queryOptions());
  const neuLaden = () => queryClient.invalidateQueries({ queryKey: trpc.aufgaben.pathKey() });
  const anlegen = useMutation(
    trpc.aufgaben.anlegen.mutationOptions({
      onSuccess: () => {
        setTitel("");
        neuLaden();
      },
    }),
  );
  const erledigen = useMutation(trpc.aufgaben.erledigen.mutationOptions({ onSuccess: neuLaden }));
  const heute = wienDatum(new Date());
  const hinzufuegen = () => {
    if (titel.trim() && !anlegen.isPending) anlegen.mutate({ titel: titel.trim() });
  };

  return (
    <Seite titel="Aufgaben" neuLaden={() => liste.refetch()} laedt={liste.isRefetching}>
      <View style={{ flexDirection: "row", gap: Spacing.two }}>
        <Eingabe
          placeholder="Neue Aufgabe …"
          accessibilityLabel="Neue Aufgabe"
          value={titel}
          onChangeText={setTitel}
          onSubmitEditing={hinzufuegen}
          returnKeyType="done"
          style={{ flex: 1, minWidth: 0 }}
        />
        <Knopf
          text="Hinzufügen"
          deaktiviert={!titel.trim() || anlegen.isPending}
          onPress={hinzufuegen}
        />
      </View>
      {anlegen.error && <Fehler text={fehlerText(anlegen.error)} />}
      {erledigen.error && <Fehler text={fehlerText(erledigen.error)} />}
      {liste.isPending ? (
        <Laden />
      ) : liste.error ? (
        <Fehler text={fehlerText(liste.error)} />
      ) : liste.data.length === 0 ? (
        <Leer zeichen="haken" text="Nichts offen. Schön." />
      ) : (
        <Karte style={{ padding: 0, gap: 0 }}>
          {liste.data.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Trenner />}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`${a.titel}, als erledigt markieren`}
                onPress={() => erledigen.mutate({ id: a.id, erledigt: true })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: Spacing.three,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: theme.textSecondary,
                  }}
                />
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <ThemedText>{a.titel}</ThemedText>
                  {a.patientName && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {a.patientName}
                    </ThemedText>
                  )}
                  {a.faelligAm &&
                    (a.faelligAm < heute ? (
                      <Abzeichen
                        text={`überfällig seit ${formatDatum(a.faelligAm)}`}
                        art="gefahr"
                      />
                    ) : a.faelligAm === heute ? (
                      <Abzeichen text="heute fällig" art="hinweis" />
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        bis {formatDatum(a.faelligAm)}
                      </ThemedText>
                    ))}
                </View>
              </Pressable>
            </Fragment>
          ))}
        </Karte>
      )}
    </Seite>
  );
}
