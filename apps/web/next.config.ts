import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace-Pakete liefern TypeScript-Quellcode aus.
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
