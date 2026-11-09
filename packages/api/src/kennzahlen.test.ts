import { type Datenbank, datenbankVerbinden, schema } from "@lumiva/db";
import { neuerSchluessel } from "@lumiva/db/crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createCaller } from "./index";
import { kennzahlenBerechnen } from "./routers/kennzahlen";
import type { Kontext } from "./trpc";

let db: Datenbank;
const hauptschluessel = neuerSchluessel();
const maria = { id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" };

async function kontextFuer(benutzer: Kontext["benutzer"]): Promise<Kontext> {
  const { kontextErstellen } = await import("./kontext");
  const authAttrappe = {
    api: { getSession: async () => (benutzer ? { user: benutzer } : null) },
  } as unknown as Parameters<typeof kontextErstellen>[0]["auth"];
  return kontextErstellen({ db, auth: authAttrappe, headers: new Headers(), hauptschluessel });
}

beforeAll(async () => {
  db = await datenbankVerbinden({ art: "pglite" });
  await db.insert(schema.user).values(maria);
});

describe("Kennzahlen", () => {
  it("zählt Sitzungen, Umsatz, Patienten und Abwesenheiten im Zeitraum", async () => {
    await createCaller(await kontextFuer(maria)).praxis.anlegen({
      name: "Praxis Muster",
      strasse: "Musterstraße 1",
      plz: "1010",
      ort: "Wien",
    });
    const ctx = await kontextFuer(maria);
    const api = createCaller(ctx);
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    const { id: patientId } = await api.patienten.anlegen({
      vorname: "Anna",
      nachname: "Berger",
      geburtsdatum: "1988-04-12",
      svNummer: "1237 010180",
      versicherungstraeger: "oegk",
      kontakt: { telefon: "", email: "", strasse: "Testgasse 2", plz: "1020", ort: "Wien" },
    });
    // Montags 9:00 in Wien: 26.10., 2.11., 9.11., 16.11., 23.11.
    await api.termine.anlegen({
      patientId,
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date("2026-10-26T08:00:00Z"),
      anzahl: 5,
    });
    const termine = await api.termine.zeitraum({
      von: new Date("2026-10-01"),
      bis: new Date("2026-11-30"),
    });
    const [okt, nov2, nov9] = termine;
    await api.termine.status({ id: okt?.id ?? "", status: "erledigt" });
    await api.termine.status({ id: nov2?.id ?? "", status: "erledigt" });
    await api.termine.status({
      id: nov9?.id ?? "",
      status: "nicht_erschienen",
      ausfallhonorarCent: 5000,
    });

    await api.doku.anlegen({
      patientId,
      terminId: okt?.id,
      art: "erstgespraech",
      inhalt: "Erstgespräch",
      diagnoseIcd10: ["F32.1"],
    });
    const note = await api.honorarnoten.ausstellen({ patientId, terminIds: [okt?.id ?? ""] });
    await api.honorarnoten.bezahlt({ id: note.id, am: "2026-11-10" });

    await api.abwesenheiten.anlegen({ von: "2026-11-28", bis: "2026-12-03", art: "urlaub" });

    const jetzt = new Date("2026-11-12T12:00:00Z");
    const k = await kennzahlenBerechnen(
      ctx as Parameters<typeof kennzahlenBerechnen>[0],
      "monat",
      jetzt,
    );
    expect(k.zeitraum.bezeichnung).toBe("November 2026");
    expect(k.sitzungen).toMatchObject({
      geplant: 2,
      erledigt: 1,
      abgesagt: 0,
      nichtErschienen: 1,
      nichtVermerkt: 0,
      ausfallquote: 0.5,
    });
    expect(k.vorschau).toEqual({ naechste7Tage: 1, naechste4Wochen: 2 });
    expect(k.umsatz.geleistetCent).toBe(9000 + 5000);
    expect(k.umsatz.erwartetCent).toBe(18000);
    expect(k.umsatz.eingangCent).toBe(9000);
    expect(k.umsatz.offen).toEqual({ anzahl: 0, summeCent: 0 });
    expect(k.umsatz.nichtAbgerechnet).toEqual({ anzahl: 2, summeCent: 14000 });
    expect(k.patienten.aktiv).toBe(1);
    expect(k.abwesenheitsTage).toBe(3);
    expect(k.verlauf).toHaveLength(12);
    expect(k.verlauf.slice(-2)).toEqual([
      { monat: "2026-10", erledigt: 1 },
      { monat: "2026-11", erledigt: 1 },
    ]);

    // Über die API, ohne Gesundheitsdaten in der Antwort.
    const ueberApi = await api.kennzahlen.zeitraum({ art: "jahr" });
    expect(ueberApi.zeitraum.von).toMatch(/^\d{4}-01-01$/);
    expect(JSON.stringify(ueberApi)).not.toContain("Berger");
  });

  it("zeigt anderen Therapeuten nichts von fremden Patienten", async () => {
    const kollege = { id: "kollege", name: "Dr. Kollege", email: "kollege@test.at" };
    await db.insert(schema.user).values(kollege);
    const [m] = await db.select().from(schema.mitgliedschaften);
    await db
      .insert(schema.mitgliedschaften)
      .values({ praxisId: m?.praxisId ?? "", benutzerId: kollege.id, rolle: "therapeut" });
    const ctx = await kontextFuer(kollege);
    const k = await kennzahlenBerechnen(
      ctx as Parameters<typeof kennzahlenBerechnen>[0],
      "monat",
      new Date("2026-11-12T12:00:00Z"),
    );
    expect(k.sitzungen).toMatchObject({ geplant: 0, erledigt: 0, nichtErschienen: 0 });
    expect(k.umsatz.nichtAbgerechnet.anzahl).toBe(0);
    expect(k.patienten.aktiv).toBe(0);
    expect(k.abwesenheitsTage).toBe(0);
  });
});
