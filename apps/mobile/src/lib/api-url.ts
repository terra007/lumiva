import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Adresse des LUMIVA-Servers.
 * - EXPO_PUBLIC_API_URL gewinnt immer (z. B. für den Betrieb).
 * - Web-Vorschau: derselbe Rechner, Port 3000.
 * - Handy mit Expo Go: der Rechner, auf dem Expo läuft (aus hostUri), Port 3000.
 */
export function apiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web") return "http://localhost:3000";
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : "http://localhost:3000";
}
