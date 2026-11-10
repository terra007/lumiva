import { tageAddieren, wienDatum, wienZuDate, wochenBeginn } from "@lumiva/domain";
import Link from "next/link";
import { AktionsKnopf, Auswahl, Feld, Formular } from "@/components/formular";
import { BezahltAbzeichen } from "@/components/noten-status";
import { Seitenkopf } from "@/components/seitenkopf";
import { KassierenKnopf } from "@/components/sumup-zahlung";
import { Zeichen } from "@/components/zeichen";
import { datumIso, euro, formatDatum, TERMIN_STATUS, uhrzeit } from "@/lib/format";
import { terminAnlegen, terminLoeschen, terminStatus, terminVerschieben } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";
import {
  ABWESEND_KLASSE,
  AbwesenheitenKarte,
  abwesenheitText,
  FEIERTAG_KLASSE,
} from "./abwesenheiten";

const START = 7;
const ENDE = 21;
const PX_PRO_STUNDE = 60;
const STUNDEN = Array.from({ length: ENDE - START }, (_, i) => START + i);
const HALBSTUNDEN = STUNDEN.flatMap((h) => {
  const hh = String(h).padStart(2, "0");
  return [`${hh}:00`, `${hh}:30`];
});
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function Kalender({ searchParams }: PageProps<"/kalender">) {
  const q = await searchParams;
  const heute = wienDatum(new Date());
  const woche = wochenBeginn(
    typeof q.woche === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.woche) ? q.woche : heute,
  );
  const lumiva = await praxisApi();
  const [termine, patienten, arten, sumup, frei, kommende] = await Promise.all([
    lumiva.termine.zeitraum({
      von: wienZuDate(woche, "00:00"),
      bis: wienZuDate(tageAddieren(woche, 7), "00:00"),
    }),
    lumiva.patienten.liste(),
    lumiva.praxis.sitzungsarten(),
    lumiva.zahlungen.verfuegbar(),
    lumiva.abwesenheiten.zeitraum({ von: woche, bis: tageAddieren(woche, 6) }),
    lumiva.abwesenheiten.zeitraum({ von: heute, bis: tageAddieren(heute, 365) }),
  ]);
  const gewaehlt =
    typeof q.termin === "string" ? termine.find((t) => t.id === q.termin) : undefined;
  const vorPatient = typeof q.patient === "string" ? q.patient : undefined;
  // Klick auf eine freie Stelle im Raster belegt „Neuer Termin“ mit Tag und Uhrzeit vor.
  const vorDatum =
    typeof q.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : undefined;
  const vorUhrzeit =
    typeof q.uhrzeit === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(q.uhrzeit)
      ? q.uhrzeit
      : undefined;
  const tage = Array.from({ length: 7 }, (_, i) => tageAddieren(woche, i));
  const link = (w: string, extra = "") => `/kalender?woche=${w}${extra}`;
  // Vorschläge für „Neuer Termin“; ändert sich einer, wird das Formular neu aufgebaut.
  const vorschlag = {
    patient: vorPatient,
    datum: vorDatum ?? (tage.includes(heute) ? heute : woche),
    uhrzeit: vorUhrzeit ?? "09:00",
  };
  const patientParam = vorPatient ? `&patient=${encodeURIComponent(vorPatient)}` : "";
  const feiertag = (tag: string) => frei.feiertage.find((f) => f.datum === tag);
  const abwesend = (tag: string) => frei.abwesenheiten.filter((a) => a.von <= tag && a.bis >= tag);
  /** Hintergrund der Tagesspalte: Feiertag vor eigener Abwesenheit. */
  const tagKlasse = (tag: string) =>
    feiertag(tag)
      ? FEIERTAG_KLASSE
      : abwesend(tag).some((a) => a.eigene)
        ? ABWESEND_KLASSE
        : tag === heute
          ? "bg-akzent/[0.04]"
          : "";
  // Rote Linie für „jetzt“ in der heutigen Spalte, wenn die Uhrzeit im Raster liegt.
  const [jetztH, jetztM] = uhrzeit(new Date()).split(":").map(Number) as [number, number];
  const jetztTop =
    jetztH >= START && jetztH < ENDE ? (jetztH - START + jetztM / 60) * PX_PRO_STUNDE : null;
  const monat = new Intl.DateTimeFormat("de-AT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${tageAddieren(woche, 3)}T12:00:00Z`));

  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf
        titel="Kalender"
        untertitel={
          <span className="tabular-nums">
            {monat} · {formatDatum(woche)} – {formatDatum(tageAddieren(woche, 6))}
          </span>
        }
      >
        <Link
          href={link(tageAddieren(woche, -7))}
          className="knopf-symbol"
          aria-label="Vorige Woche"
          title="Vorige Woche"
        >
          <Zeichen name="links" />
        </Link>
        <Link href={link(heute)} className="knopf-zweit">
          Heute
        </Link>
        <Link
          href={link(tageAddieren(woche, 7))}
          className="knopf-symbol"
          aria-label="Nächste Woche"
          title="Nächste Woche"
        >
          <Zeichen name="rechts" />
        </Link>
        <a href="#neuer-termin" className="knopf xl:hidden">
          <Zeichen name="plus" />
          Neuer Termin
        </a>
      </Seitenkopf>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="karte overflow-x-auto p-0">
          <div className="grid min-w-[640px] grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <div className="sticky top-0 border-line border-b" />
            {tage.map((t, i) => (
              <div
                key={t}
                className={`flex min-w-0 flex-col items-center gap-0.5 border-line border-b border-l px-1 py-2 text-center text-sm ${tagKlasse(t)}`}
              >
                <span className="text-muted text-xs uppercase tracking-wide">{TAGE[i]}</span>
                <span
                  className={`flex size-8 items-center justify-center rounded-full font-semibold tabular-nums ${t === heute ? "bg-foreground text-background" : ""}`}
                  aria-current={t === heute ? "date" : undefined}
                >
                  {Number(t.slice(8, 10))}
                </span>
                {feiertag(t) && (
                  <span className="block max-w-full truncate font-medium text-rose-700 text-xs dark:text-rose-300">
                    {feiertag(t)?.name}
                  </span>
                )}
                {abwesend(t).map((a) => (
                  <span
                    key={a.id}
                    className="block max-w-full truncate font-normal text-amber-800 text-xs dark:text-amber-300"
                  >
                    {abwesenheitText(a)}
                  </span>
                ))}
              </div>
            ))}
            <div className="relative" style={{ height: (ENDE - START) * PX_PRO_STUNDE }}>
              {STUNDEN.slice(1).map((stunde) => (
                <span
                  key={stunde}
                  className="absolute right-2 text-[11px] text-muted tabular-nums"
                  style={{ top: (stunde - START) * PX_PRO_STUNDE - 7 }}
                >
                  {String(stunde).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {tage.map((tag) => (
              <div
                key={tag}
                className={`relative border-line border-l ${tagKlasse(tag)}`}
                style={{ height: (ENDE - START) * PX_PRO_STUNDE }}
              >
                {STUNDEN.map((stunde) => (
                  <div
                    key={stunde}
                    className="absolute inset-x-0 border-line/70 border-t"
                    style={{ top: (stunde - START) * PX_PRO_STUNDE }}
                  />
                ))}
                {tag === heute && jetztTop !== null && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500"
                    style={{ top: jetztTop }}
                  >
                    <span className="-left-1 -top-[3px] absolute size-2 rounded-full bg-red-500" />
                  </div>
                )}
                {/* Freie Halbstunden: Klick schlägt dort einen neuen Termin vor. Termine liegen darüber. */}
                {HALBSTUNDEN.map((zeit, i) => {
                  const aktiv = vorDatum === tag && vorUhrzeit === zeit;
                  return (
                    <Link
                      key={zeit}
                      href={link(
                        woche,
                        `&datum=${tag}&uhrzeit=${zeit}${patientParam}#neuer-termin`,
                      )}
                      prefetch={false}
                      tabIndex={-1}
                      aria-label={`Neuer Termin am ${formatDatum(tag)} um ${zeit}`}
                      className={`absolute inset-x-0 hover:bg-akzent/10 ${aktiv ? "bg-akzent/15 ring-1 ring-akzent ring-inset" : ""}`}
                      style={{ top: (i * PX_PRO_STUNDE) / 2, height: PX_PRO_STUNDE / 2 }}
                    />
                  );
                })}
                {termine
                  .filter((t) => datumIso(t.beginn) === tag)
                  .map((t) => {
                    const [h, m] = uhrzeit(t.beginn).split(":").map(Number) as [number, number];
                    const dauer = (t.ende.getTime() - t.beginn.getTime()) / 60_000;
                    const top = Math.max(0, (h - START + m / 60) * PX_PRO_STUNDE);
                    const hoehe = Math.max(22, (dauer / 60) * PX_PRO_STUNDE - 2);
                    return (
                      <Link
                        key={t.id}
                        href={link(woche, `&termin=${t.id}#termin`)}
                        title={`${uhrzeit(t.beginn)}–${uhrzeit(t.ende)} ${t.patientName} · ${t.sitzungsart}`}
                        className={`absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-lg border-current/20 border-l-[3px] px-1.5 py-1 text-xs leading-tight shadow-sm transition hover:z-20 hover:shadow-md ${TERMIN_STATUS[t.status]?.klasse} ${gewaehlt?.id === t.id ? "ring-2 ring-akzent" : ""} ${t.status === "abgesagt" ? "line-through opacity-60" : ""}`}
                        style={{ top, height: hoehe }}
                      >
                        <span className="font-semibold tabular-nums">{uhrzeit(t.beginn)}</span>{" "}
                        <span className={hoehe < 56 ? "truncate" : "line-clamp-2"}>
                          {t.patientName}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          {gewaehlt && (
            <section
              id="termin"
              className="karte flex scroll-mt-20 flex-col gap-3 ring-1 ring-akzent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/patienten/${gewaehlt.patientId}`} className="verweis font-semibold">
                    {gewaehlt.patientName}
                  </Link>
                  <p className="text-muted text-sm">
                    {formatDatum(datumIso(gewaehlt.beginn))}, {uhrzeit(gewaehlt.beginn)}–
                    {uhrzeit(gewaehlt.ende)} · {gewaehlt.sitzungsart} · {euro(gewaehlt.honorarCent)}
                  </p>
                </div>
                <Link
                  href={link(woche)}
                  className="knopf-symbol size-8 border-transparent"
                  aria-label="Schließen"
                >
                  <Zeichen name="schliessen" />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`abzeichen ${TERMIN_STATUS[gewaehlt.status]?.klasse}`}>
                  {TERMIN_STATUS[gewaehlt.status]?.text}
                </span>
                {gewaehlt.bezahltAm && <BezahltAbzeichen am={formatDatum(gewaehlt.bezahltAm)} />}
              </div>
              {sumup.terminal && gewaehlt.kassieren && (
                <KassierenKnopf terminId={gewaehlt.id} {...gewaehlt.kassieren} />
              )}
              {/* Bezahlte Sitzungen bleiben, wie sie sind; sonst stimmt die Zahlung nicht mehr. */}
              {!gewaehlt.bezahltAm && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(["erledigt", "abgesagt", "geplant"] as const)
                      .filter((s) => s !== gewaehlt.status)
                      .map((s) => (
                        <AktionsKnopf
                          key={s}
                          aktion={terminStatus}
                          felder={{ id: gewaehlt.id, status: s }}
                          text={TERMIN_STATUS[s]?.text ?? s}
                        />
                      ))}
                  </div>
                  {gewaehlt.status !== "nicht_erschienen" && (
                    <Formular
                      aktion={terminStatus}
                      knopf="Nicht erschienen"
                      knopfKlasse="knopf-zweit"
                      className="flex items-end gap-2"
                    >
                      <input type="hidden" name="id" value={gewaehlt.id} />
                      <input type="hidden" name="status" value="nicht_erschienen" />
                      <label className="etikett flex-1 text-xs">
                        Ausfallhonorar (€, optional)
                        <input
                          name="ausfallhonorar"
                          inputMode="decimal"
                          className="eingabe"
                          placeholder="0"
                        />
                      </label>
                    </Formular>
                  )}
                </>
              )}
              {gewaehlt.status === "geplant" && (
                <>
                  <Formular
                    aktion={terminVerschieben}
                    knopf="Verschieben"
                    knopfKlasse="knopf-zweit"
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={gewaehlt.id} />
                    <input
                      name="datum"
                      type="date"
                      defaultValue={datumIso(gewaehlt.beginn)}
                      className="eingabe w-auto"
                      required
                    />
                    <input
                      name="uhrzeit"
                      type="time"
                      defaultValue={uhrzeit(gewaehlt.beginn)}
                      step={300}
                      className="eingabe w-auto"
                      required
                    />
                  </Formular>
                  <div className="flex flex-wrap gap-2">
                    <AktionsKnopf
                      aktion={terminLoeschen}
                      felder={{ id: gewaehlt.id, zurueck: link(woche) }}
                      text="Löschen"
                      klasse="knopf-gefahr"
                      bestaetigen="Diesen Termin löschen?"
                    />
                    {gewaehlt.serieId && (
                      <AktionsKnopf
                        aktion={terminLoeschen}
                        felder={{ id: gewaehlt.id, serie: "ja", zurueck: link(woche) }}
                        text="Serie ab hier löschen"
                        klasse="knopf-gefahr"
                        bestaetigen="Diesen und alle folgenden geplanten Termine der Serie löschen?"
                      />
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          <section id="neuer-termin" className="karte flex scroll-mt-20 flex-col gap-3">
            <h2 className="karten-titel">Neuer Termin</h2>
            {patienten.length === 0 ? (
              <p className="text-muted text-sm">
                Lege zuerst einen{" "}
                <Link href="/patienten/neu" className="verweis">
                  Patienten
                </Link>{" "}
                an.
              </p>
            ) : (
              <Formular
                // Neuer Schlüssel bei anderem Vorschlag, sonst behalten die Felder den alten Wert.
                key={Object.values(vorschlag).join("|")}
                aktion={terminAnlegen}
                knopf="Termin anlegen"
                className="flex flex-col gap-3"
              >
                <Auswahl
                  name="patientId"
                  label="Patient"
                  pflicht
                  wert={vorschlag.patient}
                  optionen={patienten.map((p) => ({
                    wert: p.id,
                    text: `${p.nachname}, ${p.vorname}`,
                  }))}
                />
                <Auswahl
                  name="sitzungsartId"
                  label="Sitzungsart"
                  pflicht
                  wert={arten.find((a) => a.name === "Einzelsitzung")?.id}
                  optionen={arten
                    .filter((a) => a.aktiv)
                    .map((a) => ({
                      wert: a.id,
                      text: `${a.name} (${a.dauerMinuten} Min., ${euro(a.honorarCent)})`,
                    }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Feld name="datum" label="Datum" typ="date" pflicht wert={vorschlag.datum} />
                  <Feld
                    name="uhrzeit"
                    label="Uhrzeit"
                    typ="time"
                    pflicht
                    wert={vorschlag.uhrzeit}
                    step={300}
                  />
                </div>
                <Auswahl
                  name="anzahl"
                  label="Wiederholen"
                  wert="1"
                  optionen={[
                    { wert: "1", text: "Einmalig" },
                    ...[4, 8, 10, 12, 20].map((n) => ({
                      wert: String(n),
                      text: `Wöchentlich, ${n} Termine`,
                    })),
                  ]}
                />
              </Formular>
            )}
          </section>

          <AbwesenheitenKarte
            kommende={kommende.abwesenheiten}
            vorschlag={tage.includes(heute) ? heute : woche}
          />
        </aside>
      </div>
    </div>
  );
}
