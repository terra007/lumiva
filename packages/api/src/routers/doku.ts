import { schema } from "@lumiva/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { patientLaden } from "../sichtbarkeit";
import { router, therapeutisch } from "../trpc";
import { dec, decOpt, enc, protokollieren } from "../werkzeuge";

const ICD10 = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export async function letzteDiagnose(ctx: Parameters<typeof patientLaden>[0], patientId: string) {
  const [z] = await ctx.db
    .select({ id: schema.dokuEintraege.id, diagnoseEnc: schema.dokuEintraege.diagnoseIcd10Enc })
    .from(schema.dokuEintraege)
    .where(
      and(
        eq(schema.dokuEintraege.praxisId, ctx.praxis.id),
        eq(schema.dokuEintraege.patientId, patientId),
        isNotNull(schema.dokuEintraege.diagnoseIcd10Enc),
      ),
    )
    .orderBy(desc(schema.dokuEintraege.erstelltAm))
    .limit(1);
  return z ? decOpt(ctx.praxis, "doku_eintraege.diagnose_icd10", z.id, z.diagnoseEnc) : null;
}

export const dokuRouter = router({
  liste: therapeutisch.input(z.object({ patientId: z.uuid() })).query(async ({ ctx, input }) => {
    await patientLaden(ctx, input.patientId);
    const zeilen = await ctx.db
      .select()
      .from(schema.dokuEintraege)
      .where(
        and(
          eq(schema.dokuEintraege.praxisId, ctx.praxis.id),
          eq(schema.dokuEintraege.patientId, input.patientId),
        ),
      )
      .orderBy(desc(schema.dokuEintraege.erstelltAm));
    await protokollieren(ctx, "gelesen", "doku", input.patientId, { eintraege: zeilen.length });
    return zeilen.map((z) => ({
      id: z.id,
      terminId: z.terminId,
      art: z.art,
      inhalt: dec(ctx.praxis, "doku_eintraege.inhalt", z.id, z.inhaltEnc),
      diagnoseIcd10: decOpt(ctx.praxis, "doku_eintraege.diagnose_icd10", z.id, z.diagnoseIcd10Enc),
      erstelltAm: z.erstelltAm,
      geaendertAm: z.geaendertAm,
    }));
  }),

  anlegen: therapeutisch
    .input(
      z.object({
        patientId: z.uuid(),
        terminId: z.uuid().optional(),
        art: z.enum(["erstgespraech", "verlauf", "abschluss", "notiz"]),
        inhalt: z.string().trim().min(1).max(20_000),
        diagnoseIcd10: z
          .string()
          .trim()
          .toUpperCase()
          .refine((s) => s === "" || ICD10.test(s), "ICD-10-Code erwartet, z. B. F32.1")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await patientLaden(ctx, input.patientId);
      if (input.terminId) {
        const [t] = await ctx.db
          .select({ id: schema.termine.id })
          .from(schema.termine)
          .where(
            and(
              eq(schema.termine.id, input.terminId),
              eq(schema.termine.patientId, input.patientId),
            ),
          );
        if (!t)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Termin gehört nicht zu dieser Person.",
          });
      }
      const id = crypto.randomUUID();
      await ctx.db.insert(schema.dokuEintraege).values({
        id,
        praxisId: ctx.praxis.id,
        patientId: input.patientId,
        terminId: input.terminId ?? null,
        art: input.art,
        inhaltEnc: enc(ctx.praxis, "doku_eintraege.inhalt", id, input.inhalt),
        diagnoseIcd10Enc: input.diagnoseIcd10
          ? enc(ctx.praxis, "doku_eintraege.diagnose_icd10", id, input.diagnoseIcd10)
          : null,
        erstelltVon: ctx.benutzer.id,
      });
      await protokollieren(ctx, "angelegt", "doku", id);
      return { id };
    }),

  bearbeiten: therapeutisch
    .input(z.object({ id: z.uuid(), inhalt: z.string().trim().min(1).max(20_000) }))
    .mutation(async ({ ctx, input }) => {
      const [e] = await ctx.db
        .select()
        .from(schema.dokuEintraege)
        .where(
          and(
            eq(schema.dokuEintraege.id, input.id),
            eq(schema.dokuEintraege.praxisId, ctx.praxis.id),
          ),
        );
      if (!e) throw new TRPCError({ code: "NOT_FOUND" });
      await patientLaden(ctx, e.patientId);
      await ctx.db
        .update(schema.dokuEintraege)
        .set({
          inhaltEnc: enc(ctx.praxis, "doku_eintraege.inhalt", e.id, input.inhalt),
          geaendertAm: new Date(),
        })
        .where(eq(schema.dokuEintraege.id, e.id));
      // Die alte Fassung bleibt im Protokoll nachvollziehbar, ohne Inhalt: nur dass und wann geändert wurde.
      await protokollieren(ctx, "geaendert", "doku", e.id);
    }),
});
