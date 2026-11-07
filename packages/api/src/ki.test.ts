import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type Datenbank, datenbankVerbinden, schema } from "@lumiva/db";
import { neuerSchluessel } from "@lumiva/db/crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createCaller } from "./index";
import { kiKonfiguration } from "./ki";
import { kontextErstellen } from "./kontext";

let db: Datenbank;
const hauptschluessel = neuerSchluessel();
const benutzer = { id: "ki", name: "Mag. KI Test", email: "ki@test.at" };

async function api() {
  const auth = {
    api: { getSession: async () => ({ user: benutzer }) },
  } as unknown as Parameters<typeof kontextErstellen>[0]["auth"];
  return createCaller(
    await kontextErstellen({ db, auth, headers: new Headers(), hauptschluessel }),
  );
}

// KI-Attrappe mit den Schnittstellen von Speaches und Ollama.
const aufrufe: { pfad: string; body: string }[] = [];
let attrappe: Server;
let basis = "";
let chatAntwort = "Thema:\n- Schlaf";

beforeAll(async () => {
  attrappe = createServer((req, res) => {
    let body = "";
    req.on("data", (t) => {
      body += t;
    });
    req.on("end", () => {
      aufrufe.push({ pfad: req.url ?? "", body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/audio/transcriptions") {
        res.end(JSON.stringify({ text: "Thema heute war Schlaf." }));
      } else if (req.url === "/api/chat") {
        res.end(JSON.stringify({ message: { content: chatAntwort } }));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise<void>((r) => attrappe.listen(0, "127.0.0.1", r));
  basis = `http://127.0.0.1:${(attrappe.address() as AddressInfo).port}`;
  db = await datenbankVerbinden({ art: "pglite" });
  await db.insert(schema.user).values(benutzer);
  await (await api()).praxis.anlegen({ name: "KI-Praxis", anschrift: "Ring 1, 1010 Wien" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  attrappe.close();
});

describe("KI-Doku", () => {
  it("ist ohne Konfiguration aus und nutzt keinen fremden Anbieter", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", "");
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", "");
    expect(kiKonfiguration()).toBeNull();
    expect(await (await api()).ki.verfuegbar()).toBe(false);
  });

  it("macht aus einem Diktat einen Entwurf, Sitzungen nur mit Einwilligung", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", `${basis}/v1/`);
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", basis);
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL", "");
    const lumiva = await api();
    const { id: patientId } = await lumiva.patienten.anlegen({
      vorname: "Eva",
      nachname: "Diktat",
      geburtsdatum: "1990-01-01",
      svNummer: "",
      versicherungstraeger: "privat",
      kontakt: { telefon: "", email: "", anschrift: "" },
    });
    const eingabe = {
      patientId,
      art: "verlauf" as const,
      audio: new Uint8Array([1, 2, 3]),
      mimeType: "audio/webm;codecs=opus",
    };
    expect(await lumiva.ki.entwurf({ ...eingabe, modus: "diktat" })).toEqual({
      transkript: "Thema heute war Schlaf.",
      entwurf: "Thema:\n- Schlaf",
    });
    expect(aufrufe.map((a) => a.pfad)).toEqual(["/v1/audio/transcriptions", "/api/chat"]);
    expect(aufrufe[0]?.body).toMatch(/name="language"\r\n\r\nde/);
    expect(aufrufe[0]?.body).toMatch(/name="temperature"\r\n\r\n0/);
    expect(aufrufe[0]?.body).toMatch(/name="vad_filter"\r\n\r\ntrue/);
    const chat = JSON.parse(aufrufe[1]?.body ?? "{}");
    expect(chat.model).toBe("qwen2.5:7b-instruct"); // leere Variable fällt auf die Voreinstellung zurück
    expect(chat.options.num_ctx).toBeGreaterThanOrEqual(32_768);
    expect(chat.options.temperature).toBe(0);
    expect(chat.messages[1].content).toContain("Thema heute war Schlaf.");

    await expect(lumiva.ki.entwurf({ ...eingabe, modus: "sitzung" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await lumiva.patienten.bestaetigungen({
      id: patientId,
      aerztlicheBestaetigungAm: null,
      bewilligungAm: null,
      kiAufnahmeEinwilligungAm: "2026-11-07",
    });
    expect((await lumiva.ki.entwurf({ ...eingabe, modus: "sitzung" })).entwurf).toBe(
      "Thema:\n- Schlaf",
    );
  });

  it("nimmt das Transkript, wenn das Modell nur einen leeren Entwurf liefert", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", `${basis}/v1`);
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", basis);
    chatAntwort = "-";
    const lumiva = await api();
    const [p] = await lumiva.patienten.liste();
    const ergebnis = await lumiva.ki.entwurf({
      patientId: p?.id ?? "",
      art: "verlauf",
      modus: "diktat",
      audio: new Uint8Array([1]),
      mimeType: "audio/webm",
    });
    chatAntwort = "Thema:\n- Schlaf";
    expect(ergebnis.entwurf).toBe("Thema heute war Schlaf.");
  });

  it("meldet einen nicht erreichbaren Dienst ohne Inhalte", async () => {
    // Port 9 (discard) ist auf 127.0.0.1 nicht offen.
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", "http://127.0.0.1:9/v1");
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", basis);
    const lumiva = await api();
    const [p] = await lumiva.patienten.liste();
    await expect(
      lumiva.ki.entwurf({
        patientId: p?.id ?? "",
        art: "verlauf",
        modus: "diktat",
        audio: new Uint8Array([1]),
        mimeType: "audio/webm",
      }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Der Transkriptionsdienst ist nicht erreichbar.",
    });
  });
});
