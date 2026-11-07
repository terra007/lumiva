import { type Datenbank, datenbankVerbinden, schema } from "@lumiva/db";
import { neuerSchluessel } from "@lumiva/db/crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

beforeAll(async () => {
  db = await datenbankVerbinden({ art: "pglite" });
  await db.insert(schema.user).values(benutzer);
  await (await api()).praxis.anlegen({ name: "KI-Praxis", anschrift: "Ring 1, 1010 Wien" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("KI-Doku", () => {
  it("ist ohne Konfiguration aus und nutzt keinen fremden Anbieter", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", "");
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", "");
    expect(kiKonfiguration()).toBeNull();
    expect(await (await api()).ki.verfuegbar()).toBe(false);
  });

  it("macht aus einem Diktat einen Entwurf, Sitzungen nur mit Einwilligung", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", "http://whisper:8000/v1/");
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", "http://ollama:11434/v1");
    const aufrufe: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      aufrufe.push(url);
      if (url.endsWith("/audio/transcriptions")) {
        expect((init.body as FormData).get("language")).toBe("de");
        return Response.json({ text: "Thema heute war Schlaf." });
      }
      const body = JSON.parse(String(init.body));
      expect(body.messages[1].content).toContain("Thema heute war Schlaf.");
      return Response.json({ choices: [{ message: { content: "Thema:\n- Schlaf" } }] });
    });
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
      entwurf: "Thema:\n- Schlaf",
    });
    expect(aufrufe).toEqual([
      "http://whisper:8000/v1/audio/transcriptions",
      "http://ollama:11434/v1/chat/completions",
    ]);

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

  it("meldet einen nicht erreichbaren Dienst ohne Inhalte", async () => {
    vi.stubEnv("LUMIVA_KI_TRANSKRIPTION_URL", "http://whisper:8000/v1");
    vi.stubEnv("LUMIVA_KI_SPRACHMODELL_URL", "http://ollama:11434/v1");
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
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
