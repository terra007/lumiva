import { abwesenheitenRouter } from "./routers/abwesenheiten";
import { aufgabenRouter } from "./routers/aufgaben";
import { demoRouter } from "./routers/demo";
import { dokuRouter } from "./routers/doku";
import { honorarnotenRouter } from "./routers/honorarnoten";
import { kennzahlenRouter } from "./routers/kennzahlen";
import { kiRouter } from "./routers/ki";
import { patientenRouter } from "./routers/patienten";
import { praxisRouter } from "./routers/praxis";
import { termineRouter } from "./routers/termine";
import { uebersichtRouter } from "./routers/uebersicht";
import { zahlungenRouter } from "./routers/zahlungen";
import { oeffentlich, router } from "./trpc";

export const appRouter = router({
  status: oeffentlich.query(() => ({ name: "LUMIVA", claim: "Klarheit für deine Praxis." })),
  praxis: praxisRouter,
  patienten: patientenRouter,
  termine: termineRouter,
  abwesenheiten: abwesenheitenRouter,
  doku: dokuRouter,
  honorarnoten: honorarnotenRouter,
  aufgaben: aufgabenRouter,
  uebersicht: uebersichtRouter,
  kennzahlen: kennzahlenRouter,
  demo: demoRouter,
  ki: kiRouter,
  zahlungen: zahlungenRouter,
});

export type AppRouter = typeof appRouter;
