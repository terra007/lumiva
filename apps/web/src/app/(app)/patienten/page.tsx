import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Zeichen } from "@/components/zeichen";
import { formatDatum, hinweisText, TRAEGER } from "@/lib/format";
import { praxisApi } from "@/server/lumiva";

const STATUS = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
  alle: "Alle",
} as const;
type Status = keyof typeof STATUS;

const HINWEIS_KLASSE =
  "abzeichen bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";

export default async function Patienten({ searchParams }: PageProps<"/patienten">) {
  const { status: statusParam, suche: sucheParam } = await searchParams;
  const status: Status =
    typeof statusParam === "string" && statusParam in STATUS ? (statusParam as Status) : "aktiv";
  const suche = typeof sucheParam === "string" ? sucheParam.trim() : "";
  const lumiva = await praxisApi();
  const [alle, ich] = await Promise.all([lumiva.patienten.liste({ status }), lumiva.praxis.ich()]);
  const patienten = suche
    ? alle.filter((p) => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche.toLowerCase()))
    : alle;
  const statusLink = (s: Status) => {
    const q = new URLSearchParams();
    if (s !== "aktiv") q.set("status", s);
    if (suche) q.set("suche", suche);
    const text = q.toString();
    return text ? `/patienten?${text}` : "/patienten";
  };

  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf titel="Patienten" untertitel="Namen und Akten sind verschlüsselt gespeichert.">
        {ich.praxis?.rolle !== "assistenz" && (
          <Link href="/patienten/neu" className="knopf">
            <Zeichen name="plus" />
            Neuer Patient
          </Link>
        )}
      </Seitenkopf>

      <div className="flex flex-wrap items-center gap-3">
        <form className="relative min-w-56 flex-1 sm:max-w-sm">
          {status !== "aktiv" && <input type="hidden" name="status" value={status} />}
          <Zeichen
            name="suche"
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted"
          />
          <input
            name="suche"
            type="search"
            defaultValue={suche}
            placeholder="Name suchen …"
            aria-label="Name suchen"
            className="eingabe pl-9"
          />
        </form>
        <nav className="reiter" aria-label="Status">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <Link key={s} href={statusLink(s)} aria-current={s === status ? "page" : undefined}>
              {STATUS[s]}
            </Link>
          ))}
        </nav>
      </div>

      {patienten.length === 0 ? (
        <div className="leer">
          <Zeichen name="patienten" className="size-6" />
          {suche ? `Niemand gefunden für „${suche}“.` : "Keine Patienten in dieser Ansicht."}
        </div>
      ) : (
        <>
          {/* Handy: Liste statt Tabelle */}
          <ul className="karte flex flex-col divide-y divide-line p-0 md:hidden">
            {patienten.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patienten/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-line/30"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">
                      {p.nachname}, {p.vorname}
                    </span>
                    <span className="text-muted text-xs">
                      {TRAEGER[p.versicherungstraeger]} · {p.sitzungen}{" "}
                      {p.sitzungen === 1 ? "Sitzung" : "Sitzungen"}
                    </span>
                    {p.hinweise.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {p.hinweise.map((h) => (
                          <span
                            key={h.art}
                            className={`${HINWEIS_KLASSE} whitespace-normal rounded-md`}
                          >
                            {hinweisText(h)}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <Zeichen name="rechts" className="size-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="karte hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-line border-b text-left text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Geburtsdatum</th>
                  <th className="px-5 py-3 font-medium">Träger</th>
                  <th className="px-5 py-3 text-right font-medium">Sitzungen</th>
                  <th className="px-5 py-3 font-medium">Hinweise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {patienten.map((p) => (
                  <tr key={p.id} className="transition hover:bg-line/30">
                    <td className="px-5 py-3">
                      <Link href={`/patienten/${p.id}`} className="verweis font-medium">
                        {p.nachname}, {p.vorname}
                      </Link>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{formatDatum(p.geburtsdatum)}</td>
                    <td className="px-5 py-3">{TRAEGER[p.versicherungstraeger]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{p.sitzungen}</td>
                    <td className="px-5 py-3">
                      <span className="flex flex-wrap gap-1">
                        {p.hinweise.map((h) => (
                          <span key={h.art} className={HINWEIS_KLASSE}>
                            {hinweisText(h)}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted text-xs">
            {patienten.length} {patienten.length === 1 ? "Patient" : "Patienten"}
          </p>
        </>
      )}
    </div>
  );
}
