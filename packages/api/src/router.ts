import { kostenzuschussHinweise } from "@lumiva/domain";
import { z } from "zod";
import { angemeldet, oeffentlich, router } from "./trpc";

export const appRouter = router({
  status: oeffentlich.query(() => ({ name: "LUMIVA", claim: "Klarheit für deine Praxis." })),

  kostenzuschuss: router({
    hinweise: angemeldet
      .input(
        z.object({
          versicherungstraeger: z.enum(["oegk", "bvaeb", "svs", "kfa", "privat", "sonstige"]),
          naechsteSitzung: z.number().int().positive(),
          aerztlicheBestaetigungLiegtVor: z.boolean(),
          bewilligungLiegtVor: z.boolean(),
        }),
      )
      .query(({ input }) => kostenzuschussHinweise(input)),
  }),
});

export type AppRouter = typeof appRouter;
