import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace-Pakete liefern TypeScript-Quellcode aus.
  transpilePackages: ["@lumiva/api", "@lumiva/domain"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
