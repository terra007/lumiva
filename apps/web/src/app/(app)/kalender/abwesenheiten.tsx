import { ABWESENHEIT_ARTEN, type AbwesenheitArt } from "@lumiva/domain";
import { AktionsKnopf, Auswahl, Feld, Formular } from "@/components/formular";
import { formatDatum } from "@/lib/format";
import { abwesenheitAnlegen, abwesenheitLoeschen } from "@/server/aktionen";

export type Abwesenheit = {
  id: string;
  von: string;
  bis: string;
  eigene: boolean;
  name: string;
  art: AbwesenheitArt;
  notiz: string | null;
};

/** Farben im Kalender: Feiertage rot, eigene Abwesenheit gelb, Kollegen grau. */
export const FEIERTAG_KLASSE = "bg-rose-50 dark:bg-rose-950/40";
export const ABWESEND_KLASSE = "bg-amber-50 dark:bg-amber-950/40";

/** Beschriftung im Tageskopf, z. B. „Urlaub“ oder „Abwesend: Dr. Huber“. */
export function abwesenheitText(a: Abwesenheit): string {
  return a.eigene ? ABWESENHEIT_ARTEN[a.art] : `Abwesend: ${a.name}`;
}

function zeitraumText(a: Pick<Abwesenheit, "von" | "bis">) {
  return a.von === a.bis ? formatDatum(a.von) : `${formatDatum(a.von)} – ${formatDatum(a.bis)}`;
}

/** Seitenleiste: eigenen Urlaub und andere Abwesenheiten eintragen und kommende sehen. */
export function AbwesenheitenKarte({
  kommende,
  vorschlag,
}: {
  kommende: Abwesenheit[];
  vorschlag: string;
}) {
  return (
    <section className="karte flex flex-col gap-3">
      <h2 className="font-semibold">Urlaub und Abwesenheit</h2>
      <Formular
        aktion={abwesenheitAnlegen}
        knopf="Eintragen"
        knopfKlasse="knopf-zweit"
        className="flex flex-col gap-3"
        zuruecksetzen
      >
        <div className="grid grid-cols-2 gap-3">
          <Feld name="von" label="Von" typ="date" pflicht wert={vorschlag} />
          <Feld name="bis" label="Bis" typ="date" hinweis="Leer lassen für einen Tag" />
        </div>
        <Auswahl
          name="art"
          label="Art"
          pflicht
          wert="urlaub"
          optionen={Object.entries(ABWESENHEIT_ARTEN).map(([wert, text]) => ({ wert, text }))}
        />
        <Feld name="notiz" label="Notiz (optional)" maxLength={200} />
      </Formular>
      {kommende.length > 0 && (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {kommende.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">
                  {a.eigene ? ABWESENHEIT_ARTEN[a.art] : a.name}
                  {a.notiz && <span className="text-muted"> · {a.notiz}</span>}
                </p>
                <p className="text-muted tabular-nums">{zeitraumText(a)}</p>
              </div>
              {a.eigene && (
                <AktionsKnopf
                  aktion={abwesenheitLoeschen}
                  felder={{ id: a.id }}
                  text="✕"
                  titel="Abwesenheit löschen"
                  bestaetigen="Diese Abwesenheit löschen?"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
