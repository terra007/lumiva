import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Datenbank = PgDatabase<PgQueryResultHKT, typeof schema>;

// Als Funktion mit variablem Pfad, damit Bundler (Next.js) den Ordner nicht als Asset auflösen wollen.
const standardMigrationen = () => path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

export type Verbindung =
  /** Produktiv: PostgreSQL-Server (in der EU gehostet). */
  | { art: "postgres"; url: string; migrationen?: string }
  /** Entwicklung und Tests: eingebettetes PostgreSQL, ohne Installation. Ohne Ordner nur im Speicher. */
  | { art: "pglite"; ordner?: string; migrationen?: string };

/**
 * Verbindet und bringt das Schema auf den neuesten Stand.
 * `migrationen` nur angeben, wenn der Code gebündelt läuft (z. B. in Next.js) und der Standardpfad nicht stimmt.
 */
export async function datenbankVerbinden(v: Verbindung): Promise<Datenbank> {
  if (v.art === "postgres") {
    const db = drizzlePostgres(postgres(v.url, { prepare: false }), {
      schema,
      casing: "snake_case",
    });
    await migratePostgres(db, { migrationsFolder: v.migrationen ?? standardMigrationen() });
    return db as unknown as Datenbank;
  }
  if (v.ordner) mkdirSync(v.ordner, { recursive: true });
  const db = drizzlePglite(new PGlite(v.ordner), { schema, casing: "snake_case" });
  await migratePglite(db, { migrationsFolder: v.migrationen ?? standardMigrationen() });
  return db as unknown as Datenbank;
}
