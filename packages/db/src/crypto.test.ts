import { describe, expect, it } from "vitest";
import {
  datenschluesselEntpacken,
  datenschluesselVerpacken,
  entschluesseln,
  neuerSchluessel,
  verschluesseln,
} from "./crypto";

describe("Feldverschlüsselung", () => {
  const schluessel = neuerSchluessel();

  it("entschlüsselt, was sie verschlüsselt hat", () => {
    const wert = verschluesseln("Verlauf: stabil, Schlaf verbessert", schluessel, "doku:1");
    expect(wert).not.toContain("Schlaf");
    expect(entschluesseln(wert, schluessel, "doku:1")).toBe("Verlauf: stabil, Schlaf verbessert");
  });

  it("erzeugt bei gleichem Klartext jedes Mal einen anderen Chiffretext", () => {
    expect(verschluesseln("x", schluessel, "k")).not.toBe(verschluesseln("x", schluessel, "k"));
  });

  it("lehnt einen Wert aus einem anderen Kontext ab", () => {
    const wert = verschluesseln("geheim", schluessel, "doku:1");
    expect(() => entschluesseln(wert, schluessel, "doku:2")).toThrow();
  });

  it("lehnt einen falschen Schlüssel ab", () => {
    const wert = verschluesseln("geheim", schluessel, "doku:1");
    expect(() => entschluesseln(wert, neuerSchluessel(), "doku:1")).toThrow();
  });

  it("erkennt manipulierten Chiffretext", () => {
    const teile = verschluesseln("geheim", schluessel, "doku:1").split(".");
    const chiffre = Buffer.from(teile[3] ?? "", "base64url");
    chiffre[0] = (chiffre[0] ?? 0) ^ 1;
    teile[3] = chiffre.toString("base64url");
    expect(() => entschluesseln(teile.join("."), schluessel, "doku:1")).toThrow();
  });

  it("verpackt den Datenschlüssel einer Praxis nur für diese Praxis", () => {
    const haupt = neuerSchluessel();
    const daten = neuerSchluessel();
    const verpackt = datenschluesselVerpacken(daten, haupt, "praxis-a");
    expect(datenschluesselEntpacken(verpackt, haupt, "praxis-a").equals(daten)).toBe(true);
    expect(() => datenschluesselEntpacken(verpackt, haupt, "praxis-b")).toThrow();
  });
});
