import { formatEuro, wienDatum, wienZeit } from "@lumiva/domain";

export { formatDatum, formatDatumLang, formatEuro } from "@lumiva/domain";

export const euro = (cent: number) => formatEuro(cent).replace(/ /g, " ");
export const uhrzeit = (d: Date) => wienZeit(d);
export const datumIso = (d: Date) => wienDatum(d);

export const TRAEGER: Record<string, string> = {
  oegk: "ÖGK",
  bvaeb: "BVAEB",
  svs: "SVS",
  kfa: "KFA",
  privat: "Selbstzahler:in",
  sonstige: "Sonstige",
};

export const TERMIN_STATUS: Record<string, { text: string; klasse: string }> = {
  geplant: { text: "Geplant", klasse: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  erledigt: {
    text: "Erledigt",
    klasse: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  abgesagt: {
    text: "Abgesagt",
    klasse: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  nicht_erschienen: {
    text: "Nicht erschienen",
    klasse: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
};

export const DOKU_ART: Record<string, string> = {
  erstgespraech: "Erstgespräch",
  verlauf: "Verlauf",
  abschluss: "Abschluss",
  notiz: "Notiz",
};

export function hinweisText(h: { art: string; verbleibendeSitzungen?: number }): string {
  switch (h.art) {
    case "aerztliche-bestaetigung-fehlt":
      return "Ärztliche Bestätigung fehlt (nötig vor der 2. Sitzung)";
    case "bewilligung-fehlt":
      return "Bewilligung der Kasse fehlt (nötig ab der 11. Sitzung)";
    case "bewilligung-bald-noetig":
      return `Bewilligung in ${h.verbleibendeSitzungen} ${h.verbleibendeSitzungen === 1 ? "Sitzung" : "Sitzungen"} nötig`;
    case "regeln-selbst-pruefen":
      return "Kostenzuschuss-Regeln dieses Trägers selbst prüfen";
    default:
      return h.art;
  }
}
