import { appRouter } from "@lumiva/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    // Die Anmeldung (Better Auth) kommt in Schritt 3; bis dahin ist niemand angemeldet.
    createContext: () => ({ benutzerId: null }),
  });
}

export { handler as GET, handler as POST };
