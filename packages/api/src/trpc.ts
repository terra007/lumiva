import { initTRPC, TRPCError } from "@trpc/server";

export type Kontext = {
  /** Angemeldete Person, oder null. Die Anmeldung kommt in Schritt 3 dazu. */
  benutzerId: string | null;
};

const t = initTRPC.context<Kontext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const oeffentlich = t.procedure;

export const angemeldet = t.procedure.use(({ ctx, next }) => {
  if (!ctx.benutzerId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { benutzerId: ctx.benutzerId } });
});
