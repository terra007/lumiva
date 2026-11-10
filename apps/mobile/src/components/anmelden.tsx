import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Spacing } from "@/constants/theme";
import { authClient } from "@/lib/auth";
import { ThemedText } from "./themed-text";
import { Eingabe, Fehler, Karte, Knopf, Seite } from "./ui";

export function Anmelden() {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function anmelden() {
    if (laeuft || !email || !passwort) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password: passwort });
      if (error)
        setFehler(
          error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "E-Mail oder Passwort stimmt nicht."
            : (error.message ?? "Anmeldung fehlgeschlagen."),
        );
    } catch {
      // Ohne Netz wirft der Aufruf; der Knopf darf dann nicht gesperrt bleiben.
      setFehler("Der LUMIVA-Server ist nicht erreichbar.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Seite
        titel="LUMIVA"
        kopf={
          <View style={{ gap: Spacing.one, paddingTop: Spacing.five, paddingBottom: Spacing.two }}>
            <ThemedText type="title" accessibilityRole="header" accessibilityLabel="LUMIVA">
              LUMIVA
              <ThemedText type="title" themeColor="akzent">
                .
              </ThemedText>
            </ThemedText>
            <ThemedText themeColor="textSecondary">Klarheit für deine Praxis.</ThemedText>
          </View>
        }
      >
        <Karte style={{ gap: Spacing.three }}>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">E-Mail</ThemedText>
            <Eingabe
              accessibilityLabel="E-Mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
            />
          </View>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">Passwort</ThemedText>
            <Eingabe
              accessibilityLabel="Passwort"
              value={passwort}
              onChangeText={setPasswort}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
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
    </KeyboardAvoidingView>
  );
}
