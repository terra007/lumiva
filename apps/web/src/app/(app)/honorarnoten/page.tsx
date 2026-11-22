import { wienDatum } from "@lumiva/domain";
import Link from "next/link";
import { AktionsKnopf, Formular } from "@/components/formular";
import { BezahltAbzeichen, NotenStatus } from "@/components/noten-status";
import { TerminalZahlung, ZahllinkKopieren } from "@/components/sumup-zahlung";
import { datumIso, euro, formatDatum } from "@/lib/format";
import {
  honorarnoteAusstellen,
  honorarnoteBezahlt,
  honorarnoteStornieren,
} from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Honorarnoten() {
  const api = await praxisApi();
  const [noten, abrechenbar, ich, sumup] = await Promise.all([
    api.honorarnoten.liste(),
    api.honorarnoten.abrechenbar(),
    api.praxis.ich(),
    api.zahlungen.verfuegbar(),
  ]);
  // Die PDF enthält die Diagnose; die Assistenz sieht keine Akteninhalte (§ 45 PThG 2024).
  const therapeutisch = ich.praxis?.rolle !== "assistenz";
  const heute = wienDatum(new Date());
  const offen = noten.filter((n) => !n.bezahltAm && !n.storniertAm);
  const sitzungenOffen = abrechenbar.reduce((s, p) => s + p.sitzungen.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-3xl tracking-tight">Honorarnoten</h1>
        <p className="text-muted text-sm">
          {sitzungenOffen} {sitzungenOffen === 1 ? "Sitzung" : "Sitzungen"} noch abzurechnen,{" "}
          {euro(abrechenbar.reduce((s, p) => s + p.summeCent, 0))}. {offen.length}{" "}
          {offen.length === 1 ? "Honorarnote" : "Honorarnoten"} offen,{" "}
          {euro(offen.reduce((s, n) => s + n.summeCent, 0))}.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">Noch abzurechnen</h2>
        {abrechenbar.length === 0 ? (
          <p className="karte text-muted text-sm">
            Alle erledigten Sitzungen stehen schon auf einer Honorarnote.
          </p>
        ) : (
          <>
            {/* Ab der 11. Sitzung verlangt die ÖGK eine Bewilligung (https://oegk.at/psyche). */}
            <p className="text-muted text-xs">
              Erledigte und ausgefallene Sitzungen ohne Honorarnote, wer am längsten wartet zuerst.
              Spätestens nach der 10. Sitzung abrechnen, weil die Kasse ab der 11. eine Bewilligung
              verlangt.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {abrechenbar.map((p) => (
                <section
                  key={p.patientId}
                  aria-label={`Abrechenbar: ${p.patientName}`}
                  className="karte flex flex-col gap-3"
                >
                  <div className="flex items-baseline gap-2">
                    <Link href={`/patienten/${p.patientId}`} className="verweis font-semibold">
                      {p.patientName}
                    </Link>
                    <span className="flex-1 text-muted text-sm">
                      {p.sitzungen.length} {p.sitzungen.length === 1 ? "Sitzung" : "Sitzungen"}
                    </span>
                    <span className="font-semibold tabular-nums">{euro(p.summeCent)}</span>
                  </div>
                  {therapeutisch ? (
                    <Formular
                      aktion={honorarnoteAusstellen}
                      knopf="Honorarnote ausstellen"
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="patientId" value={p.patientId} />
                      <ul className="flex flex-col gap-2 text-sm">
                        {p.sitzungen.map((t) => (
                          <li key={t.id}>
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                name="terminIds"
                                value={t.id}
                                defaultChecked
                                className="size-4 accent-akzent"
                              />
                              <span className="tabular-nums">
                                {formatDatum(datumIso(t.beginn))}
                              </span>
                              <span className="flex-1 text-muted">{t.bezeichnung}</span>
                              {t.bezahltAm && <BezahltAbzeichen />}
                              <span className="tabular-nums">{euro(t.honorarCent)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </Formular>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {p.sitzungen.map((t) => (
                        <li key={t.id} className="flex items-center gap-3">
                          <span className="tabular-nums">{formatDatum(datumIso(t.beginn))}</span>
                          <span className="flex-1 text-muted">{t.bezeichnung}</span>
                          {t.bezahltAm && <BezahltAbzeichen />}
                          <span className="tabular-nums">{euro(t.honorarCent)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">Ausgestellt</h2>
        {noten.length === 0 ? (
          <p className="karte text-muted text-sm">Noch keine Honorarnoten ausgestellt.</p>
        ) : (
          <div className="karte overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-line border-b text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Nummer</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Datum</th>
                  <th className="px-5 py-3 text-right font-medium">Betrag</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {noten.map((n) => (
                  <tr key={n.id}>
                    <td className="px-5 py-3 tabular-nums">
                      {therapeutisch ? (
                        <a
                          href={`/honorarnoten/${n.id}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="verweis"
                        >
                          {n.nummer}
                        </a>
                      ) : (
                        n.nummer
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/patienten/${n.patientId}`} className="verweis">
                        {n.patientName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{formatDatum(n.ausgestelltAm)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{euro(n.summeCent)}</td>
                    <td className="px-5 py-3">
                      <NotenStatus bezahlt={n.bezahltAm} storniert={n.storniertAm} />
                      {n.bezahltAm && (
                        <span className="ml-2 text-muted text-xs">{formatDatum(n.bezahltAm)}</span>
                      )}
                      {n.offenCent > 0 && n.offenCent < n.summeCent && (
                        <span className="ml-2 text-muted text-xs">
                          teilweise mit Karte, offen {euro(n.offenCent)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {therapeutisch && (
                          <a
                            href={`/honorarnoten/${n.id}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="knopf-zweit"
                          >
                            PDF
                          </a>
                        )}
                        {!n.storniertAm && !n.bezahltAm && sumup.terminal && (
                          <TerminalZahlung ziel={{ honorarnoteId: n.id }} />
                        )}
                        {!n.storniertAm && !n.bezahltAm && sumup.online && (
                          <ZahllinkKopieren honorarnoteId={n.id} />
                        )}
                        {!n.storniertAm &&
                          (n.bezahltAm ? (
                            <AktionsKnopf
                              aktion={honorarnoteBezahlt}
                              felder={{ id: n.id, am: "" }}
                              text="Doch offen"
                            />
                          ) : (
                            <AktionsKnopf
                              aktion={honorarnoteBezahlt}
                              felder={{ id: n.id, am: heute }}
                              text="Bezahlt"
                            />
                          ))}
                        {therapeutisch && !n.storniertAm && (
                          <AktionsKnopf
                            aktion={honorarnoteStornieren}
                            felder={{ id: n.id }}
                            text="Stornieren"
                            klasse="knopf-gefahr"
                            bestaetigen={`Honorarnote ${n.nummer} stornieren? Die Nummer bleibt vergeben, die Sitzungen werden wieder abrechenbar.`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
