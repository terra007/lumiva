/**
 * Auswahl aus der ICD-10 (WHO-Fassung, wie die ICD-10 BMSGPK in Österreich), Kapitel V
 * „Psychische und Verhaltensstörungen“ (F00–F99) mit den in der Psychotherapie häufigen
 * Untergruppen, dazu einige Z-Codes. Quelle: https://icd.who.int/browse10/2019/en#/V
 * Nicht vollständig: Andere gültige Codes lassen sich in der Auswahl frei eintragen.
 */
export type Icd10Eintrag = { code: string; text: string };

export const ICD10_FORMAT = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export const ICD10_KATALOG: readonly Icd10Eintrag[] = [
  // F00–F09 Organische psychische Störungen
  { code: "F00", text: "Demenz bei Alzheimer-Krankheit" },
  { code: "F01", text: "Vaskuläre Demenz" },
  { code: "F03", text: "Nicht näher bezeichnete Demenz" },
  { code: "F04", text: "Organisches amnestisches Syndrom" },
  { code: "F05", text: "Delir, nicht durch Alkohol oder andere Substanzen bedingt" },
  { code: "F06", text: "Andere psychische Störungen aufgrund einer Hirnschädigung oder Krankheit" },
  { code: "F07", text: "Persönlichkeits- und Verhaltensstörung aufgrund einer Hirnschädigung" },
  // F10–F19 Störungen durch psychotrope Substanzen
  { code: "F10.1", text: "Alkohol: schädlicher Gebrauch" },
  { code: "F10.2", text: "Alkohol: Abhängigkeitssyndrom" },
  { code: "F10.3", text: "Alkohol: Entzugssyndrom" },
  { code: "F11.2", text: "Opioide: Abhängigkeitssyndrom" },
  { code: "F12.1", text: "Cannabinoide: schädlicher Gebrauch" },
  { code: "F12.2", text: "Cannabinoide: Abhängigkeitssyndrom" },
  { code: "F13.2", text: "Sedativa oder Hypnotika: Abhängigkeitssyndrom" },
  { code: "F14.2", text: "Kokain: Abhängigkeitssyndrom" },
  { code: "F15.2", text: "Andere Stimulanzien: Abhängigkeitssyndrom" },
  { code: "F17.2", text: "Tabak: Abhängigkeitssyndrom" },
  { code: "F19.2", text: "Multipler Substanzgebrauch: Abhängigkeitssyndrom" },
  // F20–F29 Schizophrenie, schizotype und wahnhafte Störungen
  { code: "F20", text: "Schizophrenie" },
  { code: "F20.0", text: "Paranoide Schizophrenie" },
  { code: "F21", text: "Schizotype Störung" },
  { code: "F22", text: "Anhaltende wahnhafte Störungen" },
  { code: "F23", text: "Akute vorübergehende psychotische Störungen" },
  { code: "F25", text: "Schizoaffektive Störungen" },
  // F30–F39 Affektive Störungen
  { code: "F30", text: "Manische Episode" },
  { code: "F31", text: "Bipolare affektive Störung" },
  {
    code: "F31.3",
    text: "Bipolare Störung, gegenwärtig leichte oder mittelgradige depressive Episode",
  },
  {
    code: "F31.4",
    text: "Bipolare Störung, gegenwärtig schwere depressive Episode ohne psychotische Symptome",
  },
  { code: "F31.7", text: "Bipolare Störung, gegenwärtig remittiert" },
  { code: "F32.0", text: "Leichte depressive Episode" },
  { code: "F32.1", text: "Mittelgradige depressive Episode" },
  { code: "F32.2", text: "Schwere depressive Episode ohne psychotische Symptome" },
  { code: "F32.3", text: "Schwere depressive Episode mit psychotischen Symptomen" },
  { code: "F32.8", text: "Sonstige depressive Episoden" },
  { code: "F32.9", text: "Depressive Episode, nicht näher bezeichnet" },
  { code: "F33.0", text: "Rezidivierende depressive Störung, gegenwärtig leichte Episode" },
  { code: "F33.1", text: "Rezidivierende depressive Störung, gegenwärtig mittelgradige Episode" },
  {
    code: "F33.2",
    text: "Rezidivierende depressive Störung, gegenwärtig schwere Episode ohne psychotische Symptome",
  },
  {
    code: "F33.3",
    text: "Rezidivierende depressive Störung, gegenwärtig schwere Episode mit psychotischen Symptomen",
  },
  { code: "F33.4", text: "Rezidivierende depressive Störung, gegenwärtig remittiert" },
  { code: "F33.9", text: "Rezidivierende depressive Störung, nicht näher bezeichnet" },
  { code: "F34.0", text: "Zyklothymia" },
  { code: "F34.1", text: "Dysthymia" },
  { code: "F38", text: "Andere affektive Störungen" },
  { code: "F39", text: "Nicht näher bezeichnete affektive Störung" },
  // F40–F48 Neurotische, Belastungs- und somatoforme Störungen
  { code: "F40.0", text: "Agoraphobie" },
  { code: "F40.1", text: "Soziale Phobien" },
  { code: "F40.2", text: "Spezifische (isolierte) Phobien" },
  { code: "F40.8", text: "Sonstige phobische Störungen" },
  { code: "F41.0", text: "Panikstörung (episodisch paroxysmale Angst)" },
  { code: "F41.1", text: "Generalisierte Angststörung" },
  { code: "F41.2", text: "Angst und depressive Störung, gemischt" },
  { code: "F41.3", text: "Andere gemischte Angststörungen" },
  { code: "F41.9", text: "Angststörung, nicht näher bezeichnet" },
  { code: "F42.0", text: "Zwangsstörung: vorwiegend Zwangsgedanken oder Grübelzwang" },
  { code: "F42.1", text: "Zwangsstörung: vorwiegend Zwangshandlungen" },
  { code: "F42.2", text: "Zwangsgedanken und -handlungen, gemischt" },
  { code: "F43.0", text: "Akute Belastungsreaktion" },
  { code: "F43.1", text: "Posttraumatische Belastungsstörung" },
  { code: "F43.2", text: "Anpassungsstörungen" },
  { code: "F43.8", text: "Sonstige Reaktionen auf schwere Belastung" },
  { code: "F43.9", text: "Reaktion auf schwere Belastung, nicht näher bezeichnet" },
  { code: "F44", text: "Dissoziative Störungen (Konversionsstörungen)" },
  { code: "F45.0", text: "Somatisierungsstörung" },
  { code: "F45.1", text: "Undifferenzierte Somatisierungsstörung" },
  { code: "F45.2", text: "Hypochondrische Störung" },
  { code: "F45.3", text: "Somatoforme autonome Funktionsstörung" },
  { code: "F45.4", text: "Anhaltende somatoforme Schmerzstörung" },
  { code: "F48.0", text: "Neurasthenie" },
  { code: "F48.1", text: "Depersonalisations- und Derealisationssyndrom" },
  // F50–F59 Verhaltensauffälligkeiten mit körperlichen Störungen
  { code: "F50.0", text: "Anorexia nervosa" },
  { code: "F50.1", text: "Atypische Anorexia nervosa" },
  { code: "F50.2", text: "Bulimia nervosa" },
  { code: "F50.3", text: "Atypische Bulimia nervosa" },
  { code: "F50.4", text: "Essattacken bei anderen psychischen Störungen" },
  { code: "F50.9", text: "Essstörung, nicht näher bezeichnet" },
  { code: "F51.0", text: "Nichtorganische Insomnie" },
  { code: "F51.1", text: "Nichtorganische Hypersomnie" },
  { code: "F51.5", text: "Albträume" },
  {
    code: "F52",
    text: "Sexuelle Funktionsstörungen, nicht verursacht durch eine organische Störung",
  },
  { code: "F53", text: "Psychische Störungen im Wochenbett" },
  { code: "F54", text: "Psychologische Faktoren bei andernorts klassifizierten Krankheiten" },
  { code: "F55", text: "Schädlicher Gebrauch von nichtabhängigkeitserzeugenden Substanzen" },
  // F60–F69 Persönlichkeits- und Verhaltensstörungen
  { code: "F60.0", text: "Paranoide Persönlichkeitsstörung" },
  { code: "F60.1", text: "Schizoide Persönlichkeitsstörung" },
  { code: "F60.2", text: "Dissoziale Persönlichkeitsstörung" },
  { code: "F60.30", text: "Emotional instabile Persönlichkeitsstörung: impulsiver Typ" },
  { code: "F60.31", text: "Emotional instabile Persönlichkeitsstörung: Borderline-Typ" },
  { code: "F60.4", text: "Histrionische Persönlichkeitsstörung" },
  { code: "F60.5", text: "Anankastische (zwanghafte) Persönlichkeitsstörung" },
  { code: "F60.6", text: "Ängstliche (vermeidende) Persönlichkeitsstörung" },
  { code: "F60.7", text: "Abhängige (asthenische) Persönlichkeitsstörung" },
  { code: "F60.8", text: "Sonstige spezifische Persönlichkeitsstörungen" },
  { code: "F60.9", text: "Persönlichkeitsstörung, nicht näher bezeichnet" },
  { code: "F61", text: "Kombinierte und andere Persönlichkeitsstörungen" },
  { code: "F62.0", text: "Andauernde Persönlichkeitsänderung nach Extrembelastung" },
  { code: "F63.0", text: "Pathologisches Spielen" },
  { code: "F63.3", text: "Trichotillomanie" },
  { code: "F64", text: "Störungen der Geschlechtsidentität" },
  { code: "F68.1", text: "Artifizielle Störung" },
  // F70–F79 Intelligenzminderung
  { code: "F70", text: "Leichte Intelligenzminderung" },
  { code: "F71", text: "Mittelgradige Intelligenzminderung" },
  // F80–F89 Entwicklungsstörungen
  { code: "F80", text: "Umschriebene Entwicklungsstörungen des Sprechens und der Sprache" },
  { code: "F81", text: "Umschriebene Entwicklungsstörungen schulischer Fertigkeiten" },
  { code: "F84.0", text: "Frühkindlicher Autismus" },
  { code: "F84.1", text: "Atypischer Autismus" },
  { code: "F84.5", text: "Asperger-Syndrom" },
  // F90–F98 Verhaltens- und emotionale Störungen mit Beginn in Kindheit und Jugend
  { code: "F90.0", text: "Einfache Aktivitäts- und Aufmerksamkeitsstörung" },
  { code: "F90.1", text: "Hyperkinetische Störung des Sozialverhaltens" },
  { code: "F91", text: "Störungen des Sozialverhaltens" },
  { code: "F92", text: "Kombinierte Störung des Sozialverhaltens und der Emotionen" },
  { code: "F93.0", text: "Emotionale Störung mit Trennungsangst des Kindesalters" },
  { code: "F93.8", text: "Sonstige emotionale Störungen des Kindesalters" },
  { code: "F94.0", text: "Elektiver Mutismus" },
  { code: "F95", text: "Ticstörungen" },
  { code: "F98.0", text: "Nichtorganische Enuresis" },
  { code: "F99", text: "Psychische Störung ohne nähere Angabe" },
  // Z-Codes (Faktoren, die den Gesundheitszustand beeinflussen)
  { code: "Z56", text: "Probleme mit Bezug auf Berufstätigkeit und Arbeitslosigkeit" },
  { code: "Z60", text: "Probleme mit Bezug auf die soziale Umgebung" },
  { code: "Z63", text: "Andere Probleme mit Bezug auf den engeren Familienkreis" },
  { code: "Z73.0", text: "Ausgebranntsein (Burn-out)" },
];

/** Codes eines Eintrags: gespeichert als „F32.1, F41.1“. */
export function icd10Liste(gespeichert: string | null | undefined): string[] {
  return (gespeichert ?? "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}
