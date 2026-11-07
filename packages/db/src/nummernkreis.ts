import { sql } from "drizzle-orm";
import type { PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { nummernkreise } from "./schema";

/**
 * Vergibt die nächste Honorarnotennummer einer Praxis für ein Jahr.
 * Ein einziges UPSERT sperrt die Zeile, so entstehen auch bei gleichzeitigen Anfragen
 * keine Lücken und keine doppelten Nummern. Muss in derselben Transaktion laufen,
 * in der die Honorarnote gespeichert wird, sonst entsteht bei einem Fehler eine Lücke.
 */
export async function naechsteHonorarnoteNummer(
  // Bewusst nur eine Transaktion, keine normale Verbindung (siehe oben).
  // biome-ignore lint/suspicious/noExplicitAny: funktioniert mit jedem Drizzle-Postgres-Treiber
  tx: PgTransaction<PgQueryResultHKT, any, any>,
  praxisId: string,
  jahr: number,
): Promise<number> {
  const [zeile] = await tx
    .insert(nummernkreise)
    .values({ praxisId, jahr, letzteNummer: 1 })
    .onConflictDoUpdate({
      target: [nummernkreise.praxisId, nummernkreise.jahr],
      set: { letzteNummer: sql`${nummernkreise.letzteNummer} + 1` },
    })
    .returning({ nummer: nummernkreise.letzteNummer });
  if (!zeile) throw new Error("Nummernkreis konnte nicht fortgeschrieben werden");
  return zeile.nummer;
}
