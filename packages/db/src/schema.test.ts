import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { naechsteHonorarnoteNummer } from "./nummernkreis";
import * as schema from "./schema";

const db = drizzle(new PGlite(), { schema, casing: "snake_case" });
let praxisId: string;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  const [praxis] = await db
    .insert(schema.praxen)
    .values({ name: "Praxis Test", anschrift: "Wien", datenschluesselEnc: "x" })
    .returning();
  praxisId = praxis?.id ?? "";
});

describe("Datenbankschema", () => {
  it("lässt sich auf eine leere Datenbank anwenden", async () => {
    const praxen = await db.select().from(schema.praxen);
    expect(praxen).toHaveLength(1);
  });

  it("vergibt Honorarnotennummern lückenlos je Jahr", async () => {
    const naechste = (jahr: number) =>
      db.transaction((tx) => naechsteHonorarnoteNummer(tx, praxisId, jahr));
    expect(await naechste(2026)).toBe(1);
    expect(await naechste(2026)).toBe(2);
    expect(await naechste(2027)).toBe(1);
    expect(await naechste(2026)).toBe(3);
  });

  it("gibt eine Nummer zurück, wenn die Honorarnote nicht gespeichert werden kann", async () => {
    await expect(
      db.transaction(async (tx) => {
        await naechsteHonorarnoteNummer(tx, praxisId, 2030);
        throw new Error("Speichern fehlgeschlagen");
      }),
    ).rejects.toThrow();
    expect(await db.transaction((tx) => naechsteHonorarnoteNummer(tx, praxisId, 2030))).toBe(1);
  });

  it("verhindert doppelte Honorarnotennummern", async () => {
    const [patient] = await db
      .insert(schema.patienten)
      .values({
        praxisId,
        therapeutId: "t1",
        vornameEnc: "a",
        nachnameEnc: "b",
        geburtsdatumEnc: "c",
        versicherungstraeger: "oegk",
      })
      .returning();
    const note = {
      praxisId,
      patientId: patient?.id ?? "",
      jahr: 2026,
      laufendeNummer: 1,
      ausgestelltAm: "2026-11-07",
      summeCent: 9000,
      inhaltEnc: "x",
    };
    await db.insert(schema.honorarnoten).values(note);
    await expect(db.insert(schema.honorarnoten).values(note)).rejects.toThrow();
  });

  it("verhindert Verweise auf Patient:innen einer anderen Praxis", async () => {
    const [andere] = await db
      .insert(schema.praxen)
      .values({ name: "Andere Praxis", anschrift: "Graz", datenschluesselEnc: "x" })
      .returning();
    const [patient] = await db
      .insert(schema.patienten)
      .values({
        praxisId,
        therapeutId: "t1",
        vornameEnc: "a",
        nachnameEnc: "b",
        geburtsdatumEnc: "c",
        versicherungstraeger: "oegk",
      })
      .returning();
    await expect(
      db.insert(schema.termine).values({
        praxisId: andere?.id ?? "",
        patientId: patient?.id ?? "",
        therapeutId: "t2",
        beginn: new Date("2026-11-09T09:00:00Z"),
        ende: new Date("2026-11-09T09:50:00Z"),
        honorarCent: 9000,
      }),
    ).rejects.toThrow();
  });
});
