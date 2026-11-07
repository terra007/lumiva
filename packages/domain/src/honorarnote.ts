import { z } from "zod";

/** Befreiungsvermerk für Heilbehandlungen nach § 6 Abs. 1 Z 19 UStG. */
export const UST_BEFREIUNGSVERMERK =
  "Umsatzsteuerfrei gemäß § 6 Abs. 1 Z 19 UStG (Heilbehandlung).";

/**
 * Fortlaufende, lückenlose Honorarnotennummer je Praxis und Jahr, z. B. "2026-0042".
 * Die laufende Nummer vergibt die Datenbank; hier wird sie nur formatiert.
 */
export function formatHonorarnoteNummer(jahr: number, laufendeNummer: number): string {
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 9999) {
    throw new Error(`Ungültiges Jahr: ${jahr}`);
  }
  if (!Number.isInteger(laufendeNummer) || laufendeNummer < 1) {
    throw new Error(`Laufende Nummer muss eine positive ganze Zahl sein: ${laufendeNummer}`);
  }
  return `${jahr}-${String(laufendeNummer).padStart(4, "0")}`;
}

/**
 * Österreichische Sozialversicherungsnummer: 10 Ziffern, Stelle 4 ist die Prüfziffer
 * (gewichtete Summe mod 11, Rest 10 wird nicht vergeben). Verfahren des Dachverbands der
 * Sozialversicherungsträger; die Quelle ist vor dem Produktivbetrieb noch amtlich zu belegen.
 */
export function istGueltigeSvNummer(svNummer: string): boolean {
  const ziffern = svNummer.replace(/\s/g, "");
  if (!/^\d{10}$/.test(ziffern)) return false;
  const gewichte = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6];
  const summe = [...ziffern].reduce((s, z, i) => s + Number(z) * (gewichte[i] ?? 0), 0);
  const pruefziffer = summe % 11;
  if (pruefziffer === 10) return false;
  return pruefziffer === Number(ziffern[3]);
}

const sitzungSchema = z.object({
  datum: z.iso.date(),
  dauerMinuten: z.number().int().positive(),
  honorarCent: z.number().int().nonnegative(),
});

/**
 * Pflichtangaben, damit Patient:innen mit der Honorarnote den Kostenzuschuss
 * bei ÖGK, BVAEB oder SVS beantragen können (siehe oegk.at/psyche).
 */
export const kostenzuschussHonorarnoteSchema = z.object({
  nummer: z.string().regex(/^\d{4}-\d{4,}$/),
  ausstellungsdatum: z.iso.date(),
  therapeut: z.object({
    name: z.string().min(1),
    anschrift: z.string().min(1),
  }),
  patient: z.object({
    vorname: z.string().min(1),
    nachname: z.string().min(1),
    geburtsdatum: z.iso.date(),
    svNummer: z.string().refine(istGueltigeSvNummer, "Ungültige Sozialversicherungsnummer"),
  }),
  diagnoseIcd10: z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, "ICD-10-Code erwartet, z. B. F32.1"),
  sitzungen: z.array(sitzungSchema).min(1),
});

export type KostenzuschussHonorarnote = z.infer<typeof kostenzuschussHonorarnoteSchema>;

export function summeCent(note: Pick<KostenzuschussHonorarnote, "sitzungen">): number {
  return note.sitzungen.reduce((s, x) => s + x.honorarCent, 0);
}
