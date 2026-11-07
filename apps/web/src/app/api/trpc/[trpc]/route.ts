import { appRouter } from "@lumiva/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { kontextAus } from "@/server/lumiva";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => kontextAus(req.headers),
  });
}

export { handler as GET, handler as POST };
