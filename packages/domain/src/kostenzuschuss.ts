/**
 * Regeln der ÖGK für den Kostenzuschuss bei Wahlpsychotherapie (Stand November 2026, oegk.at/psyche):
 * - Vor der 2. Sitzung ist eine ärztliche Untersuchung nötig.
 * - Ab der 11. Sitzung ist eine Bewilligung der Kasse nötig.
 */
export const SITZUNG_AERZTLICHE_BESTAETIGUNG = 2;
export const SITZUNG_BEWILLIGUNG = 11;

export type Versicherungstraeger = "oegk" | "bvaeb" | "svs" | "kfa" | "privat" | "sonstige";

/** Anzeigenamen der Versicherungsträger für Oberfläche, App und Honorarnote. */
export const TRAEGER_NAME: Record<string, string> = {
  oegk: "ÖGK",
  bvaeb: "BVAEB",
  svs: "SVS",
  kfa: "KFA",
  privat: "Selbstzahler",
  sonstige: "Sonstige",
} satisfies Record<Versicherungstraeger, string>;

export type KostenzuschussStand = {
  versicherungstraeger: Versicherungstraeger;
  /** Nummer der Sitzung, die geplant wird (1 = Erstgespräch). */
  naechsteSitzung: number;
  aerztlicheBestaetigungLiegtVor: boolean;
  bewilligungLiegtVor: boolean;
};

export type KostenzuschussHinweis =
  /** Für diesen Träger sind die Regeln in LUMIVA noch nicht hinterlegt; bitte selbst prüfen. */
  | { art: "regeln-selbst-pruefen" }
  | { art: "aerztliche-bestaetigung-fehlt" }
  | { art: "bewilligung-fehlt" }
  | { art: "bewilligung-bald-noetig"; verbleibendeSitzungen: number };

/** Hinweise, die LUMIVA vor einer Sitzung anzeigt, damit der Kostenzuschuss nicht verloren geht. */
export function kostenzuschussHinweise(stand: KostenzuschussStand): KostenzuschussHinweis[] {
  const { naechsteSitzung: n } = stand;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Ungültige Sitzungsnummer: ${n}`);
  }
  // Selbstzahler beantragen keinen Kostenzuschuss.
  if (stand.versicherungstraeger === "privat") return [];
  // Bisher sind nur die ÖGK-Regeln geprüft. BVAEB, SVS und KFA folgen, sobald belegt.
  if (stand.versicherungstraeger !== "oegk") return [{ art: "regeln-selbst-pruefen" }];

  const hinweise: KostenzuschussHinweis[] = [];
  if (n >= SITZUNG_AERZTLICHE_BESTAETIGUNG && !stand.aerztlicheBestaetigungLiegtVor) {
    hinweise.push({ art: "aerztliche-bestaetigung-fehlt" });
  }
  if (!stand.bewilligungLiegtVor) {
    if (n >= SITZUNG_BEWILLIGUNG) {
      hinweise.push({ art: "bewilligung-fehlt" });
    } else if (n >= SITZUNG_BEWILLIGUNG - 2) {
      hinweise.push({
        art: "bewilligung-bald-noetig",
        verbleibendeSitzungen: SITZUNG_BEWILLIGUNG - n,
      });
    }
  }
  return hinweise;
}
