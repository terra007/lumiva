export function NotenStatus({
  bezahlt,
  storniert,
}: {
  bezahlt: string | null;
  storniert: string | null;
}) {
  if (storniert)
    return (
      <span className="abzeichen bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        Storniert
      </span>
    );
  if (bezahlt)
    return (
      <span className="abzeichen bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Bezahlt
      </span>
    );
  return (
    <span className="abzeichen bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Offen
    </span>
  );
}

/** Abzeichen für eine mit Karte bezahlte Sitzung, optional mit Datum. */
export function BezahltAbzeichen({ am }: { am?: string }) {
  return (
    <span
      className="abzeichen bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      title="Mit Karte bezahlt"
    >
      Bezahlt{am ? ` ${am}` : ""}
    </span>
  );
}
