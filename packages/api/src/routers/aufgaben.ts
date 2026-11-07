import { schema } from "@lumiva/db";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { patientLaden } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { patientName } from "../werkzeuge";

export const aufgabenRouter = router({
  liste: inPraxis
    .input(
      z.object({ erledigt: z.boolean().default(false), patientId: z.uuid().optional() }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const zeilen = await ctx.db
        .select({
          aufgabe: schema.aufgaben,
          vornameEnc: schema.patienten.vornameEnc,
          nachnameEnc: schema.patienten.nachnameEnc,
        })
        .from(schema.aufgaben)
        .leftJoin(schema.patienten, eq(schema.patienten.id, schema.aufgaben.patientId))
        .where(
          and(
            eq(schema.aufgaben.praxisId, ctx.praxis.id),
            eq(schema.aufgaben.zustaendigId, ctx.benutzer.id),
            input?.erledigt
              ? isNotNull(schema.aufgaben.erledigtAm)
              : isNull(schema.aufgaben.erledigtAm),
            input?.patientId ? eq(schema.aufgaben.patientId, input.patientId) : undefined,
          ),
        )
        .orderBy(
          input?.erledigt ? desc(schema.aufgaben.erledigtAm) : asc(schema.aufgaben.faelligAm),
        );
      return zeilen.map(({ aufgabe, vornameEnc, nachnameEnc }) => ({
        ...aufgabe,
        patientName:
          aufgabe.patientId && vornameEnc && nachnameEnc
            ? patientName(ctx.praxis, aufgabe.patientId, vornameEnc, nachnameEnc)
            : null,
      }));
    }),

  anlegen: inPraxis
    .input(
      z.object({
        titel: z.string().trim().min(1).max(200),
        faelligAm: z.iso.date().optional(),
        patientId: z.uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.patientId) await patientLaden(ctx, input.patientId);
      await ctx.db.insert(schema.aufgaben).values({
        praxisId: ctx.praxis.id,
        zustaendigId: ctx.benutzer.id,
        titel: input.titel,
        faelligAm: input.faelligAm ?? null,
        patientId: input.patientId ?? null,
      });
    }),

  erledigen: inPraxis
    .input(z.object({ id: z.uuid(), erledigt: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db
        .update(schema.aufgaben)
        .set({ erledigtAm: input.erledigt ? new Date() : null })
        .where(
          and(
            eq(schema.aufgaben.id, input.id),
            eq(schema.aufgaben.praxisId, ctx.praxis.id),
            eq(schema.aufgaben.zustaendigId, ctx.benutzer.id),
          ),
        )
        .returning({ id: schema.aufgaben.id });
      if (r.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
    }),

  loeschen: inPraxis.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(schema.aufgaben)
      .where(
        and(
          eq(schema.aufgaben.id, input.id),
          eq(schema.aufgaben.praxisId, ctx.praxis.id),
          eq(schema.aufgaben.zustaendigId, ctx.benutzer.id),
        ),
      );
  }),
});
