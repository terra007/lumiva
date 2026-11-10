"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Zeichen, type ZeichenName } from "@/components/zeichen";
import { authClient } from "@/lib/auth-client";

type Punkt = { href: string; text: string; zeichen: ZeichenName; kurz?: string };

const PUNKTE: Punkt[] = [
  { href: "/", text: "Übersicht", zeichen: "uebersicht", kurz: "Heute" },
  { href: "/kalender", text: "Kalender", zeichen: "kalender" },
  { href: "/patienten", text: "Patienten", zeichen: "patienten" },
  { href: "/honorarnoten", text: "Honorarnoten", zeichen: "honorarnoten", kurz: "Noten" },
  { href: "/aufgaben", text: "Aufgaben", zeichen: "aufgaben" },
  { href: "/kennzahlen", text: "Kennzahlen", zeichen: "kennzahlen" },
  { href: "/einstellungen", text: "Einstellungen", zeichen: "einstellungen" },
];
/** Am Handy unten sichtbar; der Rest liegt unter „Mehr“. */
const HANDY_UNTEN = 4;

const ROLLEN = {
  inhaber: "Inhaber",
  therapeut: "Therapeut",
  assistenz: "Assistenz",
} as const;

function initialen(name: string): string {
  // Titel wie „Mag.“ oder „Dr.“ überspringen.
  const teile = name.split(/\s+/).filter((t) => t && !t.endsWith("."));
  return (
    (teile[0]?.[0] ?? "") + (teile.length > 1 ? (teile.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

export function Navigation({
  praxis,
  benutzer,
  rolle,
}: {
  praxis: string;
  benutzer: string;
  rolle: keyof typeof ROLLEN;
}) {
  const pfad = usePathname();
  const router = useRouter();
  const [mehrOffen, setMehrOffen] = useState(false);
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad.startsWith(href));
  const abmelden = async () => {
    await authClient.signOut();
    router.replace("/anmelden");
    router.refresh();
  };

  // Nach einem Seitenwechsel das Menü „Mehr“ wieder schließen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: absichtlich nur bei neuem Pfad.
  useEffect(() => setMehrOffen(false), [pfad]);

  const unten = PUNKTE.slice(0, HANDY_UNTEN);
  const mehr = PUNKTE.slice(HANDY_UNTEN);
  const mehrAktiv = mehr.some((p) => aktiv(p.href));

  return (
    <>
      {/* Breite Bildschirme: Seitenleiste links */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-line border-r bg-leiste/60 px-3 py-6 md:flex">
        <Link href="/" className="px-3 font-semibold text-xl tracking-tight">
          LUMIVA<span className="text-akzent">.</span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5">
          {PUNKTE.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={aktiv(p.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${aktiv(p.href) ? "bg-flaeche font-medium text-foreground shadow-sm ring-1 ring-line" : "text-muted hover:bg-line/50 hover:text-foreground"}`}
            >
              <Zeichen
                name={p.zeichen}
                className={`size-[18px] ${aktiv(p.href) ? "text-akzent-text" : ""}`}
              />
              {p.text}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-line border-t px-1 pt-4">
          <Benutzer name={benutzer} praxis={praxis} rolle={rolle} />
          <button
            type="button"
            onClick={abmelden}
            className="flex items-center gap-2 self-start rounded-lg px-2 py-1 text-muted text-xs transition hover:bg-line/50 hover:text-foreground"
          >
            <Zeichen name="abmelden" className="size-3.5" />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Handy: oben schmale Leiste, unten die wichtigsten Bereiche */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-line border-b bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          LUMIVA<span className="text-akzent">.</span>
        </Link>
        <span className="truncate pl-4 text-muted text-xs">{praxis}</span>
      </header>

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-line border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {unten.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={aktiv(p.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] ${aktiv(p.href) ? "font-medium text-foreground" : "text-muted"}`}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full transition ${aktiv(p.href) ? "bg-akzent/20 text-akzent-text" : ""}`}
            >
              <Zeichen name={p.zeichen} className="size-5" />
            </span>
            {p.kurz ?? p.text}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={mehrOffen}
          aria-controls="mehr-menue"
          onClick={() => setMehrOffen((o) => !o)}
          className={`flex flex-col items-center gap-1 py-2 text-[11px] ${mehrAktiv || mehrOffen ? "font-medium text-foreground" : "text-muted"}`}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full transition ${mehrAktiv || mehrOffen ? "bg-akzent/20 text-akzent-text" : ""}`}
          >
            <Zeichen name="mehr" className="size-5" />
          </span>
          Mehr
        </button>
      </nav>

      {mehrOffen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMehrOffen(false)}
          />
          <div
            id="mehr-menue"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-3xl border-line border-t bg-flaeche px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] shadow-2xl"
          >
            <div className="mb-2 px-2">
              <Benutzer name={benutzer} praxis={praxis} rolle={rolle} />
            </div>
            {mehr.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                aria-current={aktiv(p.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 ${aktiv(p.href) ? "bg-akzent/15 font-medium" : "hover:bg-line/50"}`}
              >
                <Zeichen name={p.zeichen} className="size-5 text-muted" />
                {p.text}
              </Link>
            ))}
            <button
              type="button"
              onClick={abmelden}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Zeichen name="abmelden" className="size-5" />
              Abmelden
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Benutzer({
  name,
  praxis,
  rolle,
}: {
  name: string;
  praxis: string;
  rolle: keyof typeof ROLLEN;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-akzent/20 font-semibold text-akzent-text text-xs"
      >
        {initialen(name)}
      </span>
      <div className="flex min-w-0 flex-col text-sm">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-muted text-xs">
          {praxis} · {ROLLEN[rolle]}
        </span>
      </div>
    </div>
  );
}
