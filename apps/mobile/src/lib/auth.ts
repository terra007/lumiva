import { expoClient } from "@better-auth/expo/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiUrl } from "./api-url";

export const authClient = createAuthClient({
  baseURL: apiUrl(),
  // Im Browser übernimmt der Browser die Cookies; am Handy liegen sie verschlüsselt im SecureStore.
  plugins: [
    twoFactorClient(),
    ...(Platform.OS === "web"
      ? []
      : [expoClient({ scheme: "lumiva", storagePrefix: "lumiva", storage: SecureStore })]),
  ],
});

/** Cookie-Kopfzeile für API-Aufrufe aus der nativen App. Im Browser leer. */
export function sitzungsCookie(): string {
  if (Platform.OS === "web") return "";
  const client = authClient as unknown as { getCookie?: () => string };
  return client.getCookie?.() ?? "";
}
