import { schema } from "@lumiva/db";
import {
  ABWESENHEIT_ARTEN,
  type AbwesenheitArt,
  feiertageImZeitraum,
  tageAddieren,
} from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { inPraxis, router } from "../trpc";
import { dec, decOpt, enc, protokollieren } from "../werkzeuge";

const datum = z.iso.date();
const art = z.enum(Object.keys(ABWESENHEIT_ARTEN) as [AbwesenheitArt, ...AbwesenheitArt[]]);

export const abwesenheitenRouter = router({
  /**
   * Feiertage und Abwesenheiten aller Therapeuten der Praxis im Zeitraum (beide Tage inklusive).
   * Art und Notiz fremder Einträge bleiben verborgen; dort steht nur „Abwesend“.
   */
  zeitraum: inPraxis.input(z.object({ von: datum, bis: datum })).query(async ({ ctx, input }) => {
    if (input.bis < input.von || input.bis > tageAddieren(input.von, 400)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Der Zeitraum ist ungültig." });
    }
    const zeilen = await ctx.db
      .select({ a: schema.abwesenheiten, name: schema.user.name })
      .from(schema.abwesenheiten)
      .leftJoin(schema.user, eq(schema.user.id, schema.abwesenheiten.benutzerId))
      .where(
        and(
          eq(schema.abwesenheiten.praxisId, ctx.praxis.id),
          lte(schema.abwesenheiten.von, input.bis),
          gte(schema.abwesenheiten.bis, input.von),
        ),
      )
      .orderBy(asc(schema.abwesenheiten.von));
    return {
      feiertage: feiertageImZeitraum(input.von, input.bis),
      abwesenheiten: zeilen.map(({ a, name }) => {
        const eigene = a.benutzerId === ctx.benutzer.id;
        const art = eigene
          ? (dec(ctx.praxis, "abwesenheiten.art", a.id, a.artEnc) as AbwesenheitArt)
          : "sonstiges";
        return {
          id: a.id,
          von: a.von,
          bis: a.bis,
          eigene,
          name: name ?? "Therapeut",
          art,
          notiz: eigene ? decOpt(ctx.praxis, "abwesenheiten.notiz", a.id, a.notizEnc) : null,
        };
      }),
    };
  }),

  anlegen: inPraxis
    .input(
      z.object({
        von: datum,
        bis: datum,
        art,
        notiz: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.bis < input.von) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Das Ende liegt vor dem Beginn." });
      }
      if (input.bis > tageAddieren(input.von, 366)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Höchstens ein Jahr am Stück." });
      }
      const id = crypto.randomUUID();
      await ctx.db.insert(schema.abwesenheiten).values({
        id,
        praxisId: ctx.praxis.id,
        benutzerId: ctx.benutzer.id,
        von: input.von,
        bis: input.bis,
        artEnc: enc(ctx.praxis, "abwesenheiten.art", id, input.art),
        notizEnc: input.notiz ? enc(ctx.praxis, "abwesenheiten.notiz", id, input.notiz) : null,
      });
      await protokollieren(ctx, "angelegt", "abwesenheit", id);
      return { id };
    }),

  loeschen: inPraxis.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const geloescht = await ctx.db
      .delete(schema.abwesenheiten)
      .where(
        and(
          eq(schema.abwesenheiten.id, input.id),
          eq(schema.abwesenheiten.praxisId, ctx.praxis.id),
          eq(schema.abwesenheiten.benutzerId, ctx.benutzer.id),
        ),
      )
      .returning({ id: schema.abwesenheiten.id });
    if (geloescht.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Abwesenheit nicht gefunden." });
    }
    await protokollieren(ctx, "geloescht", "abwesenheit", input.id);
  }),
});
