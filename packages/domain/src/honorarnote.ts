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

/** Inhalt einer ausgestellten Honorarnote. Wird verschlüsselt und unveränderlich gespeichert. */
export type HonorarnoteInhalt = {
  nummer: string;
  ausstellungsdatum: string;
  praxis: {
    name: string;
    anschrift: string;
    telefon: string | null;
    email: string | null;
    iban: string | null;
  };
  therapeut: { name: string; berufsbezeichnung: string | null };
  patient: {
    vorname: string;
    nachname: string;
    geburtsdatum: string;
    svNummer: string | null;
    versicherungstraeger: string;
    anschrift: string | null;
  };
  diagnoseIcd10: string | null;
  sitzungen: { datum: string; dauerMinuten: number; bezeichnung: string; honorarCent: number }[];
  summeCent: number;
};

/** Welche Angaben für den Kostenzuschuss noch fehlen. Leer heißt: vollständig. */
export function fehlendeKostenzuschussAngaben(inhalt: HonorarnoteInhalt): string[] {
  if (inhalt.patient.versicherungstraeger === "privat") return [];
  const fehlt: string[] = [];
  if (!inhalt.patient.svNummer || !istGueltigeSvNummer(inhalt.patient.svNummer)) {
    fehlt.push("gültige Sozialversicherungsnummer");
  }
  if (!inhalt.diagnoseIcd10) fehlt.push("Diagnose (ICD-10)");
  if (inhalt.sitzungen.length === 0) fehlt.push("mindestens eine Sitzung");
  return fehlt;
}

/** Honorar eines Termins: bei „nicht erschienen“ das Ausfallhonorar, sonst das Sitzungshonorar. */
export function terminBetragCent(t: {
  status: string;
  honorarCent: number;
  ausfallhonorarCent: number | null;
}): number {
  return t.status === "nicht_erschienen" ? (t.ausfallhonorarCent ?? 0) : t.honorarCent;
}

/**
 * Was sich für einen Termin gleich am Terminal kassieren lässt, oder null.
 * Erledigt oder ausgefallen mit Honorar; eine begonnene, noch geplante Sitzung wird dabei als
 * erledigt vermerkt (`abschliessen`). Bezahlte oder schon abgerechnete Termine nicht: Die
 * stehen auf einer Honorarnote und werden dort bezahlt.
 */
export function kassierbar(
  t: {
    status: string;
    beginn: Date;
    honorarCent: number;
    ausfallhonorarCent: number | null;
    bezahlt: boolean;
    abgerechnet: boolean;
  },
  jetzt: Date,
): { betragCent: number; abschliessen: boolean } | null {
  if (t.bezahlt || t.abgerechnet) return null;
  const betragCent = terminBetragCent(t);
  if (betragCent <= 0) return null;
  if (t.status === "erledigt" || t.status === "nicht_erschienen")
    return { betragCent, abschliessen: false };
  if (t.status === "geplant" && t.beginn <= jetzt) return { betragCent, abschliessen: true };
  return null;
}
