import { schema } from "@lumiva/db";
import { entschluesseln, verschluesseln } from "@lumiva/db/crypto";
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

/** Vor- und Nachname einer Patient:in aus den verschlüsselten Spalten. */
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
