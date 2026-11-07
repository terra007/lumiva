import { schema } from "@lumiva/db";
import { tageAddieren, wienZuDate, wochenBeginn } from "@lumiva/domain";
import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { router, therapeutisch } from "../trpc";
import { enc, protokollieren } from "../werkzeuge";
import { heuteInWien } from "./uebersicht";

const PERSONEN = [
  {
    vorname: "Anna",
    nachname: "Berger",
    geburtsdatum: "1988-04-12",
    sv: "1237010180",
    traeger: "oegk",
    diagnose: "F32.1",
    stunde: 9,
    wochentag: 1,
    sitzungen: 6,
  },
  {
    vorname: "Lukas",
    nachname: "Hofer",
    geburtsdatum: "1979-09-30",
    sv: "",
    traeger: "privat",
    diagnose: "F43.2",
    stunde: 10,
    wochentag: 1,
    sitzungen: 3,
  },
  {
    vorname: "Sophie",
    nachname: "Wagner",
    geburtsdatum: "1995-01-22",
    sv: "1237010180",
    traeger: "bvaeb",
    diagnose: "F41.1",
    stunde: 14,
    wochentag: 2,
    sitzungen: 9,
  },
  {
    vorname: "Elias",
    nachname: "Gruber",
    geburtsdatum: "2001-06-05",
    sv: "1237010180",
    traeger: "oegk",
    diagnose: "F40.1",
    stunde: 9,
    wochentag: 3,
    sitzungen: 1,
  },
  {
    vorname: "Marie",
    nachname: "Pichler",
    geburtsdatum: "1969-11-17",
    sv: "1237010180",
    traeger: "svs",
    diagnose: "F33.0",
    stunde: 16,
    wochentag: 4,
    sitzungen: 4,
  },
  {
    vorname: "Jonas",
    nachname: "Steiner",
    geburtsdatum: "1990-03-08",
    sv: "1237010180",
    traeger: "oegk",
    diagnose: "F42.1",
    stunde: 11,
    wochentag: 5,
    sitzungen: 10,
  },
] as const;

const VERLAUF = [
  "Thema: Schlaf und Tagesstruktur. Erste kleine Fortschritte, Wochenplan besprochen.",
  "Rückblick auf die Woche, belastende Situation im Beruf bearbeitet. Hausaufgabe: Tagebuch.",
  "Ressourcenarbeit, Stimmung stabiler. Nächste Sitzung: Umgang mit Rückfällen.",
];

const TAG = 24 * 60 * 60_000;

