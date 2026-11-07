import type { Patient } from "@lumiva/api";
import { Auswahl, Feld } from "@/components/formular";
import { TRAEGER } from "@/lib/format";

export function StammdatenFelder({ p }: { p?: Patient }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld name="vorname" label="Vorname" pflicht wert={p?.vorname} autoComplete="off" />
        <Feld name="nachname" label="Nachname" pflicht wert={p?.nachname} autoComplete="off" />
        <Feld name="geburtsdatum" label="Geburtsdatum" typ="date" pflicht wert={p?.geburtsdatum} />
        <Auswahl
          name="versicherungstraeger"
          label="Versicherungsträger"
          pflicht
          wert={p?.versicherungstraeger ?? "oegk"}
          optionen={Object.entries(TRAEGER).map(([wert, text]) => ({ wert, text }))}
        />
      </div>
      <Feld
        name="svNummer"
        label="Sozialversicherungsnummer"
        wert={p?.svNummer}
        inputMode="numeric"
        placeholder="1234 010180"
        hinweis="10 Ziffern. Für den Kostenzuschuss nötig, bei Selbstzahler:innen optional."
      />
      <Feld
        name="anschrift"
        label="Anschrift"
        wert={p?.kontakt.anschrift}
        placeholder="Straße 1, 1010 Wien"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld name="telefon" label="Telefon" typ="tel" wert={p?.kontakt.telefon} />
        <Feld name="email" label="E-Mail" typ="email" wert={p?.kontakt.email} />
      </div>
    </>
  );
}
