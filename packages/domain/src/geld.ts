/** Beträge werden immer als ganze Cent gespeichert, nie als Kommazahl. */
export type Cent = number;

const formatter = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export function formatEuro(cent: Cent): string {
  if (!Number.isInteger(cent)) {
    throw new Error(`Betrag muss in ganzen Cent angegeben sein, erhalten: ${cent}`);
  }
  return formatter.format(cent / 100);
}
