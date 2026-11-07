import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Fehler, Karte, Knopf, Laden, Seite } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { fehlerText, formatDatum } from "@/lib/format";
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

  return (
    <Seite titel="Aufgaben" neuLaden={() => liste.refetch()} laedt={liste.isRefetching}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          placeholder="Neue Aufgabe …"
          placeholderTextColor={theme.textSecondary}
          value={titel}
          onChangeText={setTitel}
          onSubmitEditing={() => titel.trim() && anlegen.mutate({ titel })}
          style={{
            flex: 1,
            minWidth: 0,
            borderWidth: 1,
            borderColor: theme.backgroundSelected,
            borderRadius: 10,
            padding: 10,
            color: theme.text,
            fontSize: 16,
          }}
        />
        <Knopf
          text="Neu"
          deaktiviert={!titel.trim() || anlegen.isPending}
          onPress={() => anlegen.mutate({ titel })}
        />
      </View>
      {anlegen.error && <Fehler text={fehlerText(anlegen.error)} />}
      {liste.isPending ? (
        <Laden />
      ) : liste.error ? (
        <Fehler text={fehlerText(liste.error)} />
      ) : liste.data.length === 0 ? (
        <ThemedText themeColor="textSecondary">Keine offenen Aufgaben.</ThemedText>
      ) : (
        liste.data.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="checkbox"
            onPress={() => erledigen.mutate({ id: a.id, erledigt: true })}
          >
            <Karte style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: theme.textSecondary,
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText>{a.titel}</ThemedText>
                {(a.patientName || a.faelligAm) && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {[a.patientName, a.faelligAm && `fällig ${formatDatum(a.faelligAm)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </ThemedText>
                )}
              </View>
            </Karte>
          </Pressable>
        ))
      )}
    </Seite>
  );
}
