import {
  formatDatum,
  formatEuro,
  type HonorarnoteInhalt,
  TRAEGER_NAME,
  UST_BEFREIUNGSVERMERK,
} from "@lumiva/domain";
import { PDFDocument, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

// Zeichen, die Helvetica (WinAnsi) zusätzlich zu Latin-1 darstellen kann.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const ERSATZ: Record<string, string> = { ł: "l", Ł: "L", đ: "d", Đ: "D", ı: "i", ħ: "h", Ħ: "H" };

/**
 * Macht Text für die Standardschrift druckbar: z. B. "Kovačević" wird "Kovacevic".
 * Ohne das wirft pdf-lib bei Namen mit Zeichen außerhalb von WinAnsi.
 */
export function druckbar(t: string): string {
  let aus = "";
  for (const z of t) {
    const code = z.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(z)) {
      aus += z;
      continue;
    }
    const ohneAkzent = (ERSATZ[z] ?? z).normalize("NFD").replace(/\p{M}/gu, "");
    aus += [...ohneAkzent].every((c) => (c.codePointAt(0) ?? 0) <= 0xff) ? ohneAkzent : "?";
  }
  return aus;
}

/** Honorarnote als PDF, A4, mit allen Angaben für den Kostenzuschuss. */
export async function honorarnotePdf(
  n: HonorarnoteInhalt,
  vermerke: {
    bezahltAm: string | null;
    storniertAm: string | null;
    /** Link zur Online-Zahlung (SumUp); erscheint als QR-Code, solange die Note offen ist. */
    zahllink?: string | null;
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Honorarnote ${n.nummer}`);
  doc.setAuthor(n.praxis.name);
  doc.setCreator("LUMIVA");
  const FORMAT: [number, number] = [595.28, 841.89];
  const OBEN = 790;
  let seite = doc.addPage(FORMAT);
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const dunkel = rgb(0.11, 0.14, 0.19);
  const grau = rgb(0.36, 0.39, 0.45);
  const links = 56;
  const rechts = 539;
  let y = OBEN;
  /** Neue Seite, wenn unten weniger als `hoehe` Punkte frei sind. */
  const platz = (hoehe: number) => {
    if (y - hoehe >= 60) return;
    seite = doc.addPage(FORMAT);
    y = OBEN;
  };

  const text = (
    t: string,
    x: number,
    opts: { groesse?: number; bold?: boolean; farbe?: typeof dunkel } = {},
  ) =>
    seite.drawText(druckbar(t), {
      x,
      y,
      size: opts.groesse ?? 10,
      font: opts.bold ? fett : schrift,
      color: opts.farbe ?? dunkel,
    });
  const rechtsbuendig = (
    t: string,
    xRechts: number,
    opts: { groesse?: number; bold?: boolean } = {},
  ) => {
    const breite = (opts.bold ? fett : schrift).widthOfTextAtSize(druckbar(t), opts.groesse ?? 10);
    text(t, xRechts - breite, opts);
  };
  const zeile = () => {
    seite.drawLine({
      start: { x: links, y: y + 4 },
      end: { x: rechts, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.84, 0.8),
    });
  };

  // Kopf: Praxis
  text(n.praxis.name, links, { groesse: 14, bold: true });
  y -= 16;
  text(
    n.therapeut.name + (n.therapeut.berufsbezeichnung ? `, ${n.therapeut.berufsbezeichnung}` : ""),
    links,
    { farbe: grau },
  );
  for (const t of [
    n.praxis.anschrift,
    [n.praxis.telefon, n.praxis.email].filter(Boolean).join(" · "),
  ]) {
    if (!t) continue;
    y -= 13;
    text(t, links, { farbe: grau });
  }

  // Empfänger:in
  y -= 40;
  text(`${n.patient.vorname} ${n.patient.nachname}`, links, { bold: true });
  if (n.patient.anschrift) {
    for (const t of n.patient.anschrift.split(/,\s*|\n/)) {
      y -= 13;
      text(t, links);
    }
  }

  y -= 40;
  text(`Honorarnote Nr. ${n.nummer}`, links, { groesse: 16, bold: true });
  rechtsbuendig(`Datum: ${formatDatum(n.ausstellungsdatum)}`, rechts);

  // Angaben für den Kostenzuschuss
  y -= 26;
  const angaben: [string, string][] = [
    ["Geburtsdatum", formatDatum(n.patient.geburtsdatum)],
    ["Sozialversicherungsnr.", n.patient.svNummer ?? "–"],
    [
      "Versicherungsträger",
      TRAEGER_NAME[n.patient.versicherungstraeger] ?? n.patient.versicherungstraeger,
    ],
    ["Diagnose (ICD-10)", n.diagnoseIcd10 ?? "–"],
  ];
  for (const [k, v] of angaben) {
    text(k, links, { farbe: grau });
    text(v, links + 140);
    y -= 14;
  }

  // Leistungen
  y -= 16;
  text("Datum", links, { bold: true });
  text("Leistung", links + 80, { bold: true });
  rechtsbuendig("Dauer", links + 380, { bold: true });
  rechtsbuendig("Honorar", rechts, { bold: true });
  y -= 6;
  zeile();
  for (const s of n.sitzungen) {
    platz(16);
    y -= 16;
    text(formatDatum(s.datum), links);
    text(s.bezeichnung, links + 80);
    rechtsbuendig(`${s.dauerMinuten} Min.`, links + 380);
    rechtsbuendig(formatEuro(s.honorarCent), rechts);
  }
  platz(120);
  y -= 8;
  zeile();
  y -= 14;
  text(
    `Summe (${n.sitzungen.length} ${n.sitzungen.length === 1 ? "Sitzung" : "Sitzungen"}, Einzelbehandlung)`,
    links,
    { bold: true },
  );
  rechtsbuendig(formatEuro(n.summeCent), rechts, { bold: true });

  y -= 30;
  text(UST_BEFREIUNGSVERMERK, links, { farbe: grau });
  if (n.praxis.iban && !vermerke.bezahltAm) {
    y -= 14;
    text(
      `Bitte überweisen Sie den Betrag auf IBAN ${n.praxis.iban}, Verwendungszweck ${n.nummer}.`,
      links,
      { farbe: grau },
    );
  }
  if (vermerke.bezahltAm) {
    y -= 24;
    text(`Betrag dankend erhalten am ${formatDatum(vermerke.bezahltAm)}.`, links, { bold: true });
  }
  if (vermerke.storniertAm) {
    y -= 24;
    text(`STORNIERT am ${formatDatum(vermerke.storniertAm)}`, links, {
      groesse: 14,
      bold: true,
      farbe: rgb(0.7, 0.15, 0.15),
    });
  }

  // Unterschrift unten auf der letzten Seite
  if (y < 160) {
    seite = doc.addPage(FORMAT);
  }
  y = 120;
  seite.drawLine({
    start: { x: rechts - 200, y },
    end: { x: rechts, y },
    thickness: 0.5,
    color: grau,
  });
  y -= 12;
  rechtsbuendig("Unterschrift und Stempel", rechts, { groesse: 8 });

  if (vermerke.zahllink && !vermerke.bezahltAm && !vermerke.storniertAm) {
    const groesse = 72;
    qrZeichnen(seite, vermerke.zahllink, links, 70, groesse);
    y = 70 + groesse - 10;
    text("Mit Karte bezahlen:", links + groesse + 10, { bold: true, groesse: 9 });
    y -= 12;
    text("QR-Code mit dem Handy scannen,", links + groesse + 10, { groesse: 8, farbe: grau });
    y -= 10;
    text("sicher bezahlen über SumUp.", links + groesse + 10, { groesse: 8, farbe: grau });
  }

  return doc.save();
}

/** Zeichnet einen QR-Code als Vektorgrafik (scharf in jeder Druckgröße). */
function qrZeichnen(seite: PDFPage, inhalt: string, x: number, y: number, groesse: number) {
  const { modules } = QRCode.create(inhalt, { errorCorrectionLevel: "M" });
  const modul = groesse / modules.size;
  for (let zeile = 0; zeile < modules.size; zeile++) {
    for (let spalte = 0; spalte < modules.size; spalte++) {
      if (!modules.get(zeile, spalte)) continue;
      seite.drawRectangle({
        x: x + spalte * modul,
        y: y + groesse - (zeile + 1) * modul,
        width: modul,
        height: modul,
        color: rgb(0, 0, 0),
      });
    }
  }
}
