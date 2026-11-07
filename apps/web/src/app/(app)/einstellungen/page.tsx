import { Feld, Formular } from "@/components/formular";
import { praxisSpeichern, sitzungsartSpeichern } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Einstellungen() {
  const lumiva = await praxisApi();
  const [e, arten] = await Promise.all([
    lumiva.praxis.einstellungen(),
    lumiva.praxis.sitzungsarten(),
  ]);
  const inhaber = e.rolle === "inhaber";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-semibold text-3xl tracking-tight">Einstellungen</h1>
      <section className="karte flex flex-col gap-4">
        <h2 className="font-semibold">Praxis</h2>
        <p className="text-muted text-sm">
          Diese Angaben stehen auf neuen Honorarnoten. Bereits ausgestellte bleiben unverändert.
        </p>
        <Formular aktion={praxisSpeichern} knopf="Speichern">
          <fieldset disabled={!inhaber} className="flex flex-col gap-4">
            <Feld name="name" label="Name der Praxis" pflicht wert={e.name} />
            <Feld name="anschrift" label="Anschrift" pflicht wert={e.anschrift} />
            <Feld
              name="berufsbezeichnung"
              label="Deine Berufsbezeichnung"
              wert={e.berufsbezeichnung}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld name="telefon" label="Telefon" typ="tel" wert={e.telefon} />
              <Feld name="email" label="E-Mail" typ="email" wert={e.email} />
            </div>
            <Feld name="iban" label="IBAN" wert={e.iban} />
          </fieldset>
        </Formular>
      </section>
      <section className="karte flex flex-col gap-4">
        <h2 className="font-semibold">Sitzungsarten und Honorare</h2>
        <ul className="flex flex-col divide-y divide-line">
          {arten.map((a) => (
            <li key={a.id} className="py-3">
              <Formular
                aktion={sitzungsartSpeichern}
                knopf="Speichern"
                knopfKlasse="knopf-zweit"
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={a.id} />
                <label className="etikett min-w-40 flex-1">
                  Name
                  <input name="name" defaultValue={a.name} className="eingabe" required />
                </label>
                <label className="etikett w-28">
                  Minuten
                  <input
                    name="dauerMinuten"
                    type="number"
                    min={10}
                    max={240}
                    defaultValue={a.dauerMinuten}
                    className="eingabe"
                    required
                  />
                </label>
                <label className="etikett w-28">
                  Honorar €
                  <input
                    name="honorar"
                    inputMode="decimal"
                    defaultValue={(a.honorarCent / 100).toFixed(2)}
                    className="eingabe"
                    required
                  />
                </label>
                <label className="etikett w-28">
                  Aktiv
                  <select name="aktiv" defaultValue={a.aktiv ? "ja" : "nein"} className="eingabe">
                    <option value="ja">Ja</option>
                    <option value="nein">Nein</option>
                  </select>
                </label>
              </Formular>
            </li>
          ))}
        </ul>
        <Formular
          aktion={sitzungsartSpeichern}
          knopf="Neue Sitzungsart"
          knopfKlasse="knopf-zweit"
          className="flex flex-wrap items-end gap-2"
          zuruecksetzen
        >
          <label className="etikett min-w-40 flex-1">
            Name
            <input name="name" className="eingabe" required placeholder="z. B. Gruppensitzung" />
          </label>
          <label className="etikett w-28">
            Minuten
            <input
              name="dauerMinuten"
              type="number"
              min={10}
              max={240}
              defaultValue={50}
              className="eingabe"
              required
            />
          </label>
          <label className="etikett w-28">
            Honorar €
            <input
              name="honorar"
              inputMode="decimal"
              className="eingabe"
              required
              placeholder="90,00"
            />
          </label>
        </Formular>
      </section>
    </div>
  );
}
