"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { dokuBearbeiten } from "@/server/aktionen";

/** Text eines Doku-Eintrags mit Bleistift zum Bearbeiten (Zusammenfassung oder Transkript). */
export function DokuText({
  id,
  feld,
  text,
  bearbeitbar,
}: {
  id: string;
  feld: "inhalt" | "transkript";
  text: string;
  bearbeitbar: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const [ergebnis, ausfuehren, laeuft] = useActionState(dokuBearbeiten, null);
  useEffect(() => {
    if (ergebnis?.ok) setOffen(false);
  }, [ergebnis]);
  const name = feld === "transkript" ? "Transkript" : "Zusammenfassung";

  if (!offen)
    return (
      <div className="group flex items-start gap-2">
        <p className="flex-1 whitespace-pre-wrap text-sm">{text}</p>
        {bearbeitbar && (
          <button
            type="button"
            onClick={() => setOffen(true)}
            title={`${name} bearbeiten`}
            aria-label={`${name} bearbeiten`}
            className="rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-foreground"
          >
            <Bleistift />
          </button>
        )}
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const daten = new FormData(e.currentTarget);
        startTransition(() => ausfuehren(daten));
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="feld" value={feld} />
      <textarea
        name="text"
        aria-label={name}
        defaultValue={text}
        required={feld === "inhalt"}
        rows={Math.min(16, Math.max(4, text.split("\n").length + 1))}
        className="eingabe text-sm"
        // biome-ignore lint/a11y/noAutofocus: Fokus folgt dem Klick auf den Bleistift.
        autoFocus
      />
      {ergebnis?.fehler && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
        >
          {ergebnis.fehler}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="knopf" disabled={laeuft}>
          {laeuft ? "Einen Moment …" : "Speichern"}
        </button>
        <button
          type="button"
          className="knopf-zweit"
          onClick={() => setOffen(false)}
          disabled={laeuft}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Bleistift() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
