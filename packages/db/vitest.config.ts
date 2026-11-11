import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite startet ein ganzes PostgreSQL in WebAssembly und spielt alle Migrationen ein.
    // Auf ausgelasteten CI-Runnern dauert das mehr als die Standardgrenze von 5 Sekunden.
    testTimeout: 30_000,
  },
});
