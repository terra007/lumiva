import { schema } from "@lumiva/db";
import { kassierbar, tageAddieren, wienDatum, wienZeit, wienZuDate } from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, notExists } from "drizzle-orm";
import { z } from "zod";
import { patientenFilter, patientLaden } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { patientName, protokollieren } from "../werkzeuge";
import { bezahlteSitzungen, termineAufNote } from "../zahlungen";

const MINUTE = 60_000;

/** Termine im Zeitraum, mit Namen der Patienten. Sichtbarkeit wie bei den Patienten. */
export async function termineImZeitraum(
  ctx: Parameters<typeof patientLaden>[0],
  von: Date,
  bis: Date,
  patientId?: string,
) {
  const zeilen = await ctx.db
    .select({
      termin: schema.termine,
      vornameEnc: schema.patienten.vornameEnc,
      nachnameEnc: schema.patienten.nachnameEnc,
      sitzungsart: schema.sitzungsarten.name,
    })
    .from(schema.termine)
    .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
    .leftJoin(schema.sitzungsarten, eq(schema.sitzungsarten.id, schema.termine.sitzungsartId))
    .where(
      and(
        patientenFilter(ctx),
        gte(schema.termine.beginn, von),
        lt(schema.termine.beginn, bis),
        patientId ? eq(schema.termine.patientId, patientId) : undefined,
      ),
    )
    .orderBy(asc(schema.termine.beginn));
  const ids = zeilen.map((z) => z.termin.id);
  const [bezahlt, aufNote] = await Promise.all([
    bezahlteSitzungen(ctx.db, ctx.praxis.id, ids),
    termineAufNote(ctx.db, ctx.praxis.id, ids),
  ]);
  const jetzt = new Date();
  return zeilen.map(({ termin, vornameEnc, nachnameEnc, sitzungsart }) => {
    const bezahltAm = bezahlt.get(termin.id)?.am ?? null;
    return {
      ...termin,
      /** Mit Karte bezahlt (Wiener Datum), etwa gleich nach der Sitzung am Terminal. */
      bezahltAm,
      /** Was sich jetzt am Terminal kassieren lässt (Betrag, vorher erledigt vermerken). */
      kassieren: kassierbar(
        { ...termin, bezahlt: bezahltAm !== null, abgerechnet: aufNote.has(termin.id) },
        jetzt,
      ),
      sitzungsart: sitzungsart ?? "Sitzung",
      patientName: patientName(ctx.praxis, termin.patientId, vornameEnc, nachnameEnc),
    };
  });
}

async function terminLaden(ctx: Parameters<typeof patientLaden>[0], id: string) {
  const [t] = await ctx.db
    .select({ termin: schema.termine })
    .from(schema.termine)
    .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
    .where(and(patientenFilter(ctx), eq(schema.termine.id, id)));
  if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden." });
  return t.termin;
}

async function istAbgerechnet(ctx: Parameters<typeof patientLaden>[0], terminId: string) {
  return (await termineAufNote(ctx.db, ctx.praxis.id, [terminId])).size > 0;
}

