import { nutzerMeldung } from "@lumiva/api";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { api } from "@/server/lumiva";

/**
 * Aufnahme hochladen, Doku-Entwurf zurück. Als Route statt Server-Aktion, weil Aufnahmen
 * größer sind als das Limit für Server-Aktionen. Die Aufnahme bleibt nur im Speicher.
 */
export async function POST(req: Request) {
  const daten = await req.formData();
  const audio = daten.get("audio");
  if (!(audio instanceof Blob)) {
    return Response.json({ fehler: "Keine Aufnahme erhalten." }, { status: 400 });
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
