import { schema } from "@lumiva/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dokuEntwurf, KiFehler, kiKonfiguration, MAX_AUDIO_BYTES, transkribieren } from "../ki";
import { patientLaden } from "../sichtbarkeit";
import { router, therapeutisch } from "../trpc";
import { protokollieren } from "../werkzeuge";

export const kiRouter = router({
  /** Ist auf diesem Server eine KI eingerichtet? */
  verfuegbar: therapeutisch.query(() => kiKonfiguration() !== null),

  /**
   * Aufnahme zu Doku-Entwurf. Gespeichert wird nichts: weder Aufnahme noch Transkript.
   * Das Transkript kommt mit, damit die Therapeut:in den Entwurf daran prüfen kann.
   * Den Entwurf prüft und speichert die Therapeut:in selbst als Doku-Eintrag.
   */
  entwurf: therapeutisch
    .input(
      z.object({
        patientId: z.uuid(),
        art: z.enum(schema.eintragArt.enumValues),
        /** diktat: Therapeut:in spricht nach der Sitzung; sitzung: Aufnahme der ganzen Sitzung. */
        modus: z.enum(["diktat", "sitzung"]),
        audio: z.instanceof(Uint8Array).refine((a) => a.byteLength > 0, "Aufnahme ist leer"),
        mimeType: z.string().regex(/^audio\/[\w.+-]+(;.*)?$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const k = kiKonfiguration();
      if (!k) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Auf diesem Server ist keine KI eingerichtet.",
        });
      }
      if (input.audio.byteLength > MAX_AUDIO_BYTES) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Die Aufnahme ist zu lang." });
      }
      const patient = await patientLaden(ctx, input.patientId);
      // Aufnahme einer Sitzung nur mit dokumentierter Einwilligung (DSGVO Art. 9 Abs. 2 lit. a).
      if (input.modus === "sitzung" && !patient.kiAufnahmeEinwilligungAm) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Für die Aufnahme der Sitzung fehlt die Einwilligung der Patient:in.",
        });
      }
      // Vor der Verarbeitung protokollieren: Auch ein fehlgeschlagener Versuch ist ein Aktenzugriff.
      await protokollieren(ctx, "ki-entwurf", "patient", patient.id, { modus: input.modus });
      try {
        const transkript = await transkribieren(k, input.audio, input.mimeType);
        if (!transkript) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "In der Aufnahme war keine Sprache zu erkennen.",
          });
        }
        const entwurf = await dokuEntwurf(k, transkript, input.art, input.modus);
        // Das Transkript geht zur Kontrolle zurück, gespeichert wird es auch hier nicht.
        return { transkript, entwurf };
      } catch (e) {
        if (e instanceof KiFehler) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: e.message });
        }
        throw e;
      }
    }),
});
