/** Alle Uhrzeiten in LUMIVA gelten in der Zeitzone der Praxis: Europe/Vienna. */
export const ZEITZONE = "Europe/Vienna";

const teileFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZEITZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function wienTeile(d: Date) {
  const t = Object.fromEntries(teileFormat.formatToParts(d).map((p) => [p.type, p.value]));
  return { datum: `${t.year}-${t.month}-${t.day}`, zeit: `${t.hour}:${t.minute}` };
}

/** Kalenderdatum in Wien, z. B. "2026-11-07". */
export function wienDatum(d: Date): string {
  return wienTeile(d).datum;
}

/** Uhrzeit in Wien, z. B. "09:30". */
export function wienZeit(d: Date): string {
  return wienTeile(d).zeit;
}

/** Wandelt Datum und Uhrzeit in Wien in einen Zeitpunkt um, inklusive Sommerzeit. */
export function wienZuDate(datum: string, zeit: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) {
    throw new Error(`Datum JJJJ-MM-TT und Uhrzeit HH:MM erwartet: ${datum} ${zeit}`);
  }
  const alsUtc = new Date(`${datum}T${zeit}:00Z`);
  // Zweimal korrigieren: einmal reicht außer direkt an der Sommerzeitumstellung.
  let ergebnis = alsUtc;
  for (let i = 0; i < 2; i++) {
    const t = wienTeile(ergebnis);
    const angezeigt = new Date(`${t.datum}T${t.zeit}:00Z`);
    ergebnis = new Date(ergebnis.getTime() - (angezeigt.getTime() - alsUtc.getTime()));
  }
  return ergebnis;
}

export function tageAddieren(datum: string, tage: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche, in der das Datum liegt. */
export function wochenBeginn(datum: string): string {
  const wochentag = new Date(`${datum}T12:00:00Z`).getUTCDay() || 7;
  return tageAddieren(datum, 1 - wochentag);
}

const datumLang = new Intl.DateTimeFormat("de-AT", {
  timeZone: ZEITZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatDatumLang(d: Date): string {
  return datumLang.format(d);
}

/** "2026-11-07" → "07.11.2026" */
export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [j, m, t] = iso.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}
