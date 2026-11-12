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
  const abgemeldet: Kontext = {
    db,
    hauptschluessel,
    benutzer: null,
    praxis: null,
    zweiFaktorFehlt: false,
  };
  const sitzung = await auth.api.getSession({ headers });
  if (!sitzung) return abgemeldet;

  const { user } = sitzung;
  // Eine Sitzung von vor der Einrichtung hat den zweiten Faktor nie durchlaufen: abmelden.
  if (
    user.twoFactorEnabled &&
    user.zweiFaktorSeit &&
    sitzung.session.createdAt < user.zweiFaktorSeit
  ) {
    await db.delete(schema.session).where(eq(schema.session.id, sitzung.session.id));
    return abgemeldet;
  }
  const benutzer = { id: user.id, name: user.name, email: user.email };
  const ohnePraxis: Kontext = { ...abgemeldet, benutzer, zweiFaktorFehlt: !user.twoFactorEnabled };
  // Ohne zweiten Faktor wird der Datenschlüssel der Praxis gar nicht erst entpackt.
  if (ohnePraxis.zweiFaktorFehlt) return ohnePraxis;
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

  if (!zeile) return ohnePraxis;
  return {
    ...ohnePraxis,
    praxis: {
      id: zeile.id,
      name: zeile.name,
      rolle: zeile.rolle as Rolle,
      schluessel: datenschluesselEntpacken(zeile.schluesselEnc, hauptschluessel, zeile.id),
    },
  };
}
