import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Ende-zu-Ende-Tests der Web-App. Jeder Lauf startet einen eigenen Server auf Port 3100
 * mit leerer eingebetteter Datenbank (PGlite) in einem temporären Ordner; echte Daten
 * werden nie berührt. Getestet wird der Produktions-Build (`next build` + `next start`),
 * wie er auf dem Server läuft. Start: `pnpm --filter @lumiva/web e2e`.
 */
const PORT = Number(process.env.LUMIVA_E2E_PORT ?? 3100);
const URL = `http://localhost:${PORT}`;
// Playwright lädt die Konfiguration auch in jedem Worker; der Ordner gilt für den ganzen Lauf.
process.env.LUMIVA_E2E_DATEN ??= mkdtempSync(path.join(tmpdir(), "lumiva-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  // Die Abläufe bauen aufeinander auf (Praxis → Patientin → Termin → Honorarnote).
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: URL,
    locale: "de-AT",
    timezoneId: "Europe/Vienna",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: `${URL}/anmelden`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      LUMIVA_DATEN: process.env.LUMIVA_E2E_DATEN,
      LUMIVA_NEXT_DIST: ".next-e2e",
      BETTER_AUTH_URL: URL,
      LUMIVA_URL: URL,
      DATABASE_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
      // Nur für diesen Testlauf erzeugt; Produktion verlangt beide Geheimnisse.
      LUMIVA_HAUPTSCHLUESSEL: randomBytes(32).toString("base64"),
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
      LUMIVA_SUMUP_DEMO: "1",
    },
  },
});
