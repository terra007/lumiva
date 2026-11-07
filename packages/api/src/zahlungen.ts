/**
 * Zahlungen von Honorarnoten über SumUp: am Terminal (SumUp Solo) oder online über einen Link
 * bzw. QR-Code auf der Honorarnote. Gemeinsam genutzt von tRPC (angemeldet) und den öffentlichen
 * Routen für Webhook und Zahlseite (ohne Anmeldung).
 *
 * Die Honorarnote selbst bleibt unverändert; gesetzt wird nur bezahltAm, wie beim händischen
 * Vermerk „Bezahlt“.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { type Datenbank, schema } from "@lumiva/db";
import { datenschluesselEntpacken, entschluesseln } from "@lumiva/db/crypto";
import { formatHonorarnoteNummer, wienDatum } from "@lumiva/domain";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { type Abruf, euroZuCent, SumupFehler, type SumupZugang, sumupClient } from "./sumup";

/** Benutzer-ID im Protokoll für Änderungen, die SumUp ausgelöst hat. */
export const SUMUP_BENUTZER = "sumup";

/** Wie lange eine Zahlseite von SumUp weiterverwendet wird (gültig sind 30 Minuten). */
const ZAHLSEITE_GUELTIG_MS = 25 * 60_000;
/** Ab wann eine Terminal-Zahlung ohne Transaktion bei SumUp als abgebrochen gilt. */
const TERMINAL_FRIST_MS = 3 * 60_000;

type Praxis = { id: string; schluessel: Buffer };
type Zahlung = typeof schema.zahlungen.$inferSelect;

/** Öffentliche Adresse von LUMIVA für Webhook, Rücksprung und QR-Code. */
export function oeffentlicheUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.LUMIVA_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** SumUp ruft Webhooks nur über HTTPS auf; lokal wird stattdessen nachgefragt (Abgleich). */
export function webhookUrl(zahlungId: string): string | undefined {
  const basis = oeffentlicheUrl();
  return basis.startsWith("https://") ? `${basis}/api/sumup/webhook/${zahlungId}` : undefined;
}

export type SumupKonto = SumupZugang & { terminalId: string | null; terminalName: string | null };

export async function sumupKontoLaden(db: Datenbank, praxis: Praxis): Promise<SumupKonto | null> {
  const [k] = await db
    .select()
    .from(schema.sumupKonten)
    .where(eq(schema.sumupKonten.praxisId, praxis.id));
  if (!k) return null;
  return {
    haendlerCode: k.haendlerCode,
    apiSchluessel: entschluesseln(
      k.apiSchluesselEnc,
      praxis.schluessel,
      `sumup_konten.api_schluessel:${praxis.id}`,
    ),
    affiliate:
      k.affiliateAppId && k.affiliateSchluesselEnc
        ? {
            appId: k.affiliateAppId,
            schluessel: entschluesseln(
              k.affiliateSchluesselEnc,
              praxis.schluessel,
              `sumup_konten.affiliate_schluessel:${praxis.id}`,
            ),
          }
        : null,
    terminalId: k.terminalId,
    terminalName: k.terminalName,
  };
}

/** Text, den SumUp und die zahlende Person sehen. Bewusst nur die Nummer. */
export function zahlungsBeschreibung(jahr: number, laufendeNummer: number): string {
  return `Honorarnote ${formatHonorarnoteNummer(jahr, laufendeNummer)}`;
}

// Zahllink: /bezahlen/<honorarnoteId>.<prüfsumme>. Die Prüfsumme hängt am Schlüssel der Praxis,
// so lässt sich der Link nicht erraten und muss nicht gespeichert werden.

