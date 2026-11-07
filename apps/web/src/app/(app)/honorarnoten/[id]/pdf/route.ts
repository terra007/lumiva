import { nutzerMeldung } from "@lumiva/api";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { praxisApi } from "@/server/lumiva";

export async function GET(_req: Request, { params }: RouteContext<"/honorarnoten/[id]/pdf">) {
  const { id } = await params;
  try {
    const { dateiname, base64 } = await (await praxisApi()).honorarnoten.pdf({ id });
    return new Response(Buffer.from(base64, "base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${dateiname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof TRPCError)
      return new Response(nutzerMeldung(e), { status: getHTTPStatusCodeFromError(e) });
    throw e;
  }
}
