import { describe, expect, it } from "vitest";
import { anschriftText, anschriftZerlegen } from "./index";

describe("anschriftZerlegen", () => {
  it("trennt Straße, PLZ und Ort", () => {
    expect(anschriftZerlegen("Musterstraße 1, 1010 Wien")).toEqual({
      strasse: "Musterstraße 1",
      plz: "1010",
      ort: "Wien",
    });
  });

  it("nimmt das letzte Komma, wenn die Straße selbst eines enthält", () => {
    expect(anschriftZerlegen("Hof 2, Stiege 3, 8010 Graz")).toEqual({
      strasse: "Hof 2, Stiege 3",
      plz: "8010",
      ort: "Graz",
    });
  });

  it("versteht Zeilenumbrüche und fünfstellige PLZ", () => {
    expect(anschriftZerlegen("Hauptstraße 5\n80331 München")).toEqual({
      strasse: "Hauptstraße 5",
      plz: "80331",
      ort: "München",
    });
  });

  it("erkennt nur PLZ und Ort", () => {
    expect(anschriftZerlegen("1020 Wien")).toEqual({ strasse: "", plz: "1020", ort: "Wien" });
  });

  it("lässt Unerkanntes als Straße stehen", () => {
    expect(anschriftZerlegen(" Wien ")).toEqual({ strasse: "Wien", plz: "", ort: "" });
  });
});

describe("anschriftText", () => {
  it("setzt die Felder einzeilig zusammen und lässt Leeres weg", () => {
    expect(anschriftText({ strasse: "Ring 1", plz: "1010", ort: "Wien" })).toBe(
      "Ring 1, 1010 Wien",
    );
    expect(anschriftText({ strasse: "", plz: "1010", ort: "Wien" })).toBe("1010 Wien");
    expect(anschriftText({ strasse: "", plz: "", ort: "" })).toBe("");
  });
});
