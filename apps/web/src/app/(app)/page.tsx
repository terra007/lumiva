import Link from "next/link";
import { AktionsKnopf } from "@/components/formular";
import { euro, formatDatumLang, hinweisText, TERMIN_STATUS, uhrzeit } from "@/lib/format";
import { demoLaden, terminStatus } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Uebersicht() {
  const lumiva = await praxisApi();
  const [heute, patienten, ich] = await Promise.all([
    lumiva.uebersicht.heute(),
    lumiva.patienten.liste(),
    lumiva.praxis.ich(),
  ]);
  const mitHinweis = patienten.filter((p) => p.hinweise.length > 0);
  const leer = heute.aktivePatienten === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted text-sm">{formatDatumLang(new Date())}</p>
        <h1 className="font-semibold text-3xl tracking-tight">
          Guten Tag, {ich.benutzer?.name}
        </h1>
      </header>

      {leer && ich.praxis?.rolle !== "assistenz" && (
        <section className="karte flex flex-col items-start gap-3 border-akzent/50 bg-akzent/5">
          <h2 className="font-semibold">Noch leer hier</h2>
          <p className="text-muted text-sm">
            Lege deine erste Patientin oder deinen ersten Patienten an, oder lade Beispieldaten, um
            LUMIVA auszuprobieren. Die Beispieldaten sind frei erfunden.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/patienten/neu" className="knopf">
              Patient:in anlegen
            </Link>
            <AktionsKnopf aktion={demoLaden} felder={{}} text="Beispieldaten laden" />
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Kennzahl titel="Termine heute" wert={String(heute.termine.length)} href="/kalender" />
        <Kennzahl
          titel="Offene Honorarnoten"
          wert={euro(heute.offeneHonorarnoten.summeCent)}
          unten={`${heute.offeneHonorarnoten.anzahl} unbezahlt`}
          href="/honorarnoten"
        />
        <Kennzahl titel="Offene Aufgaben" wert={String(heute.offeneAufgaben)} href="/aufgaben" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="karte flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Heute</h2>
            <Link href="/kalender" className="verweis text-sm">
              Zum Kalender
            </Link>
          </div>
          {heute.termine.length === 0 ? (
            <p className="text-muted text-sm">Heute stehen keine Termine an.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {heute.termine.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-24 font-medium tabular-nums">
                    {uhrzeit(t.beginn)}–{uhrzeit(t.ende)}
                  </span>
                  <Link href={`/patienten/${t.patientId}`} className="verweis flex-1">
                    {t.patientName}
                  </Link>
                  <span className={`abzeichen ${TERMIN_STATUS[t.status]?.klasse}`}>
                    {TERMIN_STATUS[t.status]?.text}
                  </span>
                  {t.status === "geplant" && (
                    <AktionsKnopf
                      aktion={terminStatus}
                      felder={{ id: t.id, status: "erledigt" }}
                      text="Erledigt"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="karte flex flex-col gap-4">
          <h2 className="font-semibold">Kostenzuschuss im Blick</h2>
          {mitHinweis.length === 0 ? (
            <p className="text-muted text-sm">Alles in Ordnung. Keine fehlenden Bestätigungen.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {mitHinweis.map((p) => (
                <li key={p.id} className="flex flex-col gap-0.5">
                  <Link href={`/patienten/${p.id}`} className="verweis font-medium">
                    {p.vorname} {p.nachname}
                  </Link>
                  {p.hinweise.map((h) => (
                    <span key={h.art} className="text-amber-800 dark:text-amber-300">
                      {hinweisText(h)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kennzahl({
  titel,
  wert,
  unten,
  href,
}: {
  titel: string;
  wert: string;
  unten?: string;
  href: string;
}) {
  return (
    <Link href={href} className="karte flex flex-col gap-1 transition hover:border-akzent/60">
      <span className="text-muted text-sm">{titel}</span>
      <span className="font-semibold text-3xl tabular-nums tracking-tight">{wert}</span>
      {unten && <span className="text-muted text-xs">{unten}</span>}
    </Link>
  );
}
