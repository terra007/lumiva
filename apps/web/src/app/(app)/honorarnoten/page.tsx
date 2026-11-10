import { wienDatum } from "@lumiva/domain";
import Link from "next/link";
import { AktionsKnopf } from "@/components/formular";
import { NotenStatus } from "@/components/noten-status";
import { Seitenkopf } from "@/components/seitenkopf";
import { TerminalZahlung, ZahllinkKopieren } from "@/components/sumup-zahlung";
import { Zeichen } from "@/components/zeichen";
import { euro, formatDatum } from "@/lib/format";
import { honorarnoteBezahlt, honorarnoteStornieren } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";

const FILTER = {
  alle: "Alle",
  offen: "Offen",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
} as const;
type Filter = keyof typeof FILTER;

type Note = { bezahltAm: string | null; storniertAm: string | null };
const PASST: Record<Filter, (n: Note) => boolean> = {
  alle: () => true,
  offen: (n) => !n.bezahltAm && !n.storniertAm,
  bezahlt: (n) => !!n.bezahltAm && !n.storniertAm,
  storniert: (n) => !!n.storniertAm,
};

export default async function Honorarnoten({ searchParams }: PageProps<"/honorarnoten">) {
  const { status } = await searchParams;
  const filter: Filter =
    typeof status === "string" && status in FILTER ? (status as Filter) : "alle";
  const api = await praxisApi();
  const [noten, ich, sumup] = await Promise.all([
    api.honorarnoten.liste(),
    api.praxis.ich(),
    api.zahlungen.verfuegbar(),
  ]);
  // Die PDF enthält die Diagnose; die Assistenz sieht keine Akteninhalte (§ 45 PThG 2024).
  const therapeutisch = ich.praxis?.rolle !== "assistenz";
  const heute = wienDatum(new Date());
  const offen = noten.filter(PASST.offen);
  const sichtbar = noten.filter(PASST[filter]);
  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf
        titel="Honorarnoten"
        untertitel={
          offen.length === 0
            ? "Keine offenen Honorarnoten. Neue stellst du in der Akte des Patienten aus."
            : `${offen.length} offen über ${euro(offen.reduce((s, n) => s + n.summeCent, 0))}. Neue stellst du in der Akte des Patienten aus.`
        }
      />
      {noten.length > 0 && (
        <nav className="reiter self-start" aria-label="Status">
          {(Object.keys(FILTER) as Filter[]).map((f) => (
            <Link
              key={f}
              href={f === "alle" ? "/honorarnoten" : `/honorarnoten?status=${f}`}
              aria-current={f === filter ? "page" : undefined}
            >
              {FILTER[f]}
              <span className="text-muted text-xs tabular-nums">
                {noten.filter(PASST[f]).length}
              </span>
            </Link>
          ))}
        </nav>
      )}
      {sichtbar.length === 0 ? (
        <div className="leer">
          <Zeichen name="honorarnoten" className="size-6" />
          {noten.length === 0
            ? "Noch keine Honorarnoten ausgestellt."
            : "Keine Honorarnoten in dieser Ansicht."}
        </div>
      ) : (
        <div className="karte overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-line border-b text-left text-muted text-xs uppercase tracking-wide">
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
              {sichtbar.map((n) => (
                <tr key={n.id} className="transition hover:bg-line/30">
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
                  <td className="whitespace-nowrap px-5 py-3">
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
    </div>
  );
}
