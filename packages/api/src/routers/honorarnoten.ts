import { naechsteHonorarnoteNummer, schema } from "@lumiva/db";
import {
  fehlendeKostenzuschussAngaben,
  formatHonorarnoteNummer,
  type HonorarnoteInhalt,
  wienDatum,
} from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { honorarnotePdf } from "../pdf";
import { patientenFilter, patientLaden } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { dec, decOpt, enc, protokollieren } from "../werkzeuge";
import { letzteDiagnose } from "./doku";

type Ctx = Parameters<typeof patientLaden>[0];

/** Erledigte oder ausgefallene Termine mit Honorar, die auf keiner gültigen Honorarnote stehen. */
async function offeneTermine(ctx: Ctx, patientId: string) {
  const termine = await ctx.db
    .select({ termin: schema.termine, sitzungsart: schema.sitzungsarten.name })
    .from(schema.termine)
    .leftJoin(schema.sitzungsarten, eq(schema.sitzungsarten.id, schema.termine.sitzungsartId))
    .where(
      and(
        eq(schema.termine.praxisId, ctx.praxis.id),
        eq(schema.termine.patientId, patientId),
        inArray(schema.termine.status, ["erledigt", "nicht_erschienen"]),
      ),
    )
    .orderBy(asc(schema.termine.beginn));
  if (termine.length === 0) return [];
  const abgerechnet = await ctx.db
    .select({ terminId: schema.honorarnotePositionen.terminId })
    .from(schema.honorarnotePositionen)
    .innerJoin(
      schema.honorarnoten,
      eq(schema.honorarnoten.id, schema.honorarnotePositionen.honorarnoteId),
    )
    .where(
      and(
        eq(schema.honorarnotePositionen.praxisId, ctx.praxis.id),
        inArray(
          schema.honorarnotePositionen.terminId,
          termine.map((t) => t.termin.id),
        ),
        isNull(schema.honorarnoten.storniertAm),
      ),
    );
  const vergeben = new Set(abgerechnet.map((a) => a.terminId));
  return termine
    .filter((t) => !vergeben.has(t.termin.id))
    .map(({ termin, sitzungsart }) => {
      const ausfall = termin.status === "nicht_erschienen";
      return {
        id: termin.id,
        beginn: termin.beginn,
        dauerMinuten: Math.round((termin.ende.getTime() - termin.beginn.getTime()) / 60_000),
        bezeichnung: ausfall ? "Ausfallhonorar (nicht erschienen)" : (sitzungsart ?? "Sitzung"),
        honorarCent: ausfall ? (termin.ausfallhonorarCent ?? 0) : termin.honorarCent,
      };
    })
    .filter((t) => t.honorarCent > 0);
}

async function noteLaden(ctx: Ctx, id: string) {
  const [zeile] = await ctx.db
    .select({ note: schema.honorarnoten })
    .from(schema.honorarnoten)
    .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
    .where(and(patientenFilter(ctx), eq(schema.honorarnoten.id, id)));
  if (!zeile) throw new TRPCError({ code: "NOT_FOUND", message: "Honorarnote nicht gefunden." });
  const note = zeile.note;
  const inhalt = JSON.parse(
    dec(ctx.praxis, "honorarnoten.inhalt", note.id, note.inhaltEnc),
  ) as HonorarnoteInhalt;
  return { note, inhalt };
}

