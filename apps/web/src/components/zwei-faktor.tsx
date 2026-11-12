"use client";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Schritt =
  | { art: "ruhe" }
  | { art: "passwort"; ziel: "einschalten" | "neu" | "codes" }
  | { art: "scannen"; uri: string; codes: string[] }
  | { art: "codes"; codes: string[] };

/** Geheimnis aus der otpauth-Adresse, zum Abtippen, wenn die Kamera nicht geht. */
function geheimnisAus(uri: string): string {
  const s = new URL(uri).searchParams.get("secret") ?? "";
  return s.replace(/(.{4})/g, "$1 ").trim();
}

function fehlerText(code?: string, message?: string): string {
  if (code === "INVALID_PASSWORD") return "Das Passwort stimmt nicht.";
  if (code === "INVALID_CODE") return "Der Code stimmt nicht. Bitte prüfe die Uhrzeit am Handy.";
  return message ?? "Das hat nicht geklappt.";
}

/**
 * Zwei-Faktor-Anmeldung einrichten und verwalten. Mit `pflicht` als eigene Seite nach der
 * Anmeldung: ohne Abbrechen, und nach dem Sichern der Codes geht es in die Praxis.
 */
export function ZweiFaktor({ pflicht = false }: { pflicht?: boolean }) {
  const router = useRouter();
  const { data: sitzung, refetch } = authClient.useSession();
  const aktiv = Boolean(sitzung?.user.twoFactorEnabled);
  const [schritt, setSchritt] = useState<Schritt>(
    pflicht ? { art: "passwort", ziel: "einschalten" } : { art: "ruhe" },
  );
  const [qr, setQr] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const uri = schritt.art === "scannen" ? schritt.uri : null;
  useEffect(() => {
    if (!uri) return setQr(null);
    QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setQr, () =>
      setFehler("Der QR-Code ließ sich nicht anzeigen. Tippe den Schlüssel darunter ab."),
    );
  }, [uri]);

  async function mitPasswort(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (schritt.art !== "passwort") return;
    setFehler(null);
    setLaeuft(true);
    const password = String(new FormData(e.currentTarget).get("passwort"));
    if (schritt.ziel === "codes") {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      setLaeuft(false);
      if (error) return setFehler(fehlerText(error.code, error.message));
      if (data) setSchritt({ art: "codes", codes: data.backupCodes });
      return;
    }
    // Neues Handy: alten Schlüssel löschen und gleich einen neuen ausstellen.
    if (schritt.ziel === "neu") {
      const { error } = await authClient.twoFactor.disable({ password });
      if (error) {
        setLaeuft(false);
        return setFehler(fehlerText(error.code, error.message));
      }
      // Der alte Faktor ist weg: Scheitert der nächste Schritt, nur noch neu einschalten.
      setSchritt({ art: "passwort", ziel: "einschalten" });
    }
    const { data, error } = await authClient.twoFactor.enable({ password, issuer: "LUMIVA" });
    setLaeuft(false);
    if (error) return setFehler(fehlerText(error.code, error.message));
    if (data && "totpURI" in data)
      setSchritt({ art: "scannen", uri: data.totpURI, codes: data.backupCodes });
  }

  async function bestaetigen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (schritt.art !== "scannen") return;
    setFehler(null);
    setLaeuft(true);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLaeuft(false);
    if (error) return setFehler(fehlerText(error.code, error.message));
    setSchritt({ art: "codes", codes: schritt.codes });
    refetch();
  }

  const fehlerBox = fehler && (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
    >
      {fehler}
    </p>
  );
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
          className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${aktiv ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
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
          {fehlerBox}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="knopf" disabled={laeuft}>
              {laeuft
                ? "Einen Moment …"
                : schritt.ziel === "einschalten"
                  ? "Weiter"
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
              {qr && (
                <div
                  role="img"
                  aria-label="QR-Code für die Authenticator-App"
                  className="mt-2 w-48 rounded-lg bg-white p-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG von der qrcode-Bibliothek, aus der eigenen otpauth-Adresse erzeugt.
                  dangerouslySetInnerHTML={{ __html: qr }}
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
          {fehlerBox}
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
