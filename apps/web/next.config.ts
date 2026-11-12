import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigener Ordner für die Playwright-Tests, damit sie neben einem laufenden `next dev` starten.
  distDir: process.env.LUMIVA_NEXT_DIST || ".next",
  // Workspace-Pakete liefern TypeScript-Quellcode aus.
  // Nur `next dev`: Aufruf vom Handy oder Tablet im selben WLAN (private Adressbereiche).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  transpilePackages: ["@lumiva/api", "@lumiva/db", "@lumiva/domain"],
  // Eingebettetes PostgreSQL bringt WebAssembly-Dateien mit und darf nicht gebündelt werden.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
