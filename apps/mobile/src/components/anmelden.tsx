import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth";
import { ThemedText } from "./themed-text";
import { Fehler, Karte, Knopf, Seite } from "./ui";

export function Anmelden() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const eingabe = [
    styles.eingabe,
    { borderColor: theme.backgroundSelected, color: theme.text, backgroundColor: theme.background },
  ];

  async function anmelden() {
    setLaeuft(true);
    setFehler(null);
    const { error } = await authClient.signIn.email({ email: email.trim(), password: passwort });
    setLaeuft(false);
    if (error)
      setFehler(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-Mail oder Passwort stimmt nicht."
          : (error.message ?? "Anmeldung fehlgeschlagen."),
      );
  }

  return (
    <Seite titel="LUMIVA" untertitel="Klarheit für deine Praxis.">
      <Karte>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold">E-Mail</ThemedText>
          <TextInput
            style={eingabe}
            accessibilityLabel="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
          />
        </View>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="smallBold">Passwort</ThemedText>
          <TextInput
            style={eingabe}
            accessibilityLabel="Passwort"
            value={passwort}
            onChangeText={setPasswort}
            secureTextEntry
            autoComplete="current-password"
            onSubmitEditing={anmelden}
          />
        </View>
        {fehler && <Fehler text={fehler} />}
        <Knopf
          text={laeuft ? "Einen Moment …" : "Anmelden"}
          onPress={anmelden}
          deaktiviert={laeuft || !email || !passwort}
        />
      </Karte>
      <ThemedText type="small" themeColor="textSecondary">
        Noch kein Konto? Erstelle es in der Web-App von LUMIVA und richte dort deine Praxis ein.
      </ThemedText>
    </Seite>
  );
}

const styles = StyleSheet.create({
  eingabe: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
