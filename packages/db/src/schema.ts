/**
 * Datenmodell von LUMIVA. Jede Zeile gehört zu genau einer Praxis (praxisId),
 * damit mehrere Praxen sicher getrennt in einer Datenbank liegen können.
 *
 * Felder mit der Endung "Enc" enthalten Gesundheitsdaten und werden vor dem Speichern
 * mit dem Schlüssel der Praxis verschlüsselt (siehe crypto.ts). Die Datenbank sieht nur Chiffretext.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid().primaryKey().default(sql`gen_random_uuid()`);
const erstelltAm = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/**
 * Fremdschlüssel über (praxisId, patientId): Die Datenbank selbst verhindert so,
 * dass eine Zeile der Praxis A auf eine Patientin der Praxis B zeigt.
 */
function gleichePraxis(
  t: { praxisId: AnyPgColumn; patientId: AnyPgColumn },
  ziel: { praxisId: AnyPgColumn; id: AnyPgColumn },
) {
  return foreignKey({
    columns: [t.praxisId, t.patientId],
    foreignColumns: [ziel.praxisId, ziel.id],
  });
}

export const rolle = pgEnum("rolle", ["inhaber", "therapeut", "assistenz"]);
export const versicherungstraeger = pgEnum("versicherungstraeger", [
  "oegk",
  "bvaeb",
  "svs",
  "kfa",
  "privat",
  "sonstige",
]);
export const patientStatus = pgEnum("patient_status", ["aktiv", "pausiert", "abgeschlossen"]);
export const terminStatus = pgEnum("termin_status", [
  "geplant",
  "erledigt",
  "abgesagt",
  "nicht_erschienen",
]);
export const eintragArt = pgEnum("eintrag_art", ["erstgespraech", "verlauf", "abschluss", "notiz"]);

export const praxen = pgTable("praxen", {
  id: id(),
  name: text().notNull(),
  anschrift: text().notNull(),
  /** Datenschlüssel der Praxis, verschlüsselt mit dem Hauptschlüssel des Servers. */
  datenschluesselEnc: text().notNull(),
  erstelltAm: erstelltAm(),
});

export const mitgliedschaften = pgTable(
  "mitgliedschaften",
  {
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    benutzerId: text().notNull(),
    rolle: rolle().notNull(),
    /** § 45 Abs. 2 PThG 2024: Belehrung von Hilfspersonen über die Verschwiegenheit. */
    verschwiegenheitBelehrtAm: timestamp({ withTimezone: true }),
    erstelltAm: erstelltAm(),
  },
  (t) => [primaryKey({ columns: [t.praxisId, t.benutzerId] })],
);

export const patienten = pgTable(
  "patienten",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    therapeutId: text().notNull(),
    vornameEnc: text().notNull(),
    nachnameEnc: text().notNull(),
    geburtsdatumEnc: text().notNull(),
    svNummerEnc: text(),
    kontaktEnc: text(),
    versicherungstraeger: versicherungstraeger().notNull(),
    status: patientStatus().notNull().default("aktiv"),
    aerztlicheBestaetigungAm: date(),
    bewilligungAm: date(),
    behandlungsende: date(),
    /** Ab diesem Tag darf die Akte gelöscht werden (Aufbewahrungsfrist). */
    loeschbarAb: date(),
    erstelltAm: erstelltAm(),
  },
  (t) => [index().on(t.praxisId, t.therapeutId), unique().on(t.praxisId, t.id)],
);

export const sitzungsarten = pgTable(
  "sitzungsarten",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    name: text().notNull(),
    dauerMinuten: integer().notNull(),
    honorarCent: integer().notNull(),
    aktiv: boolean().notNull().default(true),
  },
  (t) => [unique().on(t.praxisId, t.id)],
);

