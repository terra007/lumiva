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
  check,
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
  "svs_bauern",
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
  strasse: text().notNull().default(""),
  plz: text().notNull().default(""),
  ort: text().notNull().default(""),
  telefon: text(),
  email: text(),
  iban: text(),
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
    /** Wie die Person auf der Honorarnote steht, z. B. "Psychotherapeutin (Verhaltenstherapie)". */
    berufsbezeichnung: text(),
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
    /** Schriftliche Einwilligung zur Aufnahme von Sitzungen für die KI-Doku (DSGVO Art. 9 Abs. 2 lit. a). */
    kiAufnahmeEinwilligungAm: date(),
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
    /** Mehrere Codes als „F32.1, F41.1“. */
    diagnoseIcd10Enc: text(),
    /** Wörtliches Transkript der KI-Aufnahme, wenn der Therapeut es mitspeichert. */
    transkriptEnc: text(),
    erstelltVon: text().notNull(),
    erstelltAm: erstelltAm(),
    geaendertAm: timestamp({ withTimezone: true }),
    /**
     * Papierkorb: gelöschte Einträge bleiben wegen der Dokumentations- und Aufbewahrungspflicht
     * (§ 18 PThG 2024) erhalten und lassen sich wiederherstellen.
     */
    geloeschtAm: timestamp({ withTimezone: true }),
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

export const zahlungArt = pgEnum("zahlung_art", ["terminal", "online"]);
export const zahlungStatus = pgEnum("zahlung_status", [
  "offen",
  "bezahlt",
  "fehlgeschlagen",
  "abgebrochen",
]);

/**
 * Zugang der Praxis zu SumUp. Der API-Schlüssel ist kein Gesundheitsdatum, aber ein Geheimnis
 * und liegt deshalb ebenso verschlüsselt in der Datenbank.
 */
export const sumupKonten = pgTable("sumup_konten", {
  praxisId: uuid()
    .primaryKey()
    .references(() => praxen.id),
  haendlerCode: text().notNull(),
  apiSchluesselEnc: text().notNull(),
  /** Für Zahlungen am Terminal (Cloud API): Affiliate-Key und App-ID aus dem SumUp-Dashboard. */
  affiliateAppId: text(),
  affiliateSchluesselEnc: text(),
  terminalId: text(),
  terminalName: text(),
  geaendertAm: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zahlungsversuche über SumUp: gleich nach einer Sitzung (terminId) oder für eine Honorarnote
 * (honorarnoteId). An SumUp gehen nur Betrag und Nummer bzw. Datum, nie Name oder Diagnose.
 * Der Betrag ist eine Kopie zum Zeitpunkt des Versuchs.
 */
export const zahlungen = pgTable(
  "zahlungen",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    /** Genau eines von beiden: Zahlung einer Honorarnote oder einer einzelnen Sitzung. */
    honorarnoteId: uuid(),
    terminId: uuid(),
    art: zahlungArt().notNull(),
    status: zahlungStatus().notNull().default("offen"),
    betragCent: integer().notNull(),
    /** Terminal: client_transaction_id; online: ID des Checkouts bei SumUp. */
    anbieterId: text(),
    /** Online: Adresse der Zahlungsseite von SumUp, gültig rund 30 Minuten. */
    zahlseiteUrl: text(),
    transaktionCode: text(),
    erstelltAm: erstelltAm(),
    abgeschlossenAm: timestamp({ withTimezone: true }),
  },
  (t) => [
    index().on(t.honorarnoteId),
    index().on(t.terminId),
    foreignKey({
      columns: [t.praxisId, t.honorarnoteId],
      foreignColumns: [honorarnoten.praxisId, honorarnoten.id],
    }),
    foreignKey({
      columns: [t.praxisId, t.terminId],
      foreignColumns: [termine.praxisId, termine.id],
    }),
    check("zahlung_ziel", sql`num_nonnulls(${t.honorarnoteId}, ${t.terminId}) = 1`),
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

/**
 * Urlaub und andere Abwesenheiten eines Therapeuten, ganztägig von `von` bis einschließlich `bis`.
 * Art und Notiz sind verschlüsselt: Ein Krankenstand ist ein Gesundheitsdatum (Art. 9 DSGVO).
 */
export const abwesenheiten = pgTable(
  "abwesenheiten",
  {
    id: id(),
    praxisId: uuid()
      .notNull()
      .references(() => praxen.id),
    benutzerId: text().notNull(),
    von: date().notNull(),
    bis: date().notNull(),
    artEnc: text().notNull(),
    notizEnc: text(),
    erstelltAm: erstelltAm(),
  },
  (t) => [index().on(t.praxisId, t.bis), check("abwesenheit_zeitraum", sql`${t.bis} >= ${t.von}`)],
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

/*
 * Tabellen der Anmeldung (Better Auth). Namen und Felder folgen dem Better-Auth-Kernschema.
 * benutzerId in den Praxis-Tabellen verweist auf user.id.
 */
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
