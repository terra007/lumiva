"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AnmeldeFormular() {
  const router = useRouter();
  const [modus, setModus] = useState<"anmelden" | "registrieren">("anmelden");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    const d = new FormData(e.currentTarget);
    const email = String(d.get("email"));
    const password = String(d.get("passwort"));
    const { error } =
      modus === "anmelden"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(d.get("name")) });
    setLaeuft(false);
    if (error) {
      setFehler(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-Mail oder Passwort stimmt nicht."
          : error.code === "USER_ALREADY_EXISTS" ||
              error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an."
            : error.code === "PASSWORD_TOO_SHORT"
              ? "Das Passwort braucht mindestens 10 Zeichen."
              : error.status === 429
                ? "Zu viele Versuche. Bitte warte eine Minute und versuche es dann erneut."
                : (error.message ?? "Das hat nicht geklappt."),
      );
      return;
    }
    router.replace("/");
    router.refresh();
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
        {fehler && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
          >
            {fehler}
          </p>
        )}
        <button type="submit" className="knopf" disabled={laeuft}>
          {laeuft ? "Einen Moment …" : modus === "anmelden" ? "Anmelden" : "Konto erstellen"}
        </button>
      </form>
    </div>
  );
}
