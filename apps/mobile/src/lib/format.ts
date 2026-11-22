import { formatEuro, TRAEGER_NAME, wienZeit } from "@lumiva/domain";

export { formatDatum, formatDatumLang, wienDatum } from "@lumiva/domain";
export const euro = (cent: number) => formatEuro(cent).replace(/ /g, " ");
export const uhrzeit = (d: Date) => wienZeit(d);

export const STATUS: Record<string, string> = {
  geplant: "Geplant",
  erledigt: "Erledigt",
  abgesagt: "Abgesagt",
  nicht_erschienen: "Nicht erschienen",
};

export const TRAEGER = TRAEGER_NAME;

export function hinweisText(h: { art: string; verbleibendeSitzungen?: number }): string {
  switch (h.art) {
    case "aerztliche-bestaetigung-fehlt":
      return "Ärztliche Bestätigung fehlt";
    case "bewilligung-fehlt":
      return "Bewilligung der Kasse fehlt";
    case "bewilligung-bald-noetig":
      return `Bewilligung in ${h.verbleibendeSitzungen} Sitzung(en) nötig`;
    case "regeln-selbst-pruefen":
      return "Kostenzuschuss-Regeln selbst prüfen";
    default:
      return h.art;
  }
}

/** Verständliche Meldung für Fehler der API. */
export function fehlerText(e: unknown): string {
  const daten = (e as { data?: { code?: string; zweiFaktorFehlt?: boolean } })?.data;
  if (daten?.zweiFaktorFehlt) return "Richte zuerst die Zwei-Faktor-Anmeldung in der Web-App ein.";
  const code = daten?.code;
  if (code === "PRECONDITION_FAILED") return "Richte zuerst deine Praxis in der Web-App ein.";
  if (code === "UNAUTHORIZED") return "Bitte melde dich erneut an.";
  if (e instanceof Error && /fetch|network/i.test(e.message))
    return "Der LUMIVA-Server ist nicht erreichbar.";
  return e instanceof Error ? e.message : "Etwas ist schiefgelaufen.";
}
