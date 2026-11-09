import { schema } from "@lumiva/db";
import { formatDatum, kassierbar, wienDatum } from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { patientenFilter } from "../sichtbarkeit";
import { SumupFehler, sumupClient } from "../sumup";
import { DEMO_HAENDLERCODE, DEMO_TERMINAL, demoErlaubt } from "../sumup-demo";
import { inhaberIn, inPraxis, router } from "../trpc";
import { enc, protokollieren } from "../werkzeuge";
import {
  bezahlteSitzungen,
  offenCent,
  type SumupKonto,
  sumupKontoLaden,
  termineAufNote,
  webhookUrl,
  zahllinkUrl,
  zahlungAbgleichen,
  zahlungsBeschreibung,
} from "../zahlungen";

type Ctx = Parameters<typeof patientenFilter>[0];
type PraxisCtx = Parameters<typeof protokollieren>[0];

/** Fehler von SumUp als Meldung für die Oberfläche, ohne Antwortinhalt. */
function alsTrpcFehler(e: unknown): never {
  if (e instanceof SumupFehler) throw new TRPCError({ code: "BAD_GATEWAY", message: e.message });
  throw e;
}

async function kontoPflicht(ctx: Ctx): Promise<SumupKonto> {
  const konto = await sumupKontoLaden(ctx.db, ctx.praxis);
  if (!konto) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SumUp ist noch nicht eingerichtet (Einstellungen).",
    });
  }
  return konto;
}

/** Offene Honorarnote, die die Person sehen darf. */
async function offeneNote(ctx: Ctx, id: string) {
  const [zeile] = await ctx.db
    .select({ note: schema.honorarnoten })
    .from(schema.honorarnoten)
    .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
    .where(and(patientenFilter(ctx), eq(schema.honorarnoten.id, id)));
  if (!zeile) throw new TRPCError({ code: "NOT_FOUND", message: "Honorarnote nicht gefunden." });
  if (zeile.note.storniertAm)
    throw new TRPCError({ code: "CONFLICT", message: "Die Honorarnote ist storniert." });
  if (zeile.note.bezahltAm)
    throw new TRPCError({ code: "CONFLICT", message: "Die Honorarnote ist bereits bezahlt." });
  return zeile.note;
}

/**
 * Erledigte oder ausgefallene Sitzung mit Honorar, die noch niemand bezahlt hat.
 * Mit `abschliessen` wird eine begonnene, noch geplante Sitzung zuerst als erledigt vermerkt,
 * damit am Ende der Sitzung ein Klick reicht.
 */
async function offeneSitzung(ctx: Ctx & PraxisCtx, id: string, abschliessen: boolean) {
  const [zeile] = await ctx.db
    .select({ termin: schema.termine })
    .from(schema.termine)
    .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
    .where(and(patientenFilter(ctx), eq(schema.termine.id, id)));
  if (!zeile) throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden." });
  const [bezahlt, aufNote] = await Promise.all([
    bezahlteSitzungen(ctx.db, ctx.praxis.id, [id]),
    termineAufNote(ctx.db, ctx.praxis.id, [id]),
  ]);
  let t = zeile.termin;
  if (bezahlt.size > 0)
    throw new TRPCError({ code: "CONFLICT", message: "Die Sitzung ist bereits bezahlt." });
  // Steht sie schon auf einer Honorarnote, wird über die Note bezahlt (Rest oder Zahllink).
  // So können Sitzung und Note nicht gleichzeitig kassiert werden.
  if (aufNote.size > 0)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Die Sitzung steht schon auf einer Honorarnote; bitte dort kassieren.",
    });
  const k = kassierbar({ ...t, bezahlt: false, abgerechnet: false }, new Date());
  if (!k || (k.abschliessen && !abschliessen))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Erst die Sitzung als erledigt markieren, dann kassieren.",
    });
  if (k.abschliessen) {
    const [neu] = await ctx.db
      .update(schema.termine)
      .set({ status: "erledigt", ausfallhonorarCent: null })
      .where(and(eq(schema.termine.id, t.id), eq(schema.termine.status, "geplant")))
      .returning();
    if (!neu) throw new TRPCError({ code: "CONFLICT", message: "Der Termin wurde eben geändert." });
    t = neu;
    await protokollieren(ctx, "status", "termin", t.id, { status: "erledigt" });
  }
  const betragCent = k.betragCent;
  return { termin: t, betragCent };
}

