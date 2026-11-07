import { appRouter } from "./router";
import { createCallerFactory } from "./trpc";

export { type AppRouter, appRouter } from "./router";
export type { Kontext } from "./trpc";
export const createCaller = createCallerFactory(appRouter);
