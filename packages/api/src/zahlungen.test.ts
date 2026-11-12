import { type Datenbank, datenbankVerbinden, schema } from "@lumiva/db";
import { neuerSchluessel } from "@lumiva/db/crypto";
import { wienDatum } from "@lumiva/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createCaller,
  demoCheckoutBezahlen,
  onlineZahlungStarten,
  sumupWebhook,
  zahlseiteLaden,
} from "./index";
import { kontextErstellen } from "./kontext";
import { centZuEuro } from "./sumup";

let db: Datenbank;
const hauptschluessel = neuerSchluessel();

/** Nachgebaute SumUp-API: merkt sich Anfragen und antwortet wie die echte (laut Doku). */
const sumup = {
  anfragen: [] as { methode: string; pfad: string; body: unknown; auth: string | null }[],
  checkouts: new Map<string, { status: string; amount: number }>(),
  transaktionen: new Map<string, { status: string; amount: number }>(),
  zaehler: 0,
};

async function sumupAttrappe(eingabe: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(eingabe));
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  const auth = new Headers(init?.headers).get("authorization");
  sumup.anfragen.push({ methode: init?.method ?? "GET", pfad: url.pathname, body, auth });
  const json = (daten: unknown, status = 200) => Response.json(daten, { status });
  if (auth !== "Bearer sup_sk_test") return json({ message: "Unauthorized" }, 401);
  const p = url.pathname;
  if (p === "/v0.1/merchants/MTEST123/readers" && init?.method === "POST")
    return json({ id: "rdr_TEST", name: body.name, status: "paired" }, 201);
  if (p === "/v0.1/merchants/MTEST123/readers/rdr_TEST/checkout") {
    const id = `ctx-${++sumup.zaehler}`;
    sumup.transaktionen.set(id, { status: "PENDING", amount: body.total_amount.value / 100 });
    return json({ data: { client_transaction_id: id } }, 201);
  }
  if (p === "/v2.1/merchants/MTEST123/transactions") {
    const t = sumup.transaktionen.get(url.searchParams.get("client_transaction_id") ?? "");
    return t ? json({ ...t, transaction_code: "TX1" }) : json({ error_code: "NOT_FOUND" }, 404);
  }
  if (p === "/v0.1/checkouts" && init?.method === "POST") {
    const id = `chk-${++sumup.zaehler}`;
    sumup.checkouts.set(id, { status: "PENDING", amount: body.amount });
    return json({ id, status: "PENDING", hosted_checkout_url: `https://checkout.sumup.com/${id}` });
  }
  if (p.startsWith("/v0.1/checkouts/")) {
    const c = sumup.checkouts.get(p.split("/").pop() ?? "");
    return c ? json({ id: p, ...c }) : json({}, 404);
  }
  return json({}, 404);
}

async function kontextFuer(benutzer: { id: string; name: string; email: string }) {
  const auth = {
    api: { getSession: async () => ({ user: { ...benutzer, twoFactorEnabled: true } }) },
  } as never;
  return kontextErstellen({ db, auth, headers: new Headers(), hauptschluessel });
}

