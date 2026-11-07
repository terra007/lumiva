import { appRouter } from "./router";
import { createCallerFactory } from "./trpc";

export { type Auth, authErstellen } from "./auth";
export { kontextErstellen } from "./kontext";
export { type AppRouter, appRouter } from "./router";
export type { Patient } from "./routers/patienten";
export { VERSICHERUNGSTRAEGER } from "./routers/patienten";
export { type Kontext, nutzerMeldung, type Rolle } from "./trpc";
export const createCaller = createCallerFactory(appRouter);
