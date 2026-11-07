"use client";
import { ICD10_FORMAT, ICD10_KATALOG } from "@lumiva/domain";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const TEXT = new Map(ICD10_KATALOG.map((e) => [e.code, e.text]));

/** Klein, ohne Bindestriche und doppelte Leerzeichen: „Burn-out“ und „Burnout“ gleich. */
function normal(text: string) {
  return text.toLowerCase().replace(/-/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Mehrfachauswahl für ICD-10-Diagnosen: suchen nach Code oder Text, auswählen, als Chips anzeigen.
 * Jeder gewählte Code geht als eigenes Feld „name“ mit dem Formular mit. Codes außerhalb des
 * Katalogs lassen sich eintragen, wenn sie dem ICD-10-Format entsprechen.
 */
export function Icd10Auswahl({ name, label }: { name: string; label: string }) {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [suche, setSuche] = useState("");
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(0);
  const wurzel = useRef<HTMLDivElement>(null);
  const listeId = useId();

  // Nach „Eintrag speichern“ setzt das Formular seine Felder zurück, die Auswahl mit.
  useEffect(() => {
    const form = wurzel.current?.closest("form");
    if (!form) return;
    const leeren = () => {
      setGewaehlt([]);
      setSuche("");
    };
    form.addEventListener("reset", leeren);
    return () => form.removeEventListener("reset", leeren);
  }, []);

  // Klick außerhalb schließt die Liste.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!wurzel.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);

  const treffer = useMemo(() => {
    const s = normal(suche);
    // Jedes Suchwort genügt mit seinen ersten sechs Buchstaben: „Depression“ findet so auch
    // „depressive Episode“, „Trauma“ die „posttraumatische Belastungsstörung“.
    const woerter = s
      .split(" ")
      .filter(Boolean)
      .map((w) => w.slice(0, 6));
    const liste = ICD10_KATALOG.filter(
      (e) =>
        !gewaehlt.includes(e.code) &&
        (woerter.length === 0 ||
          e.code.toLowerCase().startsWith(s) ||
          woerter.every((w) => normal(e.text).includes(w))),
    );
    // Eigener Code nur, wenn der Katalog dazu nichts hat, und nie vor den Treffern.
    const eigener = suche.trim().toUpperCase();
    if (
      ICD10_FORMAT.test(eigener) &&
      !gewaehlt.includes(eigener) &&
      !ICD10_KATALOG.some((e) => e.code.startsWith(eigener))
    ) {
      return [...liste, { code: eigener, text: "Code übernehmen" }].slice(0, 50);
    }
    return liste.slice(0, 50);
  }, [suche, gewaehlt]);

  function waehlen(code: string) {
    setGewaehlt((g) => (g.includes(code) ? g : [...g, code]));
    setSuche("");
    setMarkiert(0);
  }

  return (
    <div ref={wurzel} className="etikett relative">
      <span>{label}</span>
      <div className="eingabe flex min-h-11 flex-wrap items-center gap-1.5 py-1.5">
        {gewaehlt.map((code) => (
          <span
            key={code}
            className="abzeichen gap-1 bg-line/60 text-foreground"
            title={TEXT.get(code)}
          >
            <input type="hidden" name={name} value={code} />
            {code}
            <button
              type="button"
              className="text-muted hover:text-foreground"
              aria-label={`${code} entfernen`}
              onClick={() => setGewaehlt((g) => g.filter((c) => c !== code))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          role="combobox"
          aria-expanded={offen}
          aria-controls={listeId}
          aria-label={label}
          className="min-w-24 flex-1 bg-transparent font-normal outline-none"
          placeholder={gewaehlt.length ? "" : "F32 oder Begriff"}
          value={suche}
          onFocus={() => setOffen(true)}
          onChange={(e) => {
            setSuche(e.target.value);
            setMarkiert(0);
            setOffen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOffen(true);
              setMarkiert((m) => Math.min(m + 1, treffer.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMarkiert((m) => Math.max(m - 1, 0));
            } else if (e.key === "Enter") {
              // Enter wählt aus, statt das ganze Formular abzuschicken.
              if (offen && treffer[markiert]) {
                e.preventDefault();
                waehlen(treffer[markiert].code);
              }
            } else if (e.key === "Escape") {
              setOffen(false);
            } else if (e.key === "Backspace" && !suche && gewaehlt.length) {
              setGewaehlt((g) => g.slice(0, -1));
            }
          }}
        />
      </div>
      {offen && treffer.length > 0 && (
        <ul
          id={listeId}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-background p-1 font-normal shadow-lg"
        >
          {treffer.map((e, i) => (
            <li key={e.code}>
              <button
                type="button"
                tabIndex={-1}
                className={`flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${i === markiert ? "bg-line/60" : ""}`}
                onMouseEnter={() => setMarkiert(i)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => waehlen(e.code)}
              >
                <span className="w-14 shrink-0 font-medium">{e.code}</span>
                <span className="text-muted">{e.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