/** Zahlung, deren Note oder Sitzung die Person sehen darf. */
async function zahlungLaden(ctx: Ctx, id: string) {
  const [zahlung] = await ctx.db
    .select()
    .from(schema.zahlungen)
    .where(and(eq(schema.zahlungen.praxisId, ctx.praxis.id), eq(schema.zahlungen.id, id)));
  let sichtbar = false;
  if (zahlung?.terminId) {
    const [t] = await ctx.db
      .select({ id: schema.termine.id })
      .from(schema.termine)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
      .where(and(patientenFilter(ctx), eq(schema.termine.id, zahlung.terminId)));
    sichtbar = Boolean(t);
  } else if (zahlung?.honorarnoteId) {
    const [n] = await ctx.db
      .select({ id: schema.honorarnoten.id })
      .from(schema.honorarnoten)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
      .where(and(patientenFilter(ctx), eq(schema.honorarnoten.id, zahlung.honorarnoteId)));
    sichtbar = Boolean(n);
  }
  if (!zahlung || !sichtbar)
    throw new TRPCError({ code: "NOT_FOUND", message: "Zahlung nicht gefunden." });
  return zahlung;
}

const geheim = z.string().trim().max(500);

export const zahlungenRouter = router({
  /** Was die Praxis anbieten kann; für Knöpfe und den QR-Code auf der Honorarnote. */
  verfuegbar: inPraxis.query(async ({ ctx }) => {
    const konto = await sumupKontoLaden(ctx.db, ctx.praxis);
    return {
      online: konto !== null,
      terminal: Boolean(konto?.terminalId && konto.affiliate),
      terminalName: konto?.terminalName ?? null,
      demo: konto?.haendlerCode === DEMO_HAENDLERCODE,
    };
  }),

  einstellungen: inhaberIn.query(async ({ ctx }) => {
    const [k] = await ctx.db
      .select()
      .from(schema.sumupKonten)
      .where(eq(schema.sumupKonten.praxisId, ctx.praxis.id));
    // Schlüssel verlassen den Server nie, die Oberfläche erfährt nur, ob sie gesetzt sind.
    return {
      haendlerCode: k?.haendlerCode ?? "",
      apiSchluesselGesetzt: Boolean(k?.apiSchluesselEnc),
      affiliateAppId: k?.affiliateAppId ?? "",
      affiliateSchluesselGesetzt: Boolean(k?.affiliateSchluesselEnc),
      terminalName: k?.terminalName ?? null,
      demo: k?.haendlerCode === DEMO_HAENDLERCODE,
      demoErlaubt: demoErlaubt(),
    };
  }),

  speichern: inhaberIn
    .input(
      z.object({
        haendlerCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{4,20}$/, "Händlercode prüfen"),
        /** Leer: bisherigen Schlüssel behalten. */
        apiSchluessel: geheim.optional(),
        affiliateAppId: z.string().trim().max(200).optional(),
        affiliateSchluessel: geheim.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.haendlerCode === DEMO_HAENDLERCODE)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Für die Demo den Demo-Knopf nutzen.",
        });
      const [bisher] = await ctx.db
        .select()
        .from(schema.sumupKonten)
        .where(eq(schema.sumupKonten.praxisId, ctx.praxis.id));
      const id = ctx.praxis.id;
      const apiSchluesselEnc = input.apiSchluessel
        ? enc(ctx.praxis, "sumup_konten.api_schluessel", id, input.apiSchluessel)
        : bisher?.apiSchluesselEnc;
      if (!apiSchluesselEnc)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bitte den API-Schlüssel angeben." });
      const affiliateSchluesselEnc = input.affiliateSchluessel
        ? enc(ctx.praxis, "sumup_konten.affiliate_schluessel", id, input.affiliateSchluessel)
        : (bisher?.affiliateSchluesselEnc ?? null);
      // Anderes Händlerkonto: das gekoppelte Terminal gehört nicht mehr dazu.
      const terminalBleibt = bisher?.haendlerCode === input.haendlerCode;
      const werte = {
        haendlerCode: input.haendlerCode,
        apiSchluesselEnc,
        affiliateAppId: input.affiliateAppId || null,
        affiliateSchluesselEnc,
        terminalId: terminalBleibt ? (bisher?.terminalId ?? null) : null,
        terminalName: terminalBleibt ? (bisher?.terminalName ?? null) : null,
        geaendertAm: new Date(),
      };
      await ctx.db
        .insert(schema.sumupKonten)
        .values({ praxisId: id, ...werte })
        .onConflictDoUpdate({ target: schema.sumupKonten.praxisId, set: werte });
      await protokollieren(ctx, "sumup_eingerichtet", "praxis", id, {
        apiSchluesselNeu: Boolean(input.apiSchluessel),
      });
    }),

  /** Demo ohne SumUp-Konto: simuliertes Händlerkonto mit gekoppeltem Terminal. */
  demoEinschalten: inhaberIn.mutation(async ({ ctx }) => {
    if (!demoErlaubt())
      throw new TRPCError({ code: "FORBIDDEN", message: "Der Demo-Modus ist hier ausgeschaltet." });
    const id = ctx.praxis.id;
    const werte = {
      haendlerCode: DEMO_HAENDLERCODE,
      apiSchluesselEnc: enc(ctx.praxis, "sumup_konten.api_schluessel", id, "demo"),
      affiliateAppId: "demo",
      affiliateSchluesselEnc: enc(ctx.praxis, "sumup_konten.affiliate_schluessel", id, "demo"),
      terminalId: DEMO_TERMINAL.id,
      terminalName: DEMO_TERMINAL.name,
      geaendertAm: new Date(),
    };
    await ctx.db
      .insert(schema.sumupKonten)
      .values({ praxisId: id, ...werte })
      .onConflictDoUpdate({ target: schema.sumupKonten.praxisId, set: werte });
    await protokollieren(ctx, "sumup_demo", "praxis", id);
  }),

  trennen: inhaberIn.mutation(async ({ ctx }) => {
    await ctx.db.delete(schema.sumupKonten).where(eq(schema.sumupKonten.praxisId, ctx.praxis.id));
    await protokollieren(ctx, "sumup_getrennt", "praxis", ctx.praxis.id);
  }),

  /** Koppelt den Solo mit dem Code, den er unter Verbindungen → API → Verbinden anzeigt. */
  terminalKoppeln: inhaberIn
    .input(
      z.object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{8,9}$/, "Der Code hat 8 oder 9 Zeichen"),
        name: z.string().trim().min(1).max(60).default("Praxis"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const konto = await kontoPflicht(ctx);
      const terminal = await sumupClient(konto)
        .terminalKoppeln(input.code, input.name)
        .catch(alsTrpcFehler);
      await ctx.db
        .update(schema.sumupKonten)
        .set({ terminalId: terminal.id, terminalName: terminal.name, geaendertAm: new Date() })
        .where(eq(schema.sumupKonten.praxisId, ctx.praxis.id));
      await protokollieren(ctx, "terminal_gekoppelt", "praxis", ctx.praxis.id);
      return { name: terminal.name };
    }),

  /** Adresse für Link und QR-Code. Enthält nur die ID der Note und eine Prüfsumme. */
  link: inPraxis.input(z.object({ honorarnoteId: z.uuid() })).query(async ({ ctx, input }) => {
    const note = await offeneNote(ctx, input.honorarnoteId);
    await kontoPflicht(ctx);
    return { url: zahllinkUrl(ctx.praxis.schluessel, note.id) };
  }),

  /**
   * Schickt den Betrag an den Solo, entweder für eine Sitzung gleich danach oder für den offenen
   * Rest einer Honorarnote. Ob bezahlt wurde, meldet danach `status`.
   */
  terminalStarten: inPraxis
    .input(
      z.union([
        z.object({ terminId: z.uuid(), abschliessen: z.boolean().default(false) }),
        z.object({ honorarnoteId: z.uuid() }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      // Zuerst prüfen, damit „Erledigt · kassieren“ ohne Terminal nichts am Termin ändert.
      const konto = await kontoPflicht(ctx);
      if (!konto.terminalId || !konto.affiliate) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kein Terminal gekoppelt oder Affiliate-Key fehlt (Einstellungen).",
        });
      }
      const terminalId = konto.terminalId;
      let ziel: { honorarnoteId: string | null; terminId: string | null };
      let betragCent: number;
      let beschreibung: string;
      if ("terminId" in input) {
        const s = await offeneSitzung(ctx, input.terminId, input.abschliessen);
        ziel = { honorarnoteId: null, terminId: s.termin.id };
        betragCent = s.betragCent;
        // Für SumUp nur das Datum, nichts über die Behandlung.
        beschreibung = `Honorar ${formatDatum(wienDatum(s.termin.beginn))}`;
      } else {
        const note = await offeneNote(ctx, input.honorarnoteId);
        ziel = { honorarnoteId: note.id, terminId: null };
        betragCent = await offenCent(ctx.db, note);
        beschreibung = zahlungsBeschreibung(note.jahr, note.laufendeNummer);
        if (betragCent === 0)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Die Honorarnote ist bereits bezahlt.",
          });
      }
      // Doppelklick: Läuft schon eine Terminal-Zahlung dafür, diese zurückgeben.
      const demo = konto.haendlerCode === DEMO_HAENDLERCODE;
      const [laeuft] = await ctx.db
        .select({ id: schema.zahlungen.id, betragCent: schema.zahlungen.betragCent })
        .from(schema.zahlungen)
        .where(
          and(
            eq(schema.zahlungen.praxisId, ctx.praxis.id),
            ziel.terminId
              ? eq(schema.zahlungen.terminId, ziel.terminId)
              : eq(schema.zahlungen.honorarnoteId, ziel.honorarnoteId ?? ""),
            eq(schema.zahlungen.art, "terminal"),
            eq(schema.zahlungen.status, "offen"),
            gt(schema.zahlungen.erstelltAm, new Date(Date.now() - 2 * 60_000)),
          ),
        );
      if (laeuft) return { zahlungId: laeuft.id, betragCent: laeuft.betragCent, demo };

      const [zahlung] = await ctx.db
        .insert(schema.zahlungen)
        .values({ praxisId: ctx.praxis.id, ...ziel, art: "terminal", betragCent })
        .returning({ id: schema.zahlungen.id });
      if (!zahlung) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try {
        const antwort = await sumupClient(konto).terminalZahlung({
          terminalId,
          betragCent,
          beschreibung,
          webhookUrl: webhookUrl(zahlung.id),
        });
        await ctx.db
          .update(schema.zahlungen)
          .set({ anbieterId: antwort.data.client_transaction_id })
          .where(eq(schema.zahlungen.id, zahlung.id));
      } catch (e) {
        await ctx.db
          .update(schema.zahlungen)
          .set({ status: "fehlgeschlagen", abgeschlossenAm: new Date() })
          .where(eq(schema.zahlungen.id, zahlung.id));
        alsTrpcFehler(e);
      }
      await protokollieren(
        ctx,
        "zahlung_gestartet",
        ziel.terminId ? "termin" : "honorarnote",
        ziel.terminId ?? ziel.honorarnoteId,
        { zahlung: zahlung.id, art: "terminal", betragCent },
      );
      return { zahlungId: zahlung.id, betragCent, demo };
    }),

  /** Stand einer Zahlung; fragt bei SumUp nach, solange sie offen ist (falls kein Webhook ankommt). */
  status: inPraxis.input(z.object({ zahlungId: z.uuid() })).query(async ({ ctx, input }) => {
    const zahlung = await zahlungLaden(ctx, input.zahlungId);
    if (zahlung.status !== "offen") return { status: zahlung.status };
    const konto = await kontoPflicht(ctx);
    const status = await zahlungAbgleichen(ctx.db, konto, zahlung).catch(alsTrpcFehler);
    return { status };
  }),

  terminalAbbrechen: inPraxis
    .input(z.object({ zahlungId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const zahlung = await zahlungLaden(ctx, input.zahlungId);
      if (zahlung.status !== "offen" || zahlung.art !== "terminal") return;
      const konto = await kontoPflicht(ctx);
      if (konto.terminalId)
        await sumupClient(konto).terminalAbbrechen(konto.terminalId).catch(alsTrpcFehler);
      // Das Ergebnis (meist „fehlgeschlagen“) kommt wie jede Zahlung über Webhook oder `status`.
      await protokollieren(
        ctx,
        "zahlung_abbruch_angefordert",
        zahlung.terminId ? "termin" : "honorarnote",
        zahlung.terminId ?? zahlung.honorarnoteId,
        { zahlung: zahlung.id },
      );
    }),
});
