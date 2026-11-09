"use server";
import { nutzerMeldung } from "@lumiva/api";
import { wienZuDate } from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { api } from "./lumiva";

export type Ergebnis = { ok?: boolean; fehler?: string } | null;

const FELDNAMEN: Record<string, string> = {
  vorname: "Vorname",
  nachname: "Nachname",
  geburtsdatum: "Geburtsdatum",
  svNummer: "Sozialversicherungsnummer",
  name: "Name",
  anschrift: "Anschrift",
  email: "E-Mail",
  iban: "IBAN",
  inhalt: "Text",
  diagnoseIcd10: "Diagnose",
  transkript: "Transkript",
  titel: "Titel",
  terminIds: "Termine",
  haendlerCode: "Händlercode",
  code: "Kopplungscode",
  von: "Von",
  bis: "Bis",
  art: "Art",
  notiz: "Notiz",
};

function fehlertext(e: unknown): string | null {
  if (e instanceof TRPCError) {
    if (e.cause instanceof ZodError) {
      const erstes = e.cause.issues[0];
      const feld = erstes?.path[0]
        ? (FELDNAMEN[String(erstes.path[0])] ?? String(erstes.path[0]))
        : "Eingabe";
      return `${feld}: ${erstes?.message ?? "ungültig"}`;
    }
    return nutzerMeldung(e);
  }
  return null;
}

/** Führt eine Änderung aus und übersetzt erwartbare Fehler in eine Meldung fürs Formular. */
async function ausfuehren(fn: () => Promise<unknown>): Promise<Ergebnis> {
  try {
    await fn();
  } catch (e) {
    // Umleitungen von Next.js weiterreichen, alles andere als Meldung im Formular zeigen,
    // damit die Eingaben auch bei unerwarteten Fehlern erhalten bleiben.
    unstable_rethrow(e);
    return { fehler: fehlertext(e) ?? "Etwas ist schiefgelaufen. Bitte versuche es erneut." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const s = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const optional = (d: FormData, k: string) => s(d, k) || undefined;
const cent = (d: FormData, k: string) => Math.round(Number(s(d, k).replace(",", ".")) * 100);

// Praxis

export async function praxisAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  const r = await ausfuehren(async () =>
    (await api()).praxis.anlegen({
      name: s(d, "name"),
      anschrift: s(d, "anschrift"),
      telefon: optional(d, "telefon"),
      email: s(d, "email"),
      iban: s(d, "iban"),
      berufsbezeichnung: optional(d, "berufsbezeichnung"),
    }),
  );
  if (r?.ok) redirect("/");
  return r;
}

export async function praxisSpeichern(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).praxis.speichern({
      name: s(d, "name"),
      anschrift: s(d, "anschrift"),
      telefon: optional(d, "telefon"),
      email: s(d, "email"),
      iban: s(d, "iban"),
      berufsbezeichnung: optional(d, "berufsbezeichnung"),
    }),
  );
}

export async function sitzungsartSpeichern(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).praxis.sitzungsartSpeichern({
      id: optional(d, "id"),
      name: s(d, "name"),
      dauerMinuten: Number(s(d, "dauerMinuten")),
      honorarCent: cent(d, "honorar"),
      aktiv: d.get("aktiv") !== "nein",
    }),
  );
}

export async function demoLaden(_: Ergebnis): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).demo.laden());
}

// Patient:innen

function stammdaten(d: FormData) {
  return {
    vorname: s(d, "vorname"),
    nachname: s(d, "nachname"),
    geburtsdatum: s(d, "geburtsdatum"),
    svNummer: s(d, "svNummer"),
    versicherungstraeger: s(d, "versicherungstraeger") as "oegk",
    kontakt: { telefon: s(d, "telefon"), email: s(d, "email"), anschrift: s(d, "anschrift") },
  };
}

export async function patientAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  let id = "";
  const r = await ausfuehren(async () => {
    id = (await (await api()).patienten.anlegen(stammdaten(d))).id;
  });
  if (r?.ok) redirect(`/patienten/${id}`);
  return r;
}

export async function patientBearbeiten(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  const id = s(d, "id");
  const r = await ausfuehren(async () =>
    (await api()).patienten.bearbeiten({ id, ...stammdaten(d) }),
  );
  if (r?.ok) redirect(`/patienten/${id}`);
  return r;
}

export async function bestaetigungenSpeichern(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).patienten.bestaetigungen({
      id: s(d, "id"),
      aerztlicheBestaetigungAm: s(d, "aerztlicheBestaetigungAm") || null,
      bewilligungAm: s(d, "bewilligungAm") || null,
      // Feld gibt es nur, wenn die KI eingerichtet ist; sonst unverändert lassen.
      kiAufnahmeEinwilligungAm: d.has("kiAufnahmeEinwilligungAm")
        ? s(d, "kiAufnahmeEinwilligungAm") || null
        : undefined,
    }),
  );
}

export async function patientStatus(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).patienten.status({ id: s(d, "id"), status: s(d, "status") as "aktiv" }),
  );
}

// Termine

export async function terminAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => {
    if (!s(d, "datum") || !s(d, "uhrzeit"))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bitte Datum und Uhrzeit angeben." });
    await (await api()).termine.anlegen({
      patientId: s(d, "patientId"),
      sitzungsartId: s(d, "sitzungsartId"),
      beginn: wienZuDate(s(d, "datum"), s(d, "uhrzeit")),
      anzahl: Number(s(d, "anzahl") || "1"),
    });
  });
}

