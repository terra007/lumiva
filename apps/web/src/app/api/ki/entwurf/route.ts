import { nutzerMeldung } from "@lumiva/api";
import { MAX_AUDIO_BYTES } from "@lumiva/api/ki";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { api } from "@/server/lumiva";

/**
 * Aufnahme hochladen, Doku-Entwurf zurück. Als Route statt Server-Aktion, weil Aufnahmen
 * größer sind als das Limit für Server-Aktionen. Die Aufnahme bleibt nur im Speicher.
 */
export async function POST(req: Request) {
  // Wie bei Server-Aktionen: nur Anfragen von der eigenen Seite (Schutz vor CSRF).
  const herkunft = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!herkunft || !host || new URL(herkunft).host !== host) {
    return Response.json({ fehler: "Anfrage nicht erlaubt." }, { status: 403 });
  }
  // Grob vorab prüfen, bevor die ganze Aufnahme in den Speicher gelesen wird.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES + 1024 * 1024) {
    return Response.json({ fehler: "Die Aufnahme ist zu lang." }, { status: 413 });
  }
  const daten = await req.formData();
  const audio = daten.get("audio");
  if (!(audio instanceof Blob)) {
    return Response.json({ fehler: "Keine Aufnahme erhalten." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ fehler: "Die Aufnahme ist zu lang." }, { status: 413 });
  }
  try {
    const { entwurf } = await (await api()).ki.entwurf({
      patientId: String(daten.get("patientId") ?? ""),
      art: String(daten.get("art") ?? "verlauf") as "verlauf",
      modus: String(daten.get("modus") ?? "diktat") as "diktat",
      audio: new Uint8Array(await audio.arrayBuffer()),
      mimeType: audio.type || "audio/webm",
    });
    return Response.json({ entwurf }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof TRPCError) {
      return Response.json({ fehler: nutzerMeldung(e) }, { status: getHTTPStatusCodeFromError(e) });
    }
    throw e;
  }
}
