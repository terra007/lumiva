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
  // Nach richtigem Passwort: Code aus der Authenticator-App oder ein Wiederherstellungscode.
  const [codeSchritt, setCodeSchritt] = useState(false);
  const [ersatzcode, setErsatzcode] = useState(false);
  const [code, setCode] = useState("");
  const eingabe = [
    styles.eingabe,
    { borderColor: theme.backgroundSelected, color: theme.text, backgroundColor: theme.background },
  ];

  async function anmelden() {
    setLaeuft(true);
    setFehler(null);
    const { data, error } = await authClient.signIn.email({
      email: email.trim(),
      password: passwort,
    });
    setLaeuft(false);
    if (error)
      return setFehler(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-Mail oder Passwort stimmt nicht."
          : (error.message ?? "Anmeldung fehlgeschlagen."),
      );
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) setCodeSchritt(true);
  }

  async function codePruefen() {
    setLaeuft(true);
    setFehler(null);
    const wert = code.replace(/\s/g, "");
    const { error } = ersatzcode
      ? await authClient.twoFactor.verifyBackupCode({ code: wert })
      : await authClient.twoFactor.verifyTotp({ code: wert });
    setLaeuft(false);
    if (!error) return;
    if (error.code === "INVALID_TWO_FACTOR_COOKIE") {
      setCodeSchritt(false);
      setErsatzcode(false);
      setCode("");
      return setFehler("Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.");
    }
    setFehler(
      error.code === "INVALID_CODE" || error.code === "INVALID_BACKUP_CODE"
        ? "Der Code stimmt nicht."
        : error.code === "ACCOUNT_TEMPORARILY_LOCKED"
          ? "Zu viele falsche Codes. Bitte warte 15 Minuten."
          : (error.message ?? "Anmeldung fehlgeschlagen."),
    );
  }

  if (codeSchritt) {
    return (
      <Seite titel="LUMIVA" untertitel="Bestätigungscode">
        <Karte>
          <ThemedText type="small" themeColor="textSecondary">
            {ersatzcode
              ? "Gib einen deiner Wiederherstellungscodes ein. Jeder Code gilt nur einmal."
              : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
          </ThemedText>
          <TextInput
            style={eingabe}
            accessibilityLabel={ersatzcode ? "Wiederherstellungscode" : "Code"}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType={ersatzcode ? "default" : "number-pad"}
            autoFocus
            onSubmitEditing={codePruefen}
          />
          {fehler && <Fehler text={fehler} />}
          <Knopf
            text={laeuft ? "Einen Moment …" : "Bestätigen"}
            onPress={codePruefen}
            deaktiviert={laeuft || !code}
          />
          <Knopf
            art="zweit"
            text={ersatzcode ? "Code aus der App verwenden" : "Kein Zugriff auf die App?"}
            onPress={() => {
              setErsatzcode(!ersatzcode);
              setCode("");
              setFehler(null);
            }}
          />
        </Karte>
      </Seite>
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
