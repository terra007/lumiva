import { AktionsKnopf, Feld, Formular } from "@/components/formular";
import {
  praxisSpeichern,
  sitzungsartSpeichern,
  sumupSpeichern,
  sumupTrennen,
  terminalKoppeln,
} from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Einstellungen() {
  const lumiva = await praxisApi();
  const [e, arten] = await Promise.all([
    lumiva.praxis.einstellungen(),
    lumiva.praxis.sitzungsarten(),
  ]);
  const inhaber = e.rolle === "inhaber";
  const sumup = inhaber ? await lumiva.zahlungen.einstellungen() : null;
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
        {!inhaber && <p className="text-muted text-sm">Nur die Inhaber:in ändert Honorare.</p>}
        <fieldset disabled={!inhaber} className="flex flex-col gap-4">
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
        </fieldset>
      </section>
      {sumup && (
        <section className="karte flex flex-col gap-4">
          <h2 className="font-semibold">Kartenzahlung mit SumUp</h2>
          <p className="text-muted text-sm">
            Patient:innen zahlen am SumUp-Terminal oder über den QR-Code auf der Honorarnote. An
            SumUp gehen nur Betrag und Nummer der Honorarnote. Händlercode und API-Schlüssel findest
            du im SumUp-Dashboard unter Einstellungen → Entwickler. Zum Testen eignet sich ein
            Sandbox-Konto.
          </p>
          <Formular aktion={sumupSpeichern} knopf="Speichern">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld name="haendlerCode" label="Händlercode" pflicht wert={sumup.haendlerCode} />
              <Feld
                name="apiSchluessel"
                label="API-Schlüssel"
                typ="password"
                autoComplete="off"
                pflicht={!sumup.apiSchluesselGesetzt}
                hinweis={
                  sumup.apiSchluesselGesetzt
                    ? "Gespeichert. Leer lassen, um ihn zu behalten."
                    : undefined
                }
              />
            </div>
            <p className="text-muted text-sm">
              Nur für das Terminal (SumUp Solo): Affiliate-Key und App-ID aus dem SumUp-Dashboard.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld name="affiliateAppId" label="App-ID" wert={sumup.affiliateAppId} />
              <Feld
                name="affiliateSchluessel"
                label="Affiliate-Key"
                typ="password"
                autoComplete="off"
                hinweis={
                  sumup.affiliateSchluesselGesetzt
                    ? "Gespeichert. Leer lassen, um ihn zu behalten."
                    : undefined
                }
              />
            </div>
          </Formular>
          {sumup.apiSchluesselGesetzt && (
            <>
              <h3 className="font-medium">Terminal</h3>
              <p className="text-muted text-sm">
                {sumup.terminalName
                  ? `Gekoppelt: ${sumup.terminalName}. Mit einem neuen Code koppelst du ein anderes Terminal.`
                  : "Am Solo: Verbindungen → API → Verbinden. Den angezeigten Code hier eingeben."}
              </p>
              <Formular
                aktion={terminalKoppeln}
                knopf="Terminal koppeln"
                knopfKlasse="knopf-zweit"
                className="flex flex-wrap items-end gap-2"
                zuruecksetzen
              >
                <label className="etikett w-40">
                  Code
                  <input name="code" className="eingabe" required autoComplete="off" />
                </label>
                <label className="etikett min-w-40 flex-1">
                  Name
                  <input name="name" className="eingabe" placeholder="z. B. Empfang" />
                </label>
              </Formular>
              <div>
                <AktionsKnopf
                  aktion={sumupTrennen}
                  felder={{}}
                  text="SumUp trennen"
                  klasse="knopf-gefahr"
                  bestaetigen="SumUp trennen? Schlüssel und Terminal werden aus LUMIVA entfernt."
                />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
