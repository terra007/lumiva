/**
 * Feldverschlüsselung für Gesundheitsdaten (AES-256-GCM, Umschlagverfahren):
 * - Jede Praxis hat einen eigenen Datenschlüssel.
 * - Der Datenschlüssel liegt nur verschlüsselt mit dem Hauptschlüssel des Servers in der Datenbank.
 * - Jeder Wert ist an seinen Kontext gebunden (z. B. "patienten.vorname:<id>"), damit
 *   Chiffretext nicht unbemerkt in eine andere Zeile oder Spalte kopiert werden kann.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHMUS = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;
const SCHLUESSEL_BYTES = 32;
const TAG_BYTES = 16;

export function neuerSchluessel(): Buffer {
  return randomBytes(SCHLUESSEL_BYTES);
}

export function schluesselAusBase64(wert: string): Buffer {
  const schluessel = Buffer.from(wert, "base64");
  if (schluessel.length !== SCHLUESSEL_BYTES) {
    throw new Error(`Schlüssel muss ${SCHLUESSEL_BYTES} Bytes lang sein`);
  }
  return schluessel;
}

export function verschluesseln(klartext: string, schluessel: Buffer, kontext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHMUS, schluessel, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(kontext, "utf8"));
  const chiffre = Buffer.concat([cipher.update(klartext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, chiffre]
    .map((t) => (typeof t === "string" ? t : t.toString("base64url")))
    .join(".");
}

export function entschluesseln(wert: string, schluessel: Buffer, kontext: string): string {
  const teile = wert.split(".");
  if (teile.length !== 4 || teile[0] !== VERSION) {
    throw new Error("Unbekanntes Format des verschlüsselten Werts");
  }
  const [, iv, tag, chiffre] = teile.map((t) => Buffer.from(t, "base64url")) as [
    Buffer,
    Buffer,
    Buffer,
    Buffer,
  ];
  // Länge prüfen: Node akzeptiert sonst gekürzte Prüfsummen, die sich leichter fälschen lassen.
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Ungültige Länge von IV oder Prüfsumme");
  }
  const decipher = createDecipheriv(ALGORITHMUS, schluessel, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(kontext, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(chiffre), decipher.final()]).toString("utf8");
}

/** Verpackt den Datenschlüssel einer Praxis mit dem Hauptschlüssel des Servers. */
export function datenschluesselVerpacken(
  datenschluessel: Buffer,
  hauptschluessel: Buffer,
  praxisId: string,
): string {
  return verschluesseln(datenschluessel.toString("base64"), hauptschluessel, `praxis:${praxisId}`);
}

export function datenschluesselEntpacken(
  verpackt: string,
  hauptschluessel: Buffer,
  praxisId: string,
): Buffer {
  return schluesselAusBase64(entschluesseln(verpackt, hauptschluessel, `praxis:${praxisId}`));
}
