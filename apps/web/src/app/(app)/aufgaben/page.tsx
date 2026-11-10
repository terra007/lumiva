import Link from "next/link";
import { AktionsKnopf, Formular } from "@/components/formular";
import { Seitenkopf } from "@/components/seitenkopf";
import { Zeichen } from "@/components/zeichen";
import { datumIso, formatDatum } from "@/lib/format";
import { aufgabeAnlegen, aufgabeErledigen, aufgabeLoeschen } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

/** Fälligkeit als kurzes Abzeichen: überfällig rot, heute gelb, sonst grau. */
function Faellig({ am, heute }: { am: string; heute: string }) {
  if (am < heute)
    return (
      <span className="abzeichen bg-red-100 text-red-800 tabular-nums dark:bg-red-950 dark:text-red-200">
        überfällig seit {formatDatum(am)}
      </span>
    );
  if (am === heute)
    return (
      <span className="abzeichen bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        heute fällig
      </span>
    );
  return <span className="text-muted text-xs tabular-nums">bis {formatDatum(am)}</span>;
}

export default async function Aufgaben() {
  const lumiva = await praxisApi();
  const [offen, erledigt] = await Promise.all([
    lumiva.aufgaben.liste(),
    lumiva.aufgaben.liste({ erledigt: true }),
  ]);
  const heute = datumIso(new Date());
  const ueberfaellig = offen.filter((a) => a.faelligAm && a.faelligAm < heute).length;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Seitenkopf
        titel="Aufgaben"
        untertitel={
          offen.length === 0
            ? "Alles erledigt."
            : `${offen.length} offen${ueberfaellig > 0 ? `, davon ${ueberfaellig} überfällig` : ""}`
        }
      />
      <section className="karte">
        <Formular
          aktion={aufgabeAnlegen}
          knopf="Hinzufügen"
          className="flex flex-wrap items-end gap-3"
          zuruecksetzen
        >
          <label className="etikett min-w-60 flex-1">
            Neue Aufgabe
            <input
              name="titel"
              required
              className="eingabe"
              placeholder="z. B. Befund an Hausarzt schicken"
            />
          </label>
          <label className="etikett">
            Fällig am
            <input name="faelligAm" type="date" className="eingabe" />
          </label>
        </Formular>
      </section>
      <section className="karte flex flex-col gap-2">
        <h2 className="karten-titel">
          Offen <span className="font-normal text-muted">({offen.length})</span>
        </h2>
        {offen.length === 0 && (
          <div className="leer">
            <Zeichen name="haken" className="size-6 text-emerald-600" />
            Nichts offen. Schön.
          </div>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {offen.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 py-2.5 text-sm">
              <AktionsKnopf
                aktion={aufgabeErledigen}
                felder={{ id: a.id, erledigt: "ja" }}
                text={
                  <Zeichen name="haken" className="size-3.5 opacity-0 group-hover:opacity-60" />
                }
                titel="Als erledigt markieren"
                klasse="flex size-6 items-center justify-center rounded-full border-2 border-line transition hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0">
                  {a.titel}
                  {a.patientName && (
                    <Link
                      href={`/patienten/${a.patientId}`}
                      className="verweis ml-2 text-muted text-xs"
                    >
                      {a.patientName}
                    </Link>
                  )}
                </span>
                {a.faelligAm && (
                  <span className="sm:ml-auto">
                    <Faellig am={a.faelligAm} heute={heute} />
                  </span>
                )}
              </span>
              <AktionsKnopf
                aktion={aufgabeLoeschen}
                felder={{ id: a.id }}
                text="Löschen"
                klasse="rounded-md px-1.5 py-1 text-muted text-xs transition hover:bg-line/50 hover:text-foreground"
              />
            </li>
          ))}
        </ul>
      </section>
      {erledigt.length > 0 && (
        <section className="karte flex flex-col gap-2">
          <h2 className="karten-titel text-muted">Erledigt</h2>
          <ul className="flex flex-col divide-y divide-line">
            {erledigt.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-muted text-sm">
                <AktionsKnopf
                  aktion={aufgabeErledigen}
                  felder={{ id: a.id, erledigt: "nein" }}
                  text={<Zeichen name="haken" className="size-3.5" />}
                  titel="Wieder öffnen"
                  klasse="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
                />
                <span className="flex-1 line-through">{a.titel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
