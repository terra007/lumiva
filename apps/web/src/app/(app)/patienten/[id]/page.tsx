import Link from "next/link";
import { AktionsKnopf, Feld, Formular } from "@/components/formular";
import { NotenStatus } from "@/components/noten-status";
import {
  DOKU_ART,
  datumIso,
  euro,
  formatDatum,
  hinweisText,
  TERMIN_STATUS,
  TRAEGER,
  uhrzeit,
} from "@/lib/format";
import {
  aufgabeAnlegen,
  aufgabeErledigen,
  bestaetigungenSpeichern,
  dokuAnlegen,
  honorarnoteAusstellen,
  patientStatus,
} from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function PatientAkte({ params }: PageProps<"/patienten/[id]">) {
  const { id } = await params;
  const lumiva = await praxisApi();
  const ich = await lumiva.praxis.ich();
  const darfAkte = ich.praxis?.rolle !== "assistenz";
  const jetzt = new Date();
  const p = await lumiva.patienten.details({ id });
  const [termine, doku, offen, noten, aufgaben] = await Promise.all([
    lumiva.termine.zeitraum({
      von: new Date(jetzt.getTime() - 300 * 24 * 60 * 60_000),
      bis: new Date(jetzt.getTime() + 90 * 24 * 60 * 60_000),
      patientId: id,
    }),
    darfAkte ? lumiva.doku.liste({ patientId: id }) : Promise.resolve([]),
    lumiva.honorarnoten.offen({ patientId: id }),
    lumiva.honorarnoten.liste({ patientId: id }),
    lumiva.aufgaben.liste({ patientId: id }),
  ]);
  const vergangen = termine.filter((t) => t.beginn < jetzt).reverse();
  const kommend = termine.filter((t) => t.beginn >= jetzt);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/patienten" className="text-muted text-sm hover:underline">
            ← Patient:innen
          </Link>
          <h1 className="font-semibold text-3xl tracking-tight">
            {p.vorname} {p.nachname}
          </h1>
          <p className="text-muted text-sm">
            geb. {formatDatum(p.geburtsdatum)} · {TRAEGER[p.versicherungstraeger]}
            {p.svNummer && ` · SV ${p.svNummer}`} · {p.sitzungen}{" "}
            {p.sitzungen === 1 ? "Sitzung" : "Sitzungen"}
            {p.status !== "aktiv" &&
              ` · ${p.status === "pausiert" ? "pausiert" : `abgeschlossen am ${formatDatum(p.behandlungsende)}`}`}
          </p>
        </div>
        {darfAkte && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/patienten/${p.id}/bearbeiten`} className="knopf-zweit">
              Bearbeiten
            </Link>
            {p.status === "aktiv" ? (
              <AktionsKnopf
                aktion={patientStatus}
                felder={{ id: p.id, status: "abgeschlossen" }}
                text="Behandlung abschließen"
                bestaetigen="Behandlung abschließen? Die Akte bleibt bis zum Ende der Aufbewahrungsfrist erhalten."
              />
            ) : (
              <AktionsKnopf
                aktion={patientStatus}
                felder={{ id: p.id, status: "aktiv" }}
                text="Wieder aktivieren"
              />
            )}
          </div>
        )}
      </header>

      {p.hinweise.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {p.hinweise.map((h) => (
            <span key={h.art}>{hinweisText(h)}</span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {darfAkte && (
            <section className="karte flex flex-col gap-4">
              <h2 className="font-semibold">Dokumentation</h2>
              <Formular aktion={dokuAnlegen} knopf="Eintrag speichern" zuruecksetzen>
                <input type="hidden" name="patientId" value={p.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="etikett">
                    Art
                    <select
                      name="art"
                      className="eingabe"
                      defaultValue={doku.length === 0 ? "erstgespraech" : "verlauf"}
                    >
                      {Object.entries(DOKU_ART).map(([w, t]) => (
                        <option key={w} value={w}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="etikett">
                    Zur Sitzung
                    <select
                      name="terminId"
                      className="eingabe"
                      defaultValue={vergangen[0]?.id ?? ""}
                    >
                      <option value="">Keine</option>
                      {vergangen.slice(0, 10).map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDatum(datumIso(t.beginn))} {uhrzeit(t.beginn)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Feld name="diagnoseIcd10" label="Diagnose (ICD-10)" placeholder="F32.1" />
                </div>
                <label className="etikett">
                  Eintrag
                  <textarea
                    name="inhalt"
                    required
                    rows={4}
                    className="eingabe"
                    placeholder="Verlauf, Interventionen, Vereinbarungen …"
                  />
                </label>
              </Formular>
              <ol className="flex flex-col divide-y divide-line">
                {doku.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-muted text-xs">
                      <span className="font-medium text-foreground">{DOKU_ART[e.art]}</span>
                      <span>{formatDatum(datumIso(e.erstelltAm))}</span>
                      {e.diagnoseIcd10 && (
                        <span className="abzeichen bg-line/60 text-foreground">
                          {e.diagnoseIcd10}
                        </span>
                      )}
                      {e.geaendertAm && (
                        <span>geändert {formatDatum(datumIso(e.geaendertAm))}</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{e.inhalt}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="karte flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Termine</h2>
              <Link href={`/kalender?patient=${p.id}`} className="verweis text-sm">
                Termin vereinbaren
              </Link>
            </div>
            <TerminListe titel="Kommend" termine={kommend} />
            <TerminListe titel="Vergangen" termine={vergangen} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="karte flex flex-col gap-4">
            <h2 className="font-semibold">Honorarnote ausstellen</h2>
            {offen.length === 0 ? (
              <p className="text-muted text-sm">Keine offenen Sitzungen zum Abrechnen.</p>
            ) : (
              <Formular aktion={honorarnoteAusstellen} knopf="Honorarnote ausstellen">
                <input type="hidden" name="patientId" value={p.id} />
                <ul className="flex flex-col gap-2 text-sm">
                  {offen.map((t) => (
                    <li key={t.id}>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="terminIds"
                          value={t.id}
                          defaultChecked
                          className="size-4 accent-akzent"
                        />
                        <span className="tabular-nums">{formatDatum(datumIso(t.beginn))}</span>
                        <span className="flex-1 text-muted">{t.bezeichnung}</span>
                        <span className="tabular-nums">{euro(t.honorarCent)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </Formular>
            )}
            {noten.length > 0 && (
              <ul className="flex flex-col divide-y divide-line border-line border-t pt-2 text-sm">
                {noten.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 py-2">
                    <a
                      href={`/honorarnoten/${n.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="verweis tabular-nums"
                    >
                      {n.nummer}
                    </a>
                    <span className="flex-1 text-muted">{formatDatum(n.ausgestelltAm)}</span>
                    <span className="tabular-nums">{euro(n.summeCent)}</span>
                    <NotenStatus bezahlt={n.bezahltAm} storniert={n.storniertAm} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {darfAkte && (
            <section className="karte flex flex-col gap-4">
              <h2 className="font-semibold">Kostenzuschuss</h2>
              <Formular
                aktion={bestaetigungenSpeichern}
                knopf="Speichern"
                knopfKlasse="knopf-zweit"
              >
                <input type="hidden" name="id" value={p.id} />
                <Feld
                  name="aerztlicheBestaetigungAm"
                  label="Ärztliche Bestätigung vom"
                  typ="date"
                  wert={p.aerztlicheBestaetigungAm}
                />
                <Feld
                  name="bewilligungAm"
                  label="Bewilligung der Kasse vom"
                  typ="date"
                  wert={p.bewilligungAm}
                />
              </Formular>
            </section>
          )}

          <section className="karte flex flex-col gap-4">
            <h2 className="font-semibold">Aufgaben</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {aufgaben.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <AktionsKnopf
                    aktion={aufgabeErledigen}
                    felder={{ id: a.id, erledigt: "ja" }}
                    text="✓"
                  />
                  <span className="flex-1">{a.titel}</span>
                  {a.faelligAm && (
                    <span className="text-muted text-xs">{formatDatum(a.faelligAm)}</span>
                  )}
                </li>
              ))}
            </ul>
            <Formular
              aktion={aufgabeAnlegen}
              knopf="Hinzufügen"
              knopfKlasse="knopf-zweit"
              className="flex flex-col gap-2"
              zuruecksetzen
            >
              <input type="hidden" name="patientId" value={p.id} />
              <input name="titel" required placeholder="Neue Aufgabe …" className="eingabe" />
            </Formular>
          </section>
        </div>
      </div>
    </div>
  );
}

function TerminListe({
  titel,
  termine,
}: {
  titel: string;
  termine: { id: string; beginn: Date; status: string; sitzungsart: string }[];
}) {
  if (termine.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-muted text-xs uppercase tracking-wide">{titel}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {termine.slice(0, 8).map((t) => (
          <li key={t.id} className="flex items-center gap-3">
            <Link
              href={`/kalender?woche=${datumIso(t.beginn)}&termin=${t.id}`}
              className="verweis w-32 tabular-nums"
            >
              {formatDatum(datumIso(t.beginn))} {uhrzeit(t.beginn)}
            </Link>
            <span className="flex-1 text-muted">{t.sitzungsart}</span>
            <span className={`abzeichen ${TERMIN_STATUS[t.status]?.klasse}`}>
              {TERMIN_STATUS[t.status]?.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