/** Praxis mit einer Patientin und einer erledigten, abgerechneten Sitzung (90 €). */
async function praxisMitNote() {
  const maria = { id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" };
  await db.insert(schema.user).values(maria);
  await createCaller(await kontextFuer(maria)).praxis.anlegen({
    name: "Praxis Muster",
    strasse: "Musterstraße 1",
    plz: "1010",
    ort: "Wien",
  });
  const api = createCaller(await kontextFuer(maria));
  const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
  const { id: patientId } = await api.patienten.anlegen({
    vorname: "Anna",
    nachname: "Berger",
    geburtsdatum: "1988-04-12",
    svNummer: "1237 010180",
    versicherungstraeger: "oegk",
    kontakt: { telefon: "", email: "", strasse: "Testgasse 2", plz: "1020", ort: "Wien" },
  });
  await api.doku.anlegen({
    patientId,
    art: "erstgespraech",
    inhalt: "x",
    diagnoseIcd10: ["F32.1"],
  });
  const neueNote = async (beginn: string) => {
    await api.termine.anlegen({
      patientId,
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date(beginn),
    });
    const von = new Date(beginn);
    const offen = await api.termine.zeitraum({ von, bis: new Date(von.getTime() + 86_400_000) });
    for (const t of offen) await api.termine.status({ id: t.id, status: "erledigt" });
    return api.honorarnoten.ausstellen({
      patientId,
      terminIds: (await api.honorarnoten.offen({ patientId })).map((o) => o.id),
    });
  };
  return { api, neueNote };
}

beforeAll(async () => {
  db = await datenbankVerbinden({ art: "pglite" });
  vi.stubGlobal("fetch", vi.fn(sumupAttrappe));
  vi.stubEnv("LUMIVA_URL", "https://lumiva.example.at");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SumUp", () => {
  it("rechnet Cent genau in Euro um", () => {
    expect(centZuEuro(9000)).toBe(90);
    expect(centZuEuro(12345)).toBe(123.45);
    expect(() => centZuEuro(10.5)).toThrow();
  });

  it("kassiert am Terminal und vermerkt die Honorarnote als bezahlt", async () => {
    const { api, neueNote } = await praxisMitNote();
    expect(await api.zahlungen.verfuegbar()).toMatchObject({ online: false, terminal: false });

    await api.zahlungen.speichern({
      haendlerCode: "mtest123",
      apiSchluessel: "sup_sk_test",
      affiliateAppId: "at.lumiva",
      affiliateSchluessel: "aff_test",
    });
    const [konto] = await db.select().from(schema.sumupKonten);
    expect(konto?.apiSchluesselEnc).not.toContain("sup_sk_test");
    expect(await api.zahlungen.einstellungen()).toMatchObject({
      haendlerCode: "MTEST123",
      apiSchluesselGesetzt: true,
    });

    await api.zahlungen.terminalKoppeln({ code: "abcd1234", name: "Empfang" });
    expect(await api.zahlungen.verfuegbar()).toMatchObject({
      terminal: true,
      terminalName: "Empfang",
    });

    const note = await neueNote("2026-11-02T08:00:00Z");
    const { zahlungId } = await api.zahlungen.terminalStarten({ honorarnoteId: note.id });
    // Doppelklick startet keine zweite Zahlung.
    expect(await api.zahlungen.terminalStarten({ honorarnoteId: note.id })).toMatchObject({
      zahlungId,
      betragCent: 9000,
      demo: false,
    });

    const anSolo = sumup.anfragen.find((a) => a.pfad.endsWith("/readers/rdr_TEST/checkout"));
    expect(anSolo?.body).toEqual({
      total_amount: { value: 9000, currency: "EUR", minor_unit: 2 },
      description: `Honorarnote ${note.nummer}`,
      return_url: `https://lumiva.example.at/api/sumup/webhook/${zahlungId}`,
      affiliate: { app_id: "at.lumiva", key: "aff_test" },
    });
    // Keine Gesundheitsdaten an SumUp.
    expect(JSON.stringify(sumup.anfragen)).not.toMatch(/Anna|Berger|F32/);

    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "offen" });
    sumup.transaktionen.set("ctx-1", { status: "SUCCESSFUL", amount: 90 });
    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "bezahlt" });
    // Der Webhook danach ändert nichts mehr.
    await sumupWebhook({ db, hauptschluessel, zahlungId });

    const [liste] = await api.honorarnoten.liste();
    expect(liste?.bezahltAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const eintraege = await db
      .select()
      .from(schema.protokoll)
      .where(and(eq(schema.protokoll.objektId, note.id), eq(schema.protokoll.aktion, "bezahlt")));
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.benutzerId).toBe("sumup");
    await expect(api.zahlungen.terminalStarten({ honorarnoteId: note.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("bezahlt online über den Link auf der Honorarnote, bestätigt per Webhook", async () => {
    const api = createCaller(
      await kontextFuer({ id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" }),
    );
    const [patient] = await api.patienten.liste();
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    await api.termine.anlegen({
      patientId: patient?.id ?? "",
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date("2026-11-03T08:00:00Z"),
    });
    const [termin] = await api.termine.zeitraum({
      von: new Date("2026-11-03"),
      bis: new Date("2026-11-04"),
    });
    await api.termine.status({ id: termin?.id ?? "", status: "erledigt" });
    const note = await api.honorarnoten.ausstellen({
      patientId: patient?.id ?? "",
      terminIds: [termin?.id ?? ""],
    });

    const { url } = await api.zahlungen.link({ honorarnoteId: note.id });
    expect(url).toMatch(new RegExp(`^https://lumiva.example.at/bezahlen/${note.id}\\.`));
    const token = url.split("/").pop() ?? "";

    // Falsche Prüfsumme: kein Zugriff.
    expect(await zahlseiteLaden({ db, hauptschluessel, token: `${note.id}.falsch` })).toBeNull();
    expect(await zahlseiteLaden({ db, hauptschluessel, token })).toEqual({
      praxisName: "Praxis Muster",
      nummer: note.nummer,
      summeCent: 9000,
      status: "offen",
      online: true,
    });

    const start = await onlineZahlungStarten({ db, hauptschluessel, token });
    expect(start).toMatchObject({ url: expect.stringContaining("https://checkout.sumup.com/") });
    // Neu laden verwendet dieselbe Zahlseite.
    expect(await onlineZahlungStarten({ db, hauptschluessel, token })).toEqual(start);
    const checkouts = sumup.anfragen.filter((a) => a.pfad === "/v0.1/checkouts");
    expect(checkouts).toHaveLength(1);
    expect(checkouts[0]?.body).toMatchObject({
      amount: 90,
      currency: "EUR",
      merchant_code: "MTEST123",
      description: `Honorarnote ${note.nummer}`,
      hosted_checkout: { enabled: true },
    });

    const [zahlung] = await db
      .select()
      .from(schema.zahlungen)
      .where(eq(schema.zahlungen.honorarnoteId, note.id));
    const checkoutId = zahlung?.anbieterId ?? "";
    // Gefälschter Webhook ohne Zahlung bei SumUp: bleibt offen.
    await sumupWebhook({ db, hauptschluessel, zahlungId: zahlung?.id ?? "" });
    expect((await zahlseiteLaden({ db, hauptschluessel, token }))?.status).toBe("offen");

    sumup.checkouts.set(checkoutId, { status: "PAID", amount: 90 });
    expect(await sumupWebhook({ db, hauptschluessel, zahlungId: zahlung?.id ?? "" })).toBe(true);
    expect((await zahlseiteLaden({ db, hauptschluessel, token }))?.status).toBe("bezahlt");
    expect(await onlineZahlungStarten({ db, hauptschluessel, token })).toEqual({
      fehler: "Diese Honorarnote ist bereits bezahlt.",
    });
  });

  it("vermerkt nichts als bezahlt, wenn der Betrag nicht stimmt", async () => {
    const api = createCaller(
      await kontextFuer({ id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" }),
    );
    const [patient] = await api.patienten.liste();
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    await api.termine.anlegen({
      patientId: patient?.id ?? "",
      sitzungsartId: einzel?.id ?? "",
      beginn: new Date("2026-11-04T08:00:00Z"),
    });
    const [termin] = await api.termine.zeitraum({
      von: new Date("2026-11-04"),
      bis: new Date("2026-11-05"),
    });
    await api.termine.status({ id: termin?.id ?? "", status: "erledigt" });
    const note = await api.honorarnoten.ausstellen({
      patientId: patient?.id ?? "",
      terminIds: [termin?.id ?? ""],
    });
    const { zahlungId } = await api.zahlungen.terminalStarten({ honorarnoteId: note.id });
    const [zahlung] = await db
      .select()
      .from(schema.zahlungen)
      .where(eq(schema.zahlungen.id, zahlungId));
    sumup.transaktionen.set(zahlung?.anbieterId ?? "", { status: "SUCCESSFUL", amount: 1 });
    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "fehlgeschlagen" });
    const noten = await api.honorarnoten.liste();
    expect(noten.find((n) => n.id === note.id)?.bezahltAm).toBeNull();
  });
});

describe("Kassieren nach der Sitzung", () => {
  it("kassiert jede Sitzung gleich danach und rechnet das auf der Honorarnote an", async () => {
    const api = createCaller(
      await kontextFuer({ id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" }),
    );
    const heute = wienDatum(new Date());
    const [patient] = await api.patienten.liste();
    const patientId = patient?.id ?? "";
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    const sitzung = async (tag: string) => {
      await api.termine.anlegen({
        patientId,
        sitzungsartId: einzel?.id ?? "",
        beginn: new Date(`${tag}T08:00:00Z`),
      });
      const [t] = await api.termine.zeitraum({
        von: new Date(`${tag}T00:00:00Z`),
        bis: new Date(`${tag}T23:00:00Z`),
      });
      if (!t) throw new Error("Termin fehlt");
      return t;
    };
    const kassieren = async (terminId: string, abschliessen = false) => {
      const { zahlungId } = await api.zahlungen.terminalStarten({ terminId, abschliessen });
      const [z] = await db
        .select()
        .from(schema.zahlungen)
        .where(eq(schema.zahlungen.id, zahlungId));
      sumup.transaktionen.set(z?.anbieterId ?? "", { status: "SUCCESSFUL", amount: 90 });
      expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "bezahlt" });
    };

    // Noch geplant: erst nach der Sitzung, dann ein Klick für erledigt und kassieren.
    const a = await sitzung("2026-10-20");
    await expect(api.zahlungen.terminalStarten({ terminId: a.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const vorher = sumup.anfragen.length;
    await kassieren(a.id, true);
    const anSolo = sumup.anfragen.slice(vorher).find((x) => x.pfad.endsWith("/checkout"));
    expect(anSolo?.body).toMatchObject({
      total_amount: { value: 9000, currency: "EUR", minor_unit: 2 },
      description: "Honorar 20.10.2026",
    });
    expect(JSON.stringify(sumup.anfragen)).not.toMatch(/Anna|Berger|F32|Einzelsitzung/);
    const [nachher] = await api.termine.zeitraum({
      von: new Date("2026-10-20T00:00:00Z"),
      bis: new Date("2026-10-21T00:00:00Z"),
    });
    expect(nachher).toMatchObject({ status: "erledigt", bezahltAm: heute });
    // Bezahlt: kein zweites Mal, und der Status bleibt.
    await expect(api.zahlungen.terminalStarten({ terminId: a.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(api.termine.status({ id: a.id, status: "abgesagt" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    // Zweite Sitzung bleibt offen; die Note über beide verlangt nur noch den Rest.
    const b = await sitzung("2026-10-27");
    await api.termine.status({ id: b.id, status: "erledigt" });
    const offen = await api.honorarnoten.offen({ patientId });
    expect(offen.find((t) => t.id === a.id)?.bezahltAm).toBe(heute);
    expect(offen.find((t) => t.id === b.id)?.bezahltAm).toBeNull();
    const note = await api.honorarnoten.ausstellen({ patientId, terminIds: [a.id, b.id] });
    let eintrag = (await api.honorarnoten.liste()).find((n) => n.id === note.id);
    expect(eintrag).toMatchObject({ summeCent: 18000, offenCent: 9000, bezahltAm: null });
    const { url } = await api.zahlungen.link({ honorarnoteId: note.id });
    const seite = await zahlseiteLaden({ db, hauptschluessel, token: url.split("/").pop() ?? "" });
    expect(seite?.summeCent).toBe(9000);
    expect((await api.honorarnoten.pdf({ id: note.id })).base64.length).toBeGreaterThan(100);

    const { zahlungId } = await api.zahlungen.terminalStarten({ honorarnoteId: note.id });
    const [rest] = await db
      .select()
      .from(schema.zahlungen)
      .where(eq(schema.zahlungen.id, zahlungId));
    expect(rest?.betragCent).toBe(9000);
    sumup.transaktionen.set(rest?.anbieterId ?? "", { status: "SUCCESSFUL", amount: 90 });
    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "bezahlt" });
    eintrag = (await api.honorarnoten.liste()).find((n) => n.id === note.id);
    expect(eintrag?.bezahltAm).toBe(heute);

    // Alle Sitzungen schon bezahlt: Die Note ist gleich beim Ausstellen bezahlt.
    const c = await sitzung("2026-10-13");
    await api.termine.status({ id: c.id, status: "erledigt" });
    await kassieren(c.id);
    const voll = await api.honorarnoten.ausstellen({ patientId, terminIds: [c.id] });
    expect((await api.honorarnoten.liste()).find((n) => n.id === voll.id)?.bezahltAm).toBe(heute);
  });
});

describe("SumUp-Demo", () => {
  it("simuliert Terminal und Online-Zahlung ohne Anfrage an SumUp", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const api = createCaller(
      await kontextFuer({ id: "maria", name: "Mag. Maria Muster", email: "maria@test.at" }),
    );
    await api.zahlungen.demoEinschalten();
    expect(await api.zahlungen.verfuegbar()).toMatchObject({ demo: true, terminal: true });
    const vorher = sumup.anfragen.length;

    const [patient] = await api.patienten.liste();
    const [einzel] = (await api.praxis.sitzungsarten()).filter((s) => s.name === "Einzelsitzung");
    const neueNote = async (tag: string) => {
      await api.termine.anlegen({
        patientId: patient?.id ?? "",
        sitzungsartId: einzel?.id ?? "",
        beginn: new Date(`${tag}T08:00:00Z`),
      });
      const [t] = await api.termine.zeitraum({
        von: new Date(`${tag}T00:00:00Z`),
        bis: new Date(`${tag}T23:00:00Z`),
      });
      await api.termine.status({ id: t?.id ?? "", status: "erledigt" });
      return api.honorarnoten.ausstellen({
        patientId: patient?.id ?? "",
        terminIds: [t?.id ?? ""],
      });
    };

    const terminalNote = await neueNote("2026-11-05");
    const { zahlungId } = await api.zahlungen.terminalStarten({ honorarnoteId: terminalNote.id });
    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "offen" });
    vi.setSystemTime(Date.now() + 7_000);
    expect(await api.zahlungen.status({ zahlungId })).toEqual({ status: "bezahlt" });

    const onlineNote = await neueNote("2026-11-06");
    const { url } = await api.zahlungen.link({ honorarnoteId: onlineNote.id });
    const token = url.split("/").pop() ?? "";
    const start = await onlineZahlungStarten({ db, hauptschluessel, token });
    if (!("url" in start)) throw new Error(start.fehler);
    expect(start.url).toContain("/bezahlen/demo-kasse/demo-");
    const id = start.url.split("/").pop() ?? "";
    expect(demoCheckoutBezahlen(id)).toBe(`https://lumiva.example.at/bezahlen/${token}`);
    expect((await zahlseiteLaden({ db, hauptschluessel, token }))?.status).toBe("bezahlt");

    expect(sumup.anfragen.length).toBe(vorher);
    vi.useRealTimers();
  });
});
