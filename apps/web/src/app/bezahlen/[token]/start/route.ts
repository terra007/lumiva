import { onlineZahlungStarten } from "@lumiva/api";
import { dienste } from "@/server/lumiva";

/** Startet die Online-Zahlung und leitet zur Zahlseite von SumUp weiter. Nur per Knopf (POST). */
export async function POST(req: Request, { params }: RouteContext<"/bezahlen/[token]/start">) {
  const { token } = await params;
  const { db, hauptschluessel } = await dienste();
  const ergebnis = await onlineZahlungStarten({ db, hauptschluessel, token });
  const ziel =
    "url" in ergebnis
      ? ergebnis.url
      : new URL(`/bezahlen/${token}?fehler=${encodeURIComponent(ergebnis.fehler)}`, req.url);
  return Response.redirect(ziel, 303);
}
