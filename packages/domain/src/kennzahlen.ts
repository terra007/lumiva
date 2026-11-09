/** Kennzahlen der Praxis: Zeiträume und Quoten, ohne I/O. */

export const KENNZAHLEN_ZEITRAEUME = ["monat", "vormonat", "quartal", "jahr"] as const;
export type KennzahlenZeitraum = (typeof KENNZAHLEN_ZEITRAEUME)[number];

const MONATE = [
  "Jänner",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** Erster Tag eines Monats als "JJJJ-MM-01"; monat zählt ab 0 und darf überlaufen. */
function monatsErster(jahr: number, monat: number): string {
  const d = new Date(Date.UTC(jahr, monat, 1));
  return d.toISOString().slice(0, 10);
}

export function monatsName(datum: string): string {
  return `${MONATE[Number(datum.slice(5, 7)) - 1]} ${datum.slice(0, 4)}`;
}

/**
 * Kalendertage des Zeitraums in Wien: von einschließlich, bis ausschließlich.
 * `heute` ist das Wiener Datum, z. B. "2026-11-09".
 */
export function kennzahlenZeitraum(
  art: KennzahlenZeitraum,
  heute: string,
): { von: string; bis: string; bezeichnung: string } {
  const jahr = Number(heute.slice(0, 4));
  const monat = Number(heute.slice(5, 7)) - 1;
  switch (art) {
    case "monat": {
      const von = monatsErster(jahr, monat);
      return { von, bis: monatsErster(jahr, monat + 1), bezeichnung: monatsName(von) };
    }
    case "vormonat": {
      const von = monatsErster(jahr, monat - 1);
      return { von, bis: monatsErster(jahr, monat), bezeichnung: monatsName(von) };
    }
    case "quartal": {
      const erster = Math.floor(monat / 3) * 3;
      return {
        von: monatsErster(jahr, erster),
        bis: monatsErster(jahr, erster + 3),
        bezeichnung: `${erster / 3 + 1}. Quartal ${jahr}`,
      };
    }
    case "jahr":
      return { von: `${jahr}-01-01`, bis: `${jahr + 1}-01-01`, bezeichnung: String(jahr) };
  }
}

/** Die letzten `anzahl` Monate bis einschließlich des laufenden, als "JJJJ-MM-01", älteste zuerst. */
export function letzteMonate(heute: string, anzahl: number): string[] {
  const jahr = Number(heute.slice(0, 4));
  const monat = Number(heute.slice(5, 7)) - 1;
  return Array.from({ length: anzahl }, (_, i) => monatsErster(jahr, monat - anzahl + 1 + i));
}

/** Kalendertage, an denen [von, bis] (beide einschließlich) im Zeitraum [zVon, zBis) liegt. */
export function tageImZeitraum(von: string, bis: string, zVon: string, zBis: string): number {
  const tag = 86_400_000;
  const anfang = Math.max(Date.parse(von), Date.parse(zVon));
  const ende = Math.min(Date.parse(bis) + tag, Date.parse(zBis));
  return Math.max(0, Math.round((ende - anfang) / tag));
}

/**
 * Anteil der ausgefallenen Sitzungen (abgesagt oder nicht erschienen) an allen Sitzungen,
 * die schon stattgefunden hätten. Noch geplante zählen nicht. null, wenn es keine gibt.
 */
export function ausfallquote(s: {
  erledigt: number;
  abgesagt: number;
  nichtErschienen: number;
}): number | null {
  const gesamt = s.erledigt + s.abgesagt + s.nichtErschienen;
  return gesamt === 0 ? null : (s.abgesagt + s.nichtErschienen) / gesamt;
}
