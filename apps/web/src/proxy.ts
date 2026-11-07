import { type NextRequest, NextResponse } from "next/server";

/** Herkünfte, die die API mit Anmeldung aufrufen dürfen, z. B. die Expo-Webvorschau der App. */
const ERLAUBT = new Set(
  (process.env.LUMIVA_HERKUENFTE ?? "http://localhost:8081").split(",").map((s) => s.trim()),
);

export function proxy(req: NextRequest) {
  const herkunft = req.headers.get("origin");
  const erlaubt = herkunft !== null && ERLAUBT.has(herkunft);
  const kopf: Record<string, string> = erlaubt
    ? {
        "Access-Control-Allow-Origin": herkunft,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "content-type, trpc-accept, x-trpc-source, cookie, expo-origin",
        Vary: "Origin",
      }
    : {};
  if (req.method === "OPTIONS")
    return new NextResponse(null, { status: erlaubt ? 204 : 403, headers: kopf });
  const antwort = NextResponse.next();
  for (const [k, v] of Object.entries(kopf)) antwort.headers.set(k, v);
  return antwort;
}

export const config = { matcher: "/api/:path*" };
