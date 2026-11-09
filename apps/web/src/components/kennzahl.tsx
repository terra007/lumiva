import Link from "next/link";

/** Kachel mit einer Zahl. Mit `href` als Verweis, sonst als reine Anzeige. */
export function Kennzahl({
  titel,
  wert,
  unten,
  href,
}: {
  titel: string;
  wert: string;
  unten?: string;
  href?: string;
}) {
  const inhalt = (
    <>
      <span className="text-muted text-sm">{titel}</span>
      <span className="font-semibold text-3xl tabular-nums tracking-tight">{wert}</span>
      {unten && <span className="text-muted text-xs">{unten}</span>}
    </>
  );
  if (!href) return <div className="karte flex flex-col gap-1">{inhalt}</div>;
  return (
    <Link href={href} className="karte flex flex-col gap-1 transition hover:border-akzent/60">
      {inhalt}
    </Link>
  );
}
