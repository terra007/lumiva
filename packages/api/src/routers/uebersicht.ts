import { schema } from "@lumiva/db";
import { and, count, eq, isNull, sum } from "drizzle-orm";
import { patientenFilter } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { termineImZeitraum } from "./termine";

/** Beginn und Ende des heutigen Tages in Wien, als Zeitpunkte. */
export function heuteInWien(jetzt = new Date()) {
  const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(jetzt);
  // Versatz Wiens zu UTC zur Mittagszeit des Tages ermitteln (berücksichtigt Sommerzeit).
  const mittag = new Date(`${datum}T12:00:00Z`);
  const wienStunde = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23" }).format(mittag),
  );
  const versatzStunden = wienStunde - 12;
  const von = new Date(`${datum}T00:00:00Z`);
  von.setUTCHours(von.getUTCHours() - versatzStunden);
  return { datum, von, bis: new Date(von.getTime() + 24 * 60 * 60_000) };
}

export const uebersichtRouter = router({
  heute: inPraxis.query(async ({ ctx }) => {
    const { datum, von, bis } = heuteInWien();
    const termine = await termineImZeitraum(ctx, von, bis);
    const [aufgaben] = await ctx.db
      .select({ anzahl: count() })
      .from(schema.aufgaben)
      .where(
        and(
          eq(schema.aufgaben.praxisId, ctx.praxis.id),
          eq(schema.aufgaben.zustaendigId, ctx.benutzer.id),
          isNull(schema.aufgaben.erledigtAm),
        ),
      );
    const [offen] = await ctx.db
      .select({ anzahl: count(), summe: sum(schema.honorarnoten.summeCent) })
      .from(schema.honorarnoten)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
      .where(and(patientenFilter(ctx), isNull(schema.honorarnoten.bezahltAm), isNull(schema.honorarnoten.storniertAm)));
    const [aktiv] = await ctx.db
      .select({ anzahl: count() })
      .from(schema.patienten)
      .where(and(patientenFilter(ctx), eq(schema.patienten.status, "aktiv")));
    return {
      datum,
      termine,
      offeneAufgaben: aufgaben?.anzahl ?? 0,
      offeneHonorarnoten: { anzahl: offen?.anzahl ?? 0, summeCent: Number(offen?.summe ?? 0) },
      aktivePatienten: aktiv?.anzahl ?? 0,
    };
  }),
});
