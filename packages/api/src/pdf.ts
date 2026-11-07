import { formatEuro, type HonorarnoteInhalt, UST_BEFREIUNGSVERMERK } from "@lumiva/domain";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const TRAEGER: Record<string, string> = {
  oegk: "ÖGK",
  bvaeb: "BVAEB",
  svs: "SVS",
  kfa: "KFA",
  privat: "Selbstzahler:in",
  sonstige: "Sonstige",
};

function datum(iso: string) {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

/** Honorarnote als PDF, A4, mit allen Angaben für den Kostenzuschuss. */
export async function honorarnotePdf(
  n: HonorarnoteInhalt,
  vermerke: { bezahltAm: string | null; storniertAm: string | null },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Honorarnote ${n.nummer}`);
  doc.setAuthor(n.praxis.name);
  doc.setCreator("LUMIVA");
  const seite = doc.addPage([595.28, 841.89]);
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const dunkel = rgb(0.11, 0.14, 0.19);
  const grau = rgb(0.36, 0.39, 0.45);
  const links = 56;
  const rechts = 539;
  let y = 790;

  const text = (
    t: string,
    x: number,
    opts: { groesse?: number; bold?: boolean; farbe?: typeof dunkel } = {},
  ) =>
    seite.drawText(t, {
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
    const breite = (opts.bold ? fett : schrift).widthOfTextAtSize(t, opts.groesse ?? 10);
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
  rechtsbuendig(`Datum: ${datum(n.ausstellungsdatum)}`, rechts);

  // Angaben für den Kostenzuschuss
  y -= 26;
  const angaben: [string, string][] = [
    ["Geburtsdatum", datum(n.patient.geburtsdatum)],
    ["Sozialversicherungsnr.", n.patient.svNummer ?? "–"],
    [
      "Versicherungsträger",
      TRAEGER[n.patient.versicherungstraeger] ?? n.patient.versicherungstraeger,
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
    y -= 16;
    text(datum(s.datum), links);
    text(s.bezeichnung, links + 80);
    rechtsbuendig(`${s.dauerMinuten} Min.`, links + 380);
    rechtsbuendig(formatEuro(s.honorarCent), rechts);
  }
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
    text(`Betrag dankend erhalten am ${datum(vermerke.bezahltAm)}.`, links, { bold: true });
  }
  if (vermerke.storniertAm) {
    y -= 24;
    text(`STORNIERT am ${datum(vermerke.storniertAm)}`, links, {
      groesse: 14,
      bold: true,
      farbe: rgb(0.7, 0.15, 0.15),
    });
  }

  // Unterschrift
  y = 120;
  seite.drawLine({
    start: { x: rechts - 200, y },
    end: { x: rechts, y },
    thickness: 0.5,
    color: grau,
  });
  y -= 12;
  rechtsbuendig("Unterschrift und Stempel", rechts, { groesse: 8 });

  return doc.save();
}
