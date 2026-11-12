import Link from "next/link";
import { AktionsKnopf } from "@/components/formular";
import { Kennzahl } from "@/components/kennzahl";
import { Zeichen } from "@/components/zeichen";
import { euro, formatDatumLang, hinweisText, TERMIN_STATUS, uhrzeit } from "@/lib/format";
import { demoLaden, terminStatus } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

/** Begrüßung nach Wiener Tageszeit. */
function gruss(jetzt: Date): string {
  const stunde = Number(
    new Intl.DateTimeFormat("de-AT", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/Vienna",
    }).format(jetzt),
  );
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function Uebersicht() {
  const lumiva = await praxisApi();
  const [heute, patienten, ich] = await Promise.all([
    lumiva.uebersicht.heute(),
    lumiva.patienten.liste(),
    lumiva.praxis.ich(),
  ]);
  const jetzt = new Date();
  const mitHinweis = patienten.filter((p) => p.hinweise.length > 0);
  const leer = heute.aktivePatienten === 0;
  const naechster = heute.termine.find((t) => t.status === "geplant" && t.ende > jetzt);
  const offeneNoten = heute.offeneHonorarnoten.anzahl;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted text-sm">{formatDatumLang(jetzt)}</p>
        <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
          {gruss(jetzt)}, {ich.benutzer?.name}
        </h1>
      </header>

      {leer && ich.praxis?.rolle !== "assistenz" && (
        <section className="karte flex flex-col items-start gap-3 border-akzent/50 bg-akzent/5">
          <h2 className="karten-titel">Noch leer hier</h2>
          <p className="text-muted text-sm">
            Lege deinen ersten Patienten an oder lade Beispieldaten, um LUMIVA auszuprobieren. Die
            Beispieldaten sind frei erfunden.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/patienten/neu" className="knopf">
              <Zeichen name="plus" />
              Patient anlegen
            </Link>
            <AktionsKnopf aktion={demoLaden} felder={{}} text="Beispieldaten laden" />
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-3 md:gap-4">
        <Kennzahl
          titel="Termine heute"
          wert={String(heute.termine.length)}
          unten={naechster ? `Nächster um ${uhrzeit(naechster.beginn)}` : undefined}
          href="/kalender"
        />
        <Kennzahl
          titel="Offene Honorarnoten"
          wert={euro(heute.offeneHonorarnoten.summeCent)}
          unten={
            offeneNoten === 0
              ? "alles bezahlt"
              : `${offeneNoten} ${offeneNoten === 1 ? "Note" : "Noten"} unbezahlt`
          }
          href="/honorarnoten"
        />
        <Kennzahl titel="Offene Aufgaben" wert={String(heute.offeneAufgaben)} href="/aufgaben" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="karte flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="karten-titel">Heute</h2>
            <Link
              href="/kalender"
              className="inline-flex items-center gap-1 text-muted text-sm hover:text-foreground"
            >
              Zum Kalender
              <Zeichen name="rechts" className="size-4" />
            </Link>
          </div>
          {heute.termine.length === 0 ? (
            <div className="leer">
              <Zeichen name="kalender" className="size-6" />
              Heute stehen keine Termine an.
            </div>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {heute.termine.map((t) => {
                const laeuft = t.beginn <= jetzt && t.ende > jetzt && t.status === "geplant";
                return (
                  <li
                    key={t.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-3 ${laeuft ? "bg-akzent/10" : ""}`}
                  >
                    <span className="flex w-24 shrink-0 flex-col font-medium text-sm tabular-nums sm:w-28">
                      <span className="whitespace-nowrap">
                        {uhrzeit(t.beginn)} – {uhrzeit(t.ende)}
                      </span>
                      {laeuft && <span className="text-akzent-text text-xs">läuft gerade</span>}
                    </span>
                    <span className="flex min-w-36 flex-1 flex-col">
                      <Link href={`/patienten/${t.patientId}`} className="verweis truncate">
                        {t.patientName}
                      </Link>
                      <span className="truncate text-muted text-xs">{t.sitzungsart}</span>
                    </span>
                    <span className="flex items-center gap-2">
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
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="karte flex flex-col gap-4">
          <h2 className="karten-titel">Kostenzuschuss im Blick</h2>
          {mitHinweis.length === 0 ? (
            <p className="flex items-center gap-2 text-muted text-sm">
              <Zeichen name="haken" className="size-4 text-emerald-600" />
              Alles in Ordnung. Keine fehlenden Bestätigungen.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {mitHinweis.map((p) => (
                <li key={p.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/patienten/${p.id}`} className="verweis self-start font-medium">
                      {p.vorname} {p.nachname}
                    </Link>
                    {p.hinweise.map((h) => (
                      <span key={h.art} className="text-muted">
                        {hinweisText(h)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
