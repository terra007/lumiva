import { describe, expect, it } from "vitest";
import { feiertageImZeitraum, oesterreichischeFeiertage, ostersonntag } from "./index";

describe("österreichische Feiertage", () => {
  it("berechnet Ostersonntag", () => {
    expect(ostersonntag(2024)).toBe("2024-03-31");
    expect(ostersonntag(2026)).toBe("2026-04-05");
    expect(ostersonntag(2027)).toBe("2027-03-28");
    expect(ostersonntag(2038)).toBe("2038-04-25");
  });

  it("liefert die 13 gesetzlichen Feiertage 2026, ohne Karfreitag", () => {
    expect(oesterreichischeFeiertage(2026)).toEqual([
      { datum: "2026-01-01", name: "Neujahr" },
      { datum: "2026-01-06", name: "Heilige Drei Könige" },
      { datum: "2026-04-06", name: "Ostermontag" },
      { datum: "2026-05-01", name: "Staatsfeiertag" },
      { datum: "2026-05-14", name: "Christi Himmelfahrt" },
      { datum: "2026-05-25", name: "Pfingstmontag" },
      { datum: "2026-06-04", name: "Fronleichnam" },
      { datum: "2026-08-15", name: "Mariä Himmelfahrt" },
      { datum: "2026-10-26", name: "Nationalfeiertag" },
      { datum: "2026-11-01", name: "Allerheiligen" },
      { datum: "2026-12-08", name: "Mariä Empfängnis" },
      { datum: "2026-12-25", name: "Christtag" },
      { datum: "2026-12-26", name: "Stefanitag" },
    ]);
  });

  it("findet Feiertage über den Jahreswechsel", () => {
    expect(feiertageImZeitraum("2026-12-21", "2027-01-06").map((f) => f.datum)).toEqual([
      "2026-12-25",
      "2026-12-26",
      "2027-01-01",
      "2027-01-06",
    ]);
  });
});
