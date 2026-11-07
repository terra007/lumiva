import { zahlseiteLaden } from "@lumiva/api";
import type { Metadata } from "next";
import { euro } from "@/lib/format";
import { dienste } from "@/server/lumiva";

export const metadata: Metadata = { title: "Honorarnote bezahlen", robots: "noindex" };

/**
 * Öffentliche Zahlseite hinter dem QR-Code der Honorarnote. Zeigt bewusst nur Praxis,
 * Nummer und Betrag, keine Namen oder Diagnosen: Der Link kann weitergegeben werden.
 */
export default async function Bezahlen({ params, searchParams }: PageProps<"/bezahlen/[token]">) {
  const { token } = await params;
  const { fehler } = await searchParams;
  const { db, hauptschluessel } = await dienste();
  const seite = await zahlseiteLaden({ db, hauptschluessel, token }).catch(() => null);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      {!seite ? (
        <p className="karte">Dieser Zahlungslink ist ungültig.</p>
      ) : (
        <section className="karte flex flex-col gap-4">
          <header>
            <p className="text-muted text-sm">{seite.praxisName}</p>
            <h1 className="font-semibold text-2xl tracking-tight">Honorarnote {seite.nummer}</h1>
          </header>
          <p className="font-semibold text-3xl tabular-nums">{euro(seite.summeCent)}</p>
          {seite.status === "bezahlt" && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              Danke, der Betrag ist bezahlt.
            </p>
          )}
          {seite.status === "storniert" && (
            <p className="text-muted">
              Diese Honorarnote wurde storniert und ist nicht zu bezahlen.
            </p>
          )}
          {seite.status === "offen" && (
            <>
              {typeof fehler === "string" && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950 dark:text-red-200"
                >
                  {fehler}
                </p>
              )}
              {seite.online ? (
                <form method="post" action={`/bezahlen/${token}/start`}>
                  <button type="submit" className="knopf w-full">
                    Mit Karte bezahlen
                  </button>
                </form>
              ) : (
                <p className="text-muted text-sm">
                  Online-Zahlung ist derzeit nicht möglich. Bitte überweise den Betrag wie auf der
                  Honorarnote angegeben.
                </p>
              )}
              <p className="text-muted text-xs">
                Die Zahlung wickelt SumUp ab. Die Praxis sieht keine Kartendaten.
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
