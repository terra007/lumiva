import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Auth, authErstellen, createCaller, kontextErstellen } from "@lumiva/api";
import { type Datenbank, datenbankVerbinden } from "@lumiva/db";
import { neuerSchluessel, schluesselAusBase64 } from "@lumiva/db/crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { herkuenfte } from "./herkuenfte";

type Dienste = { db: Datenbank; auth: Auth; hauptschluessel: Buffer };

const REPO = path.resolve(process.cwd(), "../..");
const DATEN = process.env.LUMIVA_DATEN ?? path.join(REPO, ".lumiva-daten");

/**
 * Entwicklung: Fehlt der Hauptschlüssel, wird einmalig einer im Datenordner erzeugt.
 * Produktion: Der Schlüssel muss als Umgebungsvariable gesetzt sein.
 */
function hauptschluesselLaden(): Buffer {
  if (process.env.LUMIVA_HAUPTSCHLUESSEL)
    return schluesselAusBase64(process.env.LUMIVA_HAUPTSCHLUESSEL);
  if (process.env.NODE_ENV === "production") {
    throw new Error("LUMIVA_HAUPTSCHLUESSEL fehlt. Ohne ihn startet LUMIVA in Produktion nicht.");
  }
  const datei = path.join(DATEN, "hauptschluessel.entwicklung");
  if (!existsSync(datei)) {
    mkdirSync(DATEN, { recursive: true });
    writeFileSync(datei, neuerSchluessel().toString("base64"), { mode: 0o600 });
  }
  return schluesselAusBase64(readFileSync(datei, "utf8").trim());
}

function geheimnisLaden(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET fehlt.");
  const datei = path.join(DATEN, "auth-geheimnis.entwicklung");
  if (!existsSync(datei)) {
    mkdirSync(DATEN, { recursive: true });
    writeFileSync(datei, neuerSchluessel().toString("base64"), { mode: 0o600 });
  }
  return readFileSync(datei, "utf8").trim();
}

async function starten(): Promise<Dienste> {
  const migrationen = path.join(REPO, "packages/db/drizzle");
  const db = process.env.DATABASE_URL
    ? await datenbankVerbinden({ art: "postgres", url: process.env.DATABASE_URL, migrationen })
    : await datenbankVerbinden({
        art: "pglite",
        ordner: path.join(DATEN, "datenbank"),
        migrationen,
      });
  const auth = authErstellen({
    db,
    secret: geheimnisLaden(),
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    vertrauteHerkuenfte: herkuenfte(),
  });
  return { db, auth, hauptschluessel: hauptschluesselLaden() };
}

// Eine Instanz je Serverprozess, auch über Hot Reload hinweg.
const global = globalThis as unknown as { __lumiva?: Promise<Dienste> };
export function dienste(): Promise<Dienste> {
  global.__lumiva ??= starten();
  return global.__lumiva;
}

export async function kontextAus(h: Headers) {
  const { db, auth, hauptschluessel } = await dienste();
  return kontextErstellen({ db, auth, headers: h, hauptschluessel });
}

/** tRPC-Aufrufer für Server-Komponenten und Server-Aktionen, mit der Sitzung der aktuellen Anfrage. */
export async function api() {
  return createCaller(await anfrageKontext());
}

/** Ein Kontext je Anfrage: Layout und Seite teilen sich Sitzung und Praxisschlüssel. */
const anfrageKontext = cache(async () => kontextAus(await headers()));

/**
 * Für Seiten im angemeldeten Bereich. Layout und Seite rendern in Next.js parallel,
 * deshalb prüft jede Seite selbst und leitet um, statt sich auf das Layout zu verlassen.
 */
export async function praxisApi() {
  const kontext = await anfrageKontext();
  if (!kontext.benutzer) redirect("/anmelden");
  if (!kontext.praxis) redirect("/einrichten");
  return createCaller(kontext);
}
