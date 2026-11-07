import { demoCheckout, demoErlaubt } from "@lumiva/api";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { euro } from "@/lib/format";

export const metadata: Metadata = { title: "Demo-Kasse", robots: "noindex" };

/** Nachgebaute Zahlseite von SumUp für den Demo-Modus. Es fließt kein Geld. */
export default async function DemoKasse({ params }: PageProps<"/bezahlen/demo-kasse/[id]">) {
  const { id } = await params;
  const checkout = demoErlaubt() ? demoCheckout(id) : undefined;
  if (!checkout) notFound();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900 text-sm dark:bg-amber-950 dark:text-amber-200">
        Demo: So sieht die Zahlseite von SumUp aus. Es wird nichts abgebucht.
      </p>
      <section className="karte flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h1 className="font-semibold text-xl">SumUp</h1>
          <span className="font-semibold text-2xl tabular-nums">
            {euro(Math.round(checkout.amount * 100))}
          </span>
        </header>
        {checkout.status === "PAID" ? (
          <p>Bereits bezahlt.</p>
        ) : (
          <form
            method="post"
            action={`/bezahlen/demo-kasse/${id}/bezahlen`}
            className="flex flex-col gap-3"
          >
            <label className="etikett">
              Kartennummer
              <input className="eingabe" defaultValue="4242 4242 4242 4242" readOnly />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="etikett">
                Gültig bis
                <input className="eingabe" defaultValue="12/30" readOnly />
              </label>
              <label className="etikett">
                CVC
                <input className="eingabe" defaultValue="123" readOnly />
              </label>
            </div>
            <button type="submit" className="knopf w-full">
              Bezahlen
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
