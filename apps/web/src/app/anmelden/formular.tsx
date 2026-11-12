"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Fehler = { code?: string; status?: number; message?: string } | null;

function fehlerText(error: NonNullable<Fehler>): string {
  if (error.status === 429)
    return "Zu viele Versuche. Bitte warte eine Minute und versuche es dann erneut.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-Mail oder Passwort stimmt nicht.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.";
    case "PASSWORD_TOO_SHORT":
      return "Das Passwort braucht mindestens 10 Zeichen.";
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "Der Code stimmt nicht. Bitte prüfe ihn und versuche es erneut.";
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TWO_FACTOR_NOT_ENABLED":
      return "Die Anmeldung ist abgelaufen. Bitte gib E-Mail und Passwort erneut ein.";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Zu viele falsche Codes. Die Anmeldung ist für 15 Minuten gesperrt.";
    default:
      return error.message ?? "Das hat nicht geklappt.";
  }
}

export function AnmeldeFormular() {
  const router = useRouter();
  const [modus, setModus] = useState<"anmelden" | "registrieren" | "code">("anmelden");
  const [ersatzcode, setErsatzcode] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  function weiter() {
    router.replace("/");
    router.refresh();
  }

  async function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    const d = new FormData(e.currentTarget);
    const email = String(d.get("email"));
    const password = String(d.get("passwort"));
    const { data, error } =
      modus === "anmelden"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(d.get("name")) });
    setLaeuft(false);
    if (error) return setFehler(fehlerText(error));
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setModus("code");
      return;
    }
    weiter();
  }

  async function codePruefen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    const d = new FormData(e.currentTarget);
    const code = String(d.get("code")).replace(/\s/g, "");
    const trustDevice = d.get("vertrauen") === "on";
    const { error } = ersatzcode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setLaeuft(false);
    if (error) {
      setFehler(fehlerText(error));
      if (error.code === "INVALID_TWO_FACTOR_COOKIE" || error.code === "TWO_FACTOR_NOT_ENABLED")
        setModus("anmelden");
      return;
    }
    weiter();
  }

  const fehlerBox = fehler && (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
    >
      {fehler}
    </p>
  );

  if (modus === "code") {
    return (
      <div className="karte flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Bestätigungscode</h2>
          <p className="text-muted text-sm">
            {ersatzcode
              ? "Gib einen deiner Wiederherstellungscodes ein. Jeder Code gilt nur einmal."
              : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
          </p>
        </div>
        <form onSubmit={codePruefen} className="flex flex-col gap-4">
          <label className="etikett">
            {ersatzcode ? "Wiederherstellungscode" : "Code"}
            <input
              key={ersatzcode ? "ersatz" : "totp"}
              name="code"
              required
              className="eingabe font-mono tracking-widest"
              autoComplete="one-time-code"
              inputMode={ersatzcode ? "text" : "numeric"}
              pattern={ersatzcode ? undefined : "[0-9 ]{6,7}"}
              maxLength={ersatzcode ? 32 : 7}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vertrauen" />
            Diesem Gerät 30 Tage vertrauen (nur auf dem eigenen Gerät)
          </label>
          {fehlerBox}
          <button type="submit" className="knopf" disabled={laeuft}>
            {laeuft ? "Einen Moment …" : "Bestätigen"}
          </button>
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-muted underline"
            onClick={() => {
              setErsatzcode(!ersatzcode);
              setFehler(null);
            }}
          >
            {ersatzcode ? "Code aus der App verwenden" : "Kein Zugriff auf die App?"}
          </button>
          <button
            type="button"
            className="text-muted underline"
            onClick={() => {
              setModus("anmelden");
              setErsatzcode(false);
              setFehler(null);
            }}
          >
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="karte flex flex-col gap-5">
      <div className="flex gap-1 rounded-lg bg-line/40 p-1 text-sm">
        {(["anmelden", "registrieren"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModus(m)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${modus === m ? "bg-background shadow-sm" : "text-muted"}`}
          >
            {m === "anmelden" ? "Anmelden" : "Konto erstellen"}
          </button>
        ))}
      </div>
      <form onSubmit={absenden} className="flex flex-col gap-4">
        {modus === "registrieren" && (
          <label className="etikett">
            Name mit Titel
            <input
              name="name"
              required
              className="eingabe"
              placeholder="Mag. Maria Muster"
              autoComplete="name"
            />
          </label>
        )}
        <label className="etikett">
          E-Mail
          <input name="email" type="email" required className="eingabe" autoComplete="email" />
        </label>
        <label className="etikett">
          Passwort
          <input
            name="passwort"
            type="password"
            required
            minLength={10}
            className="eingabe"
            autoComplete={modus === "anmelden" ? "current-password" : "new-password"}
          />
          {modus === "registrieren" && (
            <span className="font-normal text-muted text-xs">Mindestens 10 Zeichen.</span>
          )}
        </label>
        {fehlerBox}
        <button type="submit" className="knopf" disabled={laeuft}>
          {laeuft ? "Einen Moment …" : modus === "anmelden" ? "Anmelden" : "Konto erstellen"}
        </button>
      </form>
    </div>
  );
}
