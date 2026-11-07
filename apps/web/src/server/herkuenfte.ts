/** Herkünfte, die die API mit Anmeldung aufrufen dürfen, z. B. die Expo-Webvorschau der App. */
export function herkuenfte(): string[] {
  return (process.env.LUMIVA_HERKUENFTE ?? "http://localhost:8081")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
