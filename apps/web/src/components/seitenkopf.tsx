import Link from "next/link";
import type { ReactNode } from "react";
import { Zeichen } from "./zeichen";

/** Einheitlicher Kopf jeder Seite: optional Rückweg, Titel, Untertitel und Aktionen rechts. */
export function Seitenkopf({
  titel,
  untertitel,
  zurueck,
  children,
}: {
  titel: ReactNode;
  untertitel?: ReactNode;
  zurueck?: { href: string; text: string };
  /** Knöpfe oder Umschalter rechts neben dem Titel. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1">
        {zurueck && (
          <Link
            href={zurueck.href}
            className="-ml-1 inline-flex items-center gap-1 self-start rounded-md px-1 text-muted text-sm transition hover:text-foreground"
          >
            <Zeichen name="links" className="size-4" />
            {zurueck.text}
          </Link>
        )}
        <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">{titel}</h1>
        {untertitel && <p className="text-muted text-sm">{untertitel}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
