import { tageAddieren, wienDatum, wienZuDate, wochenBeginn } from "@lumiva/domain";
import Link from "next/link";
import { AktionsKnopf, Auswahl, Feld, Formular } from "@/components/formular";
import { datumIso, euro, formatDatum, TERMIN_STATUS, uhrzeit } from "@/lib/format";
import { terminAnlegen, terminLoeschen, terminStatus, terminVerschieben } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

const START = 7;
const ENDE = 21;
const PX_PRO_STUNDE = 56;
const STUNDEN = Array.from({ length: ENDE - START }, (_, i) => START + i);
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function Kalender({ searchParams }: PageProps<"/kalender">) {
  const q = await searchParams;
  const heute = wienDatum(new Date());
  const woche = wochenBeginn(
    typeof q.woche === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.woche) ? q.woche : heute,
  );
  const lumiva = await praxisApi();
  const [termine, patienten, arten] = await Promise.all([
    lumiva.termine.zeitraum({
      von: wienZuDate(woche, "00:00"),
      bis: wienZuDate(tageAddieren(woche, 7), "00:00"),
    }),
    lumiva.patienten.liste(),
    lumiva.praxis.sitzungsarten(),
  ]);
  const gewaehlt =
    typeof q.termin === "string" ? termine.find((t) => t.id === q.termin) : undefined;
  const vorPatient = typeof q.patient === "string" ? q.patient : undefined;
  const tage = Array.from({ length: 7 }, (_, i) => tageAddieren(woche, i));
  const link = (w: string, extra = "") => `/kalender?woche=${w}${extra}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-3xl tracking-tight">Kalender</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={link(tageAddieren(woche, -7))}
            className="knopf-zweit"
            aria-label="Vorige Woche"
          >
            ←
          </Link>
          <Link href={link(heute)} className="knopf-zweit">
            Heute
          </Link>
          <Link
            href={link(tageAddieren(woche, 7))}
            className="knopf-zweit"
            aria-label="Nächste Woche"
          >
            →
          </Link>
          <span className="ml-2 font-medium tabular-nums">
            {formatDatum(woche)} – {formatDatum(tageAddieren(woche, 6))}
          </span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="karte overflow-x-auto p-0">
          <div className="grid min-w-[760px] grid-cols-[48px_repeat(7,1fr)]">
            <div className="border-line border-b" />
            {tage.map((t, i) => (
              <div
                key={t}
                className={`border-line border-b border-l px-2 py-2 text-center text-sm ${t === heute ? "bg-akzent/10 font-semibold" : ""}`}
              >
                {TAGE[i]}{" "}
                <span className="text-muted tabular-nums">
                  {t.slice(8, 10)}.{t.slice(5, 7)}.
                </span>
              </div>
            ))}
            <div className="relative" style={{ height: (ENDE - START) * PX_PRO_STUNDE }}>
              {STUNDEN.map((stunde) => (
                <span
                  key={stunde}
                  className="absolute right-2 text-muted text-xs tabular-nums"
                  style={{ top: (stunde - START) * PX_PRO_STUNDE - 6 }}
                >
                  {stunde}
                </span>
              ))}
            </div>
            {tage.map((tag) => (
              <div
                key={tag}
                className="relative border-line border-l"
                style={{ height: (ENDE - START) * PX_PRO_STUNDE }}
              >
                {STUNDEN.map((stunde) => (
                  <div
                    key={stunde}
                    className="absolute inset-x-0 border-line/60 border-t"
                    style={{ top: (stunde - START) * PX_PRO_STUNDE }}
                  />
                ))}
                {termine
                  .filter((t) => datumIso(t.beginn) === tag)
                  .map((t) => {
                    const [h, m] = uhrzeit(t.beginn).split(":").map(Number) as [number, number];
                    const dauer = (t.ende.getTime() - t.beginn.getTime()) / 60_000;
                    const top = Math.max(0, (h - START + m / 60) * PX_PRO_STUNDE);
                    return (
                      <Link
                        key={t.id}
                        href={link(woche, `&termin=${t.id}`)}
                        className={`absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-xs leading-tight shadow-sm ring-1 ring-black/5 ${TERMIN_STATUS[t.status]?.klasse} ${gewaehlt?.id === t.id ? "ring-2 ring-akzent" : ""} ${t.status === "abgesagt" ? "line-through opacity-60" : ""}`}
                        style={{ top, height: Math.max(22, (dauer / 60) * PX_PRO_STUNDE - 2) }}
                      >
                        <span className="font-semibold tabular-nums">{uhrzeit(t.beginn)}</span>{" "}
                        {t.patientName}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          {gewaehlt && (
            <section className="karte flex flex-col gap-3">
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
                <Link href={link(woche)} className="text-muted" aria-label="Schließen">
                  ✕
                </Link>
              </div>
              <span className={`abzeichen self-start ${TERMIN_STATUS[gewaehlt.status]?.klasse}`}>
                {TERMIN_STATUS[gewaehlt.status]?.text}
              </span>
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

          <section className="karte flex flex-col gap-3">
            <h2 className="font-semibold">Neuer Termin</h2>
            {patienten.length === 0 ? (
              <p className="text-muted text-sm">
                Lege zuerst eine{" "}
                <Link href="/patienten/neu" className="verweis">
                  Patient:in
                </Link>{" "}
                an.
              </p>
            ) : (
              <Formular
                aktion={terminAnlegen}
                knopf="Termin anlegen"
                className="flex flex-col gap-3"
              >
                <Auswahl
                  name="patientId"
                  label="Patient:in"
                  pflicht
                  wert={vorPatient}
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
                  <Feld
                    name="datum"
                    label="Datum"
                    typ="date"
                    pflicht
                    wert={tage.includes(heute) ? heute : woche}
                  />
                  <Feld name="uhrzeit" label="Uhrzeit" typ="time" pflicht wert="09:00" step={300} />
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
        </aside>
      </div>
    </div>
  );
}
