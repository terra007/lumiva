import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";

const migrationen = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const vorher = mkdtempSync(path.join(tmpdir(), "lumiva-migration-"));

afterAll(() => rmSync(vorher, { recursive: true, force: true }));

/** Kopie der Migrationen bis vor die Trennung der Anschrift. */
function migrationenBis(tag: string) {
  cpSync(migrationen, vorher, { recursive: true });
  const journalPfad = path.join(vorher, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPfad, "utf8"));
  const bis = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
  journal.entries = journal.entries.slice(0, bis);
  writeFileSync(journalPfad, JSON.stringify(journal));
  return vorher;
}

describe("Migration 0006: Anschrift getrennt", () => {
  it("teilt bestehende Anschriften der Praxis in Straße, PLZ und Ort", async () => {
    const pg = new PGlite();
    const db = drizzle(pg);
    await migrate(db, { migrationsFolder: migrationenBis("0006_anschrift_getrennt") });
    await pg.query(
      `INSERT INTO praxen (name, anschrift, datenschluessel_enc) VALUES
        ('A', 'Musterstraße 1, 1010 Wien', 'x'),
        ('B', 'Hof 2, Stiege 3, 8010 Graz', 'x'),
        ('C', '1020 Wien', 'x'),
        ('D', 'irgendwo', 'x')`,
    );
    await migrate(db, { migrationsFolder: migrationen });
    const { rows } = await pg.query("SELECT name, strasse, plz, ort FROM praxen ORDER BY name");
    expect(rows).toEqual([
      { name: "A", strasse: "Musterstraße 1", plz: "1010", ort: "Wien" },
      { name: "B", strasse: "Hof 2, Stiege 3", plz: "8010", ort: "Graz" },
      { name: "C", strasse: "", plz: "1020", ort: "Wien" },
      { name: "D", strasse: "irgendwo", plz: "", ort: "" },
    ]);
  });
});
