import { TRPCError } from "@trpc/server";
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
      return new Response(e.message, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    throw e;
  }
}
