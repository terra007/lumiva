import { type Datenbank, schema } from "@lumiva/db";
import { datenschluesselEntpacken } from "@lumiva/db/crypto";
import { eq } from "drizzle-orm";
import type { Auth } from "./auth";
import type { Kontext, Rolle } from "./trpc";

/** Baut den Kontext einer Anfrage: wer ist angemeldet, zu welcher Praxis gehört die Person. */
export async function kontextErstellen(opts: {
  db: Datenbank;
  auth: Auth;
  headers: Headers;
  hauptschluessel: Buffer;
}): Promise<Kontext> {
  const { db, auth, headers, hauptschluessel } = opts;
  const sitzung = await auth.api.getSession({ headers });
  if (!sitzung) return { db, benutzer: null, praxis: null, hauptschluessel };

  const benutzer = { id: sitzung.user.id, name: sitzung.user.name, email: sitzung.user.email };
  const [zeile] = await db
    .select({
      id: schema.praxen.id,
      name: schema.praxen.name,
      schluesselEnc: schema.praxen.datenschluesselEnc,
      rolle: schema.mitgliedschaften.rolle,
    })
    .from(schema.mitgliedschaften)
    .innerJoin(schema.praxen, eq(schema.praxen.id, schema.mitgliedschaften.praxisId))
    .where(eq(schema.mitgliedschaften.benutzerId, benutzer.id))
    .limit(1);

  if (!zeile) return { db, benutzer, praxis: null, hauptschluessel };
  return {
    db,
    benutzer,
    hauptschluessel,
    praxis: {
      id: zeile.id,
      name: zeile.name,
      rolle: zeile.rolle as Rolle,
      schluessel: datenschluesselEntpacken(zeile.schluesselEnc, hauptschluessel, zeile.id),
    },
  };
}
