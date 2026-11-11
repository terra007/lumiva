import { schema } from "@lumiva/db";
import {
  istGueltigeSvNummer,
  kostenzuschussHinweise,
  loeschbarAb,
  wienDatum,
} from "@lumiva/domain";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { patientenFilter, patientLaden } from "../sichtbarkeit";
import { inPraxis, router, therapeutisch } from "../trpc";
import { dec, decOpt, enc, kontaktLesen, protokollieren } from "../werkzeuge";

export const VERSICHERUNGSTRAEGER = [
  "oegk",
  "bvaeb",
  "svs",
  "svs_bauern",
  "kfa",
  "privat",
  "sonstige",
] as const;

const kontaktSchema = z.object({
  telefon: z.string().trim().max(40).default(""),
  email: z.string().trim().max(120).default(""),
  strasse: z.string().trim().max(200).default(""),
  plz: z.string().trim().max(10).default(""),
  ort: z.string().trim().max(100).default(""),
});

const stammdaten = z.object({
  vorname: z.string().trim().min(1).max(80),
  nachname: z.string().trim().min(1).max(80),
  geburtsdatum: z.iso.date(),
  svNummer: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, ""))
    .refine(
      (s) => s === "" || istGueltigeSvNummer(s),
      "ungültig. Bitte prüfen: 10 Ziffern, die vierte ist eine Prüfziffer.",
    ),
  versicherungstraeger: z.enum(VERSICHERUNGSTRAEGER),
  kontakt: kontaktSchema,
});

type PatientZeile = typeof schema.patienten.$inferSelect;

function entschluesselt(ctx: { praxis: Parameters<typeof dec>[0] }, p: PatientZeile) {
  const kontaktText = decOpt(ctx.praxis, "patienten.kontakt", p.id, p.kontaktEnc);
  return {
    id: p.id,
    vorname: dec(ctx.praxis, "patienten.vorname", p.id, p.vornameEnc),
    nachname: dec(ctx.praxis, "patienten.nachname", p.id, p.nachnameEnc),
    geburtsdatum: dec(ctx.praxis, "patienten.geburtsdatum", p.id, p.geburtsdatumEnc),
    svNummer: decOpt(ctx.praxis, "patienten.sv_nummer", p.id, p.svNummerEnc) ?? "",
    kontakt: kontaktLesen(kontaktText),
    versicherungstraeger: p.versicherungstraeger,
    status: p.status,
    therapeutId: p.therapeutId,
    aerztlicheBestaetigungAm: p.aerztlicheBestaetigungAm,
    bewilligungAm: p.bewilligungAm,
    kiAufnahmeEinwilligungAm: p.kiAufnahmeEinwilligungAm,
    behandlungsende: p.behandlungsende,
    loeschbarAb: p.loeschbarAb,
    erstelltAm: p.erstelltAm,
  };
}

export type Patient = ReturnType<typeof entschluesselt>;

function verschluesselteFelder(
  ctx: { praxis: Parameters<typeof enc>[0] },
  id: string,
  d: z.infer<typeof stammdaten>,
) {
  return {
    vornameEnc: enc(ctx.praxis, "patienten.vorname", id, d.vorname),
    nachnameEnc: enc(ctx.praxis, "patienten.nachname", id, d.nachname),
    geburtsdatumEnc: enc(ctx.praxis, "patienten.geburtsdatum", id, d.geburtsdatum),
    svNummerEnc: d.svNummer ? enc(ctx.praxis, "patienten.sv_nummer", id, d.svNummer) : null,
    kontaktEnc: enc(ctx.praxis, "patienten.kontakt", id, JSON.stringify(d.kontakt)),
    versicherungstraeger: d.versicherungstraeger,
  };
}

/** Anzahl der stattgefundenen Sitzungen je Patient (für die Kostenzuschuss-Regeln). */
export async function sitzungenGezaehlt(
  db: Parameters<typeof patientLaden>[0]["db"],
  praxisId: string,
  patientIds: string[],
): Promise<Map<string, number>> {
  if (patientIds.length === 0) return new Map();
  const zeilen = await db
    .select({ patientId: schema.termine.patientId, anzahl: count() })
    .from(schema.termine)
    .where(
      and(
        eq(schema.termine.praxisId, praxisId),
        inArray(schema.termine.patientId, patientIds),
        eq(schema.termine.status, "erledigt"),
      ),
    )
    .groupBy(schema.termine.patientId);
  return new Map(zeilen.map((z) => [z.patientId, z.anzahl]));
}

