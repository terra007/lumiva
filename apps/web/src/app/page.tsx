const bereiche = [
  { titel: "Termine", text: "Deine Woche auf einen Blick, im Web und am Handy." },
  { titel: "Honorarnoten", text: "Fertig für den Kostenzuschuss bei ÖGK, BVAEB und SVS." },
  { titel: "Dokumentation", text: "Verschlüsselt und nach § 44 PThG 2024." },
  { titel: "Aufgaben", text: "Nichts Offenes bleibt im Dunkeln." },
];

export default function Startseite() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-3">
        <h1 className="font-semibold text-4xl tracking-tight">LUMIVA</h1>
        <p className="text-lg text-muted">Klarheit für deine Praxis.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {bereiche.map((b) => (
          <li key={b.titel} className="rounded-xl border border-line p-5">
            <h2 className="font-medium">{b.titel}</h2>
            <p className="mt-1 text-muted text-sm">{b.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
