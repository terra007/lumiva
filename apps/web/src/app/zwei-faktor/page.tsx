import { redirect } from "next/navigation";
import { ZweiFaktor } from "@/components/zwei-faktor";
import { api } from "@/server/lumiva";

/** Pflichtschritt nach der Anmeldung für Konten ohne zweiten Faktor. */
export default async function ZweiFaktorEinrichten() {
  const { benutzer, zweiFaktorFehlt } = await (await api()).praxis.ich();
  if (!benutzer) redirect("/anmelden");
  if (!zweiFaktorFehlt) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Konto absichern</h1>
        <p className="text-muted">
          LUMIVA schützt Gesundheitsdaten. Deshalb braucht jedes Konto neben dem Passwort einen
          zweiten Faktor. Das dauert zwei Minuten und ist nur einmal nötig.
        </p>
      </header>
      <ZweiFaktor pflicht />
    </main>
  );
}
