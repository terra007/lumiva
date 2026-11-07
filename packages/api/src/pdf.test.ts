import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { druckbar, honorarnotePdf } from "./pdf";

describe("Honorarnote als PDF", () => {
  it("ersetzt Zeichen, die die Standardschrift nicht kennt", () => {
    expect(druckbar("Kovačević, Łukasz, Müller € 90")).toBe("Kovacevic, Lukasz, Müller € 90");
    expect(druckbar("王")).toBe("?");
  });

  it("bricht lange Notizen auf weitere Seiten um", async () => {
    const sitzungen = Array.from({ length: 60 }, () => ({
      datum: "2026-10-05",
      dauerMinuten: 50,
      bezeichnung: "Einzelsitzung",
      honorarCent: 9000,
    }));
    const bytes = await honorarnotePdf(
      {
        nummer: "2026-0001",
        ausstellungsdatum: "2026-11-07",
        praxis: {
          name: "Praxis Ševčík",
          anschrift: "Ring 1, 1010 Wien",
          telefon: null,
          email: null,
          iban: null,
        },
        therapeut: { name: "Mag. Dragana Đorđević", berufsbezeichnung: null },
        patient: {
          vorname: "Łukasz",
          nachname: "Kovačević",
          geburtsdatum: "1988-04-12",
          svNummer: "1237010180",
          versicherungstraeger: "oegk",
          anschrift: "Testgasse 2, 1020 Wien",
        },
        diagnoseIcd10: "F32.1",
        sitzungen,
        summeCent: 60 * 9000,
      },
      { bezahltAm: null, storniertAm: null },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
