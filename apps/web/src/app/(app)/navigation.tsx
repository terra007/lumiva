"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const PUNKTE = [
  { href: "/", text: "Übersicht" },
  { href: "/kalender", text: "Kalender" },
  { href: "/patienten", text: "Patient:innen" },
  { href: "/honorarnoten", text: "Honorarnoten" },
  { href: "/aufgaben", text: "Aufgaben" },
  { href: "/einstellungen", text: "Einstellungen" },
];

const ROLLEN = {
  inhaber: "Inhaber:in",
  therapeut: "Therapeut:in",
  assistenz: "Assistenz",
} as const;

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
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad.startsWith(href));
  return (
    <aside className="flex shrink-0 flex-col gap-4 border-line border-b bg-white/40 px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-b-0 md:py-8 dark:bg-white/[0.02]">
      <Link href="/" className="px-2 font-semibold text-xl tracking-tight">
        LUMIVA<span className="text-akzent">.</span>
      </Link>
      <nav className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
        {PUNKTE.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${aktiv(p.href) ? "bg-akzent/15 font-medium" : "text-muted hover:bg-line/50 hover:text-foreground"}`}
          >
            {p.text}
          </Link>
        ))}
      </nav>
      <div className="mt-auto hidden flex-col gap-1 px-2 text-sm md:flex">
        <span className="font-medium">{benutzer}</span>
        <span className="text-muted text-xs">
          {praxis} · {ROLLEN[rolle]}
        </span>
        <button
          type="button"
          className="mt-2 self-start text-muted text-xs underline underline-offset-4"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/anmelden");
            router.refresh();
          }}
        >
          Abmelden
        </button>
      </div>
    </aside>
  );
}
