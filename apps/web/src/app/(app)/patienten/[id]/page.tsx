import Link from "next/link";
import { DokuText } from "@/components/doku-text";
import { AktionsKnopf, Feld, Formular } from "@/components/formular";
import { Icd10Auswahl } from "@/components/icd10-auswahl";
import { KiAufnahme } from "@/components/ki-aufnahme";
import { BezahltAbzeichen, NotenStatus } from "@/components/noten-status";
import { Seitenkopf } from "@/components/seitenkopf";
import { KassierenKnopf, TerminalZahlung } from "@/components/sumup-zahlung";
import { Zeichen } from "@/components/zeichen";
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
  dokuLoeschen,
  dokuWiederherstellen,
  honorarnoteAusstellen,
  patientStatus,
} from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

const DOKU_ANSICHTEN = {
  zusammenfassungen: "Zusammenfassungen",
  transkripte: "Transkripte",
  papierkorb: "Papierkorb",
} as const;
type DokuAnsicht = keyof typeof DOKU_ANSICHTEN;

export default async function PatientAkte({ params, searchParams }: PageProps<"/patienten/[id]">) {
  const { id } = await params;
  const { doku: gewaehlteAnsicht } = await searchParams;
  const ansicht: DokuAnsicht =
    typeof gewaehlteAnsicht === "string" && gewaehlteAnsicht in DOKU_ANSICHTEN
      ? (gewaehlteAnsicht as DokuAnsicht)
      : "zusammenfassungen";
  const lumiva = await praxisApi();
  const ich = await lumiva.praxis.ich();
  const darfAkte = ich.praxis?.rolle !== "assistenz";
  const jetzt = new Date();
  const p = await lumiva.patienten.details({ id });
  const [termine, doku, offen, noten, aufgaben, kiVerfuegbar, sumup] = await Promise.all([
    lumiva.termine.zeitraum({
      von: new Date(jetzt.getTime() - 300 * 24 * 60 * 60_000),
      bis: new Date(jetzt.getTime() + 90 * 24 * 60 * 60_000),
      patientId: id,
    }),
    darfAkte ? lumiva.doku.liste({ patientId: id }) : Promise.resolve([]),
    lumiva.honorarnoten.offen({ patientId: id }),
    lumiva.honorarnoten.liste({ patientId: id }),
    lumiva.aufgaben.liste({ patientId: id }),
    darfAkte ? lumiva.ki.verfuegbar() : Promise.resolve(false),
    lumiva.zahlungen.verfuegbar(),
  ]);
  const vergangen = termine.filter((t) => t.beginn < jetzt).reverse();
  const aktiv = doku.filter((e) => !e.geloeschtAm);
  const anzahl: Record<DokuAnsicht, number> = {
    zusammenfassungen: aktiv.length,
    transkripte: aktiv.filter((e) => e.transkript).length,
    papierkorb: doku.length - aktiv.length,
  };
  const sichtbar =
    ansicht === "papierkorb"
      ? doku.filter((e) => e.geloeschtAm)
      : ansicht === "transkripte"
        ? aktiv.filter((e) => e.transkript)
        : aktiv;
  const kommend = termine.filter((t) => t.beginn >= jetzt);

  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf
        zurueck={{ href: "/patienten", text: "Patienten" }}
        titel={
          <span className="flex flex-wrap items-center gap-3">
            {p.vorname} {p.nachname}
            {p.status !== "aktiv" && (
              <span className="abzeichen bg-zinc-200 font-medium text-sm text-zinc-700 tracking-normal dark:bg-zinc-800 dark:text-zinc-300">
                {p.status === "pausiert"
                  ? "Pausiert"
                  : `Abgeschlossen am ${formatDatum(p.behandlungsende)}`}
              </span>
            )}
          </span>
        }
        untertitel={
          <>
            geb. {formatDatum(p.geburtsdatum)} · {TRAEGER[p.versicherungstraeger]}
            {p.svNummer && ` · SV ${p.svNummer}`} · {p.sitzungen}{" "}
            {p.sitzungen === 1 ? "Sitzung" : "Sitzungen"}
          </>
        }
      >
        {darfAkte && (
          <>
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
          </>
        )}
      </Seitenkopf>

      {p.hinweise.length > 0 && (
        <div className="hinweis-box" role="note">
          <Zeichen name="hinweis" className="mt-0.5 size-4" />
          <div className="flex flex-col gap-1">
            {p.hinweise.map((h) => (
              <span key={h.art}>{hinweisText(h)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {darfAkte && (
            <section className="karte flex flex-col gap-4">
              <h2 className="karten-titel">Dokumentation</h2>
              <Formular aktion={dokuAnlegen} knopf="Eintrag speichern" zuruecksetzen>
                <input type="hidden" name="patientId" value={p.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="etikett">
                    Art
                    <select
                      name="art"
                      className="eingabe"
                      defaultValue={aktiv.length === 0 ? "erstgespraech" : "verlauf"}
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
                  <Icd10Auswahl name="diagnoseIcd10" label="Diagnosen (ICD-10)" />
                </div>
                {kiVerfuegbar && (
                  <KiAufnahme
                    patientId={p.id}
                    sitzungErlaubt={p.kiAufnahmeEinwilligungAm !== null}
                  />
                )}
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
              <nav
                className="flex gap-1 overflow-x-auto border-line border-b"
                aria-label="Einträge"
              >
                {(Object.keys(DOKU_ANSICHTEN) as DokuAnsicht[]).map((a) => (
                  <Link
                    key={a}
                    href={`/patienten/${p.id}?doku=${a}`}
                    scroll={false}
                    aria-current={a === ansicht ? "page" : undefined}
                    className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm ${
                      a === ansicht
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {DOKU_ANSICHTEN[a]}
                    {anzahl[a] > 0 && <span className="ml-1.5 text-muted">{anzahl[a]}</span>}
                  </Link>
                ))}
              </nav>
              {ansicht === "papierkorb" && (
                <p className="text-muted text-xs">
                  Gelöschte Einträge bleiben wegen der Aufbewahrungspflicht (§ 18 PThG 2024)
                  erhalten und lassen sich wiederherstellen.
                </p>
              )}
              {sichtbar.length === 0 && (
                <p className="text-muted text-sm">
                  {ansicht === "transkripte"
                    ? "Noch keine Transkripte. Sie entstehen mit „Diktat aufnehmen“ oder „Sitzung aufnehmen“."
                    : ansicht === "papierkorb"
                      ? "Der Papierkorb ist leer."
                      : "Noch keine Einträge."}
                </p>
              )}
              <ol className="flex flex-col divide-y divide-line">
                {sichtbar.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-muted text-xs">
                      <span className="font-medium text-foreground">{DOKU_ART[e.art]}</span>
                      <span>{formatDatum(datumIso(e.erstelltAm))}</span>
                      {e.diagnoseIcd10?.split(", ").map((code) => (
                        <span key={code} className="abzeichen bg-line/60 text-foreground">
                          {code}
                        </span>
                      ))}
                      {e.geaendertAm && (
                        <span>geändert {formatDatum(datumIso(e.geaendertAm))}</span>
                      )}
                      {e.geloeschtAm && (
                        <span>gelöscht {formatDatum(datumIso(e.geloeschtAm))}</span>
                      )}
                      <span className="ml-auto">
                        {e.geloeschtAm ? (
                          <AktionsKnopf
                            aktion={dokuWiederherstellen}
                            felder={{ id: e.id }}
                            text="Wiederherstellen"
                            klasse="verweis text-xs"
                          />
                        ) : (
                          <AktionsKnopf
                            aktion={dokuLoeschen}
                            felder={{ id: e.id }}
                            text={<Papierkorb />}
                            titel="Eintrag löschen"
                            klasse="rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-red-700"
                            bestaetigen="Willst du diesen Eintrag wirklich löschen? Er kommt in den Papierkorb und lässt sich dort wiederherstellen."
                          />
                        )}
                      </span>
                    </div>
                    <DokuText
                      key={`${ansicht}-${e.id}`}
                      id={e.id}
                      feld={ansicht === "transkripte" ? "transkript" : "inhalt"}
                      text={(ansicht === "transkripte" ? e.transkript : e.inhalt) ?? ""}
                      bearbeitbar={!e.geloeschtAm}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="karte flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="karten-titel">Termine</h2>
              <Link href={`/kalender?patient=${p.id}`} className="verweis text-sm">
                Termin vereinbaren
              </Link>
            </div>
            <TerminListe titel="Kommend" termine={kommend} terminal={sumup.terminal} />
            <TerminListe titel="Vergangen" termine={vergangen} terminal={sumup.terminal} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="karte flex flex-col gap-4">
            <h2 className="karten-titel">Honorarnote ausstellen</h2>
            {offen.length === 0 ? (
              <p className="text-muted text-sm">Keine offenen Sitzungen zum Abrechnen.</p>
            ) : (
              <Formular aktion={honorarnoteAusstellen} knopf="Honorarnote ausstellen">
                <input type="hidden" name="patientId" value={p.id} />
                <ul className="flex flex-col gap-2 text-sm">
                  {offen.map((t) => (
                    <li key={t.id} className="flex items-center gap-3">
                      <label className="flex flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          name="terminIds"
                          value={t.id}
                          defaultChecked
                          className="size-4 accent-akzent"
                        />
                        <span className="tabular-nums">{formatDatum(datumIso(t.beginn))}</span>
                        <span className="flex-1 text-muted">{t.bezeichnung}</span>
                        {t.bezahltAm && <BezahltAbzeichen />}
                        <span className="tabular-nums">{euro(t.honorarCent)}</span>
                      </label>
                      {/* Jede Sitzung einzeln am Terminal; die Note rechnet es später an. */}
                      {sumup.terminal && !t.bezahltAm && (
                        <TerminalZahlung ziel={{ terminId: t.id }} />
                      )}
                    </li>
                  ))}
                </ul>
              </Formular>
            )}
            {/* Die ÖGK erstattet gegen die bezahlte Honorarnote, eine Note darf mehrere
                Sitzungen enthalten; ab der 11. Sitzung braucht es eine Bewilligung
                (https://oegk.at/psyche). */}
            <p className="text-muted text-xs">
              Am besten nach jeder Sitzung am Terminal kassieren und die Honorarnote gesammelt
              ausstellen, etwa einmal im Monat. Spätestens nach der 10. Sitzung, weil die Kasse ab
              der 11. eine Bewilligung verlangt. Mit Karte bezahlte Sitzungen stehen als bezahlt auf
              der Note, damit kann sie gleich zur Kasse.
            </p>
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
                    {n.offenCent > 0 && n.offenCent < n.summeCent && (
                      <span className="text-muted text-xs">offen {euro(n.offenCent)}</span>
                    )}
                    <NotenStatus bezahlt={n.bezahltAm} storniert={n.storniertAm} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {darfAkte && (
            <section className="karte flex flex-col gap-4">
              <h2 className="karten-titel">Kostenzuschuss und Einwilligung</h2>
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
                {kiVerfuegbar && (
                  <Feld
                    name="kiAufnahmeEinwilligungAm"
                    label="Einwilligung Sitzungsaufnahme vom"
                    typ="date"
                    wert={p.kiAufnahmeEinwilligungAm}
                    hinweis="Nur mit unterschriebener Einwilligung eintragen."
                  />
                )}
                {kiVerfuegbar && (
                  <a
                    href={`/druck/einwilligung/${p.id}`}
                    target="_blank"
                    rel="noopener"
                    className="verweis text-sm"
                  >
                    Einwilligung zum Unterschreiben drucken
                  </a>
                )}
              </Formular>
            </section>
          )}

          <section className="karte flex flex-col gap-4">
            <h2 className="karten-titel">Aufgaben</h2>
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
  terminal,
}: {
  titel: string;
  termine: {
    id: string;
    beginn: Date;
    status: string;
    sitzungsart: string;
    bezahltAm: string | null;
    kassieren: { betragCent: number; abschliessen: boolean } | null;
  }[];
  /** Ein SumUp-Terminal ist gekoppelt: Sitzungen gleich danach kassieren. */
  terminal: boolean;
}) {
  if (termine.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-muted text-xs uppercase tracking-wide">{titel}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {termine.slice(0, 8).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3">
            <Link
              href={`/kalender?woche=${datumIso(t.beginn)}&termin=${t.id}`}
              className="verweis w-32 tabular-nums"
            >
              {formatDatum(datumIso(t.beginn))} {uhrzeit(t.beginn)}
            </Link>
            <span className="flex-1 text-muted">{t.sitzungsart}</span>
            {t.bezahltAm && <BezahltAbzeichen />}
            {terminal && t.kassieren && <KassierenKnopf terminId={t.id} {...t.kassieren} />}
            <span className={`abzeichen ${TERMIN_STATUS[t.status]?.klasse}`}>
              {TERMIN_STATUS[t.status]?.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Papierkorb() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}
