import { type NextRequest, NextResponse } from "next/server";
import { herkuenfte } from "./server/herkuenfte";

const ERLAUBT = new Set(herkuenfte());

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

// Ohne /api/ki: Der Proxy puffert Anfragen und kappt sie bei 10 MB, Aufnahmen sind größer.
export const config = { matcher: "/api/((?!ki/).*)" };
