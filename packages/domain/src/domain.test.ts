import { describe, expect, it } from "vitest";
import {
  formatEuro,
  formatHonorarnoteNummer,
  istGueltigeSvNummer,
  kostenzuschussHinweise,
  kostenzuschussHonorarnoteSchema,
  loeschbarAb,
  summeCent,
} from "./index";

describe("formatEuro", () => {
  it("formatiert Cent als Euro nach österreichischer Schreibweise", () => {
    expect(formatEuro(9000).replace(/\s/g, " ")).toBe("€ 90,00");
  });
  it("lehnt Kommabeträge ab", () => {
    expect(() => formatEuro(10.5)).toThrow();
  });
});

describe("formatHonorarnoteNummer", () => {
  it("füllt die laufende Nummer auf vier Stellen auf", () => {
    expect(formatHonorarnoteNummer(2026, 42)).toBe("2026-0042");
    expect(formatHonorarnoteNummer(2026, 12345)).toBe("2026-12345");
  });
  it("lehnt ungültige Werte ab", () => {
    expect(() => formatHonorarnoteNummer(2026, 0)).toThrow();
    expect(() => formatHonorarnoteNummer(26, 1)).toThrow();
  });
});

describe("istGueltigeSvNummer", () => {
  it("akzeptiert eine Nummer mit korrekter Prüfziffer", () => {
    expect(istGueltigeSvNummer("1237 010180")).toBe(true);
  });
  it("lehnt falsche Prüfziffer und falsches Format ab", () => {
    expect(istGueltigeSvNummer("1238 010180")).toBe(false);
    expect(istGueltigeSvNummer("123")).toBe(false);
  });
});

describe("kostenzuschussHinweise", () => {
  const basis = {
    versicherungstraeger: "oegk" as const,
    aerztlicheBestaetigungLiegtVor: false,
    bewilligungLiegtVor: false,
  };

  it("braucht beim Erstgespräch nichts", () => {
    expect(kostenzuschussHinweise({ ...basis, naechsteSitzung: 1 })).toEqual([]);
  });
  it("verlangt vor der 2. Sitzung die ärztliche Bestätigung", () => {
    expect(kostenzuschussHinweise({ ...basis, naechsteSitzung: 2 })).toEqual([
      { art: "aerztliche-bestaetigung-fehlt" },
    ]);
  });
  it("warnt zwei Sitzungen vor der Bewilligungspflicht", () => {
    expect(
      kostenzuschussHinweise({
        ...basis,
        aerztlicheBestaetigungLiegtVor: true,
        naechsteSitzung: 9,
      }),
    ).toEqual([{ art: "bewilligung-bald-noetig", verbleibendeSitzungen: 2 }]);
  });
  it("verlangt ab der 11. Sitzung die Bewilligung", () => {
    expect(
      kostenzuschussHinweise({
        ...basis,
        aerztlicheBestaetigungLiegtVor: true,
        naechsteSitzung: 11,
      }),
    ).toEqual([{ art: "bewilligung-fehlt" }]);
  });
  it("gibt Selbstzahler:innen keine Hinweise", () => {
    expect(
      kostenzuschussHinweise({ ...basis, versicherungstraeger: "privat", naechsteSitzung: 12 }),
    ).toEqual([]);
  });
  it("bittet bei noch nicht hinterlegten Trägern um eigene Prüfung", () => {
    expect(
      kostenzuschussHinweise({ ...basis, versicherungstraeger: "svs", naechsteSitzung: 2 }),
    ).toEqual([{ art: "regeln-selbst-pruefen" }]);
  });
  it("ist still, wenn alles vorliegt", () => {
    expect(
      kostenzuschussHinweise({
        ...basis,
        naechsteSitzung: 20,
        aerztlicheBestaetigungLiegtVor: true,
        bewilligungLiegtVor: true,
      }),
    ).toEqual([]);
  });
});

describe("kostenzuschussHonorarnoteSchema", () => {
  const note = {
    nummer: "2026-0001",
    ausstellungsdatum: "2026-11-07",
    therapeut: { name: "Mag. Maria Muster", anschrift: "Musterstraße 1, 1010 Wien" },
    patient: {
      vorname: "Max",
      nachname: "Beispiel",
      geburtsdatum: "1980-01-01",
      svNummer: "1237010180",
    },
    diagnoseIcd10: "F32.1",
    sitzungen: [
      { datum: "2026-10-31", dauerMinuten: 50, honorarCent: 9000 },
      { datum: "2026-11-07", dauerMinuten: 50, honorarCent: 9000 },
    ],
  };

  it("akzeptiert eine vollständige Honorarnote und summiert sie", () => {
    const parsed = kostenzuschussHonorarnoteSchema.parse(note);
    expect(summeCent(parsed)).toBe(18000);
  });
  it("lehnt eine Honorarnote ohne Diagnose ab", () => {
    expect(kostenzuschussHonorarnoteSchema.safeParse({ ...note, diagnoseIcd10: "" }).success).toBe(
      false,
    );
  });
});

describe("loeschbarAb", () => {
  it("rechnet 10 Jahre ab Behandlungsende", () => {
    expect(loeschbarAb("2026-03-15")).toBe("2036-03-15");
  });
  it("löscht einen 29. Februar nie zu früh", () => {
    expect(loeschbarAb("2024-02-29", 1)).toBe("2025-03-01");
  });
  it("lehnt Zeitpunkte statt Kalenderdaten ab", () => {
    expect(() => loeschbarAb("2026-03-15T00:00:00+01:00")).toThrow();
  });
});