export const demoRouter = router({
  /** Legt Beispielpatient:innen mit Terminen, Doku und Aufgaben an, damit man LUMIVA sofort ausprobieren kann. */
  laden: therapeutisch.mutation(async ({ ctx }) => {
    const [vorhanden] = await ctx.db
      .select({ anzahl: count() })
      .from(schema.patienten)
      .where(
        and(
          eq(schema.patienten.praxisId, ctx.praxis.id),
          eq(schema.patienten.therapeutId, ctx.benutzer.id),
        ),
      );
    if ((vorhanden?.anzahl ?? 0) > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Demo-Daten nur in einer leeren Praxis." });
    }
    const arten = await ctx.db
      .select()
      .from(schema.sitzungsarten)
      .where(eq(schema.sitzungsarten.praxisId, ctx.praxis.id));
    const einzel = arten.find((a) => a.name === "Einzelsitzung") ?? arten[0];
    if (!einzel)
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Keine Sitzungsart vorhanden." });

    const { datum, von: heute } = heuteInWien();
    const montagDatum = wochenBeginn(datum);
    /** Zeitpunkt in Wien: Woche w relativ zu dieser, Wochentag 1–7, Stunde. */
    const zeitpunkt = (w: number, wochentag: number, stunde: number) =>
      wienZuDate(
        tageAddieren(montagDatum, w * 7 + wochentag - 1),
        `${String(stunde).padStart(2, "0")}:00`,
      );

    await ctx.db.transaction(async (tx) => {
      for (const p of PERSONEN) {
        const id = crypto.randomUUID();
        const dabeiSeit = zeitpunkt(-p.sitzungen, 1, 12);
        await tx.insert(schema.patienten).values({
          id,
          praxisId: ctx.praxis.id,
          therapeutId: ctx.benutzer.id,
          vornameEnc: enc(ctx.praxis, "patienten.vorname", id, p.vorname),
          nachnameEnc: enc(ctx.praxis, "patienten.nachname", id, p.nachname),
          geburtsdatumEnc: enc(ctx.praxis, "patienten.geburtsdatum", id, p.geburtsdatum),
          svNummerEnc: p.sv ? enc(ctx.praxis, "patienten.sv_nummer", id, p.sv) : null,
          kontaktEnc: enc(
            ctx.praxis,
            "patienten.kontakt",
            id,
            JSON.stringify({
              telefon: "+43 660 1234567",
              email: "",
              anschrift: "Musterstraße 1, 1010 Wien",
            }),
          ),
          versicherungstraeger: p.traeger,
          aerztlicheBestaetigungAm: p.sitzungen > 1 ? dabeiSeit.toISOString().slice(0, 10) : null,
          bewilligungAm: p.sitzungen > 9 ? dabeiSeit.toISOString().slice(0, 10) : null,
        });

        // Vergangene Sitzungen (erledigt) und vier künftige, wöchentlich am selben Tag.
        const termine = [];
        for (let w = -p.sitzungen; w < 4; w++) {
          const beginn = zeitpunkt(w, p.wochentag, p.stunde);
          termine.push({
            id: crypto.randomUUID(),
            praxisId: ctx.praxis.id,
            patientId: id,
            therapeutId: ctx.benutzer.id,
            sitzungsartId: einzel.id,
            beginn,
            ende: new Date(beginn.getTime() + einzel.dauerMinuten * 60_000),
            status: beginn < heute ? ("erledigt" as const) : ("geplant" as const),
            honorarCent: einzel.honorarCent,
          });
        }
        await tx.insert(schema.termine).values(termine);

        const vergangen = termine.filter((t) => t.status === "erledigt");
        for (const [i, t] of vergangen.slice(-3).entries()) {
          const dokuId = crypto.randomUUID();
          const erstes = i === 0 && vergangen.length <= 3;
          await tx.insert(schema.dokuEintraege).values({
            id: dokuId,
            praxisId: ctx.praxis.id,
            patientId: id,
            terminId: t.id,
            art: erstes ? "erstgespraech" : "verlauf",
            inhaltEnc: enc(
              ctx.praxis,
              "doku_eintraege.inhalt",
              dokuId,
              VERLAUF[i % VERLAUF.length] ?? "",
            ),
            diagnoseIcd10Enc:
              i === 0 ? enc(ctx.praxis, "doku_eintraege.diagnose_icd10", dokuId, p.diagnose) : null,
            erstelltVon: ctx.benutzer.id,
            erstelltAm: new Date(t.ende.getTime() + 10 * 60_000),
          });
        }
        if (p.sitzungen === 1) {
          await tx.insert(schema.aufgaben).values({
            praxisId: ctx.praxis.id,
            zustaendigId: ctx.benutzer.id,
            patientId: id,
            titel: "Ärztliche Bestätigung vor der 2. Sitzung anfordern",
            faelligAm: new Date(heute.getTime() + 2 * TAG).toISOString().slice(0, 10),
          });
        }
      }
      await tx.insert(schema.aufgaben).values([
        {
          praxisId: ctx.praxis.id,
          zustaendigId: ctx.benutzer.id,
          titel: "Honorarnoten für Oktober ausstellen",
          faelligAm: new Date(heute.getTime() + TAG).toISOString().slice(0, 10),
        },
        {
          praxisId: ctx.praxis.id,
          zustaendigId: ctx.benutzer.id,
          titel: "Supervision vorbereiten",
          faelligAm: new Date(heute.getTime() + 5 * TAG).toISOString().slice(0, 10),
        },
      ]);
    });
    await protokollieren(ctx, "demo", "praxis", ctx.praxis.id);
  }),
});