export const honorarnotenRouter = router({
  offen: inPraxis.input(z.object({ patientId: z.uuid() })).query(async ({ ctx, input }) => {
    await patientLaden(ctx, input.patientId);
    return offeneTermine(ctx, input.patientId);
  }),

  liste: inPraxis
    .input(z.object({ patientId: z.uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const zeilen = await ctx.db
        .select({
          note: schema.honorarnoten,
          vornameEnc: schema.patienten.vornameEnc,
          nachnameEnc: schema.patienten.nachnameEnc,
        })
        .from(schema.honorarnoten)
        .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
        .where(
          and(
            patientenFilter(ctx),
            input?.patientId ? eq(schema.honorarnoten.patientId, input.patientId) : undefined,
          ),
        )
        .orderBy(desc(schema.honorarnoten.jahr), desc(schema.honorarnoten.laufendeNummer));
      return zeilen.map(({ note, vornameEnc, nachnameEnc }) => ({
        id: note.id,
        nummer: formatHonorarnoteNummer(note.jahr, note.laufendeNummer),
        patientId: note.patientId,
        patientName: `${dec(ctx.praxis, "patienten.vorname", note.patientId, vornameEnc)} ${dec(ctx.praxis, "patienten.nachname", note.patientId, nachnameEnc)}`,
        ausgestelltAm: note.ausgestelltAm,
        summeCent: note.summeCent,
        bezahltAm: note.bezahltAm,
        storniertAm: note.storniertAm,
      }));
    }),

  ausstellen: inPraxis
    .input(z.object({ patientId: z.uuid(), terminIds: z.array(z.uuid()).min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const patient = await patientLaden(ctx, input.patientId);
      const offen = await offeneTermine(ctx, patient.id);
      const gewaehlt = offen.filter((t) => input.terminIds.includes(t.id));
      if (gewaehlt.length !== new Set(input.terminIds).size) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ein Termin ist nicht (mehr) abrechenbar.",
        });
      }
      const [praxis] = await ctx.db
        .select()
        .from(schema.praxen)
        .where(eq(schema.praxen.id, ctx.praxis.id));
      const [therapeut] = await ctx.db
        .select({
          name: schema.user.name,
          berufsbezeichnung: schema.mitgliedschaften.berufsbezeichnung,
        })
        .from(schema.user)
        .leftJoin(
          schema.mitgliedschaften,
          and(
            eq(schema.mitgliedschaften.benutzerId, schema.user.id),
            eq(schema.mitgliedschaften.praxisId, ctx.praxis.id),
          ),
        )
        .where(eq(schema.user.id, patient.therapeutId));
      if (!praxis) throw new TRPCError({ code: "NOT_FOUND" });
      const kontakt = JSON.parse(
        decOpt(ctx.praxis, "patienten.kontakt", patient.id, patient.kontaktEnc) ?? "{}",
      ) as {
        anschrift?: string;
      };
      const heute = wienDatum(new Date());
      const jahr = Number(heute.slice(0, 4));
      const id = crypto.randomUUID();

      const entwurf: Omit<HonorarnoteInhalt, "nummer"> = {
        ausstellungsdatum: heute,
        praxis: {
          name: praxis.name,
          anschrift: praxis.anschrift,
          telefon: praxis.telefon,
          email: praxis.email,
          iban: praxis.iban,
        },
        therapeut: {
          name: therapeut?.name ?? "",
          berufsbezeichnung: therapeut?.berufsbezeichnung ?? null,
        },
        patient: {
          vorname: dec(ctx.praxis, "patienten.vorname", patient.id, patient.vornameEnc),
          nachname: dec(ctx.praxis, "patienten.nachname", patient.id, patient.nachnameEnc),
          geburtsdatum: dec(
            ctx.praxis,
            "patienten.geburtsdatum",
            patient.id,
            patient.geburtsdatumEnc,
          ),
          svNummer: decOpt(ctx.praxis, "patienten.sv_nummer", patient.id, patient.svNummerEnc),
          versicherungstraeger: patient.versicherungstraeger,
          anschrift: kontakt.anschrift || null,
        },
        diagnoseIcd10:
          ctx.praxis.rolle === "assistenz" ? null : await letzteDiagnose(ctx, patient.id),
        sitzungen: gewaehlt.map((t) => ({
          datum: wienDatum(t.beginn),
          dauerMinuten: t.dauerMinuten,
          bezeichnung: t.bezeichnung,
          honorarCent: t.honorarCent,
        })),
        summeCent: gewaehlt.reduce((s, t) => s + t.honorarCent, 0),
      };
      const fehlt = fehlendeKostenzuschussAngaben({ ...entwurf, nummer: "" });
      if (fehlt.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Für den Kostenzuschuss fehlt noch: ${fehlt.join(", ")}.`,
        });
      }

      const nummer = await ctx.db.transaction(async (tx) => {
        const laufend = await naechsteHonorarnoteNummer(tx, ctx.praxis.id, jahr);
        const inhalt: HonorarnoteInhalt = {
          ...entwurf,
          nummer: formatHonorarnoteNummer(jahr, laufend),
        };
        await tx.insert(schema.honorarnoten).values({
          id,
          praxisId: ctx.praxis.id,
          patientId: patient.id,
          jahr,
          laufendeNummer: laufend,
          ausgestelltAm: heute,
          summeCent: inhalt.summeCent,
          inhaltEnc: enc(ctx.praxis, "honorarnoten.inhalt", id, JSON.stringify(inhalt)),
        });
        await tx.insert(schema.honorarnotePositionen).values(
          gewaehlt.map((t) => ({
            praxisId: ctx.praxis.id,
            honorarnoteId: id,
            terminId: t.id,
            honorarCent: t.honorarCent,
          })),
        );
        return inhalt.nummer;
      });
      await protokollieren(ctx, "ausgestellt", "honorarnote", id, { nummer });
      return { id, nummer };
    }),

  bezahlt: inPraxis
    .input(z.object({ id: z.uuid(), am: z.iso.date().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { note } = await noteLaden(ctx, input.id);
      if (note.storniertAm)
        throw new TRPCError({ code: "CONFLICT", message: "Die Honorarnote ist storniert." });
      await ctx.db
        .update(schema.honorarnoten)
        .set({ bezahltAm: input.am })
        .where(eq(schema.honorarnoten.id, note.id));
      await protokollieren(ctx, "bezahlt", "honorarnote", note.id, { bezahlt: input.am !== null });
    }),

  stornieren: inPraxis.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { note } = await noteLaden(ctx, input.id);
    if (note.storniertAm) return;
    await ctx.db
      .update(schema.honorarnoten)
      .set({ storniertAm: wienDatum(new Date()) })
      .where(eq(schema.honorarnoten.id, note.id));
    await protokollieren(ctx, "storniert", "honorarnote", note.id);
  }),

  /** PDF als Base64, damit es über JSON (Web und App) transportiert werden kann. */
  pdf: inPraxis.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const { note, inhalt } = await noteLaden(ctx, input.id);
    const bytes = await honorarnotePdf(inhalt, {
      bezahltAm: note.bezahltAm,
      storniertAm: note.storniertAm,
    });
    await protokollieren(ctx, "pdf", "honorarnote", note.id);
    return {
      dateiname: `Honorarnote-${inhalt.nummer}.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  }),
});
