import { schema } from "@lumiva/db";
import { entschluesseln, verschluesseln } from "@lumiva/db/crypto";
import { type Anschrift, anschriftZerlegen, LEERE_ANSCHRIFT } from "@lumiva/domain";
import type { Kontext, PraxisZugang } from "./trpc";

/** Verschlüsselt einen Wert für genau diese Zeile und Spalte. */
export function enc(p: PraxisZugang, feld: string, id: string, wert: string): string {
  return verschluesseln(wert, p.schluessel, `${feld}:${id}`);
}

export function dec(p: PraxisZugang, feld: string, id: string, wert: string): string {
  return entschluesseln(wert, p.schluessel, `${feld}:${id}`);
}

export function decOpt(
  p: PraxisZugang,
  feld: string,
  id: string,
  wert: string | null,
): string | null {
  return wert === null ? null : dec(p, feld, id, wert);
}

/** Kontaktdaten eines Patienten, wie sie verschlüsselt in `patienten.kontakt` liegen. */
export type Kontakt = Anschrift & { telefon: string; email: string };

/**
 * Liest die entschlüsselten Kontaktdaten. Ältere Einträge haben nur eine einzeilige
 * `anschrift`; die wird beim Lesen in Straße, PLZ und Ort zerlegt und beim nächsten
 * Speichern getrennt abgelegt.
 */
export function kontaktLesen(text: string | null): Kontakt {
  const roh = (text ? JSON.parse(text) : {}) as Partial<Kontakt> & { anschrift?: string };
  const anschrift =
    roh.strasse === undefined && roh.anschrift ? anschriftZerlegen(roh.anschrift) : LEERE_ANSCHRIFT;
  return {
    telefon: roh.telefon ?? "",
    email: roh.email ?? "",
    strasse: roh.strasse ?? anschrift.strasse,
    plz: roh.plz ?? anschrift.plz,
    ort: roh.ort ?? anschrift.ort,
  };
}

/** Vor- und Nachname eines Patienten aus den verschlüsselten Spalten. */
export function patientName(
  p: PraxisZugang,
  patientId: string,
  vornameEnc: string,
  nachnameEnc: string,
): string {
  return `${dec(p, "patienten.vorname", patientId, vornameEnc)} ${dec(p, "patienten.nachname", patientId, nachnameEnc)}`;
}

/** Schreibt einen Eintrag ins Zugriffsprotokoll. Nie Gesundheitsdaten in details schreiben. */
export async function protokollieren(
  ctx: Pick<Kontext, "db"> & { praxis: PraxisZugang; benutzer: { id: string } },
  aktion: string,
  objektTyp: string,
  objektId: string | null,
  details?: Record<string, string | number | boolean>,
) {
  await ctx.db.insert(schema.protokoll).values({
    praxisId: ctx.praxis.id,
    benutzerId: ctx.benutzer.id,
    aktion,
    objektTyp,
    objektId,
    details: details ?? null,
  });
}
