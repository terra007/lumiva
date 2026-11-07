import { demoCheckoutBezahlen, demoErlaubt } from "@lumiva/api";

/** Demo-Kasse: vermerkt die simulierte Zahlung und springt zurück zu LUMIVA. */
export async function POST(
  req: Request,
  { params }: RouteContext<"/bezahlen/demo-kasse/[id]/bezahlen">,
) {
  if (!demoErlaubt()) return new Response(null, { status: 404 });
  const { id } = await params;
  const zurueck = demoCheckoutBezahlen(id);
  return Response.redirect(zurueck ?? new URL("/", req.url), 303);
}
