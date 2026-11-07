import { aufgabenRouter } from "./routers/aufgaben";
import { demoRouter } from "./routers/demo";
import { dokuRouter } from "./routers/doku";
import { honorarnotenRouter } from "./routers/honorarnoten";
import { patientenRouter } from "./routers/patienten";
import { praxisRouter } from "./routers/praxis";
import { termineRouter } from "./routers/termine";
import { uebersichtRouter } from "./routers/uebersicht";
import { oeffentlich, router } from "./trpc";

export const appRouter = router({
  status: oeffentlich.query(() => ({ name: "LUMIVA", claim: "Klarheit für deine Praxis." })),
  praxis: praxisRouter,
  patienten: patientenRouter,
  termine: termineRouter,
  doku: dokuRouter,
  honorarnoten: honorarnotenRouter,
  aufgaben: aufgabenRouter,
  uebersicht: uebersichtRouter,
  demo: demoRouter,
});

export type AppRouter = typeof appRouter;
