import { redirect } from "next/navigation";
import { Feld, Formular } from "@/components/formular";
import { praxisAnlegen } from "@/server/aktionen";
import { api } from "@/server/lumiva";

export default async function Einrichten() {
  const { benutzer, praxis } = await (await api()).praxis.ich();
  if (!benutzer) redirect("/anmelden");
  if (praxis) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Willkommen, {benutzer.name}</h1>
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
          <Feld
            name="anschrift"
            label="Anschrift"
            pflicht
            placeholder="Musterstraße 1, 1010 Wien"
          />
          <Feld
            name="berufsbezeichnung"
            label="Deine Berufsbezeichnung"
            placeholder="Psychotherapeutin (Verhaltenstherapie)"
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
