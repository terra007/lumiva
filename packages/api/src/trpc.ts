import type { Datenbank } from "@lumiva/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

export type Rolle = "inhaber" | "therapeut" | "assistenz";

export type PraxisZugang = {
  id: string;
  name: string;
  rolle: Rolle;
  /** Entpackter Datenschlüssel der Praxis. Verlässt nie den Server. */
  schluessel: Buffer;
};

export type Kontext = {
  db: Datenbank;
  benutzer: { id: string; name: string; email: string } | null;
  praxis: PraxisZugang | null;
  /** Hauptschlüssel des Servers, nur zum Anlegen neuer Praxen. */
  hauptschluessel: Buffer;
};

const t = initTRPC.context<Kontext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Nur Feldnamen und Meldungen, nie die eingegebenen Werte zurückgeben.
        felder: error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const oeffentlich = t.procedure;

export const angemeldet = t.procedure.use(({ ctx, next }) => {
  if (!ctx.benutzer) throw new TRPCError({ code: "UNAUTHORIZED", message: "Bitte melde dich an." });
  return next({ ctx: { ...ctx, benutzer: ctx.benutzer } });
});

/** Angemeldet und Mitglied einer Praxis. */
export const inPraxis = angemeldet.use(({ ctx, next }) => {
  if (!ctx.praxis) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lege zuerst deine Praxis an." });
  }
  return next({ ctx: { ...ctx, praxis: ctx.praxis } });
});

/** Darf Akteninhalte sehen: Inhaber:in oder Therapeut:in, nicht die Assistenz (§ 45 PThG 2024). */
export const therapeutisch = inPraxis.use(({ ctx, next }) => {
  if (ctx.praxis.rolle === "assistenz") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Keine Berechtigung für Akteninhalte." });
  }
  return next();
});
