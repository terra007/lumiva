/**
 * KI-Unterstützung für die Dokumentation, ausschließlich über selbst betriebene Dienste.
 *
 * Beide laufen auf dem eigenen Server (siehe deploy/ionos): Sprache zu Text mit Whisper über
 * Speaches (OpenAI-kompatible Schnittstelle), Doku-Entwurf mit einem freien Sprachmodell über
 * die Schnittstelle von Ollama. Ohne Konfiguration ist die KI aus;
 * es gibt bewusst keine Voreinstellung auf einen fremden Anbieter.
 *
 * Die Aufnahme wird nur im Arbeitsspeicher verarbeitet und nie gespeichert.
 */

import { request as httpAnfrage } from "node:http";
import { request as httpsAnfrage } from "node:https";
import type { schema } from "@lumiva/db";

export type DokuArt = (typeof schema.eintragArt.enumValues)[number];

export type KiKonfiguration = {
  transkriptionUrl: string;
  transkriptionModell: string;
  sprachmodellUrl: string;
  sprachmodell: string;
};

export function kiKonfiguration(env: NodeJS.ProcessEnv = process.env): KiKonfiguration | null {
  const transkriptionUrl = env.LUMIVA_KI_TRANSKRIPTION_URL;
  const sprachmodellUrl = env.LUMIVA_KI_SPRACHMODELL_URL;
  if (!transkriptionUrl || !sprachmodellUrl) return null;
  return {
    transkriptionUrl: transkriptionUrl.replace(/\/$/, ""),
    transkriptionModell: env.LUMIVA_KI_TRANSKRIPTION_MODELL || "Systran/faster-whisper-medium",
    sprachmodellUrl: sprachmodellUrl.replace(/\/$/, ""),
    sprachmodell: env.LUMIVA_KI_SPRACHMODELL || "qwen2.5:7b-instruct",
  };
}

/** Größte erlaubte Aufnahme: reicht für rund eine Stunde Sprache als Opus. */
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

export class KiFehler extends Error {}

/**
 * Eine ganze Sitzung zu transkribieren dauert auf der CPU 15 bis 25 Minuten. fetch() bricht
 * nach 5 Minuten ohne Antwortkopf ab, deshalb hier node:http mit eigener Zeitgrenze.
 */
const ZEITGRENZE_MS = 60 * 60_000;

async function anfrage(url: string, inhalt: Request, dienst: string): Promise<unknown> {
  const body = Buffer.from(await inhalt.arrayBuffer());
  const ziel = new URL(url);
  const senden = ziel.protocol === "https:" ? httpsAnfrage : httpAnfrage;
  return new Promise((erfuellen, ablehnen) => {
    const req = senden(
      ziel,
      {
        method: "POST",
        headers: {
          "content-type": inhalt.headers.get("content-type") ?? "application/octet-stream",
          "content-length": body.byteLength,
        },
        timeout: ZEITGRENZE_MS,
      },
      (res) => {
        const teile: Buffer[] = [];
        res.on("data", (t: Buffer) => teile.push(t));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          // Nur den Status melden: Die Antwort könnte Teile des Diktats enthalten.
          if (status < 200 || status >= 300) {
            ablehnen(new KiFehler(`Der ${dienst} antwortet mit Fehler ${status}.`));
            return;
          }
          try {
            erfuellen(JSON.parse(Buffer.concat(teile).toString("utf8")));
          } catch {
            ablehnen(new KiFehler(`Der ${dienst} liefert eine ungültige Antwort.`));
          }
        });
        res.on("error", () => ablehnen(new KiFehler(`Der ${dienst} ist nicht erreichbar.`)));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => ablehnen(new KiFehler(`Der ${dienst} ist nicht erreichbar.`)));
    req.end(body);
  });
}

/** Sprache zu Text (Deutsch). */
export async function transkribieren(
  k: KiKonfiguration,
  audio: Uint8Array,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  const endung = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  form.append(
    "file",
    new Blob([audio as Uint8Array<ArrayBuffer>], { type: mimeType }),
    `diktat.${endung}`,
  );
  form.append("model", k.transkriptionModell);
  form.append("language", "de");
  form.append("response_format", "json");
  // Ohne Zufall und mit Sprach-Erkennung (VAD): Whisper erfindet sonst in Pausen gern Sätze
  // („Untertitel im Auftrag des ZDF“), die dann im Entwurf landen.
  form.append("temperature", "0");
  form.append("vad_filter", "true");
  const { text } = (await anfrage(
    `${k.transkriptionUrl}/audio/transcriptions`,
    new Request("http://lumiva/", { method: "POST", body: form }),
    "Transkriptionsdienst",
  )) as { text?: string };
  return (text ?? "").trim();
}

const ART_TEXT: Record<DokuArt, string> = {
  erstgespraech: "Erstgespräch",
  verlauf: "Verlaufseintrag",
  abschluss: "Abschlussbericht",
  notiz: "Notiz",
};

const QUELLE = {
  diktat: "Die Quelle ist ihr eigenes Diktat nach der Sitzung.",
  sitzung:
    "Die Quelle ist das Transkript der ganzen Sitzung ohne Sprecherkennzeichnung. Zitiere nicht wörtlich.",
} as const;

const ANWEISUNG = `Du hilfst einer Psychotherapeutin in Österreich bei der Dokumentation (§ 18 PThG 2024).
Fasse die Quelle sachlich und knapp auf Deutsch in Stichpunkten zusammen.
Strenge Regeln:
- Gib nur wieder, was in der Quelle ausdrücklich gesagt wird. Ergänze, deute oder vermute nichts.
- Keine Namen, Daten, Symptome, Methoden, Diagnosen oder Vereinbarungen, die nicht in der Quelle stehen.
- Behalte die Begriffe der Quelle bei. Eine kurze Quelle ergibt eine kurze Zusammenfassung.
- Gliedere nur dann in Abschnitte (Thema, Befinden und Verlauf, Interventionen, Vereinbarungen),
  wenn die Quelle dazu etwas enthält. Leere Abschnitte lässt du weg.
- Ist die Quelle unverständlich oder ohne fachlichen Inhalt, antworte nur: „Kein verwertbarer Inhalt.“
- Keine Einleitung und kein Schlusssatz.`;

/** Doku-Entwurf aus dem Transkript. Die Therapeut:in prüft und speichert selbst. */
export async function dokuEntwurf(
  k: KiKonfiguration,
  transkript: string,
  art: DokuArt,
  modus: keyof typeof QUELLE,
): Promise<string> {
  // Native Schnittstelle von Ollama, weil nur sie die Kontextlänge setzen lässt. Mit der
  // Voreinstellung (2k bis 4k Token) würde ein Sitzungstranskript stillschweigend gekürzt.
  const daten = (await anfrage(
    `${k.sprachmodellUrl}/api/chat`,
    new Request("http://lumiva/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: k.sprachmodell,
        stream: false,
        options: { temperature: 0, num_ctx: 32_768 },
        messages: [
          { role: "system", content: `${ANWEISUNG}\n${QUELLE[modus]}` },
          {
            role: "user",
            content: `Art des Eintrags: ${ART_TEXT[art]}\n\nQuelle:\n${transkript}`,
          },
        ],
      }),
    }),
    "Sprachmodell-Dienst",
  )) as { message?: { content?: string } };
  return (daten.message?.content ?? "").trim();
}
