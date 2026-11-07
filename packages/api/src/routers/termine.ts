import { schema } from "@lumiva/db";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { patientenFilter, patientLaden } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { dec, protokollieren } from "../werkzeuge";

const MINUTE = 60_000;

/** Termine im Zeitraum, mit Namen der Patient:innen. Sichtbarkeit wie bei den Patient:innen. */
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
  return zeilen.map(({ termin, vornameEnc, nachnameEnc, sitzungsart }) => ({
    ...termin,
    sitzungsart: sitzungsart ?? "Sitzung",
    patientName: `${dec(ctx.praxis, "patienten.vorname", termin.patientId, vornameEnc)} ${dec(
      ctx.praxis,
      "patienten.nachname",
      termin.patientId,
      nachnameEnc,
    )}`,
  }));
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
  const zeilen = await ctx.db
    .select({ storniert: schema.honorarnoten.storniertAm })
    .from(schema.honorarnotePositionen)
    .innerJoin(
      schema.honorarnoten,
      eq(schema.honorarnoten.id, schema.honorarnotePositionen.honorarnoteId),
    )
    .where(
      and(
        eq(schema.honorarnotePositionen.praxisId, ctx.praxis.id),
        eq(schema.honorarnotePositionen.terminId, terminId),
      ),
    );
  return zeilen.some((z) => z.storniert === null);
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
      const werte = Array.from({ length: input.anzahl }, (_, i) => {
        const beginn = new Date(input.beginn.getTime() + i * 7 * 24 * 60 * MINUTE);
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
      if (await istAbgerechnet(ctx, termin.id)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Der Termin steht schon auf einer Honorarnote.",
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
        const serie = await ctx.db
          .select({ id: schema.termine.id })
          .from(schema.termine)
          .where(
            and(
              eq(schema.termine.praxisId, ctx.praxis.id),
              eq(schema.termine.serieId, termin.serieId),
              eq(schema.termine.status, "geplant"),
              gte(schema.termine.beginn, termin.beginn),
            ),
          );
        await ctx.db.delete(schema.termine).where(
          inArray(
            schema.termine.id,
            serie.map((s) => s.id),
          ),
        );
      } else {
        await ctx.db.delete(schema.termine).where(eq(schema.termine.id, termin.id));
      }
      await protokollieren(ctx, "geloescht", "termin", termin.id, { serie: input.ganzeSerie });
    }),
});
