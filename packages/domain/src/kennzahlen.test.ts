import { describe, expect, it } from "vitest";
import { ausfallquote, kennzahlenZeitraum, letzteMonate, tageImZeitraum } from "./index";

describe("kennzahlenZeitraum", () => {
  it("liefert Monat, Vormonat, Quartal und Jahr", () => {
    expect(kennzahlenZeitraum("monat", "2026-11-09")).toEqual({
      von: "2026-11-01",
      bis: "2026-12-01",
      bezeichnung: "November 2026",
    });
    expect(kennzahlenZeitraum("vormonat", "2026-01-15")).toEqual({
      von: "2025-12-01",
      bis: "2026-01-01",
      bezeichnung: "Dezember 2025",
    });
    expect(kennzahlenZeitraum("quartal", "2026-11-09")).toEqual({
      von: "2026-10-01",
      bis: "2027-01-01",
      bezeichnung: "4. Quartal 2026",
    });
    expect(kennzahlenZeitraum("jahr", "2026-11-09").bezeichnung).toBe("2026");
    expect(kennzahlenZeitraum("monat", "2026-01-03").bezeichnung).toBe("Jänner 2026");
  });
});

describe("letzteMonate", () => {
  it("zählt über den Jahreswechsel zurück", () => {
    expect(letzteMonate("2026-02-10", 3)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });
});

describe("tageImZeitraum", () => {
  it("zählt nur die Tage innerhalb des Zeitraums", () => {
    expect(tageImZeitraum("2026-10-30", "2026-11-03", "2026-11-01", "2026-12-01")).toBe(3);
    expect(tageImZeitraum("2026-11-10", "2026-11-10", "2026-11-01", "2026-12-01")).toBe(1);
    expect(tageImZeitraum("2026-12-01", "2026-12-05", "2026-11-01", "2026-12-01")).toBe(0);
  });
});

describe("ausfallquote", () => {
  it("zählt Absagen und Nichterscheinen, ohne geplante", () => {
    expect(ausfallquote({ erledigt: 8, abgesagt: 1, nichtErschienen: 1 })).toBe(0.2);
    expect(ausfallquote({ erledigt: 0, abgesagt: 0, nichtErschienen: 0 })).toBeNull();
  });
});
