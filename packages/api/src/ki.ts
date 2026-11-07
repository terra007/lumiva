/**
 * KI-Unterstützung für die Dokumentation, ausschließlich über selbst betriebene Dienste.
 *
 * Beide Dienste sprechen die verbreitete OpenAI-kompatible Schnittstelle, laufen aber auf dem
 * eigenen Server (siehe deploy/ionos): Sprache zu Text mit Whisper (z. B. Speaches),
 * Doku-Entwurf mit einem freien Sprachmodell über Ollama. Ohne Konfiguration ist die KI aus;
 * es gibt bewusst keine Voreinstellung auf einen fremden Anbieter.
 *
 * Die Aufnahme wird nur im Arbeitsspeicher verarbeitet und nie gespeichert.
 */

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
    transkriptionModell: env.LUMIVA_KI_TRANSKRIPTION_MODELL ?? "Systran/faster-whisper-medium",
    sprachmodellUrl: sprachmodellUrl.replace(/\/$/, ""),
    sprachmodell: env.LUMIVA_KI_SPRACHMODELL ?? "qwen2.5:7b-instruct",
  };
}

/** Größte erlaubte Aufnahme: reicht für rund eine Stunde Sprache als Opus. */
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

export class KiFehler extends Error {}

async function anfrage(url: string, init: RequestInit, dienst: string): Promise<Response> {
  let antwort: Response;
  try {
    antwort = await fetch(url, { ...init, signal: AbortSignal.timeout(10 * 60_000) });
  } catch {
    throw new KiFehler(`Der ${dienst} ist nicht erreichbar.`);
  }
  // Nur den Status melden: Die Antwort könnte Teile des Diktats enthalten.
  if (!antwort.ok) throw new KiFehler(`Der ${dienst} antwortet mit Fehler ${antwort.status}.`);
  return antwort;
}

/** Sprache zu Text (Deutsch). */
export async function transkribieren(
  k: KiKonfiguration,
  audio: Uint8Array,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  const endung = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `diktat.${endung}`);
  form.append("model", k.transkriptionModell);
  form.append("language", "de");
  form.append("response_format", "json");
  const antwort = await anfrage(
    `${k.transkriptionUrl}/audio/transcriptions`,
    { method: "POST", body: form },
    "Transkriptionsdienst",
  );
  const { text } = (await antwort.json()) as { text?: string };
  return (text ?? "").trim();
}

const ART_TEXT: Record<string, string> = {
  erstgespraech: "Erstgespräch",
  verlauf: "Verlaufseintrag",
  abschluss: "Abschlussbericht",
  notiz: "Notiz",
};

const QUELLE = {
  diktat: "Die Quelle ist ihr eigenes Diktat nach der Sitzung.",
  sitzung:
    "Die Quelle ist das Transkript der ganzen Sitzung ohne Sprecherkennzeichnung. Fasse zusammen, zitiere nicht wörtlich.",
} as const;

const ANWEISUNG = `Du hilfst einer Psychotherapeutin in Österreich bei der Dokumentation (§ 18 PThG 2024).
Aus der Quelle erstellst du einen sachlichen, knappen Entwurf auf Deutsch, in der dritten Person
über die Patientin bzw. den Patienten. Gliedere in diese Abschnitte, jeweils mit Überschrift und Stichpunkten:
Thema, Befinden und Verlauf, Interventionen, Vereinbarungen.
Regeln: Verwende nur Inhalte aus der Quelle und erfinde nichts. Fehlt etwas, lass den Abschnitt weg.
Schlage keine Diagnosen vor. Keine Einleitung und kein Schlusssatz, nur der Entwurf.`;

/** Doku-Entwurf aus dem Transkript. Die Therapeut:in prüft und speichert selbst. */
export async function dokuEntwurf(
  k: KiKonfiguration,
  transkript: string,
  art: string,
  modus: keyof typeof QUELLE,
): Promise<string> {
  const antwort = await anfrage(
    `${k.sprachmodellUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: k.sprachmodell,
        temperature: 0.2,
        messages: [
          { role: "system", content: `${ANWEISUNG}\n${QUELLE[modus]}` },
          {
            role: "user",
            content: `Art des Eintrags: ${ART_TEXT[art] ?? "Verlaufseintrag"}\n\nQuelle:\n${transkript}`,
          },
        ],
      }),
    },
    "Sprachmodell-Dienst",
  );
  const daten = (await antwort.json()) as { choices?: { message?: { content?: string } }[] };
  return (daten.choices?.[0]?.message?.content ?? "").trim();
}
