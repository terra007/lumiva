import { schema } from "@lumiva/db";
import {
  ausfallquote,
  KENNZAHLEN_ZEITRAEUME,
  type KennzahlenZeitraum,
  kennzahlenZeitraum,
  letzteMonate,
  tageImZeitraum,
  terminBetragCent,
  wienDatum,
  wienZuDate,
} from "@lumiva/domain";
import { and, count, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { patientenFilter, type patientLaden } from "../sichtbarkeit";
import { inPraxis, router } from "../trpc";
import { offenJeNote, termineAufNote } from "../zahlungen";

type Ctx = Parameters<typeof patientLaden>[0];

const TAG = 86_400_000;
/** Wie viele Monate der Verlauf der Sitzungen zeigt. */
const VERLAUF_MONATE = 12;

/**
 * Kennzahlen der Praxis für einen Zeitraum. Nur Zählungen und Summen, keine Akteninhalte;
 * sichtbar sind wie überall nur die eigenen Patienten (Assistenz: alle der Praxis).
 */
export async function kennzahlenBerechnen(ctx: Ctx, art: KennzahlenZeitraum, jetzt = new Date()) {
  const heute = wienDatum(jetzt);
  const zeitraum = kennzahlenZeitraum(art, heute);
  const von = wienZuDate(zeitraum.von, "00:00");
  const bis = wienZuDate(zeitraum.bis, "00:00");
  const monate = letzteMonate(heute, VERLAUF_MONATE);
  const verlaufVon = wienZuDate(monate[0] ?? zeitraum.von, "00:00");
  const verlaufBis = wienZuDate(kennzahlenZeitraum("monat", heute).bis, "00:00");
  const sichtbar = patientenFilter(ctx);

  const termineVon = (anfang: Date, ende: Date) =>
    ctx.db
      .select({
        id: schema.termine.id,
        beginn: schema.termine.beginn,
        status: schema.termine.status,
        honorarCent: schema.termine.honorarCent,
        ausfallhonorarCent: schema.termine.ausfallhonorarCent,
      })
      .from(schema.termine)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
      .where(and(sichtbar, gte(schema.termine.beginn, anfang), lt(schema.termine.beginn, ende)));

  const [
    imZeitraum,
    kommende,
    verlauf,
    zuVerrechnen,
    noten,
    kartenSitzungen,
    kartenNoten,
    [aktiv],
    [neu],
    [abgeschlossen],
    abwesend,
  ] = await Promise.all([
    termineVon(von, bis),
    termineVon(jetzt, new Date(jetzt.getTime() + 28 * TAG)),
    termineVon(verlaufVon, verlaufBis),
    ctx.db
      .select({
        id: schema.termine.id,
        status: schema.termine.status,
        honorarCent: schema.termine.honorarCent,
        ausfallhonorarCent: schema.termine.ausfallhonorarCent,
      })
      .from(schema.termine)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
      .where(and(sichtbar, inArray(schema.termine.status, ["erledigt", "nicht_erschienen"]))),
    ctx.db
      .select({ note: schema.honorarnoten })
      .from(schema.honorarnoten)
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
      .where(and(sichtbar, isNull(schema.honorarnoten.storniertAm))),
    // Kartenzahlungen einzelner Sitzungen und ganzer Honorarnoten, jeweils sichtbar über den Patienten.
    ctx.db
      .select({ betragCent: schema.zahlungen.betragCent })
      .from(schema.zahlungen)
      .innerJoin(schema.termine, eq(schema.termine.id, schema.zahlungen.terminId))
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.termine.patientId))
      .where(
        and(
          sichtbar,
          eq(schema.zahlungen.status, "bezahlt"),
          gte(schema.zahlungen.abgeschlossenAm, von),
          lt(schema.zahlungen.abgeschlossenAm, bis),
        ),
      ),
    ctx.db
      .select({ betragCent: schema.zahlungen.betragCent })
      .from(schema.zahlungen)
      .innerJoin(schema.honorarnoten, eq(schema.honorarnoten.id, schema.zahlungen.honorarnoteId))
      .innerJoin(schema.patienten, eq(schema.patienten.id, schema.honorarnoten.patientId))
      .where(
        and(
          sichtbar,
          eq(schema.zahlungen.status, "bezahlt"),
          gte(schema.zahlungen.abgeschlossenAm, von),
          lt(schema.zahlungen.abgeschlossenAm, bis),
        ),
      ),
    ctx.db
      .select({ anzahl: count() })
      .from(schema.patienten)
      .where(and(sichtbar, eq(schema.patienten.status, "aktiv"))),
    ctx.db
      .select({ anzahl: count() })
      .from(schema.patienten)
      .where(
        and(sichtbar, gte(schema.patienten.erstelltAm, von), lt(schema.patienten.erstelltAm, bis)),
      ),
    ctx.db
      .select({ anzahl: count() })
      .from(schema.patienten)
      .where(
        and(
          sichtbar,
          isNotNull(schema.patienten.behandlungsende),
          gte(schema.patienten.behandlungsende, zeitraum.von),
          lt(schema.patienten.behandlungsende, zeitraum.bis),
        ),
      ),
    ctx.db
      .select({ von: schema.abwesenheiten.von, bis: schema.abwesenheiten.bis })
      .from(schema.abwesenheiten)
      .where(
        and(
          eq(schema.abwesenheiten.praxisId, ctx.praxis.id),
          eq(schema.abwesenheiten.benutzerId, ctx.benutzer.id),
          lt(schema.abwesenheiten.von, zeitraum.bis),
          gte(schema.abwesenheiten.bis, zeitraum.von),
        ),
      ),
  ]);

  // Sitzungen im Zeitraum nach Status.
  const sitzungen = { geplant: 0, erledigt: 0, abgesagt: 0, nichtErschienen: 0 };
  let nichtVermerkt = 0;
  let erwartetCent = 0;
  let geleistetCent = 0;
  for (const t of imZeitraum) {
    if (t.status === "geplant") {
      sitzungen.geplant++;
      if (t.beginn < jetzt) nichtVermerkt++;
      else erwartetCent += t.honorarCent;
    } else if (t.status === "erledigt") sitzungen.erledigt++;
    else if (t.status === "abgesagt") sitzungen.abgesagt++;
    else sitzungen.nichtErschienen++;
    if (t.status === "erledigt" || t.status === "nicht_erschienen")
      geleistetCent += terminBetragCent(t);
  }

  const in7Tagen = new Date(jetzt.getTime() + 7 * TAG);
  const geplant = kommende.filter((t) => t.status === "geplant");

  // Erledigte Sitzungen je Monat (Wiener Kalender).
  const jeMonat = new Map(monate.map((m) => [m.slice(0, 7), 0]));
  for (const t of verlauf) {
    if (t.status !== "erledigt") continue;
    const m = wienDatum(t.beginn).slice(0, 7);
    if (jeMonat.has(m)) jeMonat.set(m, (jeMonat.get(m) ?? 0) + 1);
  }

  // Noch nicht abgerechnet: erledigt oder ausgefallen mit Honorar, auf keiner gültigen Note.
  const aufNote = await termineAufNote(
    ctx.db,
    ctx.praxis.id,
    zuVerrechnen.map((t) => t.id),
  );
  const offenZuVerrechnen = zuVerrechnen
    .filter((t) => !aufNote.has(t.id))
    .map((t) => terminBetragCent(t))
    .filter((c) => c > 0);

  // Honorarnoten: ausgestellt im Zeitraum, offen insgesamt, im Zeitraum als bezahlt vermerkt.
  const alle = noten.map((n) => n.note);
  const ausgestellt = alle.filter(
    (n) => n.ausgestelltAm >= zeitraum.von && n.ausgestelltAm < zeitraum.bis,
  );
  const unbezahlt = alle.filter((n) => !n.bezahltAm);
  const bezahltImZeitraum = alle.filter(
    (n) => n.bezahltAm && n.bezahltAm >= zeitraum.von && n.bezahltAm < zeitraum.bis,
  );
  // Bei bezahlten Noten ist der Rest nach Kartenzahlungen das, was überwiesen oder bar bezahlt wurde.
  const [offenJe, restJe] = await Promise.all([
    offenJeNote(ctx.db, ctx.praxis.id, unbezahlt),
    offenJeNote(ctx.db, ctx.praxis.id, bezahltImZeitraum),
  ]);
  const summe = (werte: Iterable<number>) => [...werte].reduce((s, w) => s + w, 0);
  const karteCent = summe([...kartenSitzungen, ...kartenNoten].map((z) => z.betragCent));
  const sonstigCent = summe(restJe.values());

  return {
    zeitraum,
    sitzungen: {
      ...sitzungen,
      /** Termin ist vorbei, aber noch als geplant vermerkt. */
      nichtVermerkt,
      ausfallquote: ausfallquote(sitzungen),
    },
    vorschau: {
      naechste7Tage: geplant.filter((t) => t.beginn < in7Tagen).length,
      naechste4Wochen: geplant.length,
    },
    umsatz: {
      /** Honorar der erledigten und ausgefallenen Sitzungen im Zeitraum. */
      geleistetCent,
      /** Honorar der noch kommenden geplanten Sitzungen im Zeitraum. */
      erwartetCent,
      ausgestellt: {
        anzahl: ausgestellt.length,
        summeCent: summe(ausgestellt.map((n) => n.summeCent)),
      },
      /** Zahlungseingang im Zeitraum: Karte (SumUp) und als bezahlt vermerkte Reste. */
      eingangCent: karteCent + sonstigCent,
      karteCent,
      offen: { anzahl: unbezahlt.length, summeCent: summe(offenJe.values()) },
      nichtAbgerechnet: {
        anzahl: offenZuVerrechnen.length,
        summeCent: summe(offenZuVerrechnen),
      },
    },
    patienten: {
      aktiv: aktiv?.anzahl ?? 0,
      neu: neu?.anzahl ?? 0,
      abgeschlossen: abgeschlossen?.anzahl ?? 0,
    },
    abwesenheitsTage: summe(
      abwesend.map((a) => tageImZeitraum(a.von, a.bis, zeitraum.von, zeitraum.bis)),
    ),
    verlauf: [...jeMonat].map(([monat, erledigt]) => ({ monat, erledigt })),
  };
}

export const kennzahlenRouter = router({
  zeitraum: inPraxis
    .input(z.object({ art: z.enum(KENNZAHLEN_ZEITRAEUME).default("monat") }))
    .query(({ ctx, input }) => kennzahlenBerechnen(ctx, input.art)),
});
