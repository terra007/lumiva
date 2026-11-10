import { redirect } from "next/navigation";
import { AnschriftFelder, Feld, Formular } from "@/components/formular";
import { praxisAnlegen } from "@/server/aktionen";
import { api } from "@/server/lumiva";

export default async function Einrichten() {
  const { benutzer, praxis } = await (await api()).praxis.ich();
  if (!benutzer) redirect("/anmelden");
  if (praxis) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="font-semibold text-xl tracking-tight">
          LUMIVA<span className="text-akzent">.</span>
        </p>
        <p className="font-medium text-akzent-text text-xs uppercase tracking-wide">
          Schritt 2 von 2 · Praxis anlegen
        </p>
        <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
          Willkommen, {benutzer.name}
        </h1>
        <p className="text-muted">
          Lege deine Praxis an. Diese Angaben erscheinen auf deinen Honorarnoten und lassen sich
          später ändern.
        </p>
      </header>
      <div className="karte">
        <Formular aktion={praxisAnlegen} knopf="Praxis anlegen">
          <Feld
            name="name"
            label="Name der Praxis"
            pflicht
            placeholder="Praxis für Psychotherapie Muster"
          />
          <AnschriftFelder pflicht />
          <Feld
            name="berufsbezeichnung"
            label="Deine Berufsbezeichnung"
            placeholder="Psychotherapeut (Verhaltenstherapie)"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld name="telefon" label="Telefon" typ="tel" />
            <Feld name="email" label="E-Mail" typ="email" />
          </div>
          <Feld
            name="iban"
            label="IBAN"
            hinweis="Für den Überweisungshinweis auf der Honorarnote."
          />
        </Formular>
      </div>
    </main>
  );
}
