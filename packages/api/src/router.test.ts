import { describe, expect, it } from "vitest";
import { createCaller } from "./index";

describe("API", () => {
  it("meldet ihren Status ohne Anmeldung", async () => {
    const api = createCaller({ benutzerId: null });
    expect(await api.status()).toEqual({ name: "LUMIVA", claim: "Klarheit für deine Praxis." });
  });

  it("verlangt für Praxisdaten eine Anmeldung", async () => {
    const api = createCaller({ benutzerId: null });
    await expect(
      api.kostenzuschuss.hinweise({
        versicherungstraeger: "oegk",
        naechsteSitzung: 2,
        aerztlicheBestaetigungLiegtVor: false,
        bewilligungLiegtVor: false,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("liefert angemeldeten Personen die Kostenzuschuss-Hinweise", async () => {
    const api = createCaller({ benutzerId: "t1" });
    expect(
      await api.kostenzuschuss.hinweise({
        versicherungstraeger: "oegk",
        naechsteSitzung: 2,
        aerztlicheBestaetigungLiegtVor: false,
        bewilligungLiegtVor: false,
      }),
    ).toEqual([{ art: "aerztliche-bestaetigung-fehlt" }]);
  });
});
