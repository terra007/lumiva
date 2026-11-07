import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function datenbankVerbinden(url: string) {
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Datenbank = ReturnType<typeof datenbankVerbinden>;