export const termineRouter = router({
  zeitraum: inPraxis
    .input(z.object({ von: z.date(), bis: z.date(), patientId: z.uuid().optional() }))
    .query(({ ctx, input }) => {
      // Für eine einzelne Person darf es ein Jahr sein, für den ganzen Kalender höchstens zwei Monate.
      const tage = input.patientId ? 400 : 62;
      if (input.bis.getTime() - input.von.getTime() > tage * 24 * 60 * MINUTE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Der Zeitraum ist zu lang." });
      }
      return termineImZeitraum(ctx, input.von, input.bis, input.patientId);
    }),

  anlegen: inPraxis
    .input(
      z.object({
        patientId: z.uuid(),
        sitzungsartId: z.uuid(),
        beginn: z.date(),
        /** 1 = Einzeltermin, sonst wöchentliche Serie mit so vielen Terminen. */
        anzahl: z.number().int().min(1).max(52).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await patientLaden(ctx, input.patientId);
      const [art] = await ctx.db
        .select()
        .from(schema.sitzungsarten)
        .where(
          and(
            eq(schema.sitzungsarten.id, input.sitzungsartId),
            eq(schema.sitzungsarten.praxisId, ctx.praxis.id),
          ),
        );
      if (!art) throw new TRPCError({ code: "NOT_FOUND", message: "Sitzungsart nicht gefunden." });
      const serieId = input.anzahl > 1 ? crypto.randomUUID() : null;
      // Wöchentlich nach Wiener Kalender, damit die Uhrzeit über die Zeitumstellung gleich bleibt.
      const startDatum = wienDatum(input.beginn);
      const startZeit = wienZeit(input.beginn);
      const werte = Array.from({ length: input.anzahl }, (_, i) => {
        const beginn = wienZuDate(tageAddieren(startDatum, i * 7), startZeit);
        return {
          praxisId: ctx.praxis.id,
          patientId: patient.id,
          therapeutId: patient.therapeutId,
          sitzungsartId: art.id,
          beginn,
          ende: new Date(beginn.getTime() + art.dauerMinuten * MINUTE),
          honorarCent: art.honorarCent,
          serieId,
        };
      });
      const angelegt = await ctx.db
        .insert(schema.termine)
        .values(werte)
        .returning({ id: schema.termine.id });
      await protokollieren(ctx, "angelegt", "termin", angelegt[0]?.id ?? null, {
        anzahl: input.anzahl,
      });
      return { anzahl: angelegt.length };
    }),

  status: inPraxis
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(["geplant", "erledigt", "abgesagt", "nicht_erschienen"]),
        ausfallhonorarCent: z.number().int().min(0).max(100_000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const termin = await terminLaden(ctx, input.id);
      const [aufNote, bezahlt] = await Promise.all([
        istAbgerechnet(ctx, termin.id),
        bezahlteSitzungen(ctx.db, ctx.praxis.id, [termin.id]),
      ]);
      if (aufNote) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Der Termin steht schon auf einer Honorarnote.",
        });
      }
      if (bezahlt.size > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Die Sitzung ist schon bezahlt.",
        });
      }
      await ctx.db
        .update(schema.termine)
        .set({
          status: input.status,
          ausfallhonorarCent:
            input.status === "nicht_erschienen" ? (input.ausfallhonorarCent ?? null) : null,
        })
        .where(eq(schema.termine.id, termin.id));
      await protokollieren(ctx, "status", "termin", termin.id, { status: input.status });
    }),

  verschieben: inPraxis
    .input(z.object({ id: z.uuid(), beginn: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const termin = await terminLaden(ctx, input.id);
      if (termin.status !== "geplant") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Nur geplante Termine lassen sich verschieben.",
        });
      }
      const dauer = termin.ende.getTime() - termin.beginn.getTime();
      await ctx.db
        .update(schema.termine)
        .set({ beginn: input.beginn, ende: new Date(input.beginn.getTime() + dauer) })
        .where(eq(schema.termine.id, termin.id));
      await protokollieren(ctx, "verschoben", "termin", termin.id);
    }),

  loeschen: inPraxis
    .input(z.object({ id: z.uuid(), ganzeSerie: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const termin = await terminLaden(ctx, input.id);
      if (termin.status !== "geplant") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Nur geplante Termine lassen sich löschen.",
        });
      }
      if (input.ganzeSerie && termin.serieId) {
        // Nur künftige, noch geplante Termine der Serie.
        await ctx.db.delete(schema.termine).where(
          and(
            eq(schema.termine.praxisId, ctx.praxis.id),
            eq(schema.termine.serieId, termin.serieId),
            eq(schema.termine.status, "geplant"),
            gte(schema.termine.beginn, termin.beginn),
            // Termine mit Zahlungsversuch bleiben, die Zahlung braucht ihren Termin.
            notExists(
              ctx.db
                .select({ id: schema.zahlungen.id })
                .from(schema.zahlungen)
                .where(
                  and(
                    eq(schema.zahlungen.praxisId, ctx.praxis.id),
                    eq(schema.zahlungen.terminId, schema.termine.id),
                  ),
                ),
            ),
          ),
        );
      } else {
        const [zahlung] = await ctx.db
          .select({ id: schema.zahlungen.id })
          .from(schema.zahlungen)
          .where(
            and(
              eq(schema.zahlungen.praxisId, ctx.praxis.id),
              eq(schema.zahlungen.terminId, termin.id),
            ),
          )
          .limit(1);
        if (zahlung) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Für den Termin gab es schon eine Kartenzahlung. Bitte als abgesagt markieren.",
          });
        }
        await ctx.db.delete(schema.termine).where(eq(schema.termine.id, termin.id));
      }
      await protokollieren(ctx, "geloescht", "termin", termin.id, { serie: input.ganzeSerie });
    }),
});
