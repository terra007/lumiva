import { naechsteHonorarnoteNummer, schema } from "@lumiva/db";
import {
  anschriftText,
  fehlendeKostenzuschussAngaben,
  formatHonorarnoteNummer,
  type HonorarnoteInhalt,
  terminBetragCent,
  wienDatum,
} from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { honorarnotePdf } from "../pdf";
import { patientenFilter, patientLaden } from "../sichtbarkeit";
import { inPraxis, router, therapeutisch } from "../trpc";
import { dec, decOpt, enc, kontaktLesen, patientName, protokollieren } from "../werkzeuge";
import {
  bezahlteSitzungen,
  noteAusgleichen,
  notenZahlungen,
  offenJeNote,
  sumupKontoLaden,
  termineAufNote,
  zahllinkUrl,
} from "../zahlungen";
import { letzteDiagnose } from "./doku";

type Ctx = Parameters<typeof patientLaden>[0];

/** Erledigte oder ausgefallene Termine mit Honorar, die auf keiner gültigen Honorarnote stehen. */
async function offeneTermine(ctx: Ctx, patientId: string, db: Ctx["db"] = ctx.db) {
  const termine = await db
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
  const ids = termine.map((t) => t.termin.id);
  const [vergeben, bezahlt] = await Promise.all([
    termineAufNote(db, ctx.praxis.id, ids),
    bezahlteSitzungen(db, ctx.praxis.id, ids),
  ]);
  return termine
    .filter((t) => !vergeben.has(t.termin.id))
    .map(({ termin, sitzungsart }) => {
      const ausfall = termin.status === "nicht_erschienen";
      return {
        id: termin.id,
        beginn: termin.beginn,
        dauerMinuten: Math.round((termin.ende.getTime() - termin.beginn.getTime()) / 60_000),
        bezeichnung: ausfall ? "Ausfallhonorar (nicht erschienen)" : (sitzungsart ?? "Sitzung"),
        honorarCent: terminBetragCent(termin),
        /** Gleich nach der Sitzung mit Karte bezahlt. */
        bezahltAm: bezahlt.get(termin.id)?.am ?? null,
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
      // Teilweise mit Karte bezahlt: betrifft nur offene Noten, bezahlte zeigen ihr Datum.
      const offen = await offenJeNote(
        ctx.db,
        ctx.praxis.id,
        zeilen.map((z) => z.note).filter((n) => !n.bezahltAm && !n.storniertAm),
      );
      return zeilen.map(({ note, vornameEnc, nachnameEnc }) => ({
        id: note.id,
        /** Noch offen nach Kartenzahlungen; bei bezahlten und stornierten Noten 0. */
        offenCent: offen.get(note.id) ?? 0,
        nummer: formatHonorarnoteNummer(note.jahr, note.laufendeNummer),
        patientId: note.patientId,
        patientName: patientName(ctx.praxis, note.patientId, vornameEnc, nachnameEnc),
        ausgestelltAm: note.ausgestelltAm,
        summeCent: note.summeCent,
        bezahltAm: note.bezahltAm,
        storniertAm: note.storniertAm,
      }));
    }),

  // Die Honorarnote für den Kostenzuschuss enthält die Diagnose, daher nur therapeutisch.
  ausstellen: therapeutisch
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
      const [[praxis], [therapeut], diagnoseIcd10] = await Promise.all([
        ctx.db.select().from(schema.praxen).where(eq(schema.praxen.id, ctx.praxis.id)),
        ctx.db
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
          .where(eq(schema.user.id, patient.therapeutId)),
        letzteDiagnose(ctx, patient.id),
      ]);
      if (!praxis) throw new TRPCError({ code: "NOT_FOUND" });
      const kontakt = kontaktLesen(
        decOpt(ctx.praxis, "patienten.kontakt", patient.id, patient.kontaktEnc),
      );
      const heute = wienDatum(new Date());
      const jahr = Number(heute.slice(0, 4));
      const id = crypto.randomUUID();

      const entwurf: Omit<HonorarnoteInhalt, "nummer"> = {
        ausstellungsdatum: heute,
        praxis: {
          name: praxis.name,
          anschrift: anschriftText(praxis),
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
          anschrift: anschriftText(kontakt) || null,
        },
        diagnoseIcd10,
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

      const { nummer, bezahlt } = await ctx.db.transaction(async (tx) => {
        // Patienten sperren und erneut prüfen, damit gleichzeitige Anfragen (Doppelklick)
        // denselben Termin nicht zweimal abrechnen.
        await tx
          .select({ id: schema.patienten.id })
          .from(schema.patienten)
          .where(eq(schema.patienten.id, patient.id))
          .for("update");
        const nochOffen = new Set((await offeneTermine(ctx, patient.id, tx)).map((t) => t.id));
        if (!gewaehlt.every((t) => nochOffen.has(t.id))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ein Termin ist nicht (mehr) abrechenbar.",
          });
        }
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
        // Wurden alle Sitzungen schon am Terminal bezahlt, ist die Note gleich bezahlt.
        const bezahlt = await noteAusgleichen(tx as unknown as Ctx["db"], ctx.praxis.id, id);
        return { nummer: inhalt.nummer, bezahlt };
      });
      await protokollieren(ctx, "ausgestellt", "honorarnote", id, { nummer, bezahlt });
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

  stornieren: therapeutisch.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { note } = await noteLaden(ctx, input.id);
    if (note.storniertAm) return;
    await ctx.db
      .update(schema.honorarnoten)
      .set({ storniertAm: wienDatum(new Date()) })
      .where(eq(schema.honorarnoten.id, note.id));
    await protokollieren(ctx, "storniert", "honorarnote", note.id);
  }),

  /** PDF als Base64, damit es über JSON (Web und App) transportiert werden kann. */
  pdf: therapeutisch.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const { note, inhalt } = await noteLaden(ctx, input.id);
    const [sumup, kartenzahlungen] = await Promise.all([
      sumupKontoLaden(ctx.db, ctx.praxis),
      notenZahlungen(ctx.db, ctx.praxis.id, note.id),
    ]);
    const bytes = await honorarnotePdf(inhalt, {
      bezahltAm: note.bezahltAm,
      storniertAm: note.storniertAm,
      zahllink: sumup ? zahllinkUrl(ctx.praxis.schluessel, note.id) : null,
      kartenzahlungen,
    });
    await protokollieren(ctx, "pdf", "honorarnote", note.id);
    return {
      dateiname: `Honorarnote-${inhalt.nummer}.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  }),
});
