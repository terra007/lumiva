import { describe, expect, it } from "vitest";
import {
  fehlendeKostenzuschussAngaben,
  formatEuro,
  formatHonorarnoteNummer,
  istGueltigeSvNummer,
  kostenzuschussHinweise,
  kostenzuschussHonorarnoteSchema,
  loeschbarAb,
  summeCent,
  wienDatum,
  wienZeit,
  wienZuDate,
  wochenBeginn,
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
  it("gibt Selbstzahlern keine Hinweise", () => {
    expect(
      kostenzuschussHinweise({ ...basis, versicherungstraeger: "privat", naechsteSitzung: 12 }),
    ).toEqual([]);
  });
  it("bittet bei noch nicht hinterlegten Trägern um eigene Prüfung", () => {
    expect(
      kostenzuschussHinweise({ ...basis, versicherungstraeger: "svs", naechsteSitzung: 2 }),
    ).toEqual([{ art: "regeln-selbst-pruefen" }]);
    expect(
      kostenzuschussHinweise({ ...basis, versicherungstraeger: "svs_bauern", naechsteSitzung: 2 }),
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

describe("fehlendeKostenzuschussAngaben", () => {
  const inhalt = {
    nummer: "2026-0001",
    ausstellungsdatum: "2026-11-07",
    praxis: { name: "P", anschrift: "Wien", telefon: null, email: null, iban: null },
    therapeut: { name: "T", berufsbezeichnung: null },
    patient: {
      vorname: "A",
      nachname: "B",
      geburtsdatum: "1980-01-01",
      svNummer: "1237010180",
      versicherungstraeger: "oegk",
      anschrift: null,
    },
    diagnoseIcd10: "F32.1",
    sitzungen: [
      { datum: "2026-11-01", dauerMinuten: 50, bezeichnung: "Einzel", honorarCent: 9000 },
    ],
    summeCent: 9000,
  };
  it("ist leer bei vollständigen Angaben", () => {
    expect(fehlendeKostenzuschussAngaben(inhalt)).toEqual([]);
  });
  it("nennt fehlende SV-Nummer und Diagnose", () => {
    expect(
      fehlendeKostenzuschussAngaben({
        ...inhalt,
        diagnoseIcd10: null,
        patient: { ...inhalt.patient, svNummer: null },
      }),
    ).toEqual(["gültige Sozialversicherungsnummer", "Diagnose (ICD-10)"]);
  });
  it("verlangt bei Selbstzahlern nichts", () => {
    expect(
      fehlendeKostenzuschussAngaben({
        ...inhalt,
        diagnoseIcd10: null,
        patient: { ...inhalt.patient, svNummer: null, versicherungstraeger: "privat" },
      }),
    ).toEqual([]);
  });
});

describe("Zeit in Wien", () => {
  it("rechnet Winterzeit (UTC+1) und Sommerzeit (UTC+2) richtig um", () => {
    expect(wienZuDate("2026-11-09", "09:00").toISOString()).toBe("2026-11-09T08:00:00.000Z");
    expect(wienZuDate("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
  it("liefert Datum und Uhrzeit in Wien", () => {
    const d = new Date("2026-11-08T23:30:00Z");
    expect(wienDatum(d)).toBe("2026-11-09");
    expect(wienZeit(d)).toBe("00:30");
  });
  it("findet den Montag einer Woche", () => {
    expect(wochenBeginn("2026-11-07")).toBe("2026-11-02");
    expect(wochenBeginn("2026-11-02")).toBe("2026-11-02");
    expect(wochenBeginn("2026-11-08")).toBe("2026-11-02");
  });
});
