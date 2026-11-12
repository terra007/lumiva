import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { authClient } from "@/lib/auth";
import { Karte, Knopf, Seite } from "./ui";

/**
 * Konten ohne zweiten Faktor sehen keine Praxisdaten (die API verweigert sie).
 * Eingerichtet wird die Zwei-Faktor-Anmeldung in der Web-App, weil dort der QR-Code steht.
 */
export function ZweiFaktorFehlt() {
  const queryClient = useQueryClient();
  return (
    <Seite titel="Konto absichern" untertitel="Zwei-Faktor-Anmeldung fehlt">
      <Karte>
        <ThemedText>
          LUMIVA schützt Gesundheitsdaten. Jedes Konto braucht deshalb neben dem Passwort einen Code
          aus einer Authenticator-App.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Melde dich am Computer in der Web-App von LUMIVA an. Dort führt dich LUMIVA durch die
          Einrichtung. Danach meldest du dich hier erneut an.
        </ThemedText>
        <Knopf
          text="Abmelden"
          art="zweit"
          onPress={async () => {
            await authClient.signOut();
            queryClient.clear();
          }}
        />
      </Karte>
    </Seite>
  );
}
