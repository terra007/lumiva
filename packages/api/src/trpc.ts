import type { Datenbank } from "@lumiva/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";

// Fehlermeldungen der Eingabeprüfung auf Deutsch.
z.config(z.locales.de());

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
    const intern = error.code === "INTERNAL_SERVER_ERROR";
    return {
      ...shape,
      message: nutzerMeldung(error),
      data: {
        ...shape.data,
        stack: intern ? undefined : shape.data.stack,
        // Nur Feldnamen und Meldungen, nie die eingegebenen Werte zurückgeben.
        felder: error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null,
      },
    };
  },
});

/**
 * Meldung für die Oberfläche. Unerwartete Fehler können Werte aus der Datenbank enthalten
 * und werden nie weitergegeben; Eingabefehler nur mit Feldname und Regel, nie mit dem Wert.
 */
export function nutzerMeldung(error: TRPCError): string {
  if (error.code === "INTERNAL_SERVER_ERROR")
    return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
  if (error.cause instanceof ZodError) {
    const erstes = error.cause.issues[0];
    const feld = erstes?.path.length ? erstes.path.join(".") : "Eingabe";
    return `${feld}: ${erstes?.message ?? "ungültig"}`;
  }
  return error.message;
}

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

/** Darf Akteninhalte sehen: Inhaber oder Therapeut, nicht die Assistenz (§ 45 PThG 2024). */
export const therapeutisch = inPraxis.use(({ ctx, next }) => {
  if (ctx.praxis.rolle === "assistenz") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Keine Berechtigung für Akteninhalte." });
  }
  return next();
});

/** Darf Praxisdaten und Honorare ändern: nur der Inhaber. */
export const inhaberIn = inPraxis.use(({ ctx, next }) => {
  if (ctx.praxis.rolle !== "inhaber") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur der Inhaber ändert Praxisdaten." });
  }
  return next();
});
