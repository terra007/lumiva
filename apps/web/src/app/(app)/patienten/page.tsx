import Link from "next/link";
import { formatDatum, hinweisText, TRAEGER } from "@/lib/format";
import { praxisApi } from "@/server/lumiva";

export default async function Patienten({ searchParams }: PageProps<"/patienten">) {
  const { status: statusParam, suche: sucheParam } = await searchParams;
  const status =
    (["aktiv", "pausiert", "abgeschlossen", "alle"] as const).find((s) => s === statusParam) ??
    "aktiv";
  const suche = typeof sucheParam === "string" ? sucheParam.trim().toLowerCase() : "";
  const lumiva = await praxisApi();
  const [alle, ich] = await Promise.all([lumiva.patienten.liste({ status }), lumiva.praxis.ich()]);
  const patienten = suche
    ? alle.filter((p) => `${p.vorname} ${p.nachname}`.toLowerCase().includes(suche))
    : alle;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Patienten</h1>
          <p className="text-muted text-sm">Namen und Akten sind verschlüsselt gespeichert.</p>
        </div>
        {ich.praxis?.rolle !== "assistenz" && (
          <Link href="/patienten/neu" className="knopf">
            Neuer Patient
          </Link>
        )}
      </header>

      <form className="flex flex-wrap gap-2">
        <input
          name="suche"
          defaultValue={suche}
          placeholder="Name suchen …"
          className="eingabe max-w-xs"
        />
        <select name="status" defaultValue={status} className="eingabe w-auto">
          <option value="aktiv">Aktiv</option>
          <option value="pausiert">Pausiert</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="alle">Alle</option>
        </select>
        <button type="submit" className="knopf-zweit">
          Filtern
        </button>
      </form>

      {patienten.length === 0 ? (
        <p className="karte text-muted text-sm">Keine Patienten gefunden.</p>
      ) : (
        <div className="karte overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-line border-b text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Geburtsdatum</th>
                <th className="px-5 py-3 font-medium">Träger</th>
                <th className="px-5 py-3 font-medium">Sitzungen</th>
                <th className="px-5 py-3 font-medium">Hinweise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {patienten.map((p) => (
                <tr key={p.id} className="hover:bg-line/30">
                  <td className="px-5 py-3">
                    <Link href={`/patienten/${p.id}`} className="verweis font-medium">
                      {p.nachname}, {p.vorname}
                    </Link>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatDatum(p.geburtsdatum)}</td>
                  <td className="px-5 py-3">{TRAEGER[p.versicherungstraeger]}</td>
                  <td className="px-5 py-3 tabular-nums">{p.sitzungen}</td>
                  <td className="px-5 py-3">
                    {p.hinweise.map((h) => (
                      <span
                        key={h.art}
                        className="abzeichen mr-1 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      >
                        {hinweisText(h)}
                      </span>
                    ))}
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
