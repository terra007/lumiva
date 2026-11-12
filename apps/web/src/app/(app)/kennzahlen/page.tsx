import { KENNZAHLEN_ZEITRAEUME, type KennzahlenZeitraum } from "@lumiva/domain";
import Link from "next/link";
import { Kennzahl } from "@/components/kennzahl";
import { Seitenkopf } from "@/components/seitenkopf";
import { euro } from "@/lib/format";
import { praxisApi } from "@/server/lumiva";

const ZEITRAUM_TEXT: Record<KennzahlenZeitraum, string> = {
  monat: "Dieser Monat",
  vormonat: "Letzter Monat",
  quartal: "Dieses Quartal",
  jahr: "Dieses Jahr",
};

const monatKurz = new Intl.DateTimeFormat("de-AT", { month: "short", timeZone: "UTC" });
const monatLang = new Intl.DateTimeFormat("de-AT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const alsDatum = (monat: string) => new Date(`${monat}-15T12:00:00Z`);

const prozent = (anteil: number | null) =>
  anteil === null ? "–" : `${Math.round(anteil * 100)} %`;
const sitzungen = (n: number) => `${n} ${n === 1 ? "Sitzung" : "Sitzungen"}`;

export default async function Kennzahlen({ searchParams }: PageProps<"/kennzahlen">) {
  const q = await searchParams;
  const art = KENNZAHLEN_ZEITRAEUME.find((z) => z === q.zeitraum) ?? "monat";
  const k = await (await praxisApi()).kennzahlen.zeitraum({ art });
  const { sitzungen: s, umsatz: u } = k;
  const hoechster = Math.max(1, ...k.verlauf.map((v) => v.erledigt));

  return (
    <div className="flex flex-col gap-8">
      <Seitenkopf titel="Kennzahlen" untertitel={k.zeitraum.bezeichnung}>
        <nav className="reiter" aria-label="Zeitraum">
          {KENNZAHLEN_ZEITRAEUME.map((z) => (
            <Link
              key={z}
              href={`/kennzahlen?zeitraum=${z}`}
              aria-current={z === art ? "page" : undefined}
            >
              {ZEITRAUM_TEXT[z]}
            </Link>
          ))}
        </nav>
      </Seitenkopf>

      <Abschnitt titel="Sitzungen">
        <Kennzahl
          titel="Geplant"
          wert={String(s.geplant)}
          unten={s.nichtVermerkt > 0 ? `${s.nichtVermerkt} vorbei, noch nicht vermerkt` : undefined}
          href="/kalender"
        />
        <Kennzahl titel="Erledigt" wert={String(s.erledigt)} />
        <Kennzahl
          titel="Ausgefallen"
          wert={String(s.abgesagt + s.nichtErschienen)}
          unten={`${s.abgesagt} abgesagt, ${s.nichtErschienen} nicht erschienen`}
        />
        <Kennzahl
          titel="Ausfallquote"
          wert={prozent(s.ausfallquote)}
          unten="Anteil an erledigten und ausgefallenen"
        />
      </Abschnitt>

      <Abschnitt titel="Demnächst">
        <Kennzahl
          titel="Nächste 7 Tage"
          wert={String(k.vorschau.naechste7Tage)}
          unten="geplante Sitzungen"
          href="/kalender"
        />
        <Kennzahl
          titel="Nächste 4 Wochen"
          wert={String(k.vorschau.naechste4Wochen)}
          unten="geplante Sitzungen"
          href="/kalender"
        />
        <Kennzahl titel="Aktive Patienten" wert={String(k.patienten.aktiv)} href="/patienten" />
        <Kennzahl
          titel="Abwesenheit"
          wert={`${k.abwesenheitsTage} ${k.abwesenheitsTage === 1 ? "Tag" : "Tage"}`}
          unten="eigene, im Zeitraum"
          href="/kalender"
        />
      </Abschnitt>

      <Abschnitt titel="Honorar">
        <Kennzahl
          titel="Geleistet"
          wert={euro(u.geleistetCent)}
          unten="erledigte Sitzungen und Ausfallhonorare"
        />
        <Kennzahl
          titel="Noch erwartet"
          wert={euro(u.erwartetCent)}
          unten="kommende geplante Sitzungen im Zeitraum"
        />
        <Kennzahl
          titel="Zahlungseingang"
          wert={euro(u.eingangCent)}
          unten={`davon ${euro(u.karteCent)} mit Karte`}
          href="/honorarnoten"
        />
        <Kennzahl
          titel="Honorarnoten ausgestellt"
          wert={euro(u.ausgestellt.summeCent)}
          unten={`${u.ausgestellt.anzahl} im Zeitraum, ohne Stornos`}
          href="/honorarnoten"
        />
        <Kennzahl
          titel="Offene Honorarnoten"
          wert={euro(u.offen.summeCent)}
          unten={`${u.offen.anzahl} unbezahlt, insgesamt`}
          href="/honorarnoten"
        />
        <Kennzahl
          titel="Noch nicht abgerechnet"
          wert={euro(u.nichtAbgerechnet.summeCent)}
          unten={`${sitzungen(u.nichtAbgerechnet.anzahl)} ohne Honorarnote, insgesamt`}
          href="/patienten"
        />
      </Abschnitt>

      <Abschnitt titel="Patienten im Zeitraum">
        <Kennzahl titel="Neu aufgenommen" wert={String(k.patienten.neu)} href="/patienten" />
        <Kennzahl titel="Behandlung beendet" wert={String(k.patienten.abgeschlossen)} />
      </Abschnitt>

      <section className="karte flex flex-col gap-4">
        <h2 className="karten-titel">Erledigte Sitzungen der letzten 12 Monate</h2>
        <div className="flex h-44 items-end gap-0.5 border-line border-b">
          {k.verlauf.map((v) => (
            <div
              key={v.monat}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${monatLang.format(alsDatum(v.monat))}: ${sitzungen(v.erledigt)}`}
            >
              <span className="pointer-events-none absolute inset-x-0 -top-1 hidden whitespace-nowrap text-center font-medium text-xs tabular-nums group-hover:block">
                {v.erledigt}
              </span>
              <div
                className="mx-auto w-full max-w-10 rounded-t bg-akzent transition group-hover:opacity-80"
                style={{ height: `${(v.erledigt / hoechster) * 85}%` }}
              />
            </div>
          ))}
        </div>
        <div className="-mt-2 flex gap-0.5 text-muted text-xs" aria-hidden>
          {k.verlauf.map((v) => (
            <span key={v.monat} className="flex-1 text-center">
              {monatKurz.format(alsDatum(v.monat)).replace(".", "")}
            </span>
          ))}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Als Tabelle</summary>
          <table className="mt-2 w-full max-w-sm tabular-nums">
            <tbody>
              {k.verlauf.map((v) => (
                <tr key={v.monat} className="border-line border-b last:border-0">
                  <td className="py-1">{monatLang.format(alsDatum(v.monat))}</td>
                  <td className="py-1 text-right">{v.erledigt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-muted text-sm uppercase tracking-wide">{titel}</h2>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}
