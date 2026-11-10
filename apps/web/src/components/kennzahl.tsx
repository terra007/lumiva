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
      <span className="text-muted text-xs leading-snug md:text-sm">{titel}</span>
      <span className="font-semibold text-xl tabular-nums tracking-tight md:text-3xl">{wert}</span>
      {unten && <span className="text-muted text-xs leading-snug">{unten}</span>}
    </>
  );
  const klasse = "karte flex min-w-0 flex-col gap-1 p-3.5 md:p-5";
  if (!href) return <div className={klasse}>{inhalt}</div>;
  return (
    <Link href={href} className={`${klasse} transition hover:border-akzent/60 hover:shadow-md`}>
      {inhalt}
    </Link>
  );
}
