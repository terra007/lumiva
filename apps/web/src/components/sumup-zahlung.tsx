"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { euro } from "@/lib/format";
import {
  terminalZahlungAbbrechen,
  terminalZahlungStarten,
  type ZahlungsZiel,
  zahllinkHolen,
  zahlungStatus,
} from "@/server/aktionen";

const MELDUNG: Record<string, string> = {
  bezahlt: "Bezahlt.",
  fehlgeschlagen: "Zahlung fehlgeschlagen.",
  abgebrochen: "Zahlung abgebrochen.",
};

type Laufend = { zahlungId: string; betragCent: number | null; demo: boolean };
type Anzeige = "senden" | "karte" | "verarbeitet" | "bezahlt" | "fehler";

/**
 * Schickt den Betrag an den SumUp Solo und wartet auf das Ergebnis. Fragt alle zwei Sekunden
 * nach; der Server gleicht dabei mit SumUp ab, auch wenn kein Webhook ankommt.
 * Währenddessen zeigt ein Fenster, was am Terminal passiert (im Demo-Modus nachgestellt).
 */
export function TerminalZahlung({
  ziel,
  text = "Terminal",
}: {
  ziel: ZahlungsZiel;
  /** Beschriftung, z. B. „Kassieren 90,00 €“ gleich nach der Sitzung. */
  text?: string;
}) {
  const router = useRouter();
  const [laufend, setLaufend] = useState<Laufend | null>(null);
  const [anzeige, setAnzeige] = useState<Anzeige>("senden");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [startet, setStartet] = useState(false);

  useEffect(() => {
    if (!laufend) return;
    let aktiv = true;
    // Kurz „Betrag wird gesendet“, dann „Karte vorhalten“ wie am Gerät.
    const karte = setTimeout(() => aktiv && setAnzeige("karte"), 1200);
    // Demo: Die Zahlung gilt nach 6 Sekunden als bezahlt, kurz davor „wird verarbeitet“.
    const verarbeitet = laufend.demo
      ? setTimeout(() => aktiv && setAnzeige("verarbeitet"), 4500)
      : undefined;
    const takt = setInterval(async () => {
      const stand = await zahlungStatus(laufend.zahlungId);
      if (!aktiv) return;
      if (stand.fehler) setMeldung(stand.fehler);
      if (!stand.status || stand.status === "offen") return;
      clearInterval(takt);
      if (stand.status === "bezahlt") {
        setAnzeige("bezahlt");
        setMeldung("Bezahlt.");
        // Den Haken einen Moment stehen lassen, dann Fenster zu und Seite neu laden.
        setTimeout(() => {
          if (!aktiv) return;
          setLaufend(null);
          router.refresh();
        }, 1800);
      } else {
        setAnzeige("fehler");
        setMeldung(MELDUNG[stand.status] ?? stand.status);
        setTimeout(() => {
          if (!aktiv) return;
          setLaufend(null);
          router.refresh();
        }, 1800);
      }
    }, 1000);
    return () => {
      aktiv = false;
      clearTimeout(karte);
      clearTimeout(verarbeitet);
      clearInterval(takt);
    };
  }, [laufend, router]);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="knopf-zweit"
        disabled={startet || laufend !== null}
        title="Betrag an das SumUp-Terminal senden"
        onClick={async () => {
          setStartet(true);
          setMeldung(null);
          const stand = await terminalZahlungStarten(ziel);
          setStartet(false);
          if (!stand.zahlungId) return setMeldung(stand.fehler ?? "Etwas ist schiefgelaufen.");
          setAnzeige("senden");
          setLaufend({
            zahlungId: stand.zahlungId,
            betragCent: stand.betragCent ?? null,
            demo: Boolean(stand.demo),
          });
        }}
      >
        {startet ? "…" : text}
      </button>
      {meldung && !laufend && <span className="max-w-xs text-muted text-xs">{meldung}</span>}
      {laufend && (
        <TerminalFenster
          {...laufend}
          anzeige={anzeige}
          onAbbrechen={() => terminalZahlungAbbrechen(laufend.zahlungId)}
        />
      )}
    </span>
  );
}

const ANZEIGE_TEXT: Record<Anzeige, string> = {
  senden: "Betrag wird gesendet …",
  karte: "Karte vorhalten oder einstecken",
  verarbeitet: "Wird verarbeitet …",
  bezahlt: "Zahlung erfolgreich",
  fehler: "Zahlung nicht durchgeführt",
};

/** Kartenterminal auf dem Bildschirm: Betrag, Aufforderung, Ergebnis. */
function TerminalFenster({
  betragCent,
  demo,
  anzeige,
  onAbbrechen,
}: Laufend & { anzeige: Anzeige; onAbbrechen: () => void }) {
  const fertig = anzeige === "bezahlt" || anzeige === "fehler";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zahlung am Terminal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-64 flex-col items-center gap-4 rounded-[2rem] bg-zinc-900 p-5 text-white shadow-2xl ring-1 ring-white/10">
        <div className="text-[10px] text-zinc-400 uppercase tracking-widest">
          {demo ? "Demo-Terminal" : "Kartenterminal"}
        </div>
        <div className="flex h-56 w-full flex-col items-center justify-center gap-4 rounded-2xl bg-zinc-800 px-3 text-center">
          {betragCent !== null && (
            <div className="font-semibold text-3xl tabular-nums">{euro(betragCent)}</div>
          )}
          <TerminalSymbol anzeige={anzeige} />
          <p className="text-sm text-zinc-200" aria-live="polite">
            {ANZEIGE_TEXT[anzeige]}
          </p>
        </div>
        {!fertig && (
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full px-4 py-1.5 text-xs text-zinc-300 ring-1 ring-zinc-600 hover:bg-zinc-800"
          >
            Abbrechen
          </button>
        )}
        {demo && <p className="text-[10px] text-zinc-500">Simulation, es fließt kein Geld.</p>}
      </div>
    </div>
  );
}

function TerminalSymbol({ anzeige }: { anzeige: Anzeige }) {
  if (anzeige === "bezahlt")
    return (
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-3xl">
        ✓
      </span>
    );
  if (anzeige === "fehler")
    return (
      <span className="flex size-14 items-center justify-center rounded-full bg-red-500 text-3xl">
        ✕
      </span>
    );
  if (anzeige === "karte")
    return (
      <svg viewBox="0 0 24 24" className="size-14 animate-pulse text-zinc-100" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M8.5 7.5a6 6 0 0 1 0 9" />
          <path d="M12 5a9.5 9.5 0 0 1 0 14" />
          <path d="M15.5 2.5a13 13 0 0 1 0 19" />
          <path d="M5 10a2.5 2.5 0 0 1 0 4" />
        </g>
      </svg>
    );
  return (
    <span className="size-10 animate-spin rounded-full border-4 border-zinc-600 border-t-zinc-100" />
  );
}

/** „Kassieren“ gleich nach der Sitzung; bei laufender Sitzung vorher als erledigt vermerken. */
export function KassierenKnopf({
  terminId,
  betragCent,
  abschliessen,
}: {
  terminId: string;
  betragCent: number;
  abschliessen: boolean;
}) {
  return (
    <TerminalZahlung
      ziel={{ terminId, abschliessen }}
      text={`${abschliessen ? "Erledigt · kassieren" : "Kassieren"} ${euro(betragCent)}`}
    />
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
