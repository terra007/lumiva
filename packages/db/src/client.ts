import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema";

export type Datenbank = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONEN = fileURLToPath(new URL("../drizzle", import.meta.url));

export type Verbindung =
  /** Produktiv: PostgreSQL-Server (in der EU gehostet). */
  | { art: "postgres"; url: string }
  /** Entwicklung und Tests: eingebettetes PostgreSQL, ohne Installation. Ohne Ordner nur im Speicher. */
  | { art: "pglite"; ordner?: string };

/** Verbindet und bringt das Schema auf den neuesten Stand. */
export async function datenbankVerbinden(v: Verbindung): Promise<Datenbank> {
  if (v.art === "postgres") {
    const db = drizzlePostgres(postgres(v.url, { prepare: false }), { schema, casing: "snake_case" });
    await migratePostgres(db, { migrationsFolder: MIGRATIONEN });
    return db as unknown as Datenbank;
  }
  if (v.ordner) mkdirSync(v.ordner, { recursive: true });
  const db = drizzlePglite(new PGlite(v.ordner), { schema, casing: "snake_case" });
  await migratePglite(db, { migrationsFolder: MIGRATIONEN });
  return db as unknown as Datenbank;
}
