import { AktionsKnopf, AnschriftFelder, Feld, Formular } from "@/components/formular";
import { Seitenkopf } from "@/components/seitenkopf";
import {
  praxisSpeichern,
  sitzungsartSpeichern,
  sumupDemo,
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
      <Seitenkopf
        titel="Einstellungen"
        untertitel={inhaber ? undefined : "Nur der Inhaber ändert die Einstellungen der Praxis."}
      />
      <section className="karte flex flex-col gap-4">
        <h2 className="karten-titel">Praxis</h2>
        <p className="text-muted text-sm">
          Diese Angaben stehen auf neuen Honorarnoten. Bereits ausgestellte bleiben unverändert.
        </p>
        <Formular aktion={praxisSpeichern} knopf="Speichern">
          <fieldset disabled={!inhaber} className="flex flex-col gap-4">
            <Feld name="name" label="Name der Praxis" pflicht wert={e.name} />
            <AnschriftFelder pflicht wert={e} />
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
        <h2 className="karten-titel">Sitzungsarten und Honorare</h2>
        {!inhaber && <p className="text-muted text-sm">Nur der Inhaber ändert Honorare.</p>}
        <fieldset disabled={!inhaber} className="flex flex-col gap-4">
          {/* Spaltenköpfe einmal oben statt in jeder Zeile; die Felder tragen eigene Namen. */}
          <div className="hidden grid-cols-[1fr_6rem_7rem_6rem_6.5rem] gap-2 border-line border-b pb-2 font-medium text-muted text-xs uppercase tracking-wide sm:grid">
            <span>Name</span>
            <span>Minuten</span>
            <span>Honorar €</span>
            <span>Aktiv</span>
            <span />
          </div>
          <ul className="-mt-2 flex flex-col divide-y divide-line">
            {arten.map((a) => (
              <li key={a.id} className="py-2">
                <Formular
                  aktion={sitzungsartSpeichern}
                  knopf="Speichern"
                  knopfKlasse="knopf-zweit w-full"
                  className="grid grid-cols-3 items-start gap-2 sm:grid-cols-[1fr_6rem_7rem_6rem_6.5rem] [&>div]:col-span-3 [&>p]:col-span-full sm:[&>div]:col-span-1"
                >
                  <input type="hidden" name="id" value={a.id} />
                  <input
                    name="name"
                    aria-label="Name der Sitzungsart"
                    defaultValue={a.name}
                    className={`eingabe col-span-3 sm:col-span-1 ${a.aktiv ? "" : "text-muted"}`}
                    required
                  />
                  <input
                    name="dauerMinuten"
                    aria-label={`Minuten für ${a.name}`}
                    type="number"
                    min={10}
                    max={240}
                    defaultValue={a.dauerMinuten}
                    className="eingabe tabular-nums"
                    required
                  />
                  <input
                    name="honorar"
                    aria-label={`Honorar in Euro für ${a.name}`}
                    inputMode="decimal"
                    defaultValue={(a.honorarCent / 100).toFixed(2).replace(".", ",")}
                    className="eingabe tabular-nums"
                    required
                  />
                  <select
                    name="aktiv"
                    aria-label={`${a.name} aktiv`}
                    defaultValue={a.aktiv ? "ja" : "nein"}
                    className="eingabe"
                  >
                    <option value="ja">Aktiv</option>
                    <option value="nein">Inaktiv</option>
                  </select>
                </Formular>
              </li>
            ))}
          </ul>
          <Formular
            aktion={sitzungsartSpeichern}
            knopf="Hinzufügen"
            knopfKlasse="knopf-zweit w-full"
            className="grid grid-cols-2 items-end gap-2 rounded-xl bg-leiste p-3 sm:grid-cols-[1fr_6rem_7rem_6.5rem] [&>div]:col-span-2 [&>p]:col-span-full sm:[&>div]:col-span-1"
            zuruecksetzen
          >
            <label className="etikett col-span-2 sm:col-span-1">
              Neue Sitzungsart
              <input name="name" className="eingabe" required placeholder="z. B. Gruppensitzung" />
            </label>
            <label className="etikett">
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
            <label className="etikett">
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
          <h2 className="karten-titel">Kartenzahlung mit SumUp</h2>
          <p className="text-muted text-sm">
            Patienten zahlen am SumUp-Terminal oder über den QR-Code auf der Honorarnote. An SumUp
            gehen nur Betrag und Nummer der Honorarnote. Händlercode und API-Schlüssel findest du im
            SumUp-Dashboard unter Einstellungen → Entwickler. Zum Testen eignet sich ein
            Sandbox-Konto.
          </p>
          {sumup.demo && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900 text-sm dark:bg-amber-950 dark:text-amber-200">
              Demo-Modus: Terminal und QR-Zahlung werden nur simuliert, es fließt kein Geld. Für
              echte Zahlungen unten die Daten deines SumUp-Kontos eintragen.
            </p>
          )}
          {!sumup.demo && sumup.demoErlaubt && (
            <div className="flex flex-wrap items-center gap-3">
              <AktionsKnopf aktion={sumupDemo} felder={{}} text="Demo ohne SumUp-Konto" />
              <span className="text-muted text-sm">
                Zum Vorführen: simuliert Terminal und QR-Zahlung.
              </span>
            </div>
          )}
          <Formular aktion={sumupSpeichern} knopf="Speichern">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld
                name="haendlerCode"
                label="Händlercode"
                pflicht
                wert={sumup.demo ? "" : sumup.haendlerCode}
              />
              <Feld
                name="apiSchluessel"
                label="API-Schlüssel"
                typ="password"
                autoComplete="off"
                pflicht={!sumup.apiSchluesselGesetzt || sumup.demo}
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
