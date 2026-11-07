"use client";
import { useEffect, useRef, useState } from "react";

type Zustand = "bereit" | "aufnahme" | "verarbeitung";

function mikrofonAus(stream: MediaStream) {
  for (const spur of stream.getTracks()) spur.stop();
}

function dauer(sekunden: number) {
  const m = Math.floor(sekunden / 60);
  return `${m}:${String(sekunden % 60).padStart(2, "0")}`;
}

/**
 * Aufnahme im Browser, Doku-Entwurf von der KI auf dem eigenen Server.
 * Der Entwurf landet im Feld „inhalt“ des umgebenden Formulars und wird erst mit
 * „Eintrag speichern“ gespeichert. Die Aufnahme verlässt den Browser nur zum eigenen Server.
 */
export function KiAufnahme({
  patientId,
  sitzungErlaubt,
}: {
  patientId: string;
  sitzungErlaubt: boolean;
}) {
  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [modus, setModus] = useState<"diktat" | "sitzung">("diktat");
  const [sekunden, setSekunden] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const rekorder = useRef<MediaRecorder | null>(null);
  const wurzel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (zustand !== "aufnahme") return;
    const t = setInterval(() => setSekunden((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [zustand]);

  // Seite verlassen: Aufnahme verwerfen und Mikrofon freigeben, nichts hochladen.
  useEffect(
    () => () => {
      const r = rekorder.current;
      if (!r) return;
      r.onstop = null;
      if (r.state !== "inactive") r.stop();
      mikrofonAus(r.stream);
    },
    [],
  );

  async function starten(neuerModus: "diktat" | "sitzung") {
    setFehler(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setFehler("Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.");
      return;
    }
    const teile: Blob[] = [];
    // 32 kbit/s reichen für Sprache: 50 Minuten sind dann etwa 12 MB.
    const r = new MediaRecorder(stream, { audioBitsPerSecond: 32_000 });
    r.ondataavailable = (e) => teile.push(e.data);
    r.onstop = () => {
      mikrofonAus(stream);
      void senden(new Blob(teile, { type: r.mimeType }), neuerModus);
    };
    rekorder.current = r;
    r.start(1000);
    setModus(neuerModus);
    setSekunden(0);
    setZustand("aufnahme");
  }

  async function senden(audio: Blob, gesendeterModus: "diktat" | "sitzung") {
    setZustand("verarbeitung");
    const form = wurzel.current?.closest("form");
    const daten = new FormData();
    daten.set("audio", audio);
    daten.set("patientId", patientId);
    daten.set("modus", gesendeterModus);
    daten.set(
      "art",
      String(form?.querySelector<HTMLSelectElement>("[name=art]")?.value ?? "verlauf"),
    );
    try {
      const antwort = await fetch("/api/ki/entwurf", { method: "POST", body: daten });
      const ergebnis = (await antwort.json().catch(() => ({}))) as {
        transkript?: string;
        entwurf?: string;
        fehler?: string;
      };
      if (!antwort.ok || !ergebnis.entwurf) {
        setFehler(
          ergebnis.fehler ??
            (antwort.status === 413
              ? "Die Aufnahme ist zu lang."
              : `Die KI konnte keinen Entwurf erstellen (Fehler ${antwort.status}).`),
        );
      } else {
        const feld = form?.querySelector<HTMLTextAreaElement>("[name=inhalt]");
        if (feld) {
          // Beim Diktat auch das wörtliche Transkript, damit der Entwurf überprüfbar ist.
          // Bei der Sitzung nicht: Ein wörtliches Sitzungsprotokoll gehört nicht in die Akte.
          const text =
            gesendeterModus === "diktat" && ergebnis.transkript
              ? `Zusammenfassung (KI-Entwurf, bitte prüfen):\n${ergebnis.entwurf}\n\nTranskript des Diktats:\n${ergebnis.transkript}`
              : ergebnis.entwurf;
          feld.value = feld.value.trim() ? `${feld.value.trim()}\n\n${text}` : text;
          feld.rows = Math.max(feld.rows, 12);
          feld.focus();
        }
      }
    } catch {
      setFehler("Der Server ist nicht erreichbar.");
    }
    setZustand("bereit");
  }

  return (
    <div
      ref={wurzel}
      className="flex flex-col gap-2 rounded-xl border border-line border-dashed p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {zustand === "bereit" && (
          <>
            <button type="button" className="knopf-zweit" onClick={() => starten("diktat")}>
              Diktat aufnehmen
            </button>
            <button
              type="button"
              className="knopf-zweit"
              onClick={() => starten("sitzung")}
              disabled={!sitzungErlaubt}
              title={
                sitzungErlaubt ? undefined : "Zuerst die Einwilligung der Patient:in eintragen"
              }
            >
              Sitzung aufnehmen
            </button>
          </>
        )}
        {zustand === "aufnahme" && (
          <>
            <span className="flex items-center gap-2 font-medium text-sm">
              <span className="size-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
              {modus === "diktat" ? "Diktat" : "Sitzung"} läuft · {dauer(sekunden)}
            </span>
            <button type="button" className="knopf" onClick={() => rekorder.current?.stop()}>
              Beenden und Entwurf erstellen
            </button>
          </>
        )}
        {zustand === "verarbeitung" && (
          <span className="text-muted text-sm" role="status">
            Die KI schreibt den Entwurf … das kann ein bis zwei Minuten dauern.
          </span>
        )}
      </div>
      <p className="text-muted text-xs">
        KI auf deinem eigenen Server. Die Aufnahme wird nicht gespeichert, nur dein geprüfter
        Eintrag.
        {!sitzungErlaubt &&
          " Sitzungen aufnehmen geht erst mit eingetragener Einwilligung (unter „Kostenzuschuss und Einwilligung“)."}
      </p>
      {fehler && (
        <p role="alert" className="text-red-700 text-sm dark:text-red-300">
          {fehler}
        </p>
      )}
    </div>
  );
}