export async function terminStatus(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).termine.status({
      id: s(d, "id"),
      status: s(d, "status") as "erledigt",
      ausfallhonorarCent: s(d, "ausfallhonorar") ? cent(d, "ausfallhonorar") : null,
    }),
  );
}

export async function terminVerschieben(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).termine.verschieben({
      id: s(d, "id"),
      beginn: wienZuDate(s(d, "datum"), s(d, "uhrzeit")),
    }),
  );
}

export async function terminLoeschen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  const zurueck = s(d, "zurueck");
  const r = await ausfuehren(async () =>
    (await api()).termine.loeschen({ id: s(d, "id"), ganzeSerie: s(d, "serie") === "ja" }),
  );
  if (r?.ok && zurueck) redirect(zurueck);
  return r;
}

// Dokumentation

export async function dokuAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).doku.anlegen({
      patientId: s(d, "patientId"),
      terminId: optional(d, "terminId"),
      art: s(d, "art") as "verlauf",
      inhalt: s(d, "inhalt"),
      diagnoseIcd10: d
        .getAll("diagnoseIcd10")
        .map(String)
        .filter((c) => c.trim()),
      transkript: optional(d, "transkript"),
    }),
  );
}

export async function dokuBearbeiten(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).doku.bearbeiten(
      s(d, "feld") === "transkript"
        ? { id: s(d, "id"), transkript: s(d, "text") }
        : { id: s(d, "id"), inhalt: s(d, "text") },
    ),
  );
}

export async function dokuLoeschen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).doku.loeschen({ id: s(d, "id") }));
}

export async function dokuWiederherstellen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).doku.wiederherstellen({ id: s(d, "id") }));
}

// Honorarnoten

export async function honorarnoteAusstellen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).honorarnoten.ausstellen({
      patientId: s(d, "patientId"),
      terminIds: d.getAll("terminIds").map(String),
    }),
  );
}

export async function honorarnoteBezahlt(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).honorarnoten.bezahlt({ id: s(d, "id"), am: s(d, "am") || null }),
  );
}

export async function honorarnoteStornieren(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).honorarnoten.stornieren({ id: s(d, "id") }));
}

// Zahlungen (SumUp)

export async function sumupSpeichern(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).zahlungen.speichern({
      haendlerCode: s(d, "haendlerCode"),
      apiSchluessel: optional(d, "apiSchluessel"),
      affiliateAppId: s(d, "affiliateAppId"),
      affiliateSchluessel: optional(d, "affiliateSchluessel"),
    }),
  );
}

export async function sumupDemo(_: Ergebnis): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).zahlungen.demoEinschalten());
}

export async function sumupTrennen(_: Ergebnis): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).zahlungen.trennen());
}

export async function terminalKoppeln(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).zahlungen.terminalKoppeln({
      code: s(d, "code"),
      name: optional(d, "name"),
    }),
  );
}

type ZahlungsStand = {
  zahlungId?: string;
  status?: string;
  fehler?: string;
  /** Beim Start: Betrag am Terminal und ob es das Demo-Terminal ist. */
  betragCent?: number;
  demo?: boolean;
};

/** Für die Terminal-Zahlung: liefert Daten statt eines Formular-Ergebnisses. */
async function abfragen(fn: () => Promise<ZahlungsStand>): Promise<ZahlungsStand> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { fehler: fehlertext(e) ?? "Etwas ist schiefgelaufen. Bitte versuche es erneut." };
  }
}

export type ZahlungsZiel = { honorarnoteId: string } | { terminId: string; abschliessen?: boolean };

export async function terminalZahlungStarten(ziel: ZahlungsZiel): Promise<ZahlungsStand> {
  // Kein revalidatePath hier: Das würde den Knopf samt Terminal-Fenster neu aufbauen.
  // Die Oberfläche lädt nach Ende der Zahlung selbst neu (router.refresh).
  return abfragen(async () => (await api()).zahlungen.terminalStarten(ziel));
}

export async function zahlungStatus(zahlungId: string): Promise<ZahlungsStand> {
  return abfragen(async () => (await api()).zahlungen.status({ zahlungId }));
}

export async function terminalZahlungAbbrechen(zahlungId: string): Promise<ZahlungsStand> {
  return abfragen(async () => {
    await (await api()).zahlungen.terminalAbbrechen({ zahlungId });
    return {};
  });
}

export async function zahllinkHolen(
  honorarnoteId: string,
): Promise<{ url?: string; fehler?: string }> {
  try {
    return await (await api()).zahlungen.link({ honorarnoteId });
  } catch (e) {
    unstable_rethrow(e);
    return { fehler: fehlertext(e) ?? "Etwas ist schiefgelaufen." };
  }
}

// Aufgaben

export async function aufgabeAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).aufgaben.anlegen({
      titel: s(d, "titel"),
      faelligAm: optional(d, "faelligAm"),
      patientId: optional(d, "patientId"),
    }),
  );
}

export async function aufgabeErledigen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).aufgaben.erledigen({ id: s(d, "id"), erledigt: s(d, "erledigt") === "ja" }),
  );
}

export async function aufgabeLoeschen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).aufgaben.loeschen({ id: s(d, "id") }));
}

// Abwesenheiten

export async function abwesenheitAnlegen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () =>
    (await api()).abwesenheiten.anlegen({
      von: s(d, "von"),
      bis: s(d, "bis") || s(d, "von"),
      art: s(d, "art") as "urlaub",
      notiz: optional(d, "notiz"),
    }),
  );
}

export async function abwesenheitLoeschen(_: Ergebnis, d: FormData): Promise<Ergebnis> {
  return ausfuehren(async () => (await api()).abwesenheiten.loeschen({ id: s(d, "id") }));
}
