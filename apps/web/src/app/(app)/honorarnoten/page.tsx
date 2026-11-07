import { wienDatum } from "@lumiva/domain";
import Link from "next/link";
import { AktionsKnopf } from "@/components/formular";
import { NotenStatus } from "@/components/noten-status";
import { euro, formatDatum } from "@/lib/format";
import { honorarnoteBezahlt, honorarnoteStornieren } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

export default async function Honorarnoten() {
  const api = await praxisApi();
  const [noten, ich] = await Promise.all([api.honorarnoten.liste(), api.praxis.ich()]);
  // Die PDF enthält die Diagnose; die Assistenz sieht keine Akteninhalte (§ 45 PThG 2024).
  const therapeutisch = ich.praxis?.rolle !== "assistenz";
  const heute = wienDatum(new Date());
  const offen = noten.filter((n) => !n.bezahltAm && !n.storniertAm);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-3xl tracking-tight">Honorarnoten</h1>
        <p className="text-muted text-sm">
          {offen.length} offen, {euro(offen.reduce((s, n) => s + n.summeCent, 0))}. Neue
          Honorarnoten stellst du in der Akte der Patient:in aus.
        </p>
      </header>
      {noten.length === 0 ? (
        <p className="karte text-muted text-sm">Noch keine Honorarnoten ausgestellt.</p>
      ) : (
        <div className="karte overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-line border-b text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Nummer</th>
                <th className="px-5 py-3 font-medium">Patient:in</th>
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
    </div>
  );
}
