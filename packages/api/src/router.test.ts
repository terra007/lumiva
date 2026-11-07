import { type Datenbank, datenbankVerbinden, schema } from "@lumiva/db";
import { neuerSchluessel } from "@lumiva/db/crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createCaller } from "./index";
import type { Kontext } from "./trpc";

let db: Datenbank;
const hauptschluessel = neuerSchluessel();

async function benutzerAnlegen(id: string, name: string) {
  await db.insert(schema.user).values({ id, name, email: `${id}@test.at` });
  return { id, name, email: `${id}@test.at` };
}

/** Kontext wie im echten Server: Praxis und Schlüssel aus der Mitgliedschaft. */
async function kontextFuer(benutzer: Kontext["benutzer"]): Promise<Kontext> {
  const { kontextErstellen } = await import("./kontext");
  const authAttrappe = {
    api: { getSession: async () => (benutzer ? { user: benutzer } : null) },
  } as unknown as Parameters<typeof kontextErstellen>[0]["auth"];
  return kontextErstellen({ db, auth: authAttrappe, headers: new Headers(), hauptschluessel });
}

beforeAll(async () => {
  db = await datenbankVerbinden({ art: "pglite" });
});

describe("LUMIVA-API", () => {
  it("meldet ihren Status ohne Anmeldung und verlangt sonst eine Anmeldung", async () => {
    const api = createCaller(await kontextFuer(null));
    expect(await api.status()).toEqual({ name: "LUMIVA", claim: "Klarheit für deine Praxis." });
    await expect(api.patienten.liste()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deckt den Praxisalltag ab: Praxis, Patientin, Termin, Doku, Honorarnote", async () => {
    const maria = await benutzerAnlegen("maria", "Mag. Maria Muster");
    let api = createCaller(await kontextFuer(maria));
    await expect(api.patienten.liste()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await api.praxis.anlegen({ name: "Praxis Muster", anschrift: "Musterstraße 1, 1010 Wien" });
    api = createCaller(await kontextFuer(maria));
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    expect(einzel?.honorarCent).toBe(9000);

    const { id: patientId } = await api.patienten.anlegen({
      vorname: "Anna",
      nachname: "Berger",
      geburtsdatum: "1988-04-12",
      svNummer: "1237 010180",
      versicherungstraeger: "oegk",
      kontakt: { telefon: "", email: "", anschrift: "Testgasse 2, 1020 Wien" },
    });

    // Gesundheitsdaten liegen nur verschlüsselt in der Datenbank.
    const [roh] = await db.select().from(schema.patienten);
    expect(roh?.nachnameEnc).not.toContain("Berger");

    await api.termine.anlegen({
      patientId,
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date("2026-11-02T08:00:00Z"),
      anzahl: 3,
    });
    const termine = await api.termine.zeitraum({
      von: new Date("2026-11-01"),
      bis: new Date("2026-11-30"),
    });
    expect(termine.map((t) => t.patientName)).toEqual([
      "Anna Berger",
      "Anna Berger",
      "Anna Berger",
    ]);
    const [erster] = termine;
    await api.termine.status({ id: erster?.id ?? "", status: "erledigt" });

    const details = await api.patienten.details({ id: patientId });
    expect(details.sitzungen).toBe(1);
    expect(details.hinweise).toEqual([{ art: "aerztliche-bestaetigung-fehlt" }]);

    // Ohne Diagnose keine Honorarnote für den Kostenzuschuss.
    await expect(
      api.honorarnoten.ausstellen({ patientId, terminIds: [erster?.id ?? ""] }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await api.doku.anlegen({
      patientId,
      terminId: erster?.id,
      art: "erstgespraech",
      inhalt: "Erstgespräch",
      diagnoseIcd10: ["f32.1", "F41.1", "F32.1"],
    });
    expect((await api.doku.liste({ patientId }))[0]?.diagnoseIcd10).toBe("F32.1, F41.1");

    // Transkript getrennt gespeichert; Löschen legt nur in den Papierkorb.
    const { id: notizId } = await api.doku.anlegen({
      patientId,
      art: "notiz",
      inhalt: "- Thema: Schlaf",
      transkript: "Heute ging es um Schlaf.",
      diagnoseIcd10: ["F51.0"],
    });
    const mitTranskript = (await api.doku.liste({ patientId })).find((e) => e.id === notizId);
    expect(mitTranskript?.transkript).toBe("Heute ging es um Schlaf.");
    await api.doku.loeschen({ id: notizId });
    const geloescht = (await api.doku.liste({ patientId })).find((e) => e.id === notizId);
    expect(geloescht?.geloeschtAm).toBeInstanceOf(Date);
    await api.doku.wiederherstellen({ id: notizId });
    expect(
      (await api.doku.liste({ patientId })).find((e) => e.id === notizId)?.geloeschtAm,
    ).toBeNull();
    await api.doku.loeschen({ id: notizId });

    const offen = await api.honorarnoten.offen({ patientId });
    expect(offen).toHaveLength(1);
    const note = await api.honorarnoten.ausstellen({
      patientId,
      terminIds: offen.map((o) => o.id),
    });
    expect(note.nummer).toMatch(/^\d{4}-0001$/);
    expect(await api.honorarnoten.offen({ patientId })).toHaveLength(0);

    const pdf = await api.honorarnoten.pdf({ id: note.id });
    expect(Buffer.from(pdf.base64, "base64").subarray(0, 4).toString()).toBe("%PDF");

    // Abgerechnete Termine lassen sich nicht mehr umstellen; nach Storno wieder abrechenbar.
    await expect(
      api.termine.status({ id: erster?.id ?? "", status: "abgesagt" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await api.honorarnoten.stornieren({ id: note.id });
    expect(await api.honorarnoten.offen({ patientId })).toHaveLength(1);

    // Serien behalten die Wiener Uhrzeit über die Zeitumstellung (25.10.2026).
    await api.termine.anlegen({
      patientId,
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date("2026-10-19T08:00:00Z"), // 10:00 Sommerzeit
      anzahl: 2,
    });
    const serie = await api.termine.zeitraum({
      von: new Date("2026-10-19"),
      bis: new Date("2026-10-27"),
    });
    expect(serie.map((t) => t.beginn.toISOString())).toEqual([
      "2026-10-19T08:00:00.000Z",
      "2026-10-26T09:00:00.000Z", // weiterhin 10:00, jetzt Winterzeit
    ]);

    const uebersicht = await api.uebersicht.heute();
    expect(uebersicht.aktivePatienten).toBe(1);
  });

  it("trennt Praxen und schützt Akten vor der Assistenz", async () => {
    const fremd = await benutzerAnlegen("fremd", "Dr. Fremd");
    let apiFremd = createCaller(await kontextFuer(fremd));
    await apiFremd.praxis.anlegen({ name: "Andere Praxis", anschrift: "Hauptplatz 1, 8010 Graz" });
    apiFremd = createCaller(await kontextFuer(fremd));
    expect(await apiFremd.patienten.liste()).toEqual([]);

    const [maria] = await db.select().from(schema.mitgliedschaften);
    const assistenz = await benutzerAnlegen("assistenz", "Alex Assistenz");
    await db
      .insert(schema.mitgliedschaften)
      .values({ praxisId: maria?.praxisId ?? "", benutzerId: assistenz.id, rolle: "assistenz" });
    const apiAssistenz = createCaller(await kontextFuer(assistenz));
    const [patient] = await apiAssistenz.patienten.liste();
    expect(patient?.nachname).toBe("Berger");
    await expect(apiAssistenz.doku.liste({ patientId: patient?.id ?? "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const [note] = await apiAssistenz.honorarnoten.liste();
    await expect(apiAssistenz.honorarnoten.pdf({ id: note?.id ?? "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(apiFremd.patienten.details({ id: patient?.id ?? "" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("legt Demo-Daten an", async () => {
    const demo = await benutzerAnlegen("demo", "Demo Therapeutin");
    let api = createCaller(await kontextFuer(demo));
    await api.praxis.anlegen({ name: "Demo-Praxis", anschrift: "Ring 1, 1010 Wien" });
    api = createCaller(await kontextFuer(demo));
    await api.demo.laden();
    expect(await api.patienten.liste()).toHaveLength(6);
    await expect(api.demo.laden()).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