export function hinweiseFuer(p: Patient, erledigteSitzungen: number) {
  if (p.status === "abgeschlossen") return [];
  return kostenzuschussHinweise({
    versicherungstraeger: p.versicherungstraeger,
    naechsteSitzung: erledigteSitzungen + 1,
    aerztlicheBestaetigungLiegtVor: p.aerztlicheBestaetigungAm !== null,
    bewilligungLiegtVor: p.bewilligungAm !== null,
  });
}

export const patientenRouter = router({
  liste: inPraxis
    .input(
      z
        .object({ status: z.enum(["aktiv", "pausiert", "abgeschlossen", "alle"]).default("aktiv") })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "aktiv";
      const zeilen = await ctx.db
        .select()
        .from(schema.patienten)
        .where(
          status === "alle"
            ? patientenFilter(ctx)
            : and(patientenFilter(ctx), eq(schema.patienten.status, status)),
        );
      const patienten = zeilen.map((z) => entschluesselt(ctx, z));
      const sitzungen = await sitzungenGezaehlt(
        ctx.db,
        ctx.praxis.id,
        patienten.map((p) => p.id),
      );
      return patienten
        .map((p) => {
          const anzahl = sitzungen.get(p.id) ?? 0;
          return { ...p, sitzungen: anzahl, hinweise: hinweiseFuer(p, anzahl) };
        })
        .sort((a, b) => a.nachname.localeCompare(b.nachname, "de-AT"));
    }),

  details: inPraxis.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const p = entschluesselt(ctx, await patientLaden(ctx, input.id));
    const anzahl = (await sitzungenGezaehlt(ctx.db, ctx.praxis.id, [p.id])).get(p.id) ?? 0;
    await protokollieren(ctx, "gelesen", "patient", p.id);
    return { ...p, sitzungen: anzahl, hinweise: hinweiseFuer(p, anzahl) };
  }),

  anlegen: therapeutisch.input(stammdaten).mutation(async ({ ctx, input }) => {
    const id = crypto.randomUUID();
    await ctx.db.insert(schema.patienten).values({
      id,
      praxisId: ctx.praxis.id,
      therapeutId: ctx.benutzer.id,
      ...verschluesselteFelder(ctx, id, input),
    });
    await protokollieren(ctx, "angelegt", "patient", id);
    return { id };
  }),

  bearbeiten: therapeutisch
    .input(stammdaten.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await patientLaden(ctx, input.id);
      await ctx.db
        .update(schema.patienten)
        .set(verschluesselteFelder(ctx, input.id, input))
        .where(eq(schema.patienten.id, input.id));
      await protokollieren(ctx, "geaendert", "patient", input.id);
    }),

  bestaetigungen: therapeutisch
    .input(
      z.object({
        id: z.uuid(),
        aerztlicheBestaetigungAm: z.iso.date().nullable(),
        bewilligungAm: z.iso.date().nullable(),
        kiAufnahmeEinwilligungAm: z.iso.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await patientLaden(ctx, input.id);
      await ctx.db
        .update(schema.patienten)
        .set({
          aerztlicheBestaetigungAm: input.aerztlicheBestaetigungAm,
          bewilligungAm: input.bewilligungAm,
          kiAufnahmeEinwilligungAm: input.kiAufnahmeEinwilligungAm,
        })
        .where(eq(schema.patienten.id, input.id));
      await protokollieren(ctx, "geaendert", "patient", input.id, { feld: "bestaetigungen" });
    }),

  status: therapeutisch
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(["aktiv", "pausiert", "abgeschlossen"]),
        behandlungsende: z.iso.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await patientLaden(ctx, input.id);
      const ende =
        input.status === "abgeschlossen" ? (input.behandlungsende ?? wienDatum(new Date())) : null;
      await ctx.db
        .update(schema.patienten)
        .set({
          status: input.status,
          behandlungsende: ende,
          loeschbarAb: ende ? loeschbarAb(ende) : null,
        })
        .where(eq(schema.patienten.id, input.id));
      await protokollieren(ctx, "status", "patient", input.id, { status: input.status });
    }),
});
