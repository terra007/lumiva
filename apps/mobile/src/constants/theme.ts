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
