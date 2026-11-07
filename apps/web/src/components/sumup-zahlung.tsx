"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  terminalZahlungAbbrechen,
  terminalZahlungStarten,
  zahllinkHolen,
  zahlungStatus,
} from "@/server/aktionen";

const MELDUNG: Record<string, string> = {
  bezahlt: "Bezahlt.",
  fehlgeschlagen: "Zahlung fehlgeschlagen.",
  abgebrochen: "Zahlung abgebrochen.",
};

/**
 * Schickt den Betrag an den SumUp Solo und wartet auf das Ergebnis. Fragt alle zwei Sekunden
 * nach; der Server gleicht dabei mit SumUp ab, auch wenn kein Webhook ankommt.
 */
export function TerminalZahlung({ honorarnoteId }: { honorarnoteId: string }) {
  const router = useRouter();
  const [zahlungId, setZahlungId] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [startet, setStartet] = useState(false);

  useEffect(() => {
    if (!zahlungId) return;
    let aktiv = true;
    const takt = setInterval(async () => {
      const stand = await zahlungStatus(zahlungId);
      if (!aktiv) return;
      if (stand.fehler) setMeldung(stand.fehler);
      if (stand.status && stand.status !== "offen") {
        setMeldung(MELDUNG[stand.status] ?? stand.status);
        setZahlungId(null);
        if (stand.status === "bezahlt") router.refresh();
      }
    }, 2000);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, [zahlungId, router]);

  if (zahlungId) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-muted">Am Terminal bezahlen …</span>
        <button
          type="button"
          className="knopf-zweit"
          onClick={() => terminalZahlungAbbrechen(zahlungId)}
        >
          Abbrechen
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="knopf-zweit"
        disabled={startet}
        title="Betrag an das SumUp-Terminal senden"
        onClick={async () => {
          setStartet(true);
          setMeldung(null);
          const stand = await terminalZahlungStarten(honorarnoteId);
          setStartet(false);
          if (stand.zahlungId) setZahlungId(stand.zahlungId);
          else setMeldung(stand.fehler ?? "Etwas ist schiefgelaufen.");
        }}
      >
        {startet ? "…" : "Terminal"}
      </button>
      {meldung && <span className="max-w-xs text-muted text-xs">{meldung}</span>}
    </span>
  );
}

/** Kopiert den Zahlungslink (derselbe wie im QR-Code), z. B. zum Versand per E-Mail. */
export function ZahllinkKopieren({ honorarnoteId }: { honorarnoteId: string }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="knopf-zweit"
        title="Link zur Online-Zahlung kopieren"
        onClick={async () => {
          const { url, fehler } = await zahllinkHolen(honorarnoteId);
          if (!url) return setMeldung(fehler ?? "Kein Link.");
          await navigator.clipboard.writeText(url).then(
            () => setMeldung("Link kopiert."),
            () => setMeldung(url),
          );
        }}
      >
        Zahllink
      </button>
      {meldung && <span className="max-w-xs break-all text-muted text-xs">{meldung}</span>}
    </span>
  );
}
