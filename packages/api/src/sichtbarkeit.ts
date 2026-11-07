import { schema } from "@lumiva/db";
import { TRPCError } from "@trpc/server";
import { and, eq, type SQL } from "drizzle-orm";
import type { Kontext, PraxisZugang } from "./trpc";

type Ctx = Pick<Kontext, "db"> & { praxis: PraxisZugang; benutzer: { id: string } };

/**
 * Welche Patient:innen jemand sehen darf: Therapeut:innen (auch Inhaber:innen) nur die eigenen,
 * die Assistenz alle der Praxis, aber ohne Akteninhalte.
 */
export function patientenFilter(ctx: Ctx): SQL {
  const praxis = eq(schema.patienten.praxisId, ctx.praxis.id);
  if (ctx.praxis.rolle === "assistenz") return praxis;
  return and(praxis, eq(schema.patienten.therapeutId, ctx.benutzer.id)) as SQL;
}

export async function patientLaden(ctx: Ctx, patientId: string) {
  const [p] = await ctx.db
    .select()
    .from(schema.patienten)
    .where(and(patientenFilter(ctx), eq(schema.patienten.id, patientId)));
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Patient:in nicht gefunden." });
  return p;
}
