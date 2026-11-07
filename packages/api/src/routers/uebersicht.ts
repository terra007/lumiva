import { schema } from "@lumiva/db";
import { tageAddieren, wienDatum, wienZuDate } from "@lumiva/domain";
import { and, count, eq, isNull, sum } from "drizzle-orm";
import { patientenFilter } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { termineImZeitraum } from "./termine";

/** Beginn und Ende des heutigen Tages in Wien, als Zeitpunkte. */
export function heuteInWien(jetzt = new Date()) {
  const datum = wienDatum(jetzt);
  return {
    datum,
    von: wienZuDate(datum, "00:00"),
    bis: wienZuDate(tageAddieren(datum, 1), "00:00"),
  };
}

export const uebersichtRouter = router({
  heute: inPraxis.query(async ({ ctx }) => {
    const { datum, von, bis } = heuteInWien();
    const [termine, [aufgaben], [offen], [aktiv]] = await Promise.all([
      termineImZeitraum(ctx, von, bis),
      ctx.db
        .select({ anzahl: count() })
        .from(schema.aufgaben)
        .where(
          and(
            eq(schema.aufgaben.praxisId, ctx.praxis.id),
            eq(schema.aufgaben.zustaendigId, ctx.benutzer.id),
            isNull(schema.aufgaben.erledigtAm),
          ),
        ),
      ctx.db
        .select({ anzahl: count(), summe: sum(schema.honorarnoten.summeCent) })
        .from(schema.honorarnoten)
        .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
        .where(
          and(
            patientenFilter(ctx),
            isNull(schema.honorarnoten.bezahltAm),
            isNull(schema.honorarnoten.storniertAm),
          ),
        ),
      ctx.db
        .select({ anzahl: count() })
        .from(schema.patienten)
        .where(and(patientenFilter(ctx), eq(schema.patienten.status, "aktiv"))),
    ]);
    return {
      datum,
      termine,
      offeneAufgaben: aufgaben?.anzahl ?? 0,
      offeneHonorarnoten: { anzahl: offen?.anzahl ?? 0, summeCent: Number(offen?.summe ?? 0) },
      aktivePatienten: aktiv?.anzahl ?? 0,
    };
  }),
});
