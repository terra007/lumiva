"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FehlerMeldung } from "@/components/formular";
import { authClient } from "@/lib/auth-client";
import { authFehlerText } from "@/lib/auth-fehler";

type Schritt =
  | { art: "ruhe" }
  | { art: "passwort"; ziel: "einschalten" | "neu" | "codes" }
  | { art: "scannen"; uri: string; qr: string | null; codes: string[] }
  | { art: "codes"; codes: string[] };

/** Geheimnis aus der otpauth-Adresse, zum Abtippen, wenn die Kamera nicht geht. */
function geheimnisAus(uri: string): string {
  const s = new URL(uri).searchParams.get("secret") ?? "";
  return s.replace(/(.{4})/g, "$1 ").trim();
}

/** QR-Code als SVG. Die Bibliothek wird erst geladen, wenn er gebraucht wird. */
async function qrSvg(uri: string): Promise<string | null> {
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

/**
 * Zwei-Faktor-Anmeldung einrichten und verwalten. Mit `pflicht` als eigene Seite nach der
 * Anmeldung: ohne Abbrechen, und nach dem Sichern der Codes geht es in die Praxis.
 */
export function ZweiFaktor({ pflicht = false }: { pflicht?: boolean }) {
  const router = useRouter();
  // In den Einstellungen ist der zweite Faktor immer an: ohne ihn gäbe es die Seite nicht.
  const [aktiv, setAktiv] = useState(!pflicht);
  const [schritt, setSchritt] = useState<Schritt>(
    pflicht ? { art: "passwort", ziel: "einschalten" } : { art: "ruhe" },
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function mitPasswort(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (schritt.art !== "passwort") return;
    setFehler(null);
    setLaeuft(true);
    const password = String(new FormData(e.currentTarget).get("passwort"));
    if (schritt.ziel === "codes") {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      setLaeuft(false);
      if (error) return setFehler(authFehlerText(error));
      if (data) setSchritt({ art: "codes", codes: data.backupCodes });
      return;
    }
    // Neues Handy: alten Schlüssel löschen und gleich einen neuen ausstellen.
    if (schritt.ziel === "neu") {
      const { error } = await authClient.twoFactor.disable({ password });
      if (error) {
        setLaeuft(false);
        return setFehler(authFehlerText(error));
      }
      // Der alte Faktor ist weg: Scheitert der nächste Schritt, nur noch neu einschalten.
      setAktiv(false);
      setSchritt({ art: "passwort", ziel: "einschalten" });
    }
    const { data, error } = await authClient.twoFactor.enable({ password, issuer: "LUMIVA" });
    if (error) {
      setLaeuft(false);
      return setFehler(authFehlerText(error));
    }
    if (data && "totpURI" in data) {
      const qr = await qrSvg(data.totpURI);
      if (!qr) setFehler("Der QR-Code ließ sich nicht anzeigen. Tippe den Schlüssel darunter ab.");
      setSchritt({ art: "scannen", uri: data.totpURI, qr, codes: data.backupCodes });
    }
    setLaeuft(false);
  }

  async function bestaetigen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (schritt.art !== "scannen") return;
    setFehler(null);
    setLaeuft(true);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLaeuft(false);
    if (error) return setFehler(authFehlerText(error));
    setAktiv(true);
    setSchritt({ art: "codes", codes: schritt.codes });
  }

  const abbrechen = !pflicht && (
    <button
      type="button"
      className="knopf-zweit"
      onClick={() => {
        setSchritt({ art: "ruhe" });
        setFehler(null);
      }}
    >
      Abbrechen
    </button>
  );

  return (
    <section className="karte flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Zwei-Faktor-Anmeldung</h2>
        <span
          className={`abzeichen ${aktiv ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
        >
          {aktiv ? "Eingeschaltet" : "Aus"}
        </span>
      </div>
      <p className="text-muted text-sm">
        Bei der Anmeldung braucht es neben dem Passwort einen Code aus einer Authenticator-App am
        Handy, z. B. Microsoft Authenticator, Google Authenticator oder die Passwörter-App am
        iPhone. Ein gestohlenes Passwort allein reicht dann nicht mehr.
      </p>

      {schritt.art === "ruhe" && (
        <div className="flex flex-wrap gap-2">
          {aktiv ? (
            <>
              <button
                type="button"
                className="knopf-zweit"
                onClick={() => setSchritt({ art: "passwort", ziel: "codes" })}
              >
                Neue Wiederherstellungscodes
              </button>
              <button
                type="button"
                className="knopf-zweit"
                onClick={() => setSchritt({ art: "passwort", ziel: "neu" })}
              >
                Neues Handy einrichten
              </button>
            </>
          ) : (
            <button
              type="button"
              className="knopf"
              onClick={() => setSchritt({ art: "passwort", ziel: "einschalten" })}
            >
              Einschalten
            </button>
          )}
        </div>
      )}

      {schritt.art === "passwort" && (
        <form onSubmit={mitPasswort} className="flex flex-col gap-4">
          <label className="etikett">
            Zur Bestätigung dein Passwort
            <input
              name="passwort"
              type="password"
              required
              className="eingabe"
              autoComplete="current-password"
            />
          </label>
          <FehlerMeldung text={fehler} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="knopf" disabled={laeuft}>
              {laeuft
                ? "Einen Moment …"
                : schritt.ziel === "codes"
                  ? "Neue Codes erzeugen"
                  : "Weiter"}
            </button>
            {abbrechen}
          </div>
        </form>
      )}

      {schritt.art === "scannen" && (
        <form onSubmit={bestaetigen} className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
            <li>
              Den QR-Code mit der Authenticator-App scannen.
              {schritt.qr && (
                <div
                  role="img"
                  aria-label="QR-Code für die Authenticator-App"
                  className="mt-2 w-48 rounded-lg bg-white p-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG von der qrcode-Bibliothek, aus der eigenen otpauth-Adresse erzeugt.
                  dangerouslySetInnerHTML={{ __html: schritt.qr }}
                />
              )}
              <span className="mt-2 block text-muted">
                Ohne Kamera diesen Schlüssel eintippen:{" "}
                <code className="font-mono">{geheimnisAus(schritt.uri)}</code>
              </span>
            </li>
            <li>
              <label className="etikett">
                Den 6-stelligen Code aus der App eingeben
                <input
                  name="code"
                  required
                  className="eingabe w-40 font-mono tracking-widest"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                />
              </label>
            </li>
          </ol>
          <FehlerMeldung text={fehler} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="knopf" disabled={laeuft}>
              {laeuft ? "Einen Moment …" : "Bestätigen und einschalten"}
            </button>
            {abbrechen}
          </div>
        </form>
      )}

      {schritt.art === "codes" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <strong>Wiederherstellungscodes:</strong> Damit kommst du hinein, wenn das Handy fehlt.
            Jeder Code gilt einmal. Jetzt ausdrucken oder im Passwortmanager speichern; sie werden
            nicht noch einmal angezeigt. Ältere Codes gelten nicht mehr.
          </p>
          <ul className="grid grid-cols-2 gap-1 rounded-lg bg-line/40 p-3 font-mono text-sm sm:grid-cols-5">
            {schritt.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="knopf-zweit"
              onClick={() => navigator.clipboard.writeText(schritt.codes.join("\n"))}
            >
              Kopieren
            </button>
            <button
              type="button"
              className="knopf"
              onClick={() => {
                if (!pflicht) return setSchritt({ art: "ruhe" });
                router.replace("/");
                router.refresh();
              }}
            >
              Ich habe die Codes gesichert
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
