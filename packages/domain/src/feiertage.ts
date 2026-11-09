import { tageAddieren } from "./zeit";

export type Feiertag = { datum: string; name: string };

/** Ostersonntag nach der Gaußschen Osterformel (Anonymer Gregorianischer Algorithmus). */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/**
 * Gesetzliche Feiertage in Österreich, nach § 1 Abs. 1 Feiertagsruhegesetz 1957
 * (BGBl. Nr. 153/1957) und § 7 Abs. 2 Arbeitsruhegesetz.
 * Der Karfreitag ist seit 2019 kein Feiertag mehr (BGBl. I Nr. 22/2019).
 * Ostersonntag und Pfingstsonntag fehlen, weil sie ohnehin auf einen Sonntag fallen.
 * https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008211
 */
export function oesterreichischeFeiertage(jahr: number): Feiertag[] {
  const ostern = ostersonntag(jahr);
  const fest = (mmtt: string, name: string) => ({ datum: `${jahr}-${mmtt}`, name });
  const beweglich = (tage: number, name: string) => ({ datum: tageAddieren(ostern, tage), name });
  return [
    fest("01-01", "Neujahr"),
    fest("01-06", "Heilige Drei Könige"),
    beweglich(1, "Ostermontag"),
    fest("05-01", "Staatsfeiertag"),
    beweglich(39, "Christi Himmelfahrt"),
    beweglich(50, "Pfingstmontag"),
    beweglich(60, "Fronleichnam"),
    fest("08-15", "Mariä Himmelfahrt"),
    fest("10-26", "Nationalfeiertag"),
    fest("11-01", "Allerheiligen"),
    fest("12-08", "Mariä Empfängnis"),
    fest("12-25", "Christtag"),
    fest("12-26", "Stefanitag"),
  ].sort((x, y) => x.datum.localeCompare(y.datum));
}

/** Feiertage von `von` bis einschließlich `bis` (Datum JJJJ-MM-TT), auch über den Jahreswechsel. */
export function feiertageImZeitraum(von: string, bis: string): Feiertag[] {
  const jahre = [];
  for (let j = Number(von.slice(0, 4)); j <= Number(bis.slice(0, 4)); j++) jahre.push(j);
  return jahre.flatMap(oesterreichischeFeiertage).filter((f) => f.datum >= von && f.datum <= bis);
}

export const ABWESENHEIT_ARTEN = {
  urlaub: "Urlaub",
  fortbildung: "Fortbildung",
  krankenstand: "Krankenstand",
  sonstiges: "Sonstiges",
} as const;

export type AbwesenheitArt = keyof typeof ABWESENHEIT_ARTEN;
