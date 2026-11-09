/** Anschrift in getrennten Feldern, wie sie im Formular erfasst wird. */
export type Anschrift = { strasse: string; plz: string; ort: string };

export const LEERE_ANSCHRIFT: Anschrift = { strasse: "", plz: "", ort: "" };

/**
 * Zerlegt eine früher einzeilig erfasste Anschrift wie „Musterstraße 1, 1010 Wien“.
 * Was sich nicht erkennen lässt, bleibt als Straße stehen und kann von Hand korrigiert werden.
 * Gleiche Regel wie in der Migration `0006_anschrift_getrennt.sql`.
 */
export function anschriftZerlegen(text: string): Anschrift {
  const t = text.trim();
  const mitStrasse = /^([\s\S]*)[,\n]\s*(\d{4,5})\s+([^,\n]+)$/.exec(t);
  if (mitStrasse) {
    return {
      strasse: (mitStrasse[1] ?? "").trim(),
      plz: mitStrasse[2] ?? "",
      ort: (mitStrasse[3] ?? "").trim(),
    };
  }
  const nurOrt = /^(\d{4,5})\s+([^,\n]+)$/.exec(t);
  if (nurOrt) return { strasse: "", plz: nurOrt[1] ?? "", ort: (nurOrt[2] ?? "").trim() };
  return { strasse: t, plz: "", ort: "" };
}

/** Einzeilig für Kopfzeilen und die Honorarnote: „Musterstraße 1, 1010 Wien“. */
export function anschriftText(a: Anschrift): string {
  return [a.strasse.trim(), `${a.plz.trim()} ${a.ort.trim()}`.trim()].filter(Boolean).join(", ");
}