function zahllinkPruefsumme(praxisSchluessel: Buffer, honorarnoteId: string): string {
  const schluessel = createHmac("sha256", praxisSchluessel).update("lumiva:zahllink").digest();
  return createHmac("sha256", schluessel)
    .update(honorarnoteId)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

export function zahllinkToken(praxisSchluessel: Buffer, honorarnoteId: string): string {
  return `${honorarnoteId}.${zahllinkPruefsumme(praxisSchluessel, honorarnoteId)}`;
}

export function zahllinkUrl(praxisSchluessel: Buffer, honorarnoteId: string): string {
  return `${oeffentlicheUrl()}/bezahlen/${zahllinkToken(praxisSchluessel, honorarnoteId)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prüft einen Zahllink und lädt Honorarnote und Praxis. Ungültig: null. */
async function zahllinkAufloesen(db: Datenbank, hauptschluessel: Buffer, token: string) {
  const [noteId, summe] = token.split(".");
  if (!noteId || !summe || !UUID.test(noteId)) return null;
  const [zeile] = await db
    .select({
      note: schema.honorarnoten,
      praxisName: schema.praxen.name,
      schluesselEnc: schema.praxen.datenschluesselEnc,
    })
    .from(schema.honorarnoten)
    .innerJoin(schema.praxen, eq(schema.praxen.id, schema.honorarnoten.praxisId))
    .where(eq(schema.honorarnoten.id, noteId));
  if (!zeile) return null;
  const praxis: Praxis = {
    id: zeile.note.praxisId,
    schluessel: datenschluesselEntpacken(zeile.schluesselEnc, hauptschluessel, zeile.note.praxisId),
  };
  const erwartet = Buffer.from(zahllinkPruefsumme(praxis.schluessel, noteId));
  const erhalten = Buffer.from(summe);
  if (erwartet.length !== erhalten.length || !timingSafeEqual(erwartet, erhalten)) return null;
  return { note: zeile.note, praxisName: zeile.praxisName, praxis };
}

async function protokoll(
  db: Datenbank,
  praxisId: string,
  aktion: string,
  objektId: string,
  details: Record<string, string | number | boolean>,
) {
  await db.insert(schema.protokoll).values({
    praxisId,
    benutzerId: SUMUP_BENUTZER,
    aktion,
    objektTyp: "honorarnote",
    objektId,
    details,
  });
}

/**
 * Fragt bei SumUp nach, wie es um eine offene Zahlung steht, und übernimmt das Ergebnis.
 * Bezahlt: Die Honorarnote bekommt bezahltAm (Wiener Datum), falls sie noch offen ist.
 */
export async function zahlungAbgleichen(
  db: Datenbank,
  konto: SumupZugang,
  zahlung: Zahlung,
  abruf?: Abruf,
): Promise<Zahlung["status"]> {
  if (zahlung.status !== "offen" || !zahlung.anbieterId) return zahlung.status;
  const sumup = sumupClient(konto, abruf);
  let neu: Zahlung["status"] = "offen";
  let betragCent: number | null = null;
  let transaktionCode: string | null = null;
  try {
    if (zahlung.art === "online") {
      const c = await sumup.checkoutLaden(zahlung.anbieterId);
      betragCent = euroZuCent(c.amount);
      transaktionCode = c.transaction_code ?? null;
      // FAILED heißt nur, der letzte Versuch ist gescheitert; auf derselben Seite geht es weiter.
      if (c.status === "PAID") neu = "bezahlt";
      else if (c.status === "EXPIRED") neu = "abgebrochen";
    } else {
      const t = await sumup.transaktionLaden(zahlung.anbieterId);
      betragCent = euroZuCent(t.amount);
      transaktionCode = t.transaction_code ?? null;
      if (t.status === "SUCCESSFUL") neu = "bezahlt";
      else if (t.status === "FAILED") neu = "fehlgeschlagen";
      else if (t.status === "CANCELLED") neu = "abgebrochen";
    }
  } catch (e) {
    if (!(e instanceof SumupFehler && e.status === 404)) throw e;
    // Noch keine Transaktion: Der Solo muss die Zahlung binnen 60 Sekunden beginnen
    // (https://developer.sumup.com/api/readers/create-checkout). Danach gilt sie als abgebrochen.
    const alt = Date.now() - zahlung.erstelltAm.getTime() > TERMINAL_FRIST_MS;
    if (zahlung.art !== "terminal" || !alt) return "offen";
    neu = "abgebrochen";
  }
  if (neu === "offen") return "offen";
  if (neu === "bezahlt" && betragCent !== zahlung.betragCent) {
    await protokoll(db, zahlung.praxisId, "zahlung_betrag_abweichend", zahlung.honorarnoteId, {
      zahlung: zahlung.id,
      erwartetCent: zahlung.betragCent,
      erhaltenCent: betragCent ?? -1,
    });
    neu = "fehlgeschlagen";
  }

  return db.transaction(async (tx) => {
    const [aktualisiert] = await tx
      .update(schema.zahlungen)
      .set({ status: neu, transaktionCode, abgeschlossenAm: new Date() })
      .where(and(eq(schema.zahlungen.id, zahlung.id), eq(schema.zahlungen.status, "offen")))
      .returning();
    // Schon von einem parallelen Abgleich (Webhook und Abfrage) erledigt.
    if (!aktualisiert) return neu;
    const txDb = tx as unknown as Datenbank;
    if (neu !== "bezahlt") {
      await protokoll(txDb, zahlung.praxisId, `zahlung_${neu}`, zahlung.honorarnoteId, {
        zahlung: zahlung.id,
        art: zahlung.art,
      });
      return neu;
    }
    const [note] = await tx
      .update(schema.honorarnoten)
      .set({ bezahltAm: wienDatum(new Date()) })
      .where(
        and(
          eq(schema.honorarnoten.id, zahlung.honorarnoteId),
          eq(schema.honorarnoten.praxisId, zahlung.praxisId),
          isNull(schema.honorarnoten.bezahltAm),
          isNull(schema.honorarnoten.storniertAm),
        ),
      )
      .returning({ id: schema.honorarnoten.id });
    await protokoll(
      txDb,
      zahlung.praxisId,
      // Bereits bezahlt oder storniert: Geld kam trotzdem an, die Praxis muss es zurückzahlen.
      note ? "bezahlt" : "zahlung_doppelt",
      zahlung.honorarnoteId,
      { bezahlt: true, zahlung: zahlung.id, art: zahlung.art, betragCent: zahlung.betragCent },
    );
    return neu;
  });
}

/** Webhook von SumUp: nur die ID aus der Adresse zählt, der Inhalt wird nicht geglaubt. */
export async function sumupWebhook(opts: {
  db: Datenbank;
  hauptschluessel: Buffer;
  zahlungId: string;
  abruf?: Abruf;
}): Promise<boolean> {
  const { db, hauptschluessel, zahlungId, abruf } = opts;
  if (!UUID.test(zahlungId)) return false;
  const [zeile] = await db
    .select({ zahlung: schema.zahlungen, schluesselEnc: schema.praxen.datenschluesselEnc })
    .from(schema.zahlungen)
    .innerJoin(schema.praxen, eq(schema.praxen.id, schema.zahlungen.praxisId))
    .where(eq(schema.zahlungen.id, zahlungId));
  if (!zeile) return false;
  const praxis = {
    id: zeile.zahlung.praxisId,
    schluessel: datenschluesselEntpacken(
      zeile.schluesselEnc,
      hauptschluessel,
      zeile.zahlung.praxisId,
    ),
  };
  const konto = await sumupKontoLaden(db, praxis);
  if (!konto) return false;
  await zahlungAbgleichen(db, konto, zeile.zahlung, abruf);
  return true;
}

export type Zahlseite = {
  praxisName: string;
  nummer: string;
  summeCent: number;
  status: "offen" | "bezahlt" | "storniert";
  online: boolean;
};

/** Daten für die öffentliche Zahlseite. Gleicht dabei die letzte Online-Zahlung ab. */
export async function zahlseiteLaden(opts: {
  db: Datenbank;
  hauptschluessel: Buffer;
  token: string;
  abruf?: Abruf;
}): Promise<Zahlseite | null> {
  const { db, abruf } = opts;
  const z = await zahllinkAufloesen(db, opts.hauptschluessel, opts.token);
  if (!z) return null;
  const konto = await sumupKontoLaden(db, z.praxis);
  let bezahlt = z.note.bezahltAm !== null;
  if (konto && !bezahlt && !z.note.storniertAm) {
    const [letzte] = await db
      .select()
      .from(schema.zahlungen)
      .where(
        and(
          eq(schema.zahlungen.honorarnoteId, z.note.id),
          eq(schema.zahlungen.praxisId, z.praxis.id),
          eq(schema.zahlungen.art, "online"),
          eq(schema.zahlungen.status, "offen"),
        ),
      )
      .orderBy(desc(schema.zahlungen.erstelltAm))
      .limit(1);
    if (letzte) bezahlt = (await zahlungAbgleichen(db, konto, letzte, abruf)) === "bezahlt";
  }
  return {
    praxisName: z.praxisName,
    nummer: formatHonorarnoteNummer(z.note.jahr, z.note.laufendeNummer),
    summeCent: z.note.summeCent,
    status: z.note.storniertAm ? "storniert" : bezahlt ? "bezahlt" : "offen",
    online: konto !== null,
  };
}

/**
 * Startet die Online-Zahlung und liefert die Adresse der Zahlseite von SumUp.
 * Eine noch gültige Zahlseite wird wiederverwendet, damit Neuladen keine neuen Checkouts erzeugt.
 */
export async function onlineZahlungStarten(opts: {
  db: Datenbank;
  hauptschluessel: Buffer;
  token: string;
  abruf?: Abruf;
}): Promise<{ url: string } | { fehler: string }> {
  const { db, abruf, token } = opts;
  const z = await zahllinkAufloesen(db, opts.hauptschluessel, token);
  if (!z) return { fehler: "Dieser Zahlungslink ist ungültig." };
  if (z.note.storniertAm) return { fehler: "Diese Honorarnote wurde storniert." };
  if (z.note.bezahltAm) return { fehler: "Diese Honorarnote ist bereits bezahlt." };
  const konto = await sumupKontoLaden(db, z.praxis);
  if (!konto) return { fehler: "Die Praxis nimmt derzeit keine Online-Zahlungen an." };

  const [gueltig] = await db
    .select()
    .from(schema.zahlungen)
    .where(
      and(
        eq(schema.zahlungen.honorarnoteId, z.note.id),
        eq(schema.zahlungen.praxisId, z.praxis.id),
        eq(schema.zahlungen.art, "online"),
        eq(schema.zahlungen.status, "offen"),
        eq(schema.zahlungen.betragCent, z.note.summeCent),
        gt(schema.zahlungen.erstelltAm, new Date(Date.now() - ZAHLSEITE_GUELTIG_MS)),
      ),
    )
    .orderBy(desc(schema.zahlungen.erstelltAm))
    .limit(1);
  if (gueltig?.zahlseiteUrl) return { url: gueltig.zahlseiteUrl };

  const [zahlung] = await db
    .insert(schema.zahlungen)
    .values({
      praxisId: z.praxis.id,
      honorarnoteId: z.note.id,
      art: "online",
      betragCent: z.note.summeCent,
    })
    .returning();
  if (!zahlung) throw new Error("Zahlung nicht angelegt");
  try {
    const checkout = await sumupClient(konto, abruf).checkoutErstellen({
      referenz: zahlung.id,
      betragCent: zahlung.betragCent,
      beschreibung: zahlungsBeschreibung(z.note.jahr, z.note.laufendeNummer),
      webhookUrl: webhookUrl(zahlung.id),
      zurueckUrl: `${oeffentlicheUrl()}/bezahlen/${token}`,
    });
    if (!checkout.hosted_checkout_url) throw new SumupFehler("Keine Zahlseite erhalten.", 0);
    await db
      .update(schema.zahlungen)
      .set({ anbieterId: checkout.id, zahlseiteUrl: checkout.hosted_checkout_url })
      .where(eq(schema.zahlungen.id, zahlung.id));
    await protokoll(db, z.praxis.id, "zahlung_gestartet", z.note.id, {
      zahlung: zahlung.id,
      art: "online",
    });
    return { url: checkout.hosted_checkout_url };
  } catch (e) {
    await db
      .update(schema.zahlungen)
      .set({ status: "fehlgeschlagen", abgeschlossenAm: new Date() })
      .where(eq(schema.zahlungen.id, zahlung.id));
    if (e instanceof SumupFehler) return { fehler: "Die Zahlung lässt sich gerade nicht starten." };
    throw e;
  }
}
