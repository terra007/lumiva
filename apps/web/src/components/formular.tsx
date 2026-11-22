"use client";
import { type ReactNode, startTransition, useActionState, useEffect, useRef } from "react";
import type { Ergebnis } from "@/server/aktionen";

type Aktion = (vorher: Ergebnis, daten: FormData) => Promise<Ergebnis>;

/** Formular für eine Server-Aktion: zeigt Fehler, sperrt den Knopf während des Speicherns. */
export function Formular({
  aktion,
  children,
  knopf,
  knopfKlasse = "knopf",
  className = "flex flex-col gap-4",
  zuruecksetzen = false,
}: {
  aktion: Aktion;
  children?: ReactNode;
  knopf: string;
  knopfKlasse?: string;
  className?: string;
  /** Felder nach Erfolg leeren, z. B. bei „Aufgabe hinzufügen“. */
  zuruecksetzen?: boolean;
}) {
  const [ergebnis, ausfuehren, laeuft] = useActionState(aktion, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (zuruecksetzen && ergebnis?.ok) ref.current?.reset();
  }, [ergebnis, zuruecksetzen]);
  return (
    <form
      ref={ref}
      // Nicht über action={…}: React leert sonst nach jedem Absenden das Formular,
      // auch bei einem Fehler, und alle Eingaben wären weg.
      onSubmit={(e) => {
        e.preventDefault();
        const daten = new FormData(e.currentTarget);
        startTransition(() => ausfuehren(daten));
      }}
      className={className}
    >
      {children}
      <FehlerMeldung text={ergebnis?.fehler} />
      <div>
        <button type="submit" className={knopfKlasse} disabled={laeuft}>
          {laeuft ? "Einen Moment …" : knopf}
        </button>
      </div>
    </form>
  );
}

/** Rote Fehlermeldung unter einem Formular; ohne Text nichts. */
export function FehlerMeldung({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
    >
      {text}
    </p>
  );
}

export function Feld({
  name,
  label,
  typ = "text",
  wert,
  pflicht = false,
  hinweis,
  ...rest
}: {
  name: string;
  label: string;
  typ?: string;
  wert?: string | number | null;
  pflicht?: boolean;
  hinweis?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "defaultValue">) {
  return (
    <label className="etikett">
      <span>
        {label}
        {pflicht && <span className="text-akzent"> *</span>}
      </span>
      <input
        name={name}
        type={typ}
        defaultValue={wert ?? undefined}
        required={pflicht}
        className="eingabe"
        {...rest}
      />
      {hinweis && <span className="font-normal text-muted text-xs">{hinweis}</span>}
    </label>
  );
}

export function Auswahl({
  name,
  label,
  optionen,
  wert,
  pflicht = false,
}: {
  name: string;
  label: string;
  optionen: { wert: string; text: string }[];
  wert?: string | null;
  pflicht?: boolean;
}) {
  return (
    <label className="etikett">
      <span>
        {label}
        {pflicht && <span className="text-akzent"> *</span>}
      </span>
      <select name={name} defaultValue={wert ?? undefined} required={pflicht} className="eingabe">
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Ein einzelner Knopf, der eine Server-Aktion auslöst (z. B. „Erledigt“). */
export function AktionsKnopf({
  aktion,
  felder,
  text,
  klasse = "knopf-zweit",
  bestaetigen,
  titel,
}: {
  aktion: Aktion;
  felder: Record<string, string>;
  text: ReactNode;
  klasse?: string;
  bestaetigen?: string;
  /** Beschriftung für Knöpfe, die nur ein Symbol zeigen. */
  titel?: string;
}) {
  const [ergebnis, ausfuehren, laeuft] = useActionState(aktion, null);
  return (
    <form
      action={ausfuehren}
      onSubmit={(e) => {
        if (bestaetigen && !window.confirm(bestaetigen)) e.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      {Object.entries(felder).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={klasse} disabled={laeuft} title={titel} aria-label={titel}>
        {laeuft ? "…" : text}
      </button>
      {ergebnis?.fehler && (
        <span className="max-w-xs text-red-700 text-xs dark:text-red-300">{ergebnis.fehler}</span>
      )}
    </form>
  );
}

/** Straße mit Hausnummer, darunter PLZ und Ort nebeneinander. */
export function AnschriftFelder({
  wert,
  pflicht = false,
  autoComplete = true,
}: {
  wert?: { strasse: string; plz: string; ort: string };
  pflicht?: boolean;
  /** Bei Patientendaten aus, damit der Browser keine eigenen Adressen vorschlägt. */
  autoComplete?: boolean;
}) {
  return (
    <>
      <Feld
        name="strasse"
        label="Straße und Hausnummer"
        pflicht={pflicht}
        wert={wert?.strasse}
        placeholder="Musterstraße 1/3"
        autoComplete={autoComplete ? "street-address" : "off"}
      />
      <div className="grid grid-cols-[7rem_1fr] gap-4">
        <Feld
          name="plz"
          label="PLZ"
          pflicht={pflicht}
          wert={wert?.plz}
          inputMode="numeric"
          placeholder="1010"
          maxLength={10}
          autoComplete={autoComplete ? "postal-code" : "off"}
        />
        <Feld
          name="ort"
          label="Ort"
          pflicht={pflicht}
          wert={wert?.ort}
          placeholder="Wien"
          autoComplete={autoComplete ? "address-level2" : "off"}
        />
      </div>
    </>
  );
}
