/**
 * Aufbewahrungsfrist für Behandlungsakten in Jahren.
 * Das PThG 2024 nennt in § 44 keine Zahl; bis zur rechtlichen Klärung gilt konservativ 10 Jahre.
 */
export const AUFBEWAHRUNG_JAHRE = 10;

/**
 * Erster Tag, an dem eine abgeschlossene Akte gelöscht werden darf.
 * Nimmt ein Kalenderdatum "JJJJ-MM-TT" wie die Datenbankspalte, damit keine Zeitzone den Tag verschiebt.
 */
export function loeschbarAb(behandlungsende: string, jahre = AUFBEWAHRUNG_JAHRE): string {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(behandlungsende);
  if (!treffer) throw new Error(`Datum im Format JJJJ-MM-TT erwartet: ${behandlungsende}`);
  const [, j, m, t] = treffer.map(Number) as [number, number, number, number];
  // Ein 29. Februar fällt in einem Nicht-Schaltjahr automatisch auf den 1. März, also nie zu früh.
  return new Date(Date.UTC(j + jahre, m - 1, t)).toISOString().slice(0, 10);
}
