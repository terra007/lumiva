import Link from "next/link";
import { AktionsKnopf, Formular } from "@/components/formular";
import { datumIso, formatDatum } from "@/lib/format";
import { aufgabeAnlegen, aufgabeErledigen, aufgabeLoeschen } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Aufgaben() {
  const lumiva = await praxisApi();
  const [offen, erledigt] = await Promise.all([
    lumiva.aufgaben.liste(),
    lumiva.aufgaben.liste({ erledigt: true }),
  ]);
  const heute = datumIso(new Date());
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-semibold text-3xl tracking-tight">Aufgaben</h1>
      <section className="karte">
        <Formular
          aktion={aufgabeAnlegen}
          knopf="Hinzufügen"
          className="flex flex-wrap items-end gap-2"
          zuruecksetzen
        >
          <label className="etikett min-w-60 flex-1">
            Neue Aufgabe
            <input
              name="titel"
              required
              className="eingabe"
              placeholder="z. B. Befund an Hausärztin schicken"
            />
          </label>
          <label className="etikett">
            Fällig am
            <input name="faelligAm" type="date" className="eingabe" />
          </label>
        </Formular>
      </section>
      <section className="karte flex flex-col gap-2">
        <h2 className="font-semibold">Offen ({offen.length})</h2>
        {offen.length === 0 && <p className="text-muted text-sm">Nichts offen. Schön.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {offen.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <AktionsKnopf
                aktion={aufgabeErledigen}
                felder={{ id: a.id, erledigt: "ja" }}
                text="✓"
              />
              <span className="flex-1">
                {a.titel}
                {a.patientName && (
                  <Link href={`/patienten/${a.patientId}`} className="verweis ml-2 text-muted">
                    {a.patientName}
                  </Link>
                )}
              </span>
              {a.faelligAm && (
                <span
                  className={`text-xs tabular-nums ${a.faelligAm < heute ? "font-semibold text-red-700 dark:text-red-300" : "text-muted"}`}
                >
                  {formatDatum(a.faelligAm)}
                </span>
              )}
              <AktionsKnopf
                aktion={aufgabeLoeschen}
                felder={{ id: a.id }}
                text="Löschen"
                klasse="text-muted text-xs hover:underline"
              />
            </li>
          ))}
        </ul>
      </section>
      {erledigt.length > 0 && (
        <section className="karte flex flex-col gap-2">
          <h2 className="font-semibold text-muted">Erledigt</h2>
          <ul className="flex flex-col divide-y divide-line">
            {erledigt.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-muted text-sm">
                <AktionsKnopf
                  aktion={aufgabeErledigen}
                  felder={{ id: a.id, erledigt: "nein" }}
                  text="↺"
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