export const termine = pgTable(
  "termine",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    patientId: uuid().notNull(),
    therapeutId: text().notNull(),
    sitzungsartId: uuid(),
    beginn: timestamp({ withTimezone: true }).notNull(),
    ende: timestamp({ withTimezone: true }).notNull(),
    status: terminStatus().notNull().default("geplant"),
    /** Gemeinsame Kennung aller Termine einer Serie, z. B. wöchentlich. */
    serieId: uuid(),
    honorarCent: integer().notNull(),
    ausfallhonorarCent: integer(),
    erstelltAm: erstelltAm(),
  },
  (t) => [
    index().on(t.praxisId, t.therapeutId, t.beginn),
    index().on(t.patientId),
    unique().on(t.praxisId, t.id),
    gleichePraxis(t, patienten),
    foreignKey({
      columns: [t.praxisId, t.sitzungsartId],
      foreignColumns: [sitzungsarten.praxisId, sitzungsarten.id],
    }),
  ],
);

export const dokuEintraege = pgTable(
  "doku_eintraege",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    patientId: uuid().notNull(),
    terminId: uuid(),
    art: eintragArt().notNull(),
    inhaltEnc: text().notNull(),
    diagnoseIcd10Enc: text(),
    erstelltVon: text().notNull(),
    erstelltAm: erstelltAm(),
    geaendertAm: timestamp({ withTimezone: true }),
  },
  (t) => [
    index().on(t.patientId),
    gleichePraxis(t, patienten),
    foreignKey({
      columns: [t.praxisId, t.terminId],
      foreignColumns: [termine.praxisId, termine.id],
    }),
  ],
);

/** Lückenlose Nummernkreise für Honorarnoten je Praxis und Jahr. */
export const nummernkreise = pgTable(
  "nummernkreise",
  {
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    jahr: integer().notNull(),
    letzteNummer: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.praxisId, t.jahr] })],
);

export const honorarnoten = pgTable(
  "honorarnoten",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    patientId: uuid().notNull(),
    jahr: integer().notNull(),
    laufendeNummer: integer().notNull(),
    ausgestelltAm: date().notNull(),
    summeCent: integer().notNull(),
    bezahltAm: date(),
    /** Storno statt Änderung: eine fehlerhafte Honorarnote wird storniert und neu ausgestellt. */
    storniertAm: date(),
    /** Unveränderliche Kopie der Honorarnote zum Zeitpunkt der Ausstellung. */
    inhaltEnc: text().notNull(),
    erstelltAm: erstelltAm(),
  },
  (t) => [
    unique().on(t.praxisId, t.jahr, t.laufendeNummer),
    unique().on(t.praxisId, t.id),
    gleichePraxis(t, patienten),
  ],
);

/**
 * Abgerechnete Sitzungen einer Honorarnote. Ein Termin darf nur auf einer nicht stornierten
 * Honorarnote stehen; das prüft die Anwendung, weil stornierte Noten erhalten bleiben.
 */
export const honorarnotePositionen = pgTable(
  "honorarnote_positionen",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    honorarnoteId: uuid().notNull(),
    terminId: uuid().notNull(),
    honorarCent: integer().notNull(),
  },
  (t) => [
    index().on(t.terminId),
    foreignKey({
      columns: [t.praxisId, t.honorarnoteId],
      foreignColumns: [honorarnoten.praxisId, honorarnoten.id],
    }),
    foreignKey({
      columns: [t.praxisId, t.terminId],
      foreignColumns: [termine.praxisId, termine.id],
    }),
  ],
);

export const aufgaben = pgTable(
  "aufgaben",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    patientId: uuid(),
    zustaendigId: text().notNull(),
    titel: text().notNull(),
    faelligAm: date(),
    erledigtAm: timestamp({ withTimezone: true }),
    erstelltAm: erstelltAm(),
  },
  (t) => [index().on(t.praxisId, t.zustaendigId), gleichePraxis(t, patienten)],
);

/** Protokoll jedes Zugriffs auf und jeder Änderung an Patientendaten. Nur anhängen, nie ändern. */
export const protokoll = pgTable(
  "protokoll",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    benutzerId: text().notNull(),
    aktion: text().notNull(),
    objektTyp: text().notNull(),
    objektId: uuid(),
    details: jsonb(),
    zeitpunkt: erstelltAm(),
  },
  (t) => [index().on(t.praxisId, t.zeitpunkt), index().on(t.objektId)],
);
