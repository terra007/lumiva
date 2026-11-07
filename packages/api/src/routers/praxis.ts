import { schema } from "@lumiva/db";
import { datenschluesselVerpacken, neuerSchluessel } from "@lumiva/db/crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { angemeldet, inhaberIn, inPraxis, oeffentlich, router } from "../trpc";

const praxisDaten = z.object({
  name: z.string().trim().min(2).max(120),
  anschrift: z.string().trim().min(5).max(300),
  telefon: z.string().trim().max(40).optional(),
  email: z.email().optional().or(z.literal("")),
  iban: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^AT\d{18}$|^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "IBAN prüfen"))
    .optional()
    .or(z.literal("")),
});

const STANDARD_SITZUNGSARTEN = [
  { name: "Erstgespräch", dauerMinuten: 50, honorarCent: 9000 },
  { name: "Einzelsitzung", dauerMinuten: 50, honorarCent: 9000 },
  { name: "Doppelsitzung", dauerMinuten: 100, honorarCent: 18000 },
  { name: "Paarsitzung", dauerMinuten: 75, honorarCent: 13000 },
];

const praxisEingabe = praxisDaten.extend({
  berufsbezeichnung: z.string().trim().max(120).optional(),
});

export const praxisRouter = router({
  /** Wer bin ich, und habe ich schon eine Praxis? Öffentlich, damit die Oberfläche weiß, was sie zeigen soll. */
  ich: oeffentlich.query(({ ctx }) => ({
    benutzer: ctx.benutzer,
    praxis: ctx.praxis
      ? { id: ctx.praxis.id, name: ctx.praxis.name, rolle: ctx.praxis.rolle }
      : null,
  })),

  anlegen: angemeldet.input(praxisEingabe).mutation(async ({ ctx, input }) => {
    if (ctx.praxis)
      throw new TRPCError({ code: "CONFLICT", message: "Du hast bereits eine Praxis." });
    const id = crypto.randomUUID();
    await ctx.db.transaction(async (tx) => {
      await tx.insert(schema.praxen).values({
        id,
        name: input.name,
        anschrift: input.anschrift,
        telefon: input.telefon || null,
        email: input.email || null,
        iban: input.iban || null,
        datenschluesselEnc: datenschluesselVerpacken(neuerSchluessel(), ctx.hauptschluessel, id),
      });
      await tx.insert(schema.mitgliedschaften).values({
        praxisId: id,
        benutzerId: ctx.benutzer.id,
        rolle: "inhaber",
        berufsbezeichnung: input.berufsbezeichnung || null,
      });
      await tx
        .insert(schema.sitzungsarten)
        .values(STANDARD_SITZUNGSARTEN.map((s) => ({ ...s, praxisId: id })));
    });
    return { id };
  }),

  einstellungen: inPraxis.query(async ({ ctx }) => {
    const [praxis] = await ctx.db
      .select()
      .from(schema.praxen)
      .where(eq(schema.praxen.id, ctx.praxis.id));
    const [mitglied] = await ctx.db
      .select({ berufsbezeichnung: schema.mitgliedschaften.berufsbezeichnung })
      .from(schema.mitgliedschaften)
      .where(
        and(
          eq(schema.mitgliedschaften.praxisId, ctx.praxis.id),
          eq(schema.mitgliedschaften.benutzerId, ctx.benutzer.id),
        ),
      );
    if (!praxis) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      name: praxis.name,
      anschrift: praxis.anschrift,
      telefon: praxis.telefon ?? "",
      email: praxis.email ?? "",
      iban: praxis.iban ?? "",
      berufsbezeichnung: mitglied?.berufsbezeichnung ?? "",
      rolle: ctx.praxis.rolle,
    };
  }),

  speichern: inhaberIn.input(praxisEingabe).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.praxen)
      .set({
        name: input.name,
        anschrift: input.anschrift,
        telefon: input.telefon || null,
        email: input.email || null,
        iban: input.iban || null,
      })
      .where(eq(schema.praxen.id, ctx.praxis.id));
    await ctx.db
      .update(schema.mitgliedschaften)
      .set({ berufsbezeichnung: input.berufsbezeichnung || null })
      .where(
        and(
          eq(schema.mitgliedschaften.praxisId, ctx.praxis.id),
          eq(schema.mitgliedschaften.benutzerId, ctx.benutzer.id),
        ),
      );
  }),

  sitzungsarten: inPraxis.query(({ ctx }) =>
    ctx.db
      .select()
      .from(schema.sitzungsarten)
      .where(eq(schema.sitzungsarten.praxisId, ctx.praxis.id))
      .orderBy(asc(schema.sitzungsarten.name)),
  ),

  sitzungsartSpeichern: inhaberIn
    .input(
      z.object({
        id: z.uuid().optional(),
        name: z.string().trim().min(2).max(60),
        dauerMinuten: z.number().int().min(10).max(240),
        honorarCent: z.number().int().min(0).max(100_000),
        aktiv: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...werte } = input;
      if (id) {
        await ctx.db
          .update(schema.sitzungsarten)
          .set(werte)
          .where(
            and(eq(schema.sitzungsarten.id, id), eq(schema.sitzungsarten.praxisId, ctx.praxis.id)),
          );
      } else {
        await ctx.db.insert(schema.sitzungsarten).values({ ...werte, praxisId: ctx.praxis.id });
      }
    }),
});
