import { describe, expect, it } from "vitest";
import { kontaktLesen } from "./werkzeuge";

describe("kontaktLesen", () => {
  it("liest getrennt gespeicherte Anschriften", () => {
    expect(
      kontaktLesen(
        JSON.stringify({ telefon: "1", email: "", strasse: "Ring 1", plz: "1010", ort: "Wien" }),
      ),
    ).toEqual({ telefon: "1", email: "", strasse: "Ring 1", plz: "1010", ort: "Wien" });
  });

  it("zerlegt die frühere einzeilige Anschrift", () => {
    expect(
      kontaktLesen(JSON.stringify({ telefon: "", email: "", anschrift: "Testgasse 2, 1020 Wien" })),
    ).toEqual({ telefon: "", email: "", strasse: "Testgasse 2", plz: "1020", ort: "Wien" });
  });

  it("liefert leere Felder ohne Kontaktdaten", () => {
    expect(kontaktLesen(null)).toEqual({ telefon: "", email: "", strasse: "", plz: "", ort: "" });
  });
});
