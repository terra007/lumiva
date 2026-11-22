"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FehlerMeldung } from "@/components/formular";
import { authClient } from "@/lib/auth-client";
import { authFehlerText } from "@/lib/auth-fehler";

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
    if (error) return setFehler(authFehlerText(error));
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
      setFehler(authFehlerText(error));
      if (error.code === "INVALID_TWO_FACTOR_COOKIE" || error.code === "TWO_FACTOR_NOT_ENABLED")
        setModus("anmelden");
      return;
    }
    weiter();
  }

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
          <FehlerMeldung text={fehler} />
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
        <FehlerMeldung text={fehler} />
        <button type="submit" className="knopf" disabled={laeuft}>
          {laeuft ? "Einen Moment …" : modus === "anmelden" ? "Anmelden" : "Konto erstellen"}
        </button>
      </form>
    </div>
  );
}
