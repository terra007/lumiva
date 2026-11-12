import "@/global.css";

export const Colors = {
  light: {
    text: "#1D2330",
    background: "#FBFAF7",
    backgroundElement: "#F1EEE6",
    backgroundSelected: "#E4E1D8",
    textSecondary: "#5B6474",
    akzent: "#D9A441",
    gefahr: "#B42318",
    hinweis: "#92400E",
    // Karten heben sich weiß vom warmen Grund ab, wie in der Web-App.
    flaeche: "#FFFFFF",
    akzentText: "#8A5A00",
    akzentFlaeche: "#F7EBD0",
    // Abzeichen für den Stand eines Termins: Grund und Schrift.
    geplantFlaeche: "#E0F2FE",
    geplantText: "#0C4A6E",
    erledigtFlaeche: "#D1FAE5",
    erledigtText: "#064E3B",
    ausgefallenFlaeche: "#E4E4E7",
    ausgefallenText: "#3F3F46",
    hinweisFlaeche: "#FEF3C7",
    gefahrFlaeche: "#FEE2E2",
  },
  dark: {
    text: "#ECEAE4",
    background: "#12151C",
    backgroundElement: "#1C2029",
    backgroundSelected: "#2A2F3A",
    textSecondary: "#A3AAB6",
    akzent: "#E8B95C",
    gefahr: "#FCA5A5",
    hinweis: "#FCD34D",
    flaeche: "#181C24",
    akzentText: "#F0C978",
    akzentFlaeche: "#3A2F17",
    geplantFlaeche: "#082F49",
    geplantText: "#BAE6FD",
    erledigtFlaeche: "#022C22",
    erledigtText: "#A7F3D0",
    ausgefallenFlaeche: "#27272A",
    ausgefallenText: "#D4D4D8",
    hinweisFlaeche: "#451A03",
    gefahrFlaeche: "#450A0A",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
